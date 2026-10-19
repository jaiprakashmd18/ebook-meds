/**
 * Database test harness. Creates a throwaway database, loads the Supabase
 * stub, every migration and the seed, then lets tests run queries as
 * anonymous visitors, specific users or the service role — the same way
 * PostgREST switches roles and JWT claims for each request.
 *
 * Requires a local PostgreSQL. Configure with TEST_DATABASE_URL
 * (default postgres://postgres:postgres@localhost:5432/postgres).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import pg from "pg";

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/postgres";
const root = join(__dirname, "..", "..");

export type Db = {
  pool: pg.Pool;
  dbName: string;
  /** Run fn inside a transaction as the given identity, then roll back. */
  as<T>(who: Identity, fn: (c: pg.PoolClient) => Promise<T>, opts?: { commit?: boolean }): Promise<T>;
  createUser(email?: string, roles?: string[]): Promise<string>;
  close(): Promise<void>;
};

export type Identity = { kind: "anon" } | { kind: "user"; id: string } | { kind: "service" } | { kind: "owner" };

export const anon: Identity = { kind: "anon" };
export const service: Identity = { kind: "service" };
export const owner: Identity = { kind: "owner" };
export const user = (id: string): Identity => ({ kind: "user", id });

export async function setupDb(): Promise<Db> {
  const dbName = `ss_test_${randomUUID().slice(0, 8)}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  const pool = new pg.Pool({ connectionString: url.toString(), max: 4 });

  const files = [
    join(root, "supabase/tests/supabase-stub.sql"),
    ...readdirSync(join(root, "supabase/migrations")).sort().map((f) => join(root, "supabase/migrations", f)),
    join(root, "supabase/seed.sql"),
  ];
  for (const f of files) {
    try {
      await pool.query(readFileSync(f, "utf8"));
    } catch (e) {
      throw new Error(`Failed to apply ${f}: ${(e as Error).message}`);
    }
  }

  const db: Db = {
    pool,
    dbName,
    async as(who, fn, opts) {
      const c = await pool.connect();
      try {
        await c.query("begin");
        if (who.kind === "anon") {
          await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
          await c.query("set local role anon");
        } else if (who.kind === "user") {
          await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: who.id, role: "authenticated" })]);
          await c.query("set local role authenticated");
        } else if (who.kind === "service") {
          await c.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
          await c.query("set local role service_role");
        }
        const out = await fn(c);
        await c.query(opts?.commit ? "commit" : "rollback");
        return out;
      } catch (e) {
        await c.query("rollback").catch(() => {});
        throw e;
      } finally {
        c.release();
      }
    },
    async createUser(email, roles = []) {
      const id = randomUUID();
      await pool.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
        id,
        email ?? `${id}@example.test`,
        JSON.stringify({ display_name: "Test User" }),
      ]);
      for (const r of roles) await pool.query("insert into public.user_roles (user_id, role) values ($1, $2)", [id, r]);
      return id;
    },
    async close() {
      await pool.end();
      const a = new pg.Client({ connectionString: ADMIN_URL });
      await a.connect();
      await a.query(`drop database if exists ${dbName} with (force)`);
      await a.end();
    },
  };
  return db;
}

export const IDS = {
  freeEpithelium: "30000000-0000-4000-8000-000000000001",
  paidGlycolysis: "30000000-0000-4000-8000-000000000003",
  paidRmp: "30000000-0000-4000-8000-000000000004",
  paidBrachial: "30000000-0000-4000-8000-000000000005",
  bundle: "30000000-0000-4000-8000-000000000006",
  plusPlan: "50000000-0000-4000-8000-000000000001",
};

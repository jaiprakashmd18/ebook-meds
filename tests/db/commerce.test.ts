import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IDS, service, setupDb, user, type Db } from "./harness";

let db: Db;
let alice: string;
let bob: string;

async function createOrder(userId: string, product: string, coupon: string | null = null) {
  return db.as(
    user(userId),
    async (c) => (await c.query("select * from public.create_pending_order($1, $2)", [product, coupon])).rows[0],
    { commit: true },
  );
}

async function fulfill(orderId: string, amount: number, currency = "INR", reference: string | null = null) {
  return db.as(
    service,
    async (c) =>
      (await c.query("select public.service_fulfill_order($1, 'dev', $2, 'pay_1', $3, $4) as r", [orderId, reference, amount, currency])).rows[0].r as string,
    { commit: true },
  );
}

const canAccess = (userId: string, item: string) =>
  db.as(user(userId), async (c) => (await c.query("select public.can_access_content($1) as ok", [item])).rows[0].ok as boolean);

beforeAll(async () => {
  db = await setupDb();
  alice = await db.createUser("alice@example.test");
  bob = await db.createUser("bob@example.test");
  await db.pool.query(
    "insert into public.coupons (code, discount_type, discount_value, max_redemptions) values ('WELCOME10', 'percent', 10, 1)",
  );
  await db.pool.query(
    "insert into public.coupons (code, discount_type, discount_value, active) values ('OLDCODE', 'percent', 50, false)",
  );
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("checkout", () => {
  it("prices orders on the server from the catalogue", async () => {
    const order = await createOrder(alice, IDS.paidGlycolysis);
    expect(order.amount_minor_units).toBe(14900);
    expect(order.currency).toBe("INR");
    expect(order.payment_status).toBe("pending");
  });

  it("refuses free, unpublished or unknown products", async () => {
    await expect(createOrder(alice, IDS.freeEpithelium)).rejects.toThrow(/product_unavailable/);
    await expect(createOrder(alice, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/product_unavailable/);
  });

  it("applies valid coupons and rejects inactive ones", async () => {
    const order = await createOrder(bob, IDS.paidRmp, "welcome10");
    expect(order.discount_minor_units).toBe(1290);
    expect(order.amount_minor_units).toBe(11610);
    await expect(createOrder(bob, IDS.paidRmp, "OLDCODE")).rejects.toThrow(/coupon_invalid/);
  });
});

describe("payment fulfilment", () => {
  it("grants access only after verified fulfilment", async () => {
    const order = await createOrder(alice, IDS.paidBrachial);
    expect(await canAccess(alice, IDS.paidBrachial)).toBe(false);
    expect(await fulfill(order.id, 19900)).toBe("fulfilled");
    expect(await canAccess(alice, IDS.paidBrachial)).toBe(true);
    expect(await canAccess(bob, IDS.paidBrachial)).toBe(false);
  });

  it("is idempotent under duplicate webhook delivery", async () => {
    const order = await createOrder(bob, IDS.paidGlycolysis);
    const results = await Promise.all([fulfill(order.id, 14900), fulfill(order.id, 14900), fulfill(order.id, 14900)]);
    expect(results.filter((r) => r === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r === "already_paid")).toHaveLength(2);
    const { rows } = await db.pool.query("select count(*)::int as n from public.purchases where order_id = $1", [order.id]);
    expect(rows[0].n).toBe(1);
  });

  it("rejects payments whose amount or currency does not match", async () => {
    const order = await createOrder(alice, IDS.paidRmp);
    expect(await fulfill(order.id, 100)).toBe("amount_mismatch");
    expect(await fulfill(order.id, 12900, "USD")).toBe("amount_mismatch");
    const { rows } = await db.pool.query("select payment_status from public.orders where id = $1", [order.id]);
    expect(rows[0].payment_status).toBe("pending");
    expect(await canAccess(alice, IDS.paidRmp)).toBe(false);
  });

  it("blocks buying a title the user already owns", async () => {
    await expect(createOrder(alice, IDS.paidBrachial)).rejects.toThrow(/already_owned/);
  });

  it("counts coupon redemptions once and enforces the limit", async () => {
    const pending = await db.pool.query(
      "select o.id, o.amount_minor_units from public.orders o join public.coupons c on c.id = o.coupon_id where c.code = 'WELCOME10' and o.user_id = $1",
      [bob],
    );
    const order = pending.rows[0];
    expect(await fulfill(order.id, order.amount_minor_units)).toBe("fulfilled");
    expect(await fulfill(order.id, order.amount_minor_units)).toBe("already_paid");
    const { rows } = await db.pool.query("select redemption_count from public.coupons where code = 'WELCOME10'");
    expect(rows[0].redemption_count).toBe(1);
    await expect(createOrder(alice, IDS.paidRmp, "WELCOME10")).rejects.toThrow(/coupon_invalid/);
  });

  it("unlocks every title in a purchased bundle", async () => {
    const carol = await db.createUser();
    const order = await createOrder(carol, IDS.bundle);
    expect(await fulfill(order.id, 39900)).toBe("fulfilled");
    for (const id of [IDS.paidGlycolysis, IDS.paidRmp, IDS.paidBrachial]) expect(await canAccess(carol, id)).toBe(true);
  });

  it("lets owners read the paid body through RLS", async () => {
    const rows = await db.as(user(alice), async (c) =>
      (await c.query("select id from public.content_versions where content_item_id = $1", [IDS.paidBrachial])).rows,
    );
    expect(rows).toHaveLength(1);
  });
});

describe("refunds", () => {
  it("keeps access after a partial refund and revokes it after a full refund", async () => {
    const dave = await db.createUser();
    const order = await createOrder(dave, IDS.paidGlycolysis);
    await fulfill(order.id, 14900);
    const refund = (amount: number, ref: string) =>
      db.as(service, async (c) => (await c.query("select public.service_apply_refund($1, $2, 'INR', $3, 'test') as r", [order.id, amount, ref])).rows[0].r, {
        commit: true,
      });
    expect(await refund(4900, "rf_1")).toBe("partially_refunded");
    expect(await canAccess(dave, IDS.paidGlycolysis)).toBe(true);
    expect(await refund(4900, "rf_1")).toBe("already_recorded");
    expect(await refund(20000, "rf_2")).toBe("invalid_amount");
    expect(await refund(10000, "rf_3")).toBe("refunded");
    expect(await canAccess(dave, IDS.paidGlycolysis)).toBe(false);
    const { rows } = await db.pool.query("select payment_status, refunded_minor_units from public.orders where id = $1", [order.id]);
    expect(rows[0]).toEqual({ payment_status: "refunded", refunded_minor_units: 14900 });
  });

  it("reports net sales after refunds in analytics", async () => {
    const admin = await db.createUser(undefined, ["super_admin"]);
    const rows = await db.as(user(admin), async (c) =>
      (await c.query("select * from public.admin_sales_summary(now() - interval '1 day', now() + interval '1 day')")).rows,
    );
    const inr = rows.find((r) => r.currency === "INR");
    expect(Number(inr.net_minor_units)).toBe(Number(inr.gross_minor_units) - Number(inr.refunded_minor_units));
    expect(Number(inr.refunded_minor_units)).toBe(14900);
  });
});

describe("subscriptions", () => {
  it("grants access to eligible items only during the paid period", async () => {
    const erin = await db.createUser();
    const upsert = (status: string, end: string) =>
      db.as(
        service,
        (c) =>
          c.query(
            "select public.service_upsert_subscription($1, 'stripe', 'sub_erin', 'cus_erin', $2, $3::public.subscription_status, $4::timestamptz, false)",
            [erin, IDS.plusPlan, status, end],
          ),
        { commit: true },
      );
    await upsert("active", new Date(Date.now() + 86_400_000).toISOString());
    expect(await canAccess(erin, IDS.paidGlycolysis)).toBe(true);
    // Bundles are never unlocked by subscriptions.
    expect(await canAccess(erin, IDS.bundle)).toBe(false);

    await upsert("active", new Date(Date.now() - 1000).toISOString());
    expect(await canAccess(erin, IDS.paidGlycolysis)).toBe(false);

    await upsert("canceled", new Date(Date.now() + 86_400_000).toISOString());
    expect(await canAccess(erin, IDS.paidGlycolysis)).toBe(false);
    const { rows } = await db.pool.query("select count(*)::int as n from public.subscriptions where user_id = $1", [erin]);
    expect(rows[0].n).toBe(1);
  });
});

describe("administrative grants", () => {
  it("grants and expires explicit access", async () => {
    const frank = await db.createUser();
    const admin = await db.createUser(undefined, ["super_admin"]);
    await db.as(
      user(admin),
      (c) =>
        c.query("insert into public.access_grants (user_id, content_item_id, granted_by, reason, expires_at) values ($1, $2, $3, 'Scholarship', now() + interval '1 day')", [
          frank,
          IDS.paidRmp,
          admin,
        ]),
      { commit: true },
    );
    expect(await canAccess(frank, IDS.paidRmp)).toBe(true);
    await db.pool.query("update public.access_grants set expires_at = now() - interval '1 second' where user_id = $1", [frank]);
    expect(await canAccess(frank, IDS.paidRmp)).toBe(false);
  });

  it("does not let students grant themselves access", async () => {
    await expect(
      db.as(user(bob), (c) =>
        c.query("insert into public.access_grants (user_id, content_item_id, granted_by, reason) values ($1, $2, $1, 'free stuff')", [bob, IDS.paidRmp]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

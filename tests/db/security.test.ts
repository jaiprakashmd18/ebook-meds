import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, IDS, owner, service, setupDb, user, type Db } from "./harness";

let db: Db;
let alice: string;
let bob: string;
let editor: string;
let reviewer: string;
let superAdmin: string;
let draftId: string;

beforeAll(async () => {
  db = await setupDb();
  alice = await db.createUser("alice@example.test");
  bob = await db.createUser("bob@example.test");
  editor = await db.createUser("editor@example.test", ["content_editor"]);
  reviewer = await db.createUser("reviewer@example.test", ["reviewer"]);
  superAdmin = await db.createUser("admin@example.test", ["super_admin"]);
  const { rows } = await db.pool.query(
    `insert into public.content_items (title, slug, description, subject_id, price_minor_units, is_free)
     values ('Secret draft', 'secret-draft', 'draft', '10000000-0000-4000-8000-000000000003', 9900, false) returning id`,
  );
  draftId = rows[0].id;
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe("profiles and roles", () => {
  it("creates a profile automatically on sign-up", async () => {
    const { rows } = await db.pool.query("select display_name from public.profiles where id = $1", [alice]);
    expect(rows[0].display_name).toBe("Test User");
  });

  it("lets a user read only their own profile", async () => {
    const rows = await db.as(user(alice), async (c) => (await c.query("select id from public.profiles")).rows);
    expect(rows.map((r) => r.id)).toEqual([alice]);
  });

  it("prevents users from granting themselves roles", async () => {
    await expect(
      db.as(user(alice), (c) => c.query("insert into public.user_roles (user_id, role) values ($1, 'super_admin')", [alice])),
    ).rejects.toThrow(/row-level security/);
  });

  it("prevents users from changing protected profile columns", async () => {
    await expect(
      db.as(user(alice), (c) => c.query("update public.profiles set created_at = now() - interval '1 year' where id = $1", [alice])),
    ).rejects.toThrow(/permission denied/);
    const updated = await db.as(user(alice), async (c) =>
      (await c.query("update public.profiles set display_name = 'Alice' where id = $1 returning display_name", [alice])).rows,
    );
    expect(updated[0].display_name).toBe("Alice");
  });

  it("does not let one user update another user's profile", async () => {
    const res = await db.as(user(bob), (c) => c.query("update public.profiles set display_name = 'hacked' where id = $1", [alice]));
    expect(res.rowCount).toBe(0);
  });

  it("allows a super admin to grant roles", async () => {
    const res = await db.as(user(superAdmin), (c) =>
      c.query("insert into public.user_roles (user_id, role, granted_by) values ($1, 'reviewer', $2)", [bob, superAdmin]),
    );
    expect(res.rowCount).toBe(1);
  });
});

describe("content visibility", () => {
  it("hides drafts from anonymous visitors and students", async () => {
    for (const who of [anon, user(alice)]) {
      const rows = await db.as(who, async (c) => (await c.query("select id from public.content_items where id = $1", [draftId])).rows);
      expect(rows).toHaveLength(0);
    }
  });

  it("shows drafts to editors and reviewers", async () => {
    for (const who of [user(editor), user(reviewer)]) {
      const rows = await db.as(who, async (c) => (await c.query("select id from public.content_items where id = $1", [draftId])).rows);
      expect(rows).toHaveLength(1);
    }
  });

  it("excludes drafts from search even for staff", async () => {
    const rows = await db.as(user(editor), async (c) => (await c.query("select id from public.search_catalog('secret')")).rows);
    expect(rows).toHaveLength(0);
  });

  it("finds published content by full-text search over tags and subjects", async () => {
    const rows = await db.as(anon, async (c) => (await c.query("select id, total_count from public.search_catalog('nernst equation')")).rows);
    expect(rows.map((r) => r.id)).toContain(IDS.paidRmp);
    const bySubject = await db.as(anon, async (c) => (await c.query("select id from public.search_catalog(null, 'anatomy')")).rows);
    expect(bySubject.map((r) => r.id)).toEqual([IDS.paidBrachial]);
  });

  it("lets anonymous visitors read the body of free published notes only", async () => {
    const free = await db.as(anon, async (c) =>
      (await c.query("select id from public.content_versions where content_item_id = $1", [IDS.freeEpithelium])).rows,
    );
    expect(free).toHaveLength(1);
    const paid = await db.as(anon, async (c) =>
      (await c.query("select id from public.content_versions where content_item_id = $1", [IDS.paidGlycolysis])).rows,
    );
    expect(paid).toHaveLength(0);
  });

  it("hides paid note bodies from signed-in users without access", async () => {
    const rows = await db.as(user(alice), async (c) =>
      (await c.query("select id from public.content_versions where content_item_id = $1", [IDS.paidGlycolysis])).rows,
    );
    expect(rows).toHaveLength(0);
    const access = await db.as(user(alice), async (c) => (await c.query("select public.can_access_content($1) as ok", [IDS.paidGlycolysis])).rows[0].ok);
    expect(access).toBe(false);
  });

  it("does not let students create or edit content", async () => {
    await expect(
      db.as(user(alice), (c) =>
        c.query(
          "insert into public.content_items (title, slug, subject_id) values ('Mine', 'mine', '10000000-0000-4000-8000-000000000001')",
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const res = await db.as(user(alice), (c) => c.query("update public.content_items set title = 'x' where id = $1", [IDS.paidGlycolysis]));
    expect(res.rowCount).toBe(0);
  });

  it("blocks direct publication-status changes, even for editors", async () => {
    await expect(
      db.as(user(editor), (c) => c.query("update public.content_items set publication_status = 'published' where id = $1", [draftId])),
    ).rejects.toThrow(/permission denied/);
  });

  it("enforces the publishing checklist", async () => {
    await expect(
      db.as(user(editor), (c) => c.query("select public.set_publication_status($1, 'published')", [draftId])),
    ).rejects.toThrow(/add content before publishing/);
    await expect(
      db.as(user(reviewer), (c) => c.query("select public.set_publication_status($1, 'published')", [draftId])),
    ).rejects.toThrow(/forbidden/);
    await expect(db.as(user(alice), (c) => c.query("select public.set_publication_status($1, 'review')", [draftId]))).rejects.toThrow(
      /forbidden/,
    );
  });

  it("versions content immutably and publishes a valid item", async () => {
    await db.as(user(editor), async (c) => {
      const v1 = (await c.query("select * from public.create_content_version($1, $2, 'first', 3)", [draftId, { schemaVersion: 1, sections: [] }])).rows[0];
      const v2 = (await c.query("select * from public.create_content_version($1, $2, 'second', 4)", [draftId, { schemaVersion: 1, sections: [] }])).rows[0];
      expect([v1.version_number, v2.version_number]).toEqual([1, 2]);
      await c.query("savepoint s");
      await expect(c.query("update public.content_versions set structured_content = '{}' where id = $1", [v1.id])).rejects.toThrow(
        /permission denied/,
      );
      await c.query("rollback to savepoint s");
      const restored = (await c.query("select * from public.restore_content_version($1)", [v1.id])).rows[0];
      expect(restored.version_number).toBe(3);
      const item = (await c.query("select * from public.set_publication_status($1, 'published')", [draftId])).rows[0];
      expect(item.publication_status).toBe("published");
      expect(item.published_at).not.toBeNull();
    }, { commit: true });
    const { rows } = await db.pool.query("select count(*)::int as n from public.audit_events where resource_id = $1", [draftId]);
    expect(rows[0].n).toBeGreaterThanOrEqual(4);
    // Editors cannot read the audit log; only super admins can.
    const visible = await db.as(user(editor), async (c) => (await c.query("select * from public.audit_events")).rows);
    expect(visible).toHaveLength(0);
  });

  it("requires a verified PDF before publishing a downloadable item", async () => {
    await db.as(user(editor), async (c) => {
      await c.query("update public.content_items set pdf_downloadable = true where id = $1", [draftId]);
      await c.query("select public.create_content_version($1, $2, 'v', 1)", [draftId, { schemaVersion: 1, sections: [] }]);
      await expect(c.query("select public.set_publication_status($1, 'published')", [draftId])).rejects.toThrow(/verified PDF/);
    });
  });
});

describe("learning data isolation", () => {
  it("keeps bookmarks, progress and highlights private to their owner", async () => {
    await db.as(
      user(alice),
      async (c) => {
        await c.query("insert into public.bookmarks (user_id, content_item_id, section_id) values ($1, $2, 'overview')", [alice, IDS.freeEpithelium]);
        await c.query("insert into public.reading_progress (user_id, content_item_id, section_id, completion_percentage) values ($1, $2, 'overview', 20)", [alice, IDS.freeEpithelium]);
        await c.query("insert into public.highlights (user_id, content_item_id, section_id, selected_text, private_note) values ($1, $2, 'overview', 'avascular', 'my secret note')", [alice, IDS.freeEpithelium]);
      },
      { commit: true },
    );
    for (const table of ["bookmarks", "reading_progress", "highlights"]) {
      const bobSees = await db.as(user(bob), async (c) => (await c.query(`select * from public.${table}`)).rows);
      expect(bobSees, table).toHaveLength(0);
      const anonSees = await db.as(anon, async (c) => (await c.query(`select * from public.${table}`)).rows);
      expect(anonSees, table).toHaveLength(0);
      const aliceSees = await db.as(user(alice), async (c) => (await c.query(`select * from public.${table}`)).rows);
      expect(aliceSees.length, table).toBe(1);
    }
  });

  it("prevents writing activity rows on behalf of another user", async () => {
    await expect(
      db.as(user(bob), (c) => c.query("insert into public.bookmarks (user_id, content_item_id, section_id) values ($1, $2, 'x')", [alice, IDS.freeEpithelium])),
    ).rejects.toThrow(/row-level security/);
    const del = await db.as(user(bob), (c) => c.query("delete from public.highlights where user_id = $1", [alice]));
    expect(del.rowCount).toBe(0);
  });

  it("prevents saving progress or highlights on paid content without access", async () => {
    await expect(
      db.as(user(bob), (c) =>
        c.query("insert into public.highlights (user_id, content_item_id, section_id, selected_text) values ($1, $2, 'steps', 'x')", [bob, IDS.paidGlycolysis]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("commerce tables are read-only to clients", () => {
  it("rejects client inserts into orders, purchases and subscriptions", async () => {
    await expect(
      db.as(user(alice), (c) =>
        c.query("insert into public.purchases (user_id, product_id, order_id) values ($1, $2, gen_random_uuid())", [alice, IDS.paidGlycolysis]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(user(alice), (c) =>
        c.query(
          "insert into public.orders (user_id, subtotal_minor_units, amount_minor_units, currency, payment_status, paid_at) values ($1, 100, 100, 'INR', 'paid', now())",
          [alice],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(user(alice), (c) =>
        c.query(
          "insert into public.subscriptions (user_id, provider, provider_subscription_id, status, current_period_end) values ($1, 'stripe', 'sub_x', 'active', now() + interval '1 year')",
          [alice],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let clients call service-only payment functions", async () => {
    for (const who of [anon, user(alice)]) {
      await expect(
        db.as(who, (c) => c.query("select public.service_fulfill_order(gen_random_uuid(), 'stripe', 'x', 'y', 100, 'INR')")),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("hides coupons, payment events and audit logs from students", async () => {
    for (const table of ["coupons", "payment_events", "audit_events", "email_log", "search_queries"]) {
      const rows = await db.as(user(alice), async (c) => (await c.query(`select * from public.${table}`)).rows);
      expect(rows, table).toHaveLength(0);
    }
  });

  it("restricts sales analytics to super admins", async () => {
    await expect(
      db.as(user(editor), (c) => c.query("select * from public.admin_sales_summary(now() - interval '30 days', now())")),
    ).rejects.toThrow(/forbidden/);
    const rows = await db.as(user(superAdmin), async (c) => (await c.query("select * from public.admin_sales_summary(now() - interval '30 days', now())")).rows);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("storage", () => {
  it("does not let visitors or students list or read ebook files", async () => {
    await db.pool.query("insert into storage.objects (bucket_id, name) values ('ebooks', 'item/v1.pdf')");
    for (const who of [anon, user(alice)]) {
      const rows = await db.as(who, async (c) => (await c.query("select name from storage.objects where bucket_id = 'ebooks'")).rows);
      expect(rows).toHaveLength(0);
    }
    const staff = await db.as(user(editor), async (c) => (await c.query("select name from storage.objects where bucket_id = 'ebooks'")).rows);
    expect(staff).toHaveLength(1);
  });

  it("does not let students upload files", async () => {
    await expect(
      db.as(user(alice), (c) => c.query("insert into storage.objects (bucket_id, name) values ('ebooks', 'evil.pdf')")),
    ).rejects.toThrow(/row-level security/);
    await expect(
      db.as(user(alice), (c) => c.query("insert into storage.objects (bucket_id, name) values ('covers', 'evil.png')")),
    ).rejects.toThrow(/row-level security/);
  });

  it("creates private and public buckets as intended", async () => {
    const rows = await db.as(owner, async (c) => (await c.query("select id, public from storage.buckets order by id")).rows);
    expect(rows).toEqual([
      { id: "content-images", public: true },
      { id: "covers", public: true },
      { id: "ebooks", public: false },
    ]);
  });
});

describe("reviews", () => {
  it("only lets eligible readers review, and forces moderation", async () => {
    // Bob has not read or bought the paid title.
    await expect(
      db.as(user(bob), (c) => c.query("insert into public.reviews (user_id, content_item_id, rating) values ($1, $2, 5)", [bob, IDS.paidGlycolysis])),
    ).rejects.toThrow(/row-level security/);
    // Alice read the free note (progress row committed above) and tries to self-approve.
    const row = await db.as(user(alice), async (c) =>
      (
        await c.query(
          "insert into public.reviews (user_id, content_item_id, rating, moderation_status) values ($1, $2, 4, 'approved') returning moderation_status",
          [alice, IDS.freeEpithelium],
        )
      ).rows[0],
    );
    expect(row.moderation_status).toBe("pending");
  });
});

describe("service role", () => {
  it("bypasses RLS for trusted server code", async () => {
    const rows = await db.as(service, async (c) => (await c.query("select id from public.content_items where id = $1", [draftId])).rows);
    expect(rows).toHaveLength(1);
  });
});

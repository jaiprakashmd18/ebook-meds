-- Row Level Security. Every table in the exposed `public` schema has RLS
-- enabled. Policies use `(select ...)` wrappers so helper functions are
-- evaluated once per statement rather than once per row.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.content_items enable row level security;
alter table public.content_versions enable row level security;
alter table public.content_tags enable row level security;
alter table public.bundle_items enable row level security;
alter table public.plans enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.purchases enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;
alter table public.refunds enable row level security;
alter table public.access_grants enable row level security;
alter table public.bookmarks enable row level security;
alter table public.reading_progress enable row level security;
alter table public.section_completions enable row level security;
alter table public.highlights enable row level security;
alter table public.reviews enable row level security;
alter table public.content_reports enable row level security;
alter table public.search_history enable row level security;
alter table public.search_queries enable row level security;
alter table public.content_metrics_daily enable row level security;
alter table public.email_log enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_events enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles and roles
-- ---------------------------------------------------------------------------
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select private.is_super_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Only display fields are client-writable; ids and timestamps are not.
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

create policy "user_roles: read own or super admin" on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "user_roles: super admin insert" on public.user_roles
  for insert to authenticated with check ((select private.is_super_admin()));
create policy "user_roles: super admin delete" on public.user_roles
  for delete to authenticated using ((select private.is_super_admin()));

create policy "notification_preferences: own" on public.notification_preferences
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "account_deletion_requests: own read" on public.account_deletion_requests
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "account_deletion_requests: own create" on public.account_deletion_requests
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'pending');
create policy "account_deletion_requests: super admin update" on public.account_deletion_requests
  for update to authenticated using ((select private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create policy "subjects: public read published" on public.subjects
  for select to anon, authenticated using (published or (select private.is_staff()));
create policy "subjects: editors write" on public.subjects
  for insert to authenticated with check ((select private.can_edit_content()));
create policy "subjects: editors update" on public.subjects
  for update to authenticated using ((select private.can_edit_content()));
create policy "subjects: super admin delete" on public.subjects
  for delete to authenticated using ((select private.is_super_admin()));

create policy "topics: public read" on public.topics
  for select to anon, authenticated using (
    exists (select 1 from public.subjects s where s.id = subject_id and s.published)
    or (select private.is_staff())
  );
create policy "topics: editors insert" on public.topics
  for insert to authenticated with check ((select private.can_edit_content()));
create policy "topics: editors update" on public.topics
  for update to authenticated using ((select private.can_edit_content()));
create policy "topics: editors delete" on public.topics
  for delete to authenticated using ((select private.can_edit_content()));

-- Metadata of published items is public. Note bodies live in
-- content_versions and are NOT readable by anonymous visitors.
create policy "content_items: public read published" on public.content_items
  for select to anon, authenticated using (publication_status = 'published' or (select private.is_staff()));
create policy "content_items: editors insert" on public.content_items
  for insert to authenticated with check ((select private.can_edit_content()));
create policy "content_items: editors update" on public.content_items
  for update to authenticated using ((select private.can_edit_content()))
  with check ((select private.can_edit_content()));
create policy "content_items: super admin delete drafts" on public.content_items
  for delete to authenticated using ((select private.is_super_admin()) and publication_status <> 'published');

-- Publication status changes must go through set_publication_status(), which
-- enforces the publishing checklist.
revoke update on public.content_items from anon, authenticated;
grant update (title, slug, subtitle, description, subject_id, topic_id, content_type, difficulty,
  cover_image, price_minor_units, currency, is_free, subscription_eligible, estimated_reading_minutes,
  author_id, byline, learning_objectives, pdf_downloadable, featured)
  on public.content_items to authenticated;

create policy "content_versions: staff or entitled readers" on public.content_versions
  for select to anon, authenticated using (
    (select private.is_staff())
    or (
      content_versions.id = (select ci.current_version_id from public.content_items ci where ci.id = content_item_id)
      and private.content_access((select auth.uid()), content_item_id)
    )
  );
-- Versions are created through create_content_version(); PDF metadata is
-- written by trusted server code after file verification.
revoke insert, update, delete on public.content_versions from anon, authenticated;

create policy "content_tags: public read" on public.content_tags
  for select to anon, authenticated using (
    exists (select 1 from public.content_items ci where ci.id = content_item_id and ci.publication_status = 'published')
    or (select private.is_staff())
  );
create policy "content_tags: editors insert" on public.content_tags
  for insert to authenticated with check ((select private.can_edit_content()));
create policy "content_tags: editors delete" on public.content_tags
  for delete to authenticated using ((select private.can_edit_content()));

create policy "bundle_items: public read" on public.bundle_items
  for select to anon, authenticated using (
    exists (select 1 from public.content_items ci where ci.id = bundle_id and ci.publication_status = 'published')
    or (select private.is_staff())
  );
create policy "bundle_items: editors insert" on public.bundle_items
  for insert to authenticated with check ((select private.can_edit_content()));
create policy "bundle_items: editors update" on public.bundle_items
  for update to authenticated using ((select private.can_edit_content()));
create policy "bundle_items: editors delete" on public.bundle_items
  for delete to authenticated using ((select private.can_edit_content()));

-- ---------------------------------------------------------------------------
-- Commerce: clients may read their own records; all writes happen through
-- security-definer functions or trusted server code (service role).
-- ---------------------------------------------------------------------------
create policy "plans: public read active" on public.plans
  for select to anon, authenticated using (active or (select private.is_super_admin()));
create policy "plans: super admin insert" on public.plans
  for insert to authenticated with check ((select private.is_super_admin()));
create policy "plans: super admin update" on public.plans
  for update to authenticated using ((select private.is_super_admin()));

create policy "coupons: super admin" on public.coupons
  for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy "orders: own or super admin" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "order_items: own or super admin" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id
            and (o.user_id = (select auth.uid()) or (select private.is_super_admin())))
  );
create policy "purchases: own or super admin" on public.purchases
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "coupon_redemptions: own or super admin" on public.coupon_redemptions
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "subscriptions: own or super admin" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "payment_events: super admin read" on public.payment_events
  for select to authenticated using ((select private.is_super_admin()));
create policy "refunds: own or super admin" on public.refunds
  for select to authenticated using (
    (select private.is_super_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

revoke insert, update, delete on public.orders, public.order_items, public.purchases,
  public.coupon_redemptions, public.subscriptions, public.payment_events, public.refunds
  from anon, authenticated;

create policy "access_grants: own or super admin read" on public.access_grants
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_super_admin()));
create policy "access_grants: super admin insert" on public.access_grants
  for insert to authenticated with check ((select private.is_super_admin()) and granted_by = (select auth.uid()));
create policy "access_grants: super admin update" on public.access_grants
  for update to authenticated using ((select private.is_super_admin()));

-- ---------------------------------------------------------------------------
-- Learning activity: strictly owner-only
-- ---------------------------------------------------------------------------
create policy "bookmarks: own" on public.bookmarks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.content_items ci where ci.id = content_item_id and ci.publication_status = 'published')
  );

create policy "reading_progress: own" on public.reading_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.content_access((select auth.uid()), content_item_id));

create policy "section_completions: own" on public.section_completions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.content_access((select auth.uid()), content_item_id));

create policy "highlights: own" on public.highlights
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.content_access((select auth.uid()), content_item_id));

-- ---------------------------------------------------------------------------
-- Reviews and reports
-- ---------------------------------------------------------------------------
create policy "reviews: public read approved" on public.reviews
  for select to anon, authenticated using (
    moderation_status = 'approved' or user_id = (select auth.uid()) or (select private.can_edit_content())
  );
create policy "reviews: eligible users create own" on public.reviews
  for insert to authenticated with check (
    user_id = (select auth.uid()) and private.can_review((select auth.uid()), content_item_id)
  );
create policy "reviews: own update" on public.reviews
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reviews: moderators update" on public.reviews
  for update to authenticated using ((select private.can_edit_content()));
create policy "reviews: own or moderator delete" on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()) or (select private.can_edit_content()));

create policy "content_reports: create own" on public.content_reports
  for insert to authenticated with check (user_id = (select auth.uid()) and status = 'open');
create policy "content_reports: read own or staff" on public.content_reports
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy "content_reports: staff update" on public.content_reports
  for update to authenticated using ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Search, metrics, email, settings, audit
-- ---------------------------------------------------------------------------
create policy "search_history: own" on public.search_history
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "search_queries: super admin read" on public.search_queries
  for select to authenticated using ((select private.is_super_admin()));
revoke insert, update, delete on public.search_queries from anon, authenticated;

create policy "content_metrics_daily: staff read" on public.content_metrics_daily
  for select to authenticated using ((select private.is_staff()));
revoke insert, update, delete on public.content_metrics_daily from anon, authenticated;

create policy "email_log: super admin read" on public.email_log
  for select to authenticated using ((select private.is_super_admin()));
revoke insert, update, delete on public.email_log from anon, authenticated;

create policy "platform_settings: staff read" on public.platform_settings
  for select to authenticated using ((select private.is_staff()));
create policy "platform_settings: super admin write" on public.platform_settings
  for all to authenticated
  using ((select private.is_super_admin())) with check ((select private.is_super_admin()));

create policy "audit_events: super admin read" on public.audit_events
  for select to authenticated using ((select private.is_super_admin()));
revoke insert, update, delete on public.audit_events from anon, authenticated;

-- StudySimplify core schema
-- Conventions:
--   * UUID primary keys, timestamptz everywhere.
--   * Money is stored as integer minor units with an ISO 4217 currency code.
--   * Content that has ever been sold is archived, never deleted (FK RESTRICT).
--   * User-owned activity rows cascade when the profile is deleted; financial
--     records are kept with user_id set to NULL.

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
-- Supabase already grants this; repeated here so search works on any Postgres.
grant usage on schema extensions to anon, authenticated, service_role;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('super_admin', 'content_editor', 'reviewer');
create type public.content_type as enum (
  'study_note', 'ebook', 'revision_sheet', 'exam_guide', 'topic_summary',
  'question_bank', 'bundle', 'sample_chapter'
);
create type public.difficulty_level as enum ('beginner', 'intermediate', 'advanced');
create type public.publication_status as enum ('draft', 'review', 'published', 'archived');
create type public.order_status as enum (
  'pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded'
);
create type public.access_status as enum ('active', 'revoked', 'refunded');
create type public.subscription_status as enum (
  'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'expired'
);
create type public.moderation_status as enum ('pending', 'approved', 'rejected', 'removed');
create type public.discount_type as enum ('percent', 'fixed');
create type public.report_status as enum ('open', 'in_review', 'resolved', 'rejected');
create type public.report_kind as enum ('inaccuracy', 'unclear', 'typo', 'feedback', 'review_abuse', 'other');
create type public.billing_interval as enum ('month', 'year');
create type public.payment_provider as enum ('stripe', 'razorpay', 'dev', 'coupon');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (char_length(avatar_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  content_updates boolean not null default true,
  product_announcements boolean not null default false,
  search_history_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  reason text check (char_length(reason) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles (id) on delete set null
);
create unique index account_deletion_one_pending
  on public.account_deletion_requests (user_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 2000),
  cover_image text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (subject_id, slug)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subtitle text check (char_length(subtitle) <= 300),
  description text not null default '' check (char_length(description) <= 2000),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  topic_id uuid references public.topics (id) on delete set null,
  content_type public.content_type not null default 'study_note',
  difficulty public.difficulty_level not null default 'beginner',
  cover_image text,
  price_minor_units integer not null default 0 check (price_minor_units >= 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  is_free boolean not null default false,
  subscription_eligible boolean not null default false,
  publication_status public.publication_status not null default 'draft',
  estimated_reading_minutes integer not null default 0 check (estimated_reading_minutes >= 0),
  author_id uuid references public.profiles (id) on delete set null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  byline text check (char_length(byline) <= 200),
  reviewer_name text check (char_length(reviewer_name) <= 200),
  reviewed_at timestamptz,
  learning_objectives text[] not null default '{}',
  current_version_id uuid,
  current_version_number integer,
  pdf_downloadable boolean not null default false,
  pdf_available boolean not null default false,
  featured boolean not null default false,
  search_document tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint content_price_matches_free check (
    (is_free and price_minor_units = 0) or (not is_free and price_minor_units > 0)
  ),
  constraint content_published_has_date check (
    publication_status <> 'published' or published_at is not null
  ),
  constraint content_bundle_not_free check (content_type <> 'bundle' or not is_free)
);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  structured_content jsonb not null,
  pdf_storage_path text,
  pdf_size_bytes bigint check (pdf_size_bytes > 0),
  pdf_page_count integer check (pdf_page_count > 0),
  pdf_checked_at timestamptz,
  change_summary text check (char_length(change_summary) <= 1000),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  unique (content_item_id, version_number),
  -- Version rows are immutable apart from PDF metadata, enforced by trigger.
  constraint version_content_is_object check (jsonb_typeof(structured_content) = 'object')
);

alter table public.content_items
  add constraint content_items_current_version_fk
  foreign key (current_version_id) references public.content_versions (id) on delete set null;

create table public.content_tags (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  tag text not null check (char_length(tag) between 1 and 40 and tag = lower(tag)),
  primary key (content_item_id, tag)
);

create table public.bundle_items (
  bundle_id uuid not null references public.content_items (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete restrict,
  sort_order integer not null default 0,
  primary key (bundle_id, content_item_id),
  check (bundle_id <> content_item_id)
);

-- ---------------------------------------------------------------------------
-- Commerce
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  price_minor_units integer not null check (price_minor_units > 0),
  currency char(3) not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  billing_interval public.billing_interval not null,
  -- {"scope": "subscription_eligible" | "all_premium", "practice_questions": bool}
  entitlements jsonb not null default '{"scope": "subscription_eligible"}'::jsonb,
  provider_price_id text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  discount_type public.discount_type not null,
  discount_value integer not null check (discount_value > 0),
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  max_redemptions integer check (max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupon_percent_range check (discount_type <> 'percent' or discount_value <= 100),
  constraint coupon_fixed_currency check (discount_type <> 'fixed' or currency is not null)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  subtotal_minor_units integer not null check (subtotal_minor_units >= 0),
  discount_minor_units integer not null default 0 check (discount_minor_units >= 0),
  amount_minor_units integer not null check (amount_minor_units >= 0),
  refunded_minor_units integer not null default 0 check (refunded_minor_units >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  payment_status public.order_status not null default 'pending',
  provider public.payment_provider,
  provider_reference text,
  provider_payment_id text,
  coupon_id uuid references public.coupons (id) on delete set null,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint order_amount_math check (amount_minor_units = subtotal_minor_units - discount_minor_units),
  constraint order_refund_le_amount check (refunded_minor_units <= amount_minor_units),
  constraint order_paid_has_date check (
    payment_status not in ('paid', 'refunded', 'partially_refunded') or paid_at is not null
  )
);
create unique index orders_provider_reference_key
  on public.orders (provider, provider_reference) where provider_reference is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.content_items (id) on delete restrict,
  product_title_snapshot text not null,
  unit_price_minor_units integer not null check (unit_price_minor_units >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  unique (order_id, product_id)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.content_items (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  access_status public.access_status not null default 'active',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (order_id, product_id)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  redeemed_at timestamptz not null default now()
);
create unique index coupon_redemptions_once_per_user
  on public.coupon_redemptions (coupon_id, user_id) where user_id is not null;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider public.payment_provider not null,
  provider_subscription_id text not null,
  provider_customer_id text,
  plan_id uuid references public.plans (id) on delete restrict,
  status public.subscription_status not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id)
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider public.payment_provider not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  amount_minor_units integer not null check (amount_minor_units > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  provider_refund_id text unique,
  reason text,
  status text not null default 'succeeded' check (status in ('pending', 'succeeded', 'failed')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Learning activity
-- ---------------------------------------------------------------------------
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  section_id text not null check (char_length(section_id) <= 64),
  created_at timestamptz not null default now(),
  unique (user_id, content_item_id, section_id)
);

create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  section_id text check (char_length(section_id) <= 64),
  scroll_position numeric(5, 4) not null default 0 check (scroll_position between 0 and 1),
  completion_percentage integer not null default 0 check (completion_percentage between 0 and 100),
  last_read_at timestamptz not null default now(),
  unique (user_id, content_item_id)
);

create table public.section_completions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  section_id text not null check (char_length(section_id) <= 64),
  completed_at timestamptz not null default now(),
  primary key (user_id, content_item_id, section_id)
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  content_version_id uuid references public.content_versions (id) on delete set null,
  section_id text not null check (char_length(section_id) <= 64),
  selected_text text not null check (char_length(selected_text) between 1 and 2000),
  prefix text check (char_length(prefix) <= 64),
  suffix text check (char_length(suffix) <= 64),
  private_note text check (char_length(private_note) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  review_text text check (char_length(review_text) <= 3000),
  moderation_status public.moderation_status not null default 'pending',
  moderated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content_item_id)
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete cascade,
  content_version_id uuid references public.content_versions (id) on delete set null,
  section_id text check (char_length(section_id) <= 64),
  kind public.report_kind not null,
  message text not null check (char_length(message) between 5 and 4000),
  difficulty_rating integer check (difficulty_rating between 1 and 5),
  status public.report_status not null default 'open',
  admin_note text check (char_length(admin_note) <= 4000),
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Search, metrics, email, settings, audit
-- ---------------------------------------------------------------------------
create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null check (char_length(query) between 1 and 200),
  created_at timestamptz not null default now()
);

-- Anonymous aggregate of search terms (no user id stored).
create table public.search_queries (
  id bigint generated always as identity primary key,
  query_normalized text not null check (char_length(query_normalized) between 1 and 200),
  result_count integer not null,
  created_at timestamptz not null default now()
);

create table public.content_metrics_daily (
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  day date not null,
  preview_views integer not null default 0,
  reader_opens integer not null default 0,
  product_views integer not null default 0,
  primary key (content_item_id, day)
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  template text not null,
  recipient text not null,
  status text not null check (status in ('sent', 'skipped', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index content_items_status_published_idx on public.content_items (publication_status, published_at desc);
create index content_items_subject_idx on public.content_items (subject_id);
create index content_items_topic_idx on public.content_items (topic_id);
create index content_items_type_idx on public.content_items (content_type);
create index content_items_search_idx on public.content_items using gin (search_document);
create index content_items_title_trgm_idx on public.content_items using gin (title extensions.gin_trgm_ops);
create index content_items_author_idx on public.content_items (author_id);
create index content_items_reviewer_idx on public.content_items (reviewer_id);
create index content_versions_item_idx on public.content_versions (content_item_id, version_number desc);
create index content_versions_created_by_idx on public.content_versions (created_by);
create index content_tags_tag_idx on public.content_tags (tag);
create index bundle_items_item_idx on public.bundle_items (content_item_id);
create index topics_subject_idx on public.topics (subject_id);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (payment_status, created_at desc);
create index orders_coupon_idx on public.orders (coupon_id);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_product_idx on public.order_items (product_id);
create index purchases_user_idx on public.purchases (user_id, access_status);
create index purchases_product_idx on public.purchases (product_id);
create index purchases_order_idx on public.purchases (order_id);
create index subscriptions_user_idx on public.subscriptions (user_id, status);
create index subscriptions_plan_idx on public.subscriptions (plan_id);
create index refunds_order_idx on public.refunds (order_id);
create index access_grants_user_idx on public.access_grants (user_id, content_item_id);
create index access_grants_item_idx on public.access_grants (content_item_id);
create index bookmarks_item_idx on public.bookmarks (content_item_id);
create index reading_progress_user_idx on public.reading_progress (user_id, last_read_at desc);
create index reading_progress_item_idx on public.reading_progress (content_item_id);
create index section_completions_item_idx on public.section_completions (content_item_id);
create index highlights_user_item_idx on public.highlights (user_id, content_item_id);
create index highlights_item_idx on public.highlights (content_item_id);
create index highlights_version_idx on public.highlights (content_version_id);
create index reviews_item_idx on public.reviews (content_item_id, moderation_status);
create index content_reports_status_idx on public.content_reports (status, created_at desc);
create index content_reports_item_idx on public.content_reports (content_item_id);
create index content_reports_review_idx on public.content_reports (review_id);
create index search_history_user_idx on public.search_history (user_id, created_at desc);
create index search_queries_created_idx on public.search_queries (created_at desc);
create index email_log_user_idx on public.email_log (user_id);
create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_resource_idx on public.audit_events (resource_type, resource_id);
create index coupon_redemptions_user_idx on public.coupon_redemptions (user_id);
create index user_roles_granted_by_idx on public.user_roles (granted_by);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create trigger profiles_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger subjects_updated_at before update on public.subjects
  for each row execute function private.set_updated_at();
create trigger content_items_updated_at before update on public.content_items
  for each row execute function private.set_updated_at();
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function private.set_updated_at();
create trigger plans_updated_at before update on public.plans
  for each row execute function private.set_updated_at();
create trigger highlights_updated_at before update on public.highlights
  for each row execute function private.set_updated_at();
create trigger reviews_updated_at before update on public.reviews
  for each row execute function private.set_updated_at();
create trigger content_reports_updated_at before update on public.content_reports
  for each row execute function private.set_updated_at();
create trigger notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

-- Create a profile and default preferences when an auth user signs up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), '')
  )
  on conflict (id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Full-text search document: title and tags weigh most.
create or replace function private.build_search_document(p_item_id uuid)
returns tsvector
language sql
stable
set search_path = ''
as $$
  select
    setweight(to_tsvector('english', coalesce(ci.title, '')), 'A')
    || setweight(to_tsvector('english', coalesce((
         select string_agg(t.tag, ' ') from public.content_tags t where t.content_item_id = ci.id
       ), '')), 'A')
    || setweight(to_tsvector('english', coalesce(ci.subtitle, '') || ' ' || coalesce(ci.description, '')), 'B')
    || setweight(to_tsvector('english', coalesce(s.name, '') || ' ' || coalesce(tp.name, '')), 'B')
    || setweight(to_tsvector('english', coalesce(ci.byline, '') || ' '
         || array_to_string(ci.learning_objectives, ' ')), 'C')
  from public.content_items ci
  left join public.subjects s on s.id = ci.subject_id
  left join public.topics tp on tp.id = ci.topic_id
  where ci.id = p_item_id
$$;

create or replace function private.content_items_search_trigger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_document :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('english', coalesce((
         select string_agg(t.tag, ' ') from public.content_tags t where t.content_item_id = new.id
       ), '')), 'A')
    || setweight(to_tsvector('english', coalesce(new.subtitle, '') || ' ' || coalesce(new.description, '')), 'B')
    || setweight(to_tsvector('english', coalesce((select s.name from public.subjects s where s.id = new.subject_id), '')
         || ' ' || coalesce((select tp.name from public.topics tp where tp.id = new.topic_id), '')), 'B')
    || setweight(to_tsvector('english', coalesce(new.byline, '') || ' '
         || array_to_string(new.learning_objectives, ' ')), 'C');
  return new;
end;
$$;

create trigger content_items_search
  before insert or update of title, subtitle, description, subject_id, topic_id, byline, learning_objectives
  on public.content_items
  for each row execute function private.content_items_search_trigger();

create or replace function private.content_tags_reindex()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.content_item_id, old.content_item_id);
begin
  update public.content_items
     set search_document = private.build_search_document(v_id)
   where id = v_id;
  return null;
end;
$$;

create trigger content_tags_reindex
  after insert or update or delete on public.content_tags
  for each row execute function private.content_tags_reindex();

create or replace function private.subjects_reindex()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    update public.content_items
       set search_document = private.build_search_document(id)
     where subject_id = new.id;
  end if;
  return null;
end;
$$;

create trigger subjects_reindex
  after update of name on public.subjects
  for each row execute function private.subjects_reindex();

-- Content versions are append-only. Only PDF metadata may change afterwards.
create or replace function private.content_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.structured_content is distinct from old.structured_content
     or new.version_number is distinct from old.version_number
     or new.content_item_id is distinct from old.content_item_id then
    raise exception 'content versions are immutable; create a new version instead'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger content_versions_immutable
  before update on public.content_versions
  for each row execute function private.content_versions_immutable();

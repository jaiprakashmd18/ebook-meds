-- Authorization helpers, access resolution, and transactional commerce
-- functions. Helpers live in the `private` schema, which is not exposed
-- through the Data API; public RPCs are thin, explicitly granted wrappers.

-- ---------------------------------------------------------------------------
-- Role helpers (used by RLS policies)
-- ---------------------------------------------------------------------------
create or replace function private.has_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and (ur.role = p_role or ur.role = 'super_admin')
  )
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'super_admin'
  )
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()))
$$;

create or replace function private.can_edit_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('content_editor')
$$;

-- ---------------------------------------------------------------------------
-- Access resolution
-- A user may read the full content of an item when ANY of these hold:
--   1. the item is published and free;
--   2. the user has an active purchase of the item, or of a published
--      bundle that contains it;
--   3. the user has an active subscription (within its paid period) whose
--      plan entitles the item;
--   4. an administrator granted access that is not revoked or expired;
--   5. the user is staff (editors and reviewers need to read drafts).
-- ---------------------------------------------------------------------------
create or replace function private.content_access(p_user uuid, p_item uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item public.content_items%rowtype;
begin
  select * into v_item from public.content_items where id = p_item;
  if not found then
    return false;
  end if;

  if p_user is not null and exists (select 1 from public.user_roles where user_id = p_user) then
    return true;
  end if;

  if v_item.publication_status <> 'published' then
    return false;
  end if;

  if v_item.is_free then
    return true;
  end if;

  if p_user is null then
    return false;
  end if;

  if exists (
    select 1 from public.purchases p
    where p.user_id = p_user and p.access_status = 'active'
      and (
        p.product_id = p_item
        or exists (
          select 1 from public.bundle_items bi
          where bi.bundle_id = p.product_id and bi.content_item_id = p_item
        )
      )
  ) then
    return true;
  end if;

  if exists (
    select 1 from public.access_grants g
    where g.user_id = p_user and g.content_item_id = p_item
      and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
  ) then
    return true;
  end if;

  -- Subscriptions keep access until the end of the paid period, including
  -- while a renewal payment is being retried (past_due).
  if exists (
    select 1
    from public.subscriptions s
    join public.plans pl on pl.id = s.plan_id
    where s.user_id = p_user
      and s.status in ('active', 'trialing', 'past_due')
      and s.current_period_end is not null and s.current_period_end > now()
      and (
        (pl.entitlements ->> 'scope' = 'subscription_eligible' and v_item.subscription_eligible)
        or (pl.entitlements ->> 'scope' = 'all_premium' and v_item.content_type <> 'bundle')
      )
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- Public wrapper: always evaluates for the calling user.
create or replace function public.can_access_content(p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.content_access((select auth.uid()), p_item)
$$;

-- Server-side wrapper for trusted code running with the service role.
create or replace function public.service_content_access(p_user uuid, p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.content_access(p_user, p_item)
$$;

-- Owns the item outright (purchase), used to block duplicate purchases.
create or replace function private.owns_product(p_user uuid, p_product uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.purchases
    where user_id = p_user and product_id = p_product and access_status = 'active'
  )
$$;

-- ---------------------------------------------------------------------------
-- Audit logging
-- ---------------------------------------------------------------------------
create or replace function private.audit(
  p_actor uuid, p_action text, p_resource_type text, p_resource_id text, p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_events (actor_id, action, resource_type, resource_id, metadata)
  values (p_actor, p_action, p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb))
$$;

create or replace function public.log_audit_event(
  p_action text, p_resource_type text, p_resource_id text, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform private.audit((select auth.uid()), p_action, p_resource_type, p_resource_id, p_metadata);
end;
$$;

-- ---------------------------------------------------------------------------
-- Content versioning and publishing
-- ---------------------------------------------------------------------------
create or replace function public.create_content_version(
  p_item uuid, p_content jsonb, p_change_summary text, p_reading_minutes integer default null
)
returns public.content_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
  v_row public.content_versions;
begin
  if not private.can_edit_content() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_content) <> 'object' or (p_content ->> 'schemaVersion') is null then
    raise exception 'invalid structured content' using errcode = '22023';
  end if;

  -- Lock the item so concurrent saves get distinct version numbers.
  perform 1 from public.content_items where id = p_item for update;
  if not found then
    raise exception 'content item not found' using errcode = 'P0002';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.content_versions where content_item_id = p_item;

  insert into public.content_versions (content_item_id, version_number, structured_content, change_summary, created_by)
  values (p_item, v_next, p_content, nullif(trim(p_change_summary), ''), (select auth.uid()))
  returning * into v_row;

  update public.content_items
     set current_version_id = v_row.id,
         current_version_number = v_row.version_number,
         -- A new version has no verified PDF until one is generated or uploaded.
         pdf_available = false,
         estimated_reading_minutes = coalesce(p_reading_minutes, estimated_reading_minutes)
   where id = p_item;

  perform private.audit((select auth.uid()), 'content.version_created', 'content_item', p_item::text,
    jsonb_build_object('version_number', v_next, 'change_summary', p_change_summary));
  return v_row;
end;
$$;

-- Restoring creates a new version that copies an earlier one, so history is
-- never rewritten.
create or replace function public.restore_content_version(p_version uuid)
returns public.content_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.content_versions;
begin
  if not private.can_edit_content() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_old from public.content_versions where id = p_version;
  if not found then
    raise exception 'version not found' using errcode = 'P0002';
  end if;
  return public.create_content_version(
    v_old.content_item_id, v_old.structured_content,
    format('Restored from version %s', v_old.version_number), null
  );
end;
$$;

create or replace function public.set_publication_status(p_item uuid, p_status public.publication_status)
returns public.content_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_version public.content_versions;
begin
  select * into v_item from public.content_items where id = p_item for update;
  if not found then
    raise exception 'content item not found' using errcode = 'P0002';
  end if;

  -- Reviewers may only move items between draft and review.
  if p_status in ('published', 'archived') and not private.can_edit_content() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status in ('draft', 'review') and not private.has_role('reviewer') and not private.can_edit_content() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_status = 'published' then
    if v_item.content_type = 'bundle' then
      if not exists (select 1 from public.bundle_items where bundle_id = p_item) then
        raise exception 'a bundle needs at least one item before publishing' using errcode = '23514';
      end if;
    else
      if v_item.current_version_id is null then
        raise exception 'add content before publishing' using errcode = '23514';
      end if;
      select * into v_version from public.content_versions where id = v_item.current_version_id;
      if v_item.pdf_downloadable and (v_version.pdf_storage_path is null or v_version.pdf_checked_at is null) then
        raise exception 'downloadable items need a verified PDF for the current version' using errcode = '23514';
      end if;
    end if;
  end if;

  update public.content_items
     set publication_status = p_status,
         published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end
   where id = p_item
   returning * into v_item;

  perform private.audit((select auth.uid()), 'content.status_changed', 'content_item', p_item::text,
    jsonb_build_object('status', p_status));
  return v_item;
end;
$$;

create or replace function public.mark_content_reviewed(p_item uuid, p_reviewer_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('reviewer') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.content_items
     set reviewer_id = (select auth.uid()),
         reviewer_name = nullif(left(trim(p_reviewer_name), 200), ''),
         reviewed_at = now()
   where id = p_item;
  if not found then
    raise exception 'content item not found' using errcode = 'P0002';
  end if;
  perform private.audit((select auth.uid()), 'content.reviewed', 'content_item', p_item::text, '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkout: create a pending order with a server-computed price
-- ---------------------------------------------------------------------------
create or replace function public.create_pending_order(p_product uuid, p_coupon_code text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_item public.content_items;
  v_coupon public.coupons;
  v_discount integer := 0;
  v_order public.orders;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_item from public.content_items
  where id = p_product and publication_status = 'published';
  if not found or v_item.is_free then
    raise exception 'product_unavailable' using errcode = 'P0002';
  end if;

  if private.owns_product(v_user, p_product) then
    raise exception 'already_owned' using errcode = '23505';
  end if;

  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select * into v_coupon from public.coupons
    where code = upper(trim(p_coupon_code))
    for update;
    if not found
       or not v_coupon.active
       or (v_coupon.expires_at is not null and v_coupon.expires_at <= now())
       or (v_coupon.max_redemptions is not null and v_coupon.redemption_count >= v_coupon.max_redemptions)
       or (v_coupon.discount_type = 'fixed' and v_coupon.currency <> v_item.currency) then
      raise exception 'coupon_invalid' using errcode = '22023';
    end if;
    if exists (select 1 from public.coupon_redemptions where coupon_id = v_coupon.id and user_id = v_user) then
      raise exception 'coupon_already_used' using errcode = '22023';
    end if;
    if v_coupon.discount_type = 'percent' then
      v_discount := floor(v_item.price_minor_units::numeric * v_coupon.discount_value / 100)::integer;
    else
      v_discount := least(v_coupon.discount_value, v_item.price_minor_units);
    end if;
  end if;

  insert into public.orders (user_id, subtotal_minor_units, discount_minor_units, amount_minor_units, currency, coupon_id)
  values (v_user, v_item.price_minor_units, v_discount, v_item.price_minor_units - v_discount, v_item.currency, v_coupon.id)
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_title_snapshot, unit_price_minor_units, currency)
  values (v_order.id, v_item.id, v_item.title, v_item.price_minor_units, v_item.currency);

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment processing (service role only)
-- ---------------------------------------------------------------------------

-- Attach the provider's checkout reference to a pending order.
create or replace function public.service_attach_provider(
  p_order uuid, p_provider public.payment_provider, p_reference text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
     set provider = p_provider, provider_reference = p_reference
   where id = p_order and payment_status = 'pending';
  if not found then
    raise exception 'order_not_pending' using errcode = 'P0002';
  end if;
end;
$$;

-- Mark an order paid and create entitlements. Idempotent and serialised by a
-- row lock, so duplicate webhook deliveries cannot create duplicate access.
create or replace function public.service_fulfill_order(
  p_order uuid,
  p_provider public.payment_provider,
  p_provider_reference text,
  p_provider_payment_id text,
  p_amount_minor_units integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    return 'order_not_found';
  end if;

  if v_order.payment_status in ('paid', 'refunded', 'partially_refunded') then
    return 'already_paid';
  end if;

  if v_order.provider is not null and v_order.provider <> p_provider then
    return 'provider_mismatch';
  end if;
  if v_order.provider_reference is not null and p_provider_reference is not null
     and v_order.provider_reference <> p_provider_reference then
    return 'reference_mismatch';
  end if;
  if v_order.amount_minor_units <> p_amount_minor_units or v_order.currency <> upper(p_currency) then
    update public.orders
       set failure_reason = format('amount mismatch: expected %s %s, received %s %s',
             v_order.amount_minor_units, v_order.currency, p_amount_minor_units, upper(p_currency))
     where id = p_order;
    return 'amount_mismatch';
  end if;
  if v_order.user_id is null then
    return 'order_has_no_user';
  end if;

  update public.orders
     set payment_status = 'paid',
         paid_at = now(),
         provider = p_provider,
         provider_reference = coalesce(provider_reference, p_provider_reference),
         provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
         failure_reason = null
   where id = p_order;

  insert into public.purchases (user_id, product_id, order_id)
  select v_order.user_id, oi.product_id, v_order.id
  from public.order_items oi where oi.order_id = v_order.id
  on conflict (order_id, product_id) do nothing;

  if v_order.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id)
    values (v_order.coupon_id, v_order.user_id, v_order.id)
    on conflict do nothing;
    if found then
      update public.coupons set redemption_count = redemption_count + 1 where id = v_order.coupon_id;
    end if;
  end if;

  perform private.audit(null, 'order.paid', 'order', p_order::text,
    jsonb_build_object('provider', p_provider, 'amount', p_amount_minor_units, 'currency', upper(p_currency)));
  return 'fulfilled';
end;
$$;

create or replace function public.service_mark_order_unpaid(
  p_order uuid, p_status public.order_status, p_reason text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('failed', 'cancelled') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  update public.orders
     set payment_status = p_status, failure_reason = left(p_reason, 500)
   where id = p_order and payment_status = 'pending';
  return case when found then 'updated' else 'ignored' end;
end;
$$;

-- Record a refund. Full refunds revoke the entitlements created by the
-- order; partial refunds keep access (see the published refund policy).
create or replace function public.service_apply_refund(
  p_order uuid,
  p_amount_minor_units integer,
  p_currency text,
  p_provider_refund_id text,
  p_reason text,
  p_actor uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_total integer;
begin
  select * into v_order from public.orders where id = p_order for update;
  if not found then
    return 'order_not_found';
  end if;
  if v_order.payment_status not in ('paid', 'partially_refunded', 'refunded') then
    return 'order_not_paid';
  end if;
  if upper(p_currency) <> v_order.currency then
    return 'currency_mismatch';
  end if;
  if p_provider_refund_id is not null
     and exists (select 1 from public.refunds where provider_refund_id = p_provider_refund_id) then
    return 'already_recorded';
  end if;

  v_total := v_order.refunded_minor_units + p_amount_minor_units;
  if p_amount_minor_units <= 0 or v_total > v_order.amount_minor_units then
    return 'invalid_amount';
  end if;

  insert into public.refunds (order_id, amount_minor_units, currency, provider_refund_id, reason, created_by)
  values (p_order, p_amount_minor_units, v_order.currency, p_provider_refund_id, p_reason, p_actor);

  update public.orders
     set refunded_minor_units = v_total,
         payment_status = case when v_total >= amount_minor_units then 'refunded'::public.order_status
                               else 'partially_refunded'::public.order_status end
   where id = p_order;

  if v_total >= v_order.amount_minor_units then
    update public.purchases
       set access_status = 'refunded', revoked_at = now()
     where order_id = p_order and access_status = 'active';
  end if;

  perform private.audit(p_actor, 'order.refunded', 'order', p_order::text,
    jsonb_build_object('amount', p_amount_minor_units, 'total_refunded', v_total));
  return case when v_total >= v_order.amount_minor_units then 'refunded' else 'partially_refunded' end;
end;
$$;

create or replace function public.service_upsert_subscription(
  p_user uuid,
  p_provider public.payment_provider,
  p_provider_subscription_id text,
  p_provider_customer_id text,
  p_plan uuid,
  p_status public.subscription_status,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.subscriptions;
begin
  insert into public.subscriptions (
    user_id, provider, provider_subscription_id, provider_customer_id, plan_id,
    status, current_period_end, cancel_at_period_end
  )
  values (
    p_user, p_provider, p_provider_subscription_id, p_provider_customer_id, p_plan,
    p_status, p_current_period_end, coalesce(p_cancel_at_period_end, false)
  )
  on conflict (provider, provider_subscription_id) do update
    set status = excluded.status,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end,
        plan_id = coalesce(excluded.plan_id, public.subscriptions.plan_id),
        provider_customer_id = coalesce(excluded.provider_customer_id, public.subscriptions.provider_customer_id)
  returning * into v_row;
  perform private.audit(null, 'subscription.updated', 'subscription', v_row.id::text,
    jsonb_build_object('status', p_status));
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews: only users who own or have read the item may review it
-- ---------------------------------------------------------------------------
create or replace function private.can_review(p_user uuid, p_item uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.content_items ci
    where ci.id = p_item and ci.publication_status = 'published'
      and (
        exists (
          select 1 from public.purchases p
          where p.user_id = p_user and p.access_status = 'active'
            and (p.product_id = p_item
                 or exists (select 1 from public.bundle_items bi
                            where bi.bundle_id = p.product_id and bi.content_item_id = p_item))
        )
        or (ci.is_free and exists (
          select 1 from public.reading_progress rp where rp.user_id = p_user and rp.content_item_id = p_item
        ))
      )
  )
$$;

-- Non-moderators cannot change moderation fields on their own reviews; any
-- edit sends the review back to the moderation queue.
create or replace function private.reviews_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.can_edit_content() then
    if tg_op = 'UPDATE' and new.moderation_status is distinct from old.moderation_status then
      new.moderated_by := (select auth.uid());
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.content_item_id := old.content_item_id;
  end if;
  new.moderation_status := 'pending';
  new.moderated_by := null;
  return new;
end;
$$;

create trigger reviews_guard
  before insert or update on public.reviews
  for each row execute function private.reviews_guard();

create or replace view public.content_ratings
with (security_invoker = true) as
  select content_item_id,
         round(avg(rating)::numeric, 2) as rating_average,
         count(*)::integer as rating_count
  from public.reviews
  where moderation_status = 'approved'
  group by content_item_id;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------
create or replace function public.search_catalog(
  p_query text default null,
  p_subject text default null,
  p_topic text default null,
  p_difficulty public.difficulty_level default null,
  p_type public.content_type default null,
  p_price text default null,
  p_published_after timestamptz default null,
  p_sort text default 'relevance',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (id uuid, rank real, total_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select case when coalesce(trim(p_query), '') = '' then null
                else websearch_to_tsquery('english', left(p_query, 200)) end as tsq,
           nullif(trim(p_query), '') as raw
  ),
  matches as (
    select ci.id,
           case when q.tsq is null then 0::real else ts_rank(ci.search_document, q.tsq) end as rank,
           ci.published_at, ci.price_minor_units, ci.title
    from public.content_items ci
    cross join q
    join public.subjects s on s.id = ci.subject_id
    left join public.topics t on t.id = ci.topic_id
    where ci.publication_status = 'published'
      and s.published
      and (q.raw is null or ci.search_document @@ q.tsq or ci.title operator(extensions.%) q.raw
           or ci.title ilike '%' || replace(replace(q.raw, '%', ''), '_', '') || '%')
      and (p_subject is null or s.slug = p_subject)
      and (p_topic is null or t.slug = p_topic)
      and (p_difficulty is null or ci.difficulty = p_difficulty)
      and (p_type is null or ci.content_type = p_type)
      and (p_price is null or (p_price = 'free' and ci.is_free) or (p_price = 'paid' and not ci.is_free))
      and (p_published_after is null or ci.published_at >= p_published_after)
  )
  select m.id, m.rank, count(*) over () as total_count
  from matches m
  order by
    case when p_sort = 'relevance' then m.rank end desc nulls last,
    case when p_sort = 'oldest' then m.published_at end asc,
    case when p_sort = 'price_asc' then m.price_minor_units end asc,
    case when p_sort = 'price_desc' then m.price_minor_units end desc,
    case when p_sort = 'title' then m.title end asc,
    m.published_at desc,
    m.id
  limit least(greatest(p_limit, 1), 50)
  offset greatest(p_offset, 0)
$$;

create or replace function public.search_suggestions(p_prefix text)
returns table (title text, slug text)
language sql
stable
security invoker
set search_path = ''
as $$
  select ci.title, ci.slug
  from public.content_items ci
  where ci.publication_status = 'published'
    and length(trim(p_prefix)) >= 2
    and (ci.title ilike '%' || replace(replace(trim(p_prefix), '%', ''), '_', '') || '%'
         or ci.title operator(extensions.%) trim(p_prefix))
  order by extensions.similarity(ci.title, trim(p_prefix)) desc, ci.title
  limit 6
$$;

-- Privacy-preserving search term aggregate: stores no user id.
create or replace function public.record_search_query(p_query text, p_result_count integer)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.search_queries (query_normalized, result_count)
  select left(lower(regexp_replace(trim(p_query), '\s+', ' ', 'g')), 200), greatest(p_result_count, 0)
  where length(trim(coalesce(p_query, ''))) between 1 and 200
$$;

-- Aggregate counters only; no per-user tracking.
create or replace function public.record_content_metric(p_item uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind not in ('preview_views', 'reader_opens', 'product_views') then
    raise exception 'invalid metric' using errcode = '22023';
  end if;
  if not exists (select 1 from public.content_items where id = p_item and publication_status = 'published') then
    return;
  end if;
  insert into public.content_metrics_daily (content_item_id, day, preview_views, reader_opens, product_views)
  values (
    p_item, current_date,
    (p_kind = 'preview_views')::integer, (p_kind = 'reader_opens')::integer, (p_kind = 'product_views')::integer
  )
  on conflict (content_item_id, day) do update
    set preview_views = public.content_metrics_daily.preview_views + excluded.preview_views,
        reader_opens = public.content_metrics_daily.reader_opens + excluded.reader_opens,
        product_views = public.content_metrics_daily.product_views + excluded.product_views;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin analytics (super admins only). Amounts are grouped by currency.
-- ---------------------------------------------------------------------------
create or replace function public.admin_sales_summary(p_from timestamptz, p_to timestamptz)
returns table (
  currency char(3),
  paid_orders bigint,
  pending_orders bigint,
  failed_orders bigint,
  gross_minor_units bigint,
  refunded_minor_units bigint,
  net_minor_units bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select o.currency,
         count(*) filter (where o.payment_status in ('paid', 'refunded', 'partially_refunded')),
         count(*) filter (where o.payment_status = 'pending'),
         count(*) filter (where o.payment_status in ('failed', 'cancelled')),
         coalesce(sum(o.amount_minor_units) filter (where o.payment_status in ('paid', 'refunded', 'partially_refunded')), 0)::bigint,
         coalesce(sum(o.refunded_minor_units), 0)::bigint,
         (coalesce(sum(o.amount_minor_units) filter (where o.payment_status in ('paid', 'refunded', 'partially_refunded')), 0)
           - coalesce(sum(o.refunded_minor_units), 0))::bigint
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
  group by o.currency;
end;
$$;

create or replace function public.admin_daily_sales(p_from timestamptz, p_to timestamptz, p_currency text)
returns table (day date, paid_orders bigint, gross_minor_units bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
  select d::date,
         count(o.id),
         coalesce(sum(o.amount_minor_units), 0)::bigint
  from generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 second'), interval '1 day') d
  left join public.orders o
    on date_trunc('day', o.paid_at) = d
   and o.payment_status in ('paid', 'refunded', 'partially_refunded')
   and o.currency = upper(p_currency)
  group by d
  order by d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
-- RLS policies evaluated for anonymous visitors call these helpers, so the API
-- roles need EXECUTE. They remain unreachable as RPCs because the `private`
-- schema is not exposed through the Data API.
revoke all on all functions in schema private from public;
grant usage on schema private to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

revoke execute on function public.service_content_access(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.service_attach_provider(uuid, public.payment_provider, text) from public, anon, authenticated;
revoke execute on function public.service_fulfill_order(uuid, public.payment_provider, text, text, integer, text) from public, anon, authenticated;
revoke execute on function public.service_mark_order_unpaid(uuid, public.order_status, text) from public, anon, authenticated;
revoke execute on function public.service_apply_refund(uuid, integer, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.service_upsert_subscription(uuid, public.payment_provider, text, text, uuid, public.subscription_status, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.service_content_access(uuid, uuid) to service_role;
grant execute on function public.service_attach_provider(uuid, public.payment_provider, text) to service_role;
grant execute on function public.service_fulfill_order(uuid, public.payment_provider, text, text, integer, text) to service_role;
grant execute on function public.service_mark_order_unpaid(uuid, public.order_status, text) to service_role;
grant execute on function public.service_apply_refund(uuid, integer, text, text, text, uuid) to service_role;
grant execute on function public.service_upsert_subscription(uuid, public.payment_provider, text, text, uuid, public.subscription_status, timestamptz, boolean) to service_role;

revoke execute on function public.create_pending_order(uuid, text) from public, anon;
grant execute on function public.create_pending_order(uuid, text) to authenticated;
revoke execute on function public.create_content_version(uuid, jsonb, text, integer) from public, anon;
revoke execute on function public.restore_content_version(uuid) from public, anon;
revoke execute on function public.set_publication_status(uuid, public.publication_status) from public, anon;
revoke execute on function public.mark_content_reviewed(uuid, text) from public, anon;
revoke execute on function public.log_audit_event(text, text, text, jsonb) from public, anon;
revoke execute on function public.admin_sales_summary(timestamptz, timestamptz) from public, anon;
revoke execute on function public.admin_daily_sales(timestamptz, timestamptz, text) from public, anon;

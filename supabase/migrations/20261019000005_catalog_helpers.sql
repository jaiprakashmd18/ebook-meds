-- Aggregate-only popularity ranking for the public homepage. Returns item ids
-- ranked by active purchases and reader opens in the last 30 days; exposes no
-- per-user information.
create or replace function public.popular_content(p_limit integer default 4)
returns table (id uuid, score bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with purchases as (
    select p.product_id as id, count(*) * 5 as score
    from public.purchases p
    where p.access_status = 'active' and p.created_at > now() - interval '30 days'
    group by p.product_id
  ),
  opens as (
    select m.content_item_id as id, sum(m.reader_opens + m.preview_views) as score
    from public.content_metrics_daily m
    where m.day > current_date - 30
    group by m.content_item_id
  ),
  combined as (
    select id, sum(score)::bigint as score from (
      select * from purchases union all select * from opens
    ) s group by id
  )
  select c.id, c.score
  from combined c
  join public.content_items ci on ci.id = c.id
  where ci.publication_status = 'published' and ci.content_type <> 'bundle' and c.score > 0
  order by c.score desc
  limit least(greatest(p_limit, 1), 12)
$$;

grant execute on function public.popular_content(integer) to anon, authenticated;

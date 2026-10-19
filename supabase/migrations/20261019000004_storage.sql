-- Storage buckets and policies.
--   covers          public  – product cover images (read via public URL only)
--   content-images  public  – images embedded in notes
--   ebooks          private – downloadable PDFs; delivered only through
--                              short-lived signed URLs created by the server
--                              after an access check.
-- No SELECT policy is granted to anon/authenticated on any bucket, so
-- visitors cannot list or enumerate objects through the Storage API.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('content-images', 'content-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('ebooks', 'ebooks', false, 104857600, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "storage: editors upload public assets" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('covers', 'content-images') and (select private.can_edit_content()));
create policy "storage: editors update public assets" on storage.objects
  for update to authenticated
  using (bucket_id in ('covers', 'content-images') and (select private.can_edit_content()));
create policy "storage: editors delete public assets" on storage.objects
  for delete to authenticated
  using (bucket_id in ('covers', 'content-images') and (select private.can_edit_content()));

-- Staff may manage ebook files. Students never read this bucket directly.
create policy "storage: staff read ebooks" on storage.objects
  for select to authenticated
  using (bucket_id = 'ebooks' and (select private.is_staff()));
create policy "storage: editors upload ebooks" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'ebooks' and (select private.can_edit_content()));
create policy "storage: editors update ebooks" on storage.objects
  for update to authenticated
  using (bucket_id = 'ebooks' and (select private.can_edit_content()));
create policy "storage: editors delete ebooks" on storage.objects
  for delete to authenticated
  using (bucket_id = 'ebooks' and (select private.can_edit_content()));

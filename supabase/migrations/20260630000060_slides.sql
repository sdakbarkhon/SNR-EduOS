-- =====================================================================
-- Migration 60: presentation slides for theory stages + slide-images bucket
-- =====================================================================

-- Слайды презентации для этапа теории.
-- Формат: [{ "title", "content", "image_url"?, "image_prompt"? }, ...]
alter table public.lesson_stages
  add column if not exists slides jsonb;

comment on column public.lesson_stages.slides is
  'Слайды презентации (этап теории). Формат: [{ title, content, image_url?, image_prompt? }, ...]';

-- Storage bucket для картинок слайдов (public — рендерятся по public URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'slide-images', 'slide-images', true, 10485760,
  array['image/png','image/jpeg','image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS
drop policy if exists "authenticated reads slide-images" on storage.objects;
drop policy if exists "teacher uploads slide-images"     on storage.objects;

create policy "authenticated reads slide-images"
  on storage.objects for select to authenticated
  using (bucket_id = 'slide-images');

create policy "teacher uploads slide-images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'slide-images'
    and exists (select 1 from public.teachers where user_id = auth.uid())
  );

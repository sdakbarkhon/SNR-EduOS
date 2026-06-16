-- Профиль: дни расписания в группах + бакет аватаров

-- 1. Дни занятий — текстовая колонка на группе
alter table public.groups add column schedule_days text not null default '';

-- 2. Storage bucket для аватаров (public = false, signed URL для чтения)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Ученик читает только свой файл avatars/<student_id>/*
create policy "student reads own avatar"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_student_id()::text
  );

-- Ученик загружает только в свою папку
create policy "student uploads own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_student_id()::text
  );

-- Ученик может обновить только свой аватар
create policy "student updates own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_student_id()::text
  );

-- Ученик может удалить только свой аватар
create policy "student deletes own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = public.current_student_id()::text
  );

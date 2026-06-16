-- Storage-бакеты и политики. Путь файла кодирует владельца/группу:
--   homework-submissions/<student_id>/...   — папка ученика
--   course-materials/<group_id>/...         — папка группы

insert into storage.buckets (id, name, public)
values
  ('homework-submissions', 'homework-submissions', false),
  ('course-materials',     'course-materials',     false)
on conflict (id) do nothing;

-- homework-submissions: ученик читает/пишет только свою папку <student_id>/...
create policy "student reads own submission files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'homework-submissions'
    and (storage.foldername(name))[1] = public.current_student_id()::text
  );

create policy "student uploads own submission files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'homework-submissions'
    and (storage.foldername(name))[1] = public.current_student_id()::text
  );

create policy "student updates own submission files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'homework-submissions'
    and (storage.foldername(name))[1] = public.current_student_id()::text
  );

-- course-materials: ученик читает материалы только своих групп (<group_id>/...).
-- Соглашение: первый сегмент пути ОБЯЗАН быть валидным group_id (uuid).
create policy "student reads own group materials"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'course-materials'
    and public.is_my_group(((storage.foldername(name))[1])::uuid)
  );

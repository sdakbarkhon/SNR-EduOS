-- Посещаемость. Одна запись на (ученик, урок).
create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  lesson_id   uuid not null references public.lessons(id) on delete cascade,
  status      public.attendance_status not null,
  recorded_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
create index on public.attendance (student_id);

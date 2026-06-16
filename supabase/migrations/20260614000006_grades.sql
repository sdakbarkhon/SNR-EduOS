-- Оценки (read-only для ученика).
create table public.grades (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  group_id   uuid references public.groups(id) on delete set null,
  lesson_id  uuid references public.lessons(id) on delete set null,
  subject    text,                          -- денормализованный ключ предмета для отображения
  score      numeric(5,2) not null,
  work_type  text,                          -- "контрольная", "дз", "практика", ...
  comment    text,
  graded_at  timestamptz not null default now()
);
create index on public.grades (student_id, graded_at);

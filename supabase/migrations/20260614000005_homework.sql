-- Домашние задания и сдачи учеников.
create table public.homework (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  lesson_id   uuid references public.lessons(id) on delete set null,
  title       text not null,
  description text,
  due_date    timestamptz,
  attachments jsonb not null default '[]'::jsonb,  -- [{ "name": ..., "url": ... }]
  created_at  timestamptz not null default now()
);
create index on public.homework (group_id);

-- Сдача ДЗ — единственная доменная таблица, в которую ученик ПИШЕТ.
create table public.homework_submissions (
  id              uuid primary key default gen_random_uuid(),
  homework_id     uuid not null references public.homework(id) on delete cascade,
  student_id      uuid not null references public.students(id) on delete cascade,
  submitted_at    timestamptz not null default now(),
  file_url        text,
  answer_text     text,
  grade           numeric(5,2),
  teacher_comment text,
  status          public.submission_status not null default 'submitted',
  unique (homework_id, student_id)
);
create index on public.homework_submissions (student_id);

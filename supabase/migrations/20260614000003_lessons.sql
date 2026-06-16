-- Уроки (расписание). Преподаватель берётся из groups.teacher_id.
create table public.lessons (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups(id) on delete cascade,
  lesson_no      int,                       -- "Урок 12"
  topic          text,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  room           text,
  online_url     text,
  materials_link text,
  status         public.lesson_status not null default 'scheduled',
  created_at     timestamptz not null default now()
);
create index on public.lessons (group_id, starts_at);

-- Материалы курса по группам/урокам (read-only для ученика).
create table public.course_materials (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  lesson_id  uuid references public.lessons(id) on delete set null,
  title      text not null,
  type       text,                          -- 'pdf' | 'video' | 'link' | 'presentation' | ...
  file_url   text,
  link_url   text,
  created_at timestamptz not null default now()
);
create index on public.course_materials (group_id);

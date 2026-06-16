-- Сообщения (Nice-to-have по tz.md §9) и объявления (Should-have).
-- Сообщение адресовано лично ученику, его группе, либо отправлено самим учеником.
create table public.messages (
  id                   uuid primary key default gen_random_uuid(),
  sender_id            uuid references auth.users(id) on delete set null,
  recipient_student_id uuid references public.students(id) on delete cascade,
  group_id             uuid references public.groups(id) on delete cascade,
  body                 text not null,
  created_at           timestamptz not null default now(),
  read_at              timestamptz,
  check (recipient_student_id is not null or group_id is not null or sender_id is not null)
);
create index on public.messages (recipient_student_id, created_at);
create index on public.messages (group_id, created_at);

-- Объявления школы. target_group_id = null означает «всей школе».
create table public.announcements (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null,
  target_group_id uuid references public.groups(id) on delete cascade,
  created_at      timestamptz not null default now()
);

-- Identity: преподаватели, ученики, группы, связь M:N + RLS-хелперы.

-- Преподаватели (справочник; владелец данных — Teacher Workspace/Admin).
create table public.teachers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users(id) on delete set null,
  full_name  text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Ученики. Роль `student` = наличие строки с user_id = auth.uid() (tz.md §2).
create table public.students (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  username   text not null unique,           -- логин с макета (напр. Adilbek_07)
  full_name  text not null,
  phone      text,
  birth_date date,
  grade      text,                            -- "7 класс"
  avatar_url text,
  status     public.student_status not null default 'active',
  balance    numeric(12,2) not null default 0, -- read-only, формируется в админке
  curator_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Группы/курсы.
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subject    text not null,                   -- ключ для subjects.config (напр. 'robotics')
  teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Связь ученик<->группа (M:N) — основа RLS-видимости уроков/материалов/ДЗ.
create table public.student_groups (
  student_id uuid not null references public.students(id) on delete cascade,
  group_id   uuid not null references public.groups(id) on delete cascade,
  primary key (student_id, group_id)
);
create index on public.student_groups (group_id);

-- Хелперы для чистых RLS-политик. SECURITY DEFINER => внутри функции RLS
-- не применяется, поэтому рекурсии в политиках нет.
create or replace function public.current_student_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.students where user_id = auth.uid()
$$;

create or replace function public.is_my_group(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.student_groups sg
    where sg.group_id = p_group_id
      and sg.student_id = (select id from public.students where user_id = auth.uid())
  )
$$;

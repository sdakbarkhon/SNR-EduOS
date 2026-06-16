-- Настройки push-уведомлений ученика (ученик читает/меняет только свои).
create table public.notification_settings (
  student_id      uuid primary key references public.students(id) on delete cascade,
  push_homework   boolean not null default true,
  push_schedule   boolean not null default true,
  push_grades     boolean not null default true,
  push_attendance boolean not null default true,
  updated_at      timestamptz not null default now()
);

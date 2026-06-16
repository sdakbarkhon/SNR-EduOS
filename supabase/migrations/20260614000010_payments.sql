-- Платежи и списания (read-only для ученика; формируются в админке/у бухгалтера).
create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  amount     numeric(12,2) not null,
  kind       public.payment_kind not null,
  status     public.payment_status not null default 'completed',
  paid_at    timestamptz not null default now(),
  note       text
);
create index on public.payments (student_id, paid_at);

-- Списания (поурочная тарификация).
create table public.charges (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  lesson_id  uuid references public.lessons(id) on delete set null,
  amount     numeric(12,2) not null,
  charged_at timestamptz not null default now(),
  note       text
);
create index on public.charges (student_id, charged_at);

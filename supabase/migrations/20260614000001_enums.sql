-- Enum-типы домена. См. tz.md §6 и design_spec §1.4 (status chips).
-- gen_random_uuid() встроен в PostgreSQL 13+ (Supabase = PG15), расширения не нужны.

create type public.student_status   as enum ('active', 'debtor', 'frozen');
create type public.lesson_status    as enum ('scheduled', 'ongoing', 'done', 'cancelled');
create type public.attendance_status as enum ('present', 'absent', 'late');
create type public.submission_status as enum ('submitted', 'checking', 'graded');
create type public.payment_status   as enum ('completed', 'pending', 'canceled');
create type public.payment_kind     as enum ('subscription', 'one_time');

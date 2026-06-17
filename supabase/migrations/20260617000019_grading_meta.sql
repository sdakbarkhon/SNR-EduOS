-- Этап 2 (Оценки): метаданные выставления оценки — когда и кем.
-- Нужны для KPI учителя «оценено за эту неделю» и журнала оценок.
-- Новых таблиц не создаём; только колонки + триггер автозаполнения.

alter table public.homework_submissions
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references public.teachers(id) on delete set null;

alter table public.test_submissions
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references public.teachers(id) on delete set null;

-- Бэкфилл исторических оценённых строк (до создания триггера),
-- чтобы недельная статистика и сортировки имели значение.
update public.homework_submissions
  set graded_at = submitted_at
  where grade is not null and graded_at is null;

update public.test_submissions
  set graded_at = submitted_at
  where score is not null and graded_at is null;

-- Автозаполнение graded_at / graded_by при выставлении/изменении оценки.
-- SECURITY DEFINER + current_teacher_id() (из миграции 18) определяет учителя по auth.uid().
create or replace function public.set_grading_meta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_TABLE_NAME = 'homework_submissions' then
    if NEW.grade is not null
       and (OLD.grade is distinct from NEW.grade or OLD.status is distinct from NEW.status) then
      NEW.graded_at := now();
      NEW.graded_by := public.current_teacher_id();
    end if;
  elsif TG_TABLE_NAME = 'test_submissions' then
    if NEW.score is not null and (OLD.score is distinct from NEW.score) then
      NEW.graded_at := now();
      NEW.graded_by := public.current_teacher_id();
    end if;
  end if;
  return NEW;
end $$;

drop trigger if exists trg_grading_meta_hw on public.homework_submissions;
create trigger trg_grading_meta_hw
  before update on public.homework_submissions
  for each row execute function public.set_grading_meta();

drop trigger if exists trg_grading_meta_test on public.test_submissions;
create trigger trg_grading_meta_test
  before update on public.test_submissions
  for each row execute function public.set_grading_meta();

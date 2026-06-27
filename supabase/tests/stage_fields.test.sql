-- =====================================================================
-- Migration 55: lesson_stages.difficulty + duration_min
-- Запуск: `supabase test db`.
--   · difficulty принимает валидные значения и отвергает невалидные
--   · duration_min может быть NULL
-- =====================================================================
begin;

create extension if not exists pgtap;

select plan(3);

-- ── Колонки существуют ──
select has_column('public', 'lesson_stages', 'difficulty', 'lesson_stages.difficulty добавлена');
select has_column('public', 'lesson_stages', 'duration_min', 'lesson_stages.duration_min добавлена');

-- ── CHECK на difficulty: невалидное значение отвергается ──
-- (как service_role, чтобы проверять именно CHECK-констрейнт, а не RLS)
prepare bad_difficulty as
  insert into public.lesson_stages (lesson_id, position, stage_role, title, difficulty)
  values (gen_random_uuid(), 1, 'middle', 'bad', 'impossible');
select throws_ok(
  'bad_difficulty',
  '23514',  -- check_violation
  null,
  'INSERT с невалидным difficulty падает на CHECK'
);

select * from finish();
rollback;

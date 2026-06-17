-- =====================================================================
-- Этап 2 (Оценки): новая логика журнала + миграция grading_meta.
-- Запуск: `supabase test db`. Падает при нарушении изоляции учителя.
--   teacher_ivan  user ffff…  teacher cccc…  группы Programming 7A/7B (c1/c2…)
--   чужая группа: Математика 9Б (b0…) — её ведёт другой учитель.
-- =====================================================================
begin;

create extension if not exists pgtap;

select plan(5);

-- ── Миграция 19: новые колонки метаданных оценки ──
select has_column('public', 'homework_submissions', 'graded_at', 'homework_submissions.graded_at добавлена');
select has_column('public', 'test_submissions', 'graded_at', 'test_submissions.graded_at добавлена');

-- ── Контекст teacher_ivan ──
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}',
  true
);
set local role authenticated;

-- Видит матрицу своей группы (ДЗ Programming 7A)
select ok(
  (select count(*) > 0 from public.homework
   where group_id = 'c1000000-0000-0000-0000-000000000000'),
  'teacher: видит задания своей группы (Programming 7A)'
);

-- Видит ТОЛЬКО свои группы (teacher_id = его), чужие невидимы → 0
select is(
  (select count(*)::int from public.groups
   where teacher_id is distinct from 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0,
  'teacher: видит только свои группы (чужие невидимы)'
);

-- Все видимые сдачи принадлежат только его группам
select is(
  (select count(*)::int from public.homework_submissions hs
     join public.homework h on h.id = hs.homework_id
     join public.groups g on g.id = h.group_id
   where g.teacher_id is distinct from 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0,
  'teacher: видит сдачи только своих групп'
);

select * from finish();
rollback;

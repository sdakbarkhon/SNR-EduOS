-- =====================================================================
-- АВТОТЕСТ ИЗОЛЯЦИИ RLS (pgTAP) — критерий закрытия гейта Этапа 0.
-- Запуск: `supabase test db` (в локальном стеке). Падает (exit != 0) при
-- любом нарушении изоляции из tz.md §5.
--
-- Эмуляция ученика: SET ROLE authenticated + request.jwt.claims.sub = его auth.uid.
-- Данные берутся из supabase/seed.sql:
--   A = Adilbek_07  user 1111…  student a111…  группа A (a000…, robotics)
--   B = Dilnoza_09  user 2222…  student b222…  группа B (b000…, math)
-- =====================================================================
begin;

create extension if not exists pgtap;

select plan(34);

-- ============ УЧЕНИК A видит только своё ============
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select count(*)::int from public.groups), 1, 'A: только своя группа');
select is((select count(*)::int from public.lessons), 1, 'A: уроки только своей группы');
select is((select count(*)::int from public.attendance), 1, 'A: своя посещаемость');
select is((select count(*)::int from public.homework), 1, 'A: ДЗ только своей группы');
select is((select count(*)::int from public.homework_submissions), 1, 'A: своя сдача ДЗ');
select is((select count(*)::int from public.grades), 1, 'A: свои оценки');
select is((select count(*)::int from public.course_materials), 1, 'A: материалы своей группы');
select is((select count(*)::int from public.payments), 1, 'A: свои платежи');
select is((select count(*)::int from public.charges), 1, 'A: свои списания');
select is((select count(*)::int from public.announcements), 2, 'A: общешкольное + объявление группы A');
select is((select count(*)::int from public.messages), 1, 'A: только личное сообщение A');

-- A не видит данные B
select is((select count(*)::int from public.attendance
           where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
          'A НЕ видит посещаемость B');
select is((select count(*)::int from public.grades
           where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
          'A НЕ видит оценки B');
select is((select count(*)::int from public.payments
           where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
          'A НЕ видит платежи B');
select is((select count(*)::int from public.lessons
           where group_id = 'b0000000-0000-0000-0000-000000000000'), 0,
          'A НЕ видит уроки группы B');
select is((select count(*)::int from public.homework_submissions
           where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
          'A НЕ видит сдачи B');

-- A не может ПИСАТЬ за B
select throws_ok(
  $$ insert into public.homework_submissions (homework_id, student_id, answer_text)
     values ('40000000-0000-0000-0000-000000000002',
             'b2222222-2222-2222-2222-222222222222', 'hack') $$,
  '42501', NULL,
  'A не может вставить сдачу ДЗ за B (RLS 42501)'
);

select throws_ok(
  $$ update public.grades set score = 99
     where student_id = 'b2222222-2222-2222-2222-222222222222' $$,
  '42501', NULL,
  'A не может обновлять оценки (read-only, нет прав UPDATE)'
);

-- ============ УЧЕНИК B видит только своё ============
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select count(*)::int from public.groups), 1, 'B: только своя группа');
select is((select count(*)::int from public.lessons), 1, 'B: уроки только своей группы');
select is((select count(*)::int from public.attendance), 1, 'B: своя посещаемость');
select is((select count(*)::int from public.homework), 1, 'B: ДЗ только своей группы');
select is((select count(*)::int from public.homework_submissions), 0, 'B: сдач нет');
select is((select count(*)::int from public.grades), 1, 'B: свои оценки');
select is((select count(*)::int from public.course_materials), 1, 'B: материалы своей группы');
select is((select count(*)::int from public.payments), 1, 'B: свои платежи');
select is((select count(*)::int from public.charges), 0, 'B: списаний нет');
select is((select count(*)::int from public.announcements), 1, 'B: только общешкольное');
select is((select count(*)::int from public.messages), 1, 'B: только сообщение группы B');

select is((select count(*)::int from public.attendance
           where student_id = 'a1111111-1111-1111-1111-111111111111'), 0,
          'B НЕ видит посещаемость A');
select is((select count(*)::int from public.payments
           where student_id = 'a1111111-1111-1111-1111-111111111111'), 0,
          'B НЕ видит платежи A');

-- ============ Аноним не видит ничего ============
reset role;
set local role anon;

select is((select count(*)::int from public.attendance), 0, 'anon: 0 посещаемости');
select is((select count(*)::int from public.grades), 0, 'anon: 0 оценок');
select is((select count(*)::int from public.payments), 0, 'anon: 0 платежей');

select * from finish();
rollback;

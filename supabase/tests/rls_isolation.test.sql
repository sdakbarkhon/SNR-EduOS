-- =====================================================================
-- АВТОТЕСТ ИЗОЛЯЦИИ RLS (pgTAP) — критерий закрытия гейта Этапа 0.
-- Запуск: `supabase test db` (в локальном стеке). Падает (exit != 0) при
-- любом нарушении изоляции из tz.md §5.
--
-- Эмуляция ученика: SET ROLE authenticated + request.jwt.claims.sub = его auth.uid.
-- Данные берутся из supabase/seed.sql:
--   A = Adilbek_07  user 1111…  student a111…  (5 групп после homework_v2)
--   B = Dilnoza_09  user 2222…  student b222…  (6 групп после homework_v2)
-- =====================================================================
begin;

create extension if not exists pgtap;

select plan(38);

-- ============ УЧЕНИК A видит только своё ============
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- Позитивная видимость: A видит свои данные (>= 1)
select ok((select count(*) > 0 from public.groups),              'A: видит свои группы');
select ok((select count(*) > 0 from public.lessons),             'A: видит уроки своих групп');
select ok((select count(*) > 0 from public.attendance),          'A: видит свою посещаемость');
select ok((select count(*) > 0 from public.homework),            'A: видит ДЗ своих групп');
select ok((select count(*) > 0 from public.homework_submissions),'A: видит свои сдачи ДЗ');
select ok((select count(*) > 0 from public.grades),              'A: видит свои оценки');
select ok((select count(*) > 0 from public.course_materials),    'A: видит материалы своих групп');
select ok((select count(*) > 0 from public.payments),            'A: видит свои платежи');
select ok((select count(*) > 0 from public.charges),             'A: видит свои списания');
select ok((select count(*) > 0 from public.announcements),       'A: видит объявления');
select ok((select count(*) > 0 from public.messages),            'A: видит свои сообщения');
-- test_* visibility
select ok((select count(*) > 0 from public.test_questions),      'A: видит вопросы тестов своих групп');
select ok((select count(*) > 0 from public.test_submissions),    'A: видит свои сдачи тестов');

-- A не видит данные B (строгая изоляция = 0)
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
          'A НЕ видит уроки группы B (Математика 9Б)');
select is((select count(*)::int from public.homework_submissions
           where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
          'A НЕ видит сдачи ДЗ B');
select is((select count(*)::int from public.test_submissions
           where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
          'A НЕ видит сдачи тестов B');

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

-- Позитивная видимость: B видит свои данные
select ok((select count(*) > 0 from public.groups),              'B: видит свои группы');
select ok((select count(*) > 0 from public.lessons),             'B: видит уроки своих групп');
select ok((select count(*) > 0 from public.attendance),          'B: видит свою посещаемость');
select ok((select count(*) > 0 from public.homework),            'B: видит ДЗ своих групп');
select ok((select count(*) > 0 from public.grades),              'B: видит свои оценки');
select ok((select count(*) > 0 from public.course_materials),    'B: видит материалы своих групп');
select ok((select count(*) > 0 from public.payments),            'B: видит свои платежи');
select ok((select count(*) > 0 from public.announcements),       'B: видит объявления');
select ok((select count(*) > 0 from public.messages),            'B: видит свои сообщения');
-- test_* visibility for B
select ok((select count(*) > 0 from public.test_questions),      'B: видит вопросы тестов своих групп');
select ok((select count(*) > 0 from public.test_submissions),    'B: видит свои сдачи тестов');

-- B не видит данные A
select is((select count(*)::int from public.attendance
           where student_id = 'a1111111-1111-1111-1111-111111111111'), 0,
          'B НЕ видит посещаемость A');
select is((select count(*)::int from public.payments
           where student_id = 'a1111111-1111-1111-1111-111111111111'), 0,
          'B НЕ видит платежи A');
select is((select count(*)::int from public.test_submissions
           where student_id = 'a1111111-1111-1111-1111-111111111111'), 0,
          'B НЕ видит сдачи тестов A');

-- ============ Аноним не видит ничего ============
reset role;
set local role anon;

select is((select count(*)::int from public.attendance), 0, 'anon: 0 посещаемости');
select is((select count(*)::int from public.grades), 0, 'anon: 0 оценок');
select is((select count(*)::int from public.payments), 0, 'anon: 0 платежей');

select * from finish();
rollback;

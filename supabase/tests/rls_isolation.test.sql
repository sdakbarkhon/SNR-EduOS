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

select plan(59);

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
-- Материалы: конкретные проверки RLS
select ok(
  (select count(*) > 0 from public.course_materials
   where id = 'ea000001-0000-0000-0000-000000000000'),
  'A: видит материал ea000001 (в своей группе a0)'
);
select is(
  (select count(*)::int from public.course_materials
   where id = 'eb000001-0000-0000-0000-000000000000'),
  0,
  'A НЕ видит материал eb000001 (группа b0 — только Dilnoza)'
);
select throws_ok(
  $$ insert into public.course_materials (group_id, title, type, uploaded_by)
     values ('b0000000-0000-0000-0000-000000000000',
             'HACK', 'pdf', 'a1111111-1111-1111-1111-111111111111') $$,
  '42501', NULL,
  'A не может добавить материал (нет RLS INSERT-политики для ученика)'
);
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

-- ============ УЧИТЕЛЬ (teacher_ivan) — изоляция и права ============
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}',
  true
);
set local role authenticated;

-- Позитивная видимость: учитель видит данные своих групп
select ok((select count(*) > 0 from public.groups),
          'T: видит свои группы');
select ok((select count(*) > 0 from public.students),
          'T: видит учеников своих групп');
select ok((select count(*) > 0 from public.lessons),
          'T: видит уроки своих групп');
select ok((select count(*) > 0 from public.homework),
          'T: видит ДЗ своих групп');
select ok((select count(*) > 0 from public.homework_submissions),
          'T: видит сдачи ДЗ своих групп');
select ok((select count(*) > 0 from public.test_questions),
          'T: видит вопросы тестов своих групп');

-- Учитель видит собственный профиль
select ok((select count(*) > 0 from public.teachers
           where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
          'T: видит свой профиль');

-- Изоляция: учитель НЕ видит данные чужих групп
-- Группы dddddddd (Elena) — Английский 7А/9Б
select is((select count(*)::int from public.homework h
           where h.group_id = 'd0000000-0000-0000-0000-000000000000'), 0,
          'T НЕ видит ДЗ чужой группы (Английский 7А)');

select is((select count(*)::int from public.lessons
           where group_id = 'd0000000-0000-0000-0000-000000000000'), 0,
          'T НЕ видит уроки чужой группы');

-- Платежи учеников — учитель не должен видеть
select is((select count(*)::int from public.payments), 0,
          'T НЕ видит платежи (нет политики)');

-- INSERT homework в свою группу — разрешён
select lives_ok(
  $$ insert into public.homework
       (group_id, title, description, due_date, content_type, source, teacher_id)
     values
       ('c1000000-0000-0000-0000-000000000000',
        'TEST-INSERT by teacher', 'desc', '2026-07-01T23:59:00Z',
        'file', 'teacher', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
  $$,
  'T: может создать ДЗ в своей группе'
);

-- INSERT homework в чужую группу — запрещён (42501)
select throws_ok(
  $$ insert into public.homework
       (group_id, title, description, due_date, content_type, source, teacher_id)
     values
       ('d0000000-0000-0000-0000-000000000000',
        'HACK', 'desc', '2026-07-01T23:59:00Z',
        'file', 'teacher', 'cccccccc-cccc-cccc-cccc-cccccccccccc')
  $$,
  '42501', NULL,
  'T НЕ может создать ДЗ в чужой группе (42501)'
);

-- UPDATE homework_submission (оценить) — разрешён для своей группы
select lives_ok(
  $$ update public.homework_submissions
     set grade = '5', teacher_comment = 'Great!', status = 'graded'
     where homework_id = 'e1c10001-0000-0000-0000-000000000000' $$,
  'T: может выставить оценку в сдаче своей группы'
);

-- DELETE своего ДЗ — разрешён
select lives_ok(
  $$ delete from public.homework where title = 'TEST-INSERT by teacher'
     and teacher_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  'T: может удалить своё ДЗ'
);

-- Материалы: учитель может добавить в свою группу
select lives_ok(
  $$ insert into public.course_materials
       (group_id, title, type, storage_path, uploaded_by)
     values
       ('a0000000-0000-0000-0000-000000000000',
        'TEST-MATERIAL by teacher', 'pdf',
        'cccccccc-cccc-cccc-cccc-cccccccccccc/a0000000-0000-0000-0000-000000000000/test-id/test.pdf',
        'cccccccc-cccc-cccc-cccc-cccccccccccc')
  $$,
  'T: может добавить материал в свою группу (a0)'
);

-- Материалы: учитель НЕ может добавить в чужую группу
select throws_ok(
  $$ insert into public.course_materials
       (group_id, title, type, storage_path, uploaded_by)
     values
       ('d0000000-0000-0000-0000-000000000000',
        'HACK-MATERIAL', 'pdf',
        'cccccccc-cccc-cccc-cccc-cccccccccccc/d0000000-0000-0000-0000-000000000000/test-id/hack.pdf',
        'cccccccc-cccc-cccc-cccc-cccccccccccc')
  $$,
  '42501', NULL,
  'T НЕ может добавить материал в чужую группу (d0 — Elena, 42501)'
);

-- Регрессия: student A после teacher-сессии всё ещё изолирован
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select count(*)::int from public.attendance
           where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
          'Regression: A НЕ видит посещаемость B после teacher-сессии');

select is((select count(*)::int from public.payments
           where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
          'Regression: A НЕ видит платежи B после teacher-сессии');

-- ============ Аноним не видит ничего ============
reset role;
set local role anon;

select is((select count(*)::int from public.attendance), 0, 'anon: 0 посещаемости');
select is((select count(*)::int from public.grades), 0, 'anon: 0 оценок');
select is((select count(*)::int from public.payments), 0, 'anon: 0 платежей');

select * from finish();
rollback;

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

select plan(94);

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
select ok((select count(*) >= 0 from public.homework where attachment_storage_path is not distinct from null or true),
          'A: homework.attachment_storage_path column accessible (migration 22)');
select ok((select count(*) > 0 from public.homework_submissions),'A: видит свои сдачи ДЗ');
select ok((select count(*) >= 0 from public.homework_submissions where file_storage_path is not distinct from null or true),
          'A: homework_submissions.file_storage_path column accessible (migration 22)');
-- A может сдать ДЗ с прикреплённым файлом
select lives_ok(
  $$ insert into public.homework_submissions
       (homework_id, student_id, file_storage_path, file_size_bytes, file_original_name, status)
     values
       ('40aa0001-0000-0000-0000-000000000000',
        'a1111111-1111-1111-1111-111111111111',
        'cccccccc-cccc-cccc-cccc-cccccccccccc/40aa0001-0000-0000-0000-000000000000/submissions/a1111111-1111-1111-1111-111111111111/test.pdf',
        12345, 'test.pdf', 'submitted') $$,
  'A: может сдать ДЗ с file_storage_path'
);
-- A видит собственную сдачу с файлом
select ok(
  (select file_storage_path is not null
   from public.homework_submissions
   where homework_id = '40aa0001-0000-0000-0000-000000000000'
     and student_id  = 'a1111111-1111-1111-1111-111111111111'
   limit 1),
  'A: видит file_storage_path собственной сдачи'
);
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
-- Книги: A видит все книги школы
select ok((select count(*) > 0 from public.books),
          'A: видит книги библиотеки (видны всем authenticated)');
-- Избранное: у A изначально нет
select is((select count(*)::int from public.book_favorites), 0,
          'A: нет избранных книг изначально');
-- A может добавить в избранное
select lives_ok(
  $$ insert into public.book_favorites (student_id, book_id)
     values ('a1111111-1111-1111-1111-111111111111',
             'fa000001-0000-0000-0000-000000000000') $$,
  'A: может добавить книгу в избранное'
);
-- После добавления видит 1 запись
select is((select count(*)::int from public.book_favorites), 1,
          'A: видит своё избранное (1 книга)');
-- A может удалить из избранного
select lives_ok(
  $$ delete from public.book_favorites
     where student_id = 'a1111111-1111-1111-1111-111111111111'
       and book_id    = 'fa000001-0000-0000-0000-000000000000' $$,
  'A: может удалить книгу из избранного'
);
-- A не может добавить избранное за B (RLS 42501)
select throws_ok(
  $$ insert into public.book_favorites (student_id, book_id)
     values ('b2222222-2222-2222-2222-222222222222',
             'fa000001-0000-0000-0000-000000000000') $$,
  '42501', NULL,
  'A не может добавить избранное за B (RLS 42501)'
);
-- A не может INSERT книгу (нет политики INSERT для студентов)
select throws_ok(
  $$ insert into public.books (title, subject, file_storage_path, uploaded_by)
     values ('HACK-BOOK', 'math', 'a111.../hack.pdf',
             'a1111111-1111-1111-1111-111111111111') $$,
  '42501', NULL,
  'A не может добавить книгу в библиотеку (нет INSERT для студента)'
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
  $$ insert into public.homework_submissions
       (homework_id, student_id, file_storage_path, file_size_bytes, file_original_name, status)
     values
       ('40aa0001-0000-0000-0000-000000000000',
        'b2222222-2222-2222-2222-222222222222',
        'cccccccc.../submissions/b2222222.../hack.pdf',
        999, 'hack.pdf', 'submitted') $$,
  '42501', NULL,
  'A не может сдать ДЗ с file за B (RLS 42501)'
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
-- B: новые колонки migration 22 доступны
select ok(
  (select count(*) >= 0 from public.homework where attachment_storage_path is not distinct from null or true),
  'B: attachment_storage_path column selectable (migration 22)'
);

-- B не видит file-сдачу A (изоляция file_storage_path)
select is(
  (select count(*)::int from public.homework_submissions
   where student_id = 'a1111111-1111-1111-1111-111111111111' and file_storage_path is not null),
  0,
  'B НЕ видит file_storage_path сдачи A (изоляция migration 22)'
);

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
-- Книги: B видит всю библиотеку
select ok((select count(*) > 0 from public.books),
          'B: видит книги библиотеки (видны всем authenticated)');
-- Книги: B не видит favorites A (изоляция; A удалила своё выше)
select is((select count(*)::int from public.book_favorites), 0,
          'B: не видит favorites A — изоляция book_favorites');

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

-- Учитель может UPDATE attachment_storage_path на своём ДЗ
select lives_ok(
  $$ update public.homework
     set attachment_storage_path = 'cccccccc-cccc-cccc-cccc-cccccccccccc/40aa0001-0000-0000-0000-000000000000/attachment/doc.pdf',
         attachment_filename = 'doc.pdf',
         attachment_size_bytes = 2048
     where id = '40aa0001-0000-0000-0000-000000000000' $$,
  'T: может обновить attachment_storage_path в своём ДЗ (migration 22)'
);

-- Учитель видит file_storage_path в сдачах своей группы
select ok(
  (select count(*)::int from public.homework_submissions
   where homework_id = '40aa0001-0000-0000-0000-000000000000' and file_storage_path is not null) > 0,
  'T: видит file_storage_path в сдачах своей группы (migration 22)'
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

-- T может сбросить file_storage_path (resubmit cleanup) в сдаче своей группы
select lives_ok(
  $$ update public.homework_submissions
     set file_storage_path = null, file_size_bytes = null, file_original_name = null
     where homework_id = '40aa0001-0000-0000-0000-000000000000'
       and student_id  = 'a1111111-1111-1111-1111-111111111111' $$,
  'T: может сбросить file_storage_path в сдаче своей группы (migration 22)'
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

-- Книги: учитель видит всю библиотеку (включая книги других учителей)
select ok((select count(*) > 0 from public.books),
          'T: видит все книги библиотеки');
-- Книги: учитель может добавить книгу (uploaded_by = current_teacher_id())
select lives_ok(
  $$ insert into public.books (title, subject, file_storage_path, uploaded_by)
     values ('TEST-BOOK by Ivan', 'math',
             'cccccccc-cccc-cccc-cccc-cccccccccccc/test-book-id/test.pdf',
             'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'T: может добавить книгу в библиотеку'
);
-- Книги: учитель может удалить свою книгу
select lives_ok(
  $$ delete from public.books where title = 'TEST-BOOK by Ivan'
     and uploaded_by = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  'T: может удалить свою книгу'
);

-- ── Migration 24: lesson_stages + lesson_materials ────────────────────

-- Test 85: T INSERT lesson_stage (goal) для aa000001 (группа a0 — Ivan's)
select lives_ok(
  $$ insert into public.lesson_stages (lesson_id, stage_key, order_index, is_completed)
     values ('aa000001-0000-0000-0000-000000000000', 'goal', 1, false) $$,
  'T: может создать lesson_stage в своей группе (aa000001)'
);

-- Test 86: T INSERT lesson_material для aa000001
select lives_ok(
  $$ insert into public.lesson_materials
       (lesson_id, title, file_storage_path, uploaded_by)
     values (
       'aa000001-0000-0000-0000-000000000000',
       'TEST-MAT-A',
       'cccccccc-cccc-cccc-cccc-cccccccccccc/aa000001-0000-0000-0000-000000000000/m01/file.pdf',
       'cccccccc-cccc-cccc-cccc-cccccccccccc'
     ) $$,
  'T: может добавить lesson_material в свой урок (aa000001)'
);

-- Test 87: T INSERT lesson_stage для bb000001 (группа b0 — Ivan's, для isolation ниже)
select lives_ok(
  $$ insert into public.lesson_stages (lesson_id, stage_key, order_index, is_completed)
     values ('bb000001-0000-0000-0000-000000000000', 'goal', 1, false) $$,
  'T: может создать lesson_stage для bb000001 (своя группа b0)'
);

-- Test 88: T INSERT lesson_material для bb000001 (для isolation ниже)
select lives_ok(
  $$ insert into public.lesson_materials
       (lesson_id, title, file_storage_path, uploaded_by)
     values (
       'bb000001-0000-0000-0000-000000000000',
       'TEST-MAT-B',
       'cccccccc-cccc-cccc-cccc-cccccccccccc/bb000001-0000-0000-0000-000000000000/m02/file.pdf',
       'cccccccc-cccc-cccc-cccc-cccccccccccc'
     ) $$,
  'T: может добавить lesson_material для bb000001 (своя группа b0)'
);

-- Test 89: T НЕ может добавить lesson_material в чужую группу (d0 — Elena)
select throws_ok(
  $$ insert into public.lesson_materials
       (lesson_id, title, file_storage_path, uploaded_by)
     values (
       'dd000001-0000-0000-0000-000000000000',
       'HACK-MAT',
       'cccccccc-cccc-cccc-cccc-cccccccccccc/dd000001-0000-0000-0000-000000000000/m99/hack.pdf',
       'cccccccc-cccc-cccc-cccc-cccccccccccc'
     ) $$,
  '42501', NULL,
  'T НЕ может добавить lesson_material в чужую группу (d0 — Elena, 42501)'
);

-- ── Migration 25: teacher INSERT + DELETE on lessons ──────────────────────────

-- Test 93: T может INSERT урок в свою группу (a0 — Ivan's)
select lives_ok(
  $$ insert into public.lessons
       (group_id, lesson_no, topic, status, starts_at, ends_at, room)
     values
       ('a0000000-0000-0000-0000-000000000000',
        99, 'TEST-LESSON by teacher', 'scheduled',
        '2026-09-01T05:00:00Z', '2026-09-01T06:30:00Z', '305') $$,
  'T: может создать урок в своей группе (migration 25)'
);

-- Test 94: T НЕ может INSERT урок в чужую группу (d0 — Elena, 42501)
select throws_ok(
  $$ insert into public.lessons
       (group_id, lesson_no, topic, status, starts_at, ends_at, room)
     values
       ('d0000000-0000-0000-0000-000000000000',
        99, 'HACK-LESSON', 'scheduled',
        '2026-09-01T05:00:00Z', '2026-09-01T06:30:00Z', '999') $$,
  '42501', NULL,
  'T НЕ может создать урок в чужой группе (d0 — Elena, 42501)'
);

-- cleanup test lesson
delete from public.lessons where topic = 'TEST-LESSON by teacher';

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

-- ── Migration 24 regression: A изолирован в lesson_stages / lesson_materials ──

-- Test 90: A видит lesson_stages для aa000001 (Robotics 7A — его группа)
select ok(
  (select count(*)::int > 0 from public.lesson_stages
   where lesson_id = 'aa000001-0000-0000-0000-000000000000'),
  'Regression: A видит lesson_stages своей группы (aa000001)'
);

-- Test 91: A НЕ видит lesson_stages для bb000001 (Math 9B — группа Dilnoza, не его)
select is(
  (select count(*)::int from public.lesson_stages
   where lesson_id = 'bb000001-0000-0000-0000-000000000000'), 0,
  'Regression: A НЕ видит lesson_stages чужой группы (bb000001)'
);

-- Test 92: A НЕ видит lesson_materials для bb000001
select is(
  (select count(*)::int from public.lesson_materials
   where lesson_id = 'bb000001-0000-0000-0000-000000000000'), 0,
  'Regression: A НЕ видит lesson_materials чужой группы (bb000001)'
);

-- ============ Аноним не видит ничего ============
reset role;
set local role anon;

select is((select count(*)::int from public.attendance), 0, 'anon: 0 посещаемости');
select is((select count(*)::int from public.grades), 0, 'anon: 0 оценок');
select is((select count(*)::int from public.payments), 0, 'anon: 0 платежей');
select is((select count(*)::int from public.books), 0, 'anon: 0 книг (нет политики для anon)');

-- ============ MIGRATION 23: homework.lesson_id FK integrity ============
-- Run as superuser (role reset above from anon block)
reset role;

-- Test 83: lesson_id column is nullable (FK is optional)
select ok(
  (select is_nullable = 'YES'
     from information_schema.columns
    where table_schema = 'public'
      and table_name = 'homework'
      and column_name = 'lesson_id'),
  'migration 23: homework.lesson_id is nullable (optional FK)'
);

-- Test 84: FK constraint exists on homework.lesson_id → lessons.id
select ok(
  (select count(*) > 0
     from information_schema.referential_constraints rc
     join information_schema.key_column_usage kcu
       on rc.constraint_name = kcu.constraint_name
      and rc.constraint_schema = kcu.constraint_schema
    where kcu.table_schema = 'public'
      and kcu.table_name   = 'homework'
      and kcu.column_name  = 'lesson_id'),
  'migration 23: homework.lesson_id FK to lessons.id exists'
);

select * from finish();
rollback;

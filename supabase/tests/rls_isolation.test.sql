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

select plan(162);

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

-- Test 85: trigger (migration 35) auto-created start stage (stage_role='start') for aa000001
select ok(
  (select count(*) > 0 from public.lesson_stages
    where lesson_id = 'aa000001-0000-0000-0000-000000000000'
      and stage_role = 'start'),
  'M35 trigger: start stage auto-created for aa000001'
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

-- Test 87: trigger (migration 35) auto-created summary stage (stage_role='summary') for bb000001
select ok(
  (select count(*) > 0 from public.lesson_stages
    where lesson_id = 'bb000001-0000-0000-0000-000000000000'
      and stage_role = 'summary'),
  'M35 trigger: summary stage auto-created for bb000001'
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

-- ── Migration 26: lesson status columns ────────────────────────────────────
reset role;

-- Test 95: new status column default is 'scheduled' and valid values accepted
select ok(
  (select column_default = '''scheduled'''::text
     from information_schema.columns
    where table_schema = 'public' and table_name = 'lessons' and column_name = 'status'),
  'migration 26: lessons.status default is scheduled'
);

-- Test 96: CHECK constraint rejects invalid status value
select throws_ok(
  $$ insert into public.lessons (group_id, status, starts_at)
     values ('a0000000-0000-0000-0000-000000000000', 'invalid_status', now()) $$,
  '23514', NULL,
  'migration 26: invalid status value rejected by CHECK constraint'
);

-- ============ ПОСЕЩАЕМОСТЬ (migration 27) — новые статусы ============

reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

-- Test 97: attendance status column uses text (not enum) after migration 27
select ok(
  (select data_type = 'text'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'status'),
  'migration 27: attendance.status is text type'
);

-- Test 98: attendance.is_finalized column exists with bool type
select ok(
  (select data_type = 'boolean'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'is_finalized'),
  'migration 27: attendance.is_finalized column exists'
);

-- Test 99: student A sees own attendance rows only
select ok(
  (select count(*) > 0 from public.attendance
    where student_id = 'a1111111-1111-1111-1111-111111111111'),
  'attendance: student A sees own rows'
);

-- Test 100: student A does NOT see student B attendance rows
select is(
  (select count(*) from public.attendance
    where student_id = 'b2222222-2222-2222-2222-222222222222'),
  0::bigint,
  'attendance: student A sees 0 rows of student B'
);

-- Test 101: attendance.marked_at column exists (migration 27)
select ok(
  (select column_name = 'marked_at'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'attendance' and column_name = 'marked_at'),
  'migration 27: attendance.marked_at column exists'
);

-- ============ КЛАССНАЯ РАБОТА (migration 28) ============

-- Test 102: classwork table exists with expected columns
reset role;
select ok(
  (select count(*) > 0
     from information_schema.tables
    where table_schema = 'public' and table_name = 'classwork'),
  'migration 28: classwork table exists'
);

-- Test 103: classwork_questions table exists
select ok(
  (select count(*) > 0
     from information_schema.tables
    where table_schema = 'public' and table_name = 'classwork_questions'),
  'migration 28: classwork_questions table exists'
);

-- Test 104: classwork_submissions table exists
select ok(
  (select count(*) > 0
     from information_schema.tables
    where table_schema = 'public' and table_name = 'classwork_submissions'),
  'migration 28: classwork_submissions table exists'
);

-- Test 105 (as teacher): teacher can INSERT classwork in own lesson
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$ insert into public.classwork (lesson_id, title, work_type, created_by)
     values ('aa000001-0000-0000-0000-000000000000',
             'TEST-CW by Ivan', 'file',
             'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'T: can INSERT classwork in own lesson (migration 28)'
);

-- Test 106 (as teacher): teacher CANNOT INSERT classwork in another teacher's lesson
select throws_ok(
  $$ insert into public.classwork (lesson_id, title, work_type, created_by)
     values ('dd000001-0000-0000-0000-000000000000',
             'HACK-CW', 'file',
             'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', NULL,
  'T: cannot INSERT classwork in another teacher lesson (42501)'
);

-- Test 107 (as student A): student sees classwork in own group lesson
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

select ok(
  (select count(*) > 0 from public.classwork
    where lesson_id = 'aa000001-0000-0000-0000-000000000000'),
  'classwork RLS: student A sees classwork in own group lesson'
);

-- cleanup
reset role;
delete from public.classwork where title = 'TEST-CW by Ivan';

-- ============ MIGRATION 30: excuse requests + raised hands ============
-- Set lesson aa000001 (group a0 — Ivan teacher / Adilbek student) to scheduled
reset role;
update public.lessons set status = 'scheduled'
  where id = 'aa000001-0000-0000-0000-000000000000';
delete from public.lesson_excuse_requests
  where lesson_id in ('aa000001-0000-0000-0000-000000000000',
                      'dd000001-0000-0000-0000-000000000000');
delete from public.lesson_raised_hands
  where lesson_id = 'aa000001-0000-0000-0000-000000000000';

-- as student A
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Test 108: student creates excuse on own scheduled lesson → works
select lives_ok(
  $$ insert into public.lesson_excuse_requests (lesson_id, student_id, reason)
     values ('aa000001-0000-0000-0000-000000000000',
             'a1111111-1111-1111-1111-111111111111', 'плохо себя чувствую') $$,
  'M30: student can create excuse on own scheduled lesson');

-- Test 109: student CANNOT create excuse on a lesson outside own group → 42501
select throws_ok(
  $$ insert into public.lesson_excuse_requests (lesson_id, student_id, reason)
     values ('dd000001-0000-0000-0000-000000000000',
             'a1111111-1111-1111-1111-111111111111', 'hack') $$,
  '42501', NULL,
  'M30: student cannot create excuse on lesson outside own group');

-- Set aa000001 to in_progress to test the status gate
reset role;
delete from public.lesson_excuse_requests
  where lesson_id = 'aa000001-0000-0000-0000-000000000000'
    and student_id = 'a1111111-1111-1111-1111-111111111111';
update public.lessons set status = 'in_progress'
  where id = 'aa000001-0000-0000-0000-000000000000';
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Test 110: student CANNOT create excuse once lesson is in progress → 42501
select throws_ok(
  $$ insert into public.lesson_excuse_requests (lesson_id, student_id, reason)
     values ('aa000001-0000-0000-0000-000000000000',
             'a1111111-1111-1111-1111-111111111111', 'опоздал') $$,
  '42501', NULL,
  'M30: student cannot create excuse once lesson is in progress');

-- Test 111: student CAN raise hand during in_progress lesson → works
select lives_ok(
  $$ insert into public.lesson_raised_hands (lesson_id, student_id)
     values ('aa000001-0000-0000-0000-000000000000',
             'a1111111-1111-1111-1111-111111111111') $$,
  'M30: student can raise hand during in_progress lesson');

-- Seed excuse rows (superuser bypasses RLS): one in own group, one in foreign group
reset role;
insert into public.lesson_excuse_requests (lesson_id, student_id, reason)
  values ('aa000001-0000-0000-0000-000000000000',
          'a1111111-1111-1111-1111-111111111111', 'болезнь')
  on conflict do nothing;
insert into public.lesson_excuse_requests (lesson_id, student_id, reason)
  values ('dd000001-0000-0000-0000-000000000000',
          'b2222222-2222-2222-2222-222222222222', 'foreign')
  on conflict do nothing;

-- as teacher Ivan
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

-- Test 112: teacher sees excuse requests in own group
select ok(
  (select count(*) > 0 from public.lesson_excuse_requests
    where lesson_id = 'aa000001-0000-0000-0000-000000000000'),
  'M30: teacher sees excuse requests in own group');

-- Test 113: teacher does NOT see excuse requests outside own groups
select is(
  (select count(*)::int from public.lesson_excuse_requests
    where lesson_id = 'dd000001-0000-0000-0000-000000000000'), 0,
  'M30: teacher does not see excuse requests outside own groups');

-- Test 114: teacher can lower a raised hand in own group
select lives_ok(
  $$ update public.lesson_raised_hands
       set lowered_at = now(),
           lowered_by = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     where lesson_id = 'aa000001-0000-0000-0000-000000000000'
       and student_id = 'a1111111-1111-1111-1111-111111111111' $$,
  'M30: teacher can lower a raised hand in own group');

-- Test 115: deleting raised hands is forbidden for everyone (no grant) → 42501
select throws_ok(
  $$ delete from public.lesson_raised_hands
     where lesson_id = 'aa000001-0000-0000-0000-000000000000' $$,
  '42501', NULL,
  'M30: deleting raised hands is forbidden');

reset role;

-- ============ MIGRATION 31: homework test types (start-gate) ============
-- Setup (superuser): a 'test' homework in group a0 (Ivan/Adilbek) + one in d0 (Elena)
reset role;
insert into public.homework (id, group_id, title, content_type, source, teacher_id, test_auto_grade)
  values ('aa310001-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000',
          'M31 TEST HW', 'test', 'teacher', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
insert into public.test_questions (id, homework_id, question_text, question_type, order_index)
  values ('aa310002-0000-0000-0000-000000000000', 'aa310001-0000-0000-0000-000000000000',
          'Q1', 'single_choice', 0);
insert into public.homework (id, group_id, title, content_type, source)
  values ('dd310001-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
          'M31 FOREIGN TEST', 'test', 'curriculum');
insert into public.test_questions (id, homework_id, question_text, question_type, order_index)
  values ('dd310002-0000-0000-0000-000000000000', 'dd310001-0000-0000-0000-000000000000',
          'FQ1', 'single_choice', 0);

-- Test 116 (teacher): can create a 'test' homework in own group
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ insert into public.homework (group_id, title, content_type, source, teacher_id)
     values ('a0000000-0000-0000-0000-000000000000', 'M31-TEACHER-TEST',
             'test', 'teacher', 'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'M31: teacher can create a test homework in own group');

-- as student A
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Test 117: student cannot see test questions before starting
select is(
  (select count(*)::int from public.test_questions
    where homework_id = 'aa310001-0000-0000-0000-000000000000'), 0,
  'M31: student cannot read test questions before starting the test');

-- student starts the test
insert into public.test_submissions (homework_id, student_id, started_at)
  values ('aa310001-0000-0000-0000-000000000000',
          'a1111111-1111-1111-1111-111111111111', now());

-- Test 118: after starting, questions are visible
select ok(
  (select count(*) > 0 from public.test_questions
    where homework_id = 'aa310001-0000-0000-0000-000000000000'),
  'M31: student can read test questions after starting');

-- Test 119: foreign-group test questions are never visible
select is(
  (select count(*)::int from public.test_questions
    where homework_id = 'dd310001-0000-0000-0000-000000000000'), 0,
  'M31: student cannot read test questions in another group');

reset role;
delete from public.homework
  where id in ('aa310001-0000-0000-0000-000000000000','dd310001-0000-0000-0000-000000000000');

-- ============ MIGRATION 32: programming homework type ============
reset role;
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

-- Test 120: teacher can create a programming homework (python) in own group
select lives_ok(
  $$ insert into public.homework (group_id, title, content_type, source, teacher_id, programming_language)
     values ('a0000000-0000-0000-0000-000000000000', 'M32-PROG',
             'programming', 'teacher', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'python') $$,
  'M32: teacher can create a programming homework (python)');

-- Test 121: invalid programming_language rejected by CHECK
select throws_ok(
  $$ insert into public.homework (group_id, title, content_type, source, teacher_id, programming_language)
     values ('a0000000-0000-0000-0000-000000000000', 'M32-BAD',
             'programming', 'teacher', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'java') $$,
  '23514', NULL,
  'M32: invalid programming_language rejected by CHECK');

reset role;
delete from public.homework where title in ('M32-PROG', 'M32-BAD');

-- ============ MIGRATION 33: projects ============
-- Setup (superuser): P1 in a0 (Ivan/Adilbek), P2 in d0 (Elena) + foreign submission
reset role;
insert into public.projects (id, group_id, subject, title, created_by) values
  ('aa330001-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000',
   'robotics', 'M33 P1', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into public.project_stages (id, project_id, position, title) values
  ('aa330002-0000-0000-0000-000000000000', 'aa330001-0000-0000-0000-000000000000', 0, 'Stage 1');
insert into public.projects (id, group_id, subject, title) values
  ('dd330001-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000', 'robotics', 'M33 P2 foreign');
insert into public.project_submissions (id, project_id, student_id) values
  ('dd330003-0000-0000-0000-000000000000', 'dd330001-0000-0000-0000-000000000000',
   'b2222222-2222-2222-2222-222222222222');

-- as teacher Ivan
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

-- Test 122: teacher creates a project in own group
select lives_ok(
  $$ insert into public.projects (group_id, subject, title, created_by)
     values ('a0000000-0000-0000-0000-000000000000', 'robotics', 'M33-OWN',
             'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'M33: teacher creates project in own group');

-- Test 123: teacher CANNOT create a project in a foreign group → 42501
select throws_ok(
  $$ insert into public.projects (group_id, subject, title, created_by)
     values ('d0000000-0000-0000-0000-000000000000', 'robotics', 'M33-HACK',
             'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', NULL,
  'M33: teacher cannot create project in foreign group');

-- as student A
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Test 124: student creates own submission on own-group project
select lives_ok(
  $$ insert into public.project_submissions (id, project_id, student_id)
     values ('aa330003-0000-0000-0000-000000000000', 'aa330001-0000-0000-0000-000000000000',
             'a1111111-1111-1111-1111-111111111111') $$,
  'M33: student creates own project submission');

-- Test 125: student cannot see another student's submission
select is(
  (select count(*)::int from public.project_submissions
    where student_id = 'b2222222-2222-2222-2222-222222222222'), 0,
  'M33: student does not see another student project submission');

-- as teacher Ivan
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

-- Test 126: teacher grades a submission in own group
select lives_ok(
  $$ update public.project_submissions
       set grade = 5, teacher_comment = 'ok', graded_at = now(),
           graded_by = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
     where id = 'aa330003-0000-0000-0000-000000000000' $$,
  'M33: teacher grades submission in own group');

-- Test 127: teacher cannot grade a submission in a foreign group (0 rows → stays null)
update public.project_submissions set grade = 5
  where id = 'dd330003-0000-0000-0000-000000000000';
reset role;
select is(
  (select grade from public.project_submissions where id = 'dd330003-0000-0000-0000-000000000000'),
  NULL,
  'M33: teacher cannot grade a foreign-group submission');

reset role;
delete from public.projects where id in
  ('aa330001-0000-0000-0000-000000000000', 'dd330001-0000-0000-0000-000000000000');
delete from public.projects where title in ('M33-OWN');

-- ============ MIGRATION 34: announcements + notifications ============
-- Setup (superuser): a foreign-group announcement (d0 — Elena)
reset role;
insert into public.announcements (id, title, body, scope, group_id) values
  ('dd340002-0000-0000-0000-000000000000', 'M34-FOREIGN', 'x', 'group', 'd0000000-0000-0000-0000-000000000000');

-- as teacher Ivan
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

-- Test 128: teacher creates a group announcement in own group
select lives_ok(
  $$ insert into public.announcements (title, body, scope, group_id, created_by)
     values ('M34-A', 'body', 'group', 'a0000000-0000-0000-0000-000000000000',
             'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  'M34: teacher creates announcement in own group');

-- Test 129: teacher CANNOT create a group announcement in a foreign group → 42501
select throws_ok(
  $$ insert into public.announcements (title, body, scope, group_id, created_by)
     values ('M34-H', 'body', 'group', 'd0000000-0000-0000-0000-000000000000',
             'cccccccc-cccc-cccc-cccc-cccccccccccc') $$,
  '42501', NULL,
  'M34: teacher cannot create announcement in foreign group');

-- teacher creates homework in own group → fires fn_homework_notify
insert into public.homework (id, group_id, title, content_type, source, teacher_id)
  values ('aa340001-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000000',
          'M34-HW', 'file', 'teacher', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- as student A
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Test 130: student sees announcement of own group
select ok(
  (select count(*) > 0 from public.announcements where title = 'M34-A'),
  'M34: student sees announcement of own group');

-- Test 131: student does NOT see foreign-group announcements
select is(
  (select count(*)::int from public.announcements where group_id = 'd0000000-0000-0000-0000-000000000000'), 0,
  'M34: student does not see announcement of another group');

-- Test 132: homework insert produced a notification for the student
select ok(
  (select count(*) > 0 from public.notifications
    where source_id = 'aa340001-0000-0000-0000-000000000000' and kind = 'new_homework'),
  'M34: student receives new_homework notification');

-- Test 133: student cannot see another user's notifications
select is(
  (select count(*)::int from public.notifications
    where recipient_user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'M34: student cannot see another user notifications');

reset role;
delete from public.homework where id = 'aa340001-0000-0000-0000-000000000000';
delete from public.announcements where title in ('M34-A', 'M34-FOREIGN');

-- ============ MIGRATION 35: lesson_stages_v2 + lesson_stage_progress ============
reset role;

-- Test 134: lesson_stages.position column exists (migration 35 schema)
select ok(
  (select count(*) > 0
     from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'lesson_stages'
      and column_name  = 'position'),
  'M35: lesson_stages.position column exists'
);

-- Test 135: lesson_stage_progress table exists
select ok(
  (select count(*) > 0
     from information_schema.tables
    where table_schema = 'public'
      and table_name   = 'lesson_stage_progress'),
  'M35: lesson_stage_progress table exists'
);

-- Test 136 (teacher): can INSERT middle stage in own group lesson
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.lesson_stages (lesson_id, position, stage_role, stage_type, title)
     values ('aa000001-0000-0000-0000-000000000000', 5, 'middle', 'theory', 'M35-TEST-STAGE') $$,
  'M35: teacher can INSERT middle stage in own group lesson'
);

-- Test 137 (teacher): CANNOT INSERT stage in foreign group lesson → 42501
select throws_ok(
  $$ insert into public.lesson_stages (lesson_id, position, stage_role, stage_type, title)
     values ('dd000001-0000-0000-0000-000000000000', 5, 'middle', 'theory', 'HACK-STAGE') $$,
  '42501', NULL,
  'M35: teacher cannot INSERT stage in foreign group lesson'
);

-- Test 138 (student A): can SELECT lesson_stages for own group lesson
reset role;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select count(*) > 0 from public.lesson_stages
    where lesson_id = 'aa000001-0000-0000-0000-000000000000'),
  'M35: student A can SELECT lesson_stages for own group lesson'
);

-- Test 139 (student A): can upsert lesson_stage_progress for own stage
select lives_ok(
  $$ insert into public.lesson_stage_progress (stage_id, student_id, is_completed)
     values (
       (select id from public.lesson_stages
         where lesson_id = 'aa000001-0000-0000-0000-000000000000'
           and stage_role = 'start'
         limit 1),
       'a1111111-1111-1111-1111-111111111111',
       true
     ) $$,
  'M35: student A can upsert lesson_stage_progress for own stage'
);

-- cleanup M35
reset role;
delete from public.lesson_stages where title = 'M35-TEST-STAGE';

-- ============ MIGRATION 36: auto-schedule triggers + visibility ============

-- Test 140 (superuser): fn_compute_lesson_end sets ends_at on INSERT
reset role;
insert into public.lessons
  (id, group_id, teacher_id, starts_at, duration_minutes, status, topic)
  values (
    'aa360001-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000000',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    now() + interval '1 hour', 45, 'scheduled', 'M36-COMPUTE-END'
  );
select ok(
  (select ends_at is not null
     from public.lessons
    where id = 'aa360001-0000-0000-0000-000000000000'),
  'M36-T1: fn_compute_lesson_end sets ends_at on INSERT'
);
delete from public.lessons where id = 'aa360001-0000-0000-0000-000000000000';

-- Test 141 (authenticated teacher): past starts_at rejected by fn_validate_lesson_start
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.lessons
       (group_id, teacher_id, starts_at, duration_minutes, status, topic)
       values (
         'a0000000-0000-0000-0000-000000000000',
         'cccccccc-cccc-cccc-cccc-cccccccccccc',
         '2020-01-01T00:00:00Z', 45, 'scheduled', 'M36-PAST'
       ) $$,
  'P0001', NULL,
  'M36-T2: past starts_at rejected by fn_validate_lesson_start'
);

-- Test 142: fn_auto_start_lessons function exists
reset role;
select has_function('public', 'fn_auto_start_lessons', 'M36-T3: fn_auto_start_lessons exists');

-- Test 143: fn_auto_end_lessons function exists
select has_function('public', 'fn_auto_end_lessons', 'M36-T4: fn_auto_end_lessons exists');

-- Test 144 (M37): lessons has REPLICA IDENTITY FULL so realtime can evaluate the
-- teacher RLS policy (is_my_teacher_group(group_id)) on UPDATE events.
reset role;
select is(
  (select relreplident from pg_class where oid = 'public.lessons'::regclass),
  'f'::"char",
  'M37: lessons has REPLICA IDENTITY FULL'
);

-- Test 145 (M38): stage-attachments storage bucket exists (external-service screenshots).
select is(
  (select count(*)::int from storage.buckets where id = 'stage-attachments'),
  1,
  'M38: stage-attachments bucket exists'
);

-- ============ Migration 39: quizzes (QIA + Kahoot) ============
-- Setup (superuser): one quiz stage in Ivan's lesson (aa000001 / group a0) and
-- one in Elena's lesson (dd000001 / group d0 — NOT Ivan's, NOT student A's).
reset role;
insert into public.lesson_stages (id, lesson_id, position, stage_role, stage_type, content_type, title)
values
  ('99990001-0000-0000-0000-000000000000','aa000001-0000-0000-0000-000000000000',50,'middle','task','quiz_qia','IVAN-QUIZ'),
  ('99990002-0000-0000-0000-000000000000','dd000001-0000-0000-0000-000000000000',50,'middle','task','quiz_qia','ELENA-QUIZ')
on conflict (id) do nothing;

-- teacher_ivan session
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-cccc-cccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

-- Test 146: teacher inserts a quiz_question on his own stage
select lives_ok(
  $$ insert into public.quiz_questions (stage_id, position, question_text, options, correct_option_index)
     values ('99990001-0000-0000-0000-000000000000', 0, 'Q?', '["a","b","c","d"]'::jsonb, 0) $$,
  'M39: teacher inserts quiz_question on own stage'
);

-- Test 147: teacher cannot insert a quiz_question on another group''s stage
select throws_ok(
  $$ insert into public.quiz_questions (stage_id, position, question_text, options, correct_option_index)
     values ('99990002-0000-0000-0000-000000000000', 0, 'HACK', '["a","b"]'::jsonb, 0) $$,
  '42501', NULL, 'M39: teacher cannot insert quiz_question on other group stage'
);

-- Test 148: teacher creates a kahoot_session for his own stage
select lives_ok(
  $$ insert into public.kahoot_sessions (stage_id) values ('99990001-0000-0000-0000-000000000000') $$,
  'M39: teacher creates kahoot_session for own stage'
);

-- student A session
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Test 149: student inserts his OWN quiz_attempt
select lives_ok(
  $$ insert into public.quiz_attempts (stage_id, student_id, total_questions)
     values ('99990001-0000-0000-0000-000000000000', public.current_student_id(), 1) $$,
  'M39: student inserts own quiz_attempt'
);

-- Test 150: student cannot insert an attempt for ANOTHER student
select throws_ok(
  $$ insert into public.quiz_attempts (stage_id, student_id, total_questions)
     values ('99990001-0000-0000-0000-000000000000', 'b2222222-2222-2222-2222-222222222222', 1) $$,
  '42501', NULL, 'M39: student cannot insert another students quiz_attempt'
);

-- Test 151: student sees the kahoot_session of his own group stage
select ok(
  (select count(*)::int > 0 from public.kahoot_sessions
    where stage_id = '99990001-0000-0000-0000-000000000000'),
  'M39: student sees kahoot_session of own group stage'
);

-- ============ Migration 40: lesson_grades ============

-- teacher_ivan session
reset role;
select set_config('request.jwt.claims','{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}', true);
set local role authenticated;

-- Test 152: teacher inserts lesson_grade for a student in own group
select lives_ok(
  $$ insert into public.lesson_grades (lesson_id, student_id, grade, comment, graded_by)
     values ('aa000001-0000-0000-0000-000000000000',
             'a1111111-1111-1111-1111-111111111111',
             5, 'Отлично!',
             public.current_teacher_id()) $$,
  'M40: teacher inserts lesson_grade for student in own group'
);

-- Test 153: teacher cannot insert lesson_grade in a lesson from another group
select throws_ok(
  $$ insert into public.lesson_grades (lesson_id, student_id, grade, graded_by)
     values ('dd000001-0000-0000-0000-000000000000',
             'a1111111-1111-1111-1111-111111111111',
             4,
             public.current_teacher_id()) $$,
  '42501', NULL,
  'M40: teacher cannot insert lesson_grade in another group lesson'
);

-- student A session
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Test 154: student A sees their own lesson_grade
select ok(
  (select count(*)::int > 0 from public.lesson_grades
    where student_id = public.current_student_id()),
  'M40: student sees own lesson_grade'
);

-- student B session
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

-- Test 155: student B cannot see student A's lesson_grade
select is(
  (select count(*)::int from public.lesson_grades
    where student_id = 'a1111111-1111-1111-1111-111111111111'),
  0,
  'M40: student B cannot see student A lesson_grade'
);

reset role;

-- ============ Migration 41: ai_chat_messages ============

-- student A session
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Test 156: student A can INSERT own ai_chat_message
select lives_ok(
  $$ insert into public.ai_chat_messages (student_id, lesson_id, role, content)
     values (public.current_student_id(), 'aa000001-0000-0000-0000-000000000000', 'user', 'M41-TEST') $$,
  'M41: student A can INSERT own ai_chat_message'
);

-- student B session
reset role;
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

-- Test 157: student B cannot see student A's messages
select is(
  (select count(*)::int from public.ai_chat_messages
    where student_id = 'a1111111-1111-1111-1111-111111111111'),
  0,
  'M41: student B cannot see student A ai_chat_messages'
);

-- Test 158: DELETE is blocked (no GRANT DELETE on table)
select throws_ok(
  $$ delete from public.ai_chat_messages
      where student_id = 'a1111111-1111-1111-1111-111111111111' $$,
  '42501', NULL,
  'M41: DELETE ai_chat_messages is blocked (no grant)'
);

reset role;

-- ============ MIGRATION 42: admin role + fn_is_admin ============

-- Setup (superuser): create test admin auth user + admins entry
-- Also: a throwaway auth user for the INSERT-into-students test
reset role;

insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current, reauthentication_token
) values
  ('00000000-0000-0000-0000-000000000000',
   'ad000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pgtap_admin@admins.snr.local',
   crypt('adminpwd', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000',
   'ad000001-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'pgtap_new_student@students.snr.local',
   crypt('studentpwd', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
   now(), now(), '', '', '', '', '', '', '', '')
on conflict (id) do nothing;

insert into public.admins (user_id, full_name)
values ('ad000000-0000-0000-0000-000000000000', 'PGTap Admin')
on conflict (user_id) do nothing;

-- Test 159: fn_is_admin returns true for the test admin user
select is(
  public.fn_is_admin('ad000000-0000-0000-0000-000000000000'),
  true,
  'M42: fn_is_admin returns true for admin user'
);

-- Test 160: fn_is_admin returns false for student A
select is(
  public.fn_is_admin('11111111-1111-1111-1111-111111111111'),
  false,
  'M42: fn_is_admin returns false for student user'
);

-- Test 161: admin can INSERT into students (admin full access policy)
select set_config('request.jwt.claims',
  '{"sub":"ad000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$ insert into public.students (user_id, full_name, username)
     values ('ad000001-0000-0000-0000-000000000000', 'PGTap New Student', 'pgtap_student_42')
     on conflict (user_id) do nothing $$,
  'M42: admin can INSERT into students (admin full access policy)'
);

-- Test 162: non-admin (teacher jwt, not in admins) cannot INSERT into students
reset role;
select set_config('request.jwt.claims',
  '{"sub":"ffffffff-ffff-ffff-ffff-ffffffffffff","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ insert into public.students (user_id, full_name, username)
     values ('ad000000-0000-0000-0000-000000000000', 'Hack Student', 'hack_42') $$,
  '42501', NULL,
  'M42: non-admin cannot INSERT into students table (42501)'
);

-- cleanup M42
reset role;
delete from public.students where username in ('pgtap_student_42', 'hack_42');
delete from public.admins where full_name = 'PGTap Admin';
delete from auth.users where email in ('pgtap_admin@admins.snr.local', 'pgtap_new_student@students.snr.local');

select * from finish();
rollback;

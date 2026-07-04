-- =====================================================================
-- Migration 70 — Three grade-level demo students (3-А, 7-А, 10-А).
--
-- Context: the existing demo_student (migration 66) is a single account in
-- one mixed-content "Демо-класс" group. The customer wants three separate
-- demo students — one per grade band — each seeing only level-appropriate
-- content, all taught by the same existing demo_teacher.
--
-- Decision: demo_student/demo_teacher/"Демо-класс" (migration 66) are left
-- completely untouched — no rows moved, deleted, or renamed. This is the
-- option that changes the least existing data (the alternative, moving
-- demo_student into a new "Демо 10-А" group and deleting "Демо-класс",
-- would touch an existing account's group membership and its lessons/
-- homework/materials). The DemoRoleModal UI simply stops offering the old
-- demo_student as a button — its account keeps working exactly as before
-- if someone logs in with its credentials directly.
--
-- Three NEW groups + three NEW student accounts are created below, taught
-- by the SAME demo_teacher (ca1fbee0-5899-4dda-88fa-1dd0df9d4320), fully
-- isolated from each other and from every other group via the existing
-- student_groups-based RLS (is_my_group()) — no RLS policy changes needed.
--
-- Idempotent throughout: safe to re-run (matches the pattern established in
-- migrations 65/66 — existence checks by email/username/group name before
-- insert; content-seeding guarded by a per-group "already has lessons?"
-- check so re-running the migration never duplicates lessons/homework).
-- =====================================================================

DO $$
DECLARE
  v_teacher_user uuid;
  v_teacher_id   uuid;

  v_s3_user  uuid;
  v_s3_id    uuid;
  v_s7_user  uuid;
  v_s7_id    uuid;
  v_s10_user uuid;
  v_s10_id   uuid;

  v_group_3a  uuid := 'd0d0d0d0-4444-0000-0000-000000000001';
  v_group_7a  uuid := 'd0d0d0d0-4444-0000-0000-000000000002';
  v_group_10a uuid := 'd0d0d0d0-4444-0000-0000-000000000003';
BEGIN
  -- ── demo_teacher (existing — just resolve its ids) ─────────────────
  SELECT id INTO v_teacher_user FROM auth.users WHERE email = 'demo_teacher@demo.snr.local';
  SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_teacher_user;
  IF v_teacher_id IS NULL THEN
    RAISE EXCEPTION 'demo_teacher not found — expected it to already exist from migration 66';
  END IF;

  -- ── demo_student_3 (3-А) ────────────────────────────────────────────
  SELECT id INTO v_s3_user FROM auth.users WHERE email = 'demo_student_3@demo.snr.local';
  IF v_s3_user IS NULL THEN
    v_s3_user := 'd0d0d0d0-3333-0000-0000-000000000001';
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_s3_user, 'authenticated', 'authenticated',
      'demo_student_3@demo.snr.local', extensions.crypt('demo2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_s3_user, 'demo_student_3@demo.snr.local',
      jsonb_build_object('sub', v_s3_user::text, 'email', 'demo_student_3@demo.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_s3_user;
  END IF;

  SELECT id INTO v_s3_id FROM public.students WHERE user_id = v_s3_user;
  IF v_s3_id IS NULL THEN
    INSERT INTO public.students (id, user_id, username, full_name, grade)
    VALUES ('d0d0d0d0-3333-1111-0000-000000000001', v_s3_user, 'demo_student_3', 'Демо Ученик 3-А', '3 класс')
    ON CONFLICT (username) DO NOTHING;
    SELECT id INTO v_s3_id FROM public.students WHERE user_id = v_s3_user;
  END IF;

  -- ── demo_student_7 (7-А) ────────────────────────────────────────────
  SELECT id INTO v_s7_user FROM auth.users WHERE email = 'demo_student_7@demo.snr.local';
  IF v_s7_user IS NULL THEN
    v_s7_user := 'd0d0d0d0-3333-0000-0000-000000000002';
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_s7_user, 'authenticated', 'authenticated',
      'demo_student_7@demo.snr.local', extensions.crypt('demo2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_s7_user, 'demo_student_7@demo.snr.local',
      jsonb_build_object('sub', v_s7_user::text, 'email', 'demo_student_7@demo.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_s7_user;
  END IF;

  SELECT id INTO v_s7_id FROM public.students WHERE user_id = v_s7_user;
  IF v_s7_id IS NULL THEN
    INSERT INTO public.students (id, user_id, username, full_name, grade)
    VALUES ('d0d0d0d0-3333-1111-0000-000000000002', v_s7_user, 'demo_student_7', 'Демо Ученик 7-А', '7 класс')
    ON CONFLICT (username) DO NOTHING;
    SELECT id INTO v_s7_id FROM public.students WHERE user_id = v_s7_user;
  END IF;

  -- ── demo_student_10 (10-А) ──────────────────────────────────────────
  SELECT id INTO v_s10_user FROM auth.users WHERE email = 'demo_student_10@demo.snr.local';
  IF v_s10_user IS NULL THEN
    v_s10_user := 'd0d0d0d0-3333-0000-0000-000000000003';
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_s10_user, 'authenticated', 'authenticated',
      'demo_student_10@demo.snr.local', extensions.crypt('demo2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_s10_user, 'demo_student_10@demo.snr.local',
      jsonb_build_object('sub', v_s10_user::text, 'email', 'demo_student_10@demo.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_s10_user;
  END IF;

  SELECT id INTO v_s10_id FROM public.students WHERE user_id = v_s10_user;
  IF v_s10_id IS NULL THEN
    INSERT INTO public.students (id, user_id, username, full_name, grade)
    VALUES ('d0d0d0d0-3333-1111-0000-000000000003', v_s10_user, 'demo_student_10', 'Демо Ученик 10-А', '10 класс')
    ON CONFLICT (username) DO NOTHING;
    SELECT id INTO v_s10_id FROM public.students WHERE user_id = v_s10_user;
  END IF;

  -- ── Three new groups, all taught by demo_teacher ───────────────────
  INSERT INTO public.groups (id, name, subject, teacher_id)
  VALUES (v_group_3a, 'Демо 3-А', 'programming', v_teacher_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.groups (id, name, subject, teacher_id)
  VALUES (v_group_7a, 'Демо 7-А', 'programming', v_teacher_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.groups (id, name, subject, teacher_id)
  VALUES (v_group_10a, 'Демо 10-А', 'programming', v_teacher_id)
  ON CONFLICT (id) DO NOTHING;

  -- ── Each new student enrolled ONLY in their own new group ──────────
  IF v_s3_id IS NOT NULL THEN
    INSERT INTO public.student_groups (student_id, group_id) VALUES (v_s3_id, v_group_3a) ON CONFLICT DO NOTHING;
  END IF;
  IF v_s7_id IS NOT NULL THEN
    INSERT INTO public.student_groups (student_id, group_id) VALUES (v_s7_id, v_group_7a) ON CONFLICT DO NOTHING;
  END IF;
  IF v_s10_id IS NOT NULL THEN
    INSERT INTO public.student_groups (student_id, group_id) VALUES (v_s10_id, v_group_10a) ON CONFLICT DO NOTHING;
  END IF;

  -- =====================================================================
  -- Content seeding — guarded per group so re-running this migration
  -- never duplicates lessons/homework/materials.
  -- =====================================================================

  -- ── Демо 3-А: TurboWarp basics ──────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE group_id = v_group_3a) THEN
    INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, room)
    VALUES ('d0d0d0d0-5555-0000-0000-000000000001', v_group_3a, 1,
      'Знакомство с TurboWarp', 'Знакомство с TurboWarp: первый спрайт', 'scheduled',
      '2026-07-08 09:00:00+00', '2026-07-08 09:45:00+00', 'Каб. 101');

    -- position 0 (start) and 9999 (summary) are auto-created by
    -- trg_lesson_default_stages / fn_create_default_stages() — only the
    -- 'middle' stages need to be inserted explicitly.
    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title, description, duration_min)
    VALUES
      ('d0d0d0d0-5555-0000-0000-000000000001', 1, 'middle', 'theory', 'presentation', 'Что такое программа?', 'Знакомство с блоками и спрайтами', 10),
      ('d0d0d0d0-5555-0000-0000-000000000001', 2, 'middle', 'task', 'turbowarp', 'Оживи кота', 'Заставь спрайта двигаться и мяукать', 20);

    INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, started_at, ended_at, room)
    VALUES ('d0d0d0d0-5555-0000-0000-000000000002', v_group_3a, 2,
      'Движение и звуки', 'Движение и звуки в TurboWarp', 'completed',
      '2026-07-01 09:00:00+00', '2026-07-01 09:45:00+00', '2026-07-01 09:00:00+00', '2026-07-01 09:45:00+00', 'Каб. 101');

    INSERT INTO public.homework (group_id, lesson_id, title, description, due_date, content_type, source, teacher_id)
    VALUES (v_group_3a, 'd0d0d0d0-5555-0000-0000-000000000001',
      'Собери анимацию персонажа', 'Сделай так, чтобы спрайт двигался по сцене и менял костюм.',
      '2026-07-12 18:00:00+00', 'file', 'curriculum', v_teacher_id);

    INSERT INTO public.course_materials (group_id, title, type, link_url, description, subject)
    VALUES (v_group_3a, 'Введение в TurboWarp/Scratch', 'link', 'https://scratch.mit.edu/',
      'Официальный сайт Scratch — база блоков TurboWarp', 'Программирование');
  END IF;

  -- ── Демо 7-А: Python basics ─────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE group_id = v_group_7a) THEN
    INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, room)
    VALUES ('d0d0d0d0-5555-0000-0000-000000000003', v_group_7a, 1,
      'Переменные и типы данных', 'Основы Python: переменные и типы данных', 'scheduled',
      '2026-07-08 10:00:00+00', '2026-07-08 10:45:00+00', 'Каб. 204');

    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title, description, duration_min)
    VALUES
      ('d0d0d0d0-5555-0000-0000-000000000003', 1, 'middle', 'theory', 'presentation', 'Что такое переменная?', 'int, str, float, bool', 10),
      ('d0d0d0d0-5555-0000-0000-000000000003', 2, 'middle', 'task', 'code', 'Первая программа', 'Выведи своё имя и возраст', 20);

    INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, started_at, ended_at, room)
    VALUES ('d0d0d0d0-5555-0000-0000-000000000004', v_group_7a, 2,
      'Условные конструкции', 'Условные конструкции if/else', 'completed',
      '2026-07-01 10:00:00+00', '2026-07-01 10:45:00+00', '2026-07-01 10:00:00+00', '2026-07-01 10:45:00+00', 'Каб. 204');

    INSERT INTO public.homework (group_id, lesson_id, title, description, due_date, content_type, source, teacher_id, programming_language)
    VALUES (v_group_7a, 'd0d0d0d0-5555-0000-0000-000000000003',
      'Калькулятор на Python', 'Напиши программу, которая складывает, вычитает, умножает и делит два числа.',
      '2026-07-12 18:00:00+00', 'file', 'curriculum', v_teacher_id, 'python');

    INSERT INTO public.course_materials (group_id, title, type, link_url, description, subject)
    VALUES (v_group_7a, 'Документация Python', 'link', 'https://docs.python.org/3/tutorial/',
      'Официальный туториал по Python', 'Программирование');
  END IF;

  -- ── Демо 10-А: Arduino/Wokwi ────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE group_id = v_group_10a) THEN
    INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, room)
    VALUES ('d0d0d0d0-5555-0000-0000-000000000005', v_group_10a, 1,
      'Мигающий светодиод', 'Arduino: мигающий светодиод', 'scheduled',
      '2026-07-08 11:00:00+00', '2026-07-08 11:45:00+00', 'Лаб. 2');

    INSERT INTO public.lesson_stages (lesson_id, position, stage_role, stage_type, content_type, title, description, duration_min)
    VALUES
      ('d0d0d0d0-5555-0000-0000-000000000005', 1, 'middle', 'theory', 'presentation', 'Введение в Arduino', 'Платы, пины, среда разработки', 10),
      ('d0d0d0d0-5555-0000-0000-000000000005', 2, 'middle', 'task', 'wokwi', 'Схема мигания', 'Собери схему с резистором и светодиодом', 20);

    INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, started_at, ended_at, room)
    VALUES ('d0d0d0d0-5555-0000-0000-000000000006', v_group_10a, 2,
      'Датчики и ввод', 'Arduino: датчики и ввод', 'completed',
      '2026-07-01 11:00:00+00', '2026-07-01 11:45:00+00', '2026-07-01 11:00:00+00', '2026-07-01 11:45:00+00', 'Лаб. 2');

    INSERT INTO public.homework (group_id, lesson_id, title, description, due_date, content_type, source, teacher_id)
    VALUES (v_group_10a, 'd0d0d0d0-5555-0000-0000-000000000005',
      'Схема с двумя светодиодами', 'Собери в Wokwi схему с двумя независимо мигающими светодиодами.',
      '2026-07-12 18:00:00+00', 'file', 'curriculum', v_teacher_id);

    INSERT INTO public.course_materials (group_id, title, type, link_url, description, subject)
    VALUES (v_group_10a, 'Документация Arduino', 'link', 'https://docs.arduino.cc/',
      'Официальная документация Arduino', 'Робототехника');
  END IF;
END $$;

-- =====================================================================
-- reset_demo_data() — NOT modified. It already discovers demo users
-- generically via raw_user_meta_data.is_demo = true (see migration 65),
-- and derives their groups/lessons/homework via teacher_id/student_id —
-- both new demo_teacher-led groups and the three new students are
-- automatically covered without any change to the function body.
-- =====================================================================

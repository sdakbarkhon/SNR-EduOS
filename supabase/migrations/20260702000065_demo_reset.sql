-- pgcrypto provides crypt()/gen_salt() used below to hash demo passwords
-- (already enabled via seed.sql locally, but migrations run independently
-- of seed.sql on hosted — this is a no-op if it's already on).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- Migration 65 — Демо-режим: nightly reset + сами демо-аккаунты.
--
-- ВАЖНО про обнаружение "демо": НЕ по домену почты (@teachers.snr.local /
-- @students.snr.local), потому что этот домен используют и уже существующие
-- тестовые аккаунты этого проекта (teacher_ivan, adilbek_07, dilnoza_09) —
-- ими пользовались весь предыдущий цикл разработки для проверки фич, и
-- ночная чистка их уроков/ДЗ была бы разрушительной и явно не тем, что
-- задумывалось. Вместо этого демо-аккаунты помечаются
-- raw_user_meta_data.is_demo = true, и именно по этому флагу решает и
-- reset_demo_data() ниже, и клиентский DemoBanner.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reset_demo_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_user_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO demo_user_ids
  FROM auth.users
  WHERE (raw_user_meta_data->>'is_demo')::boolean IS TRUE;

  IF demo_user_ids IS NULL OR array_length(demo_user_ids, 1) = 0 THEN
    RAISE NOTICE '[reset-demo] no demo users found, nothing to clean';
    RETURN;
  END IF;

  -- 1. Уроки в группах демо-учителей (lessons не имеет created_by — владение
  --    идёт через group_id -> groups.teacher_id). Каскадно удалит
  --    lesson_stages, lesson_materials, lesson_stage_progress,
  --    lesson_raised_hands, quiz_questions/quiz_attempts/quiz_answers,
  --    kahoot_sessions — все они ссылаются на lessons/lesson_stages
  --    с ON DELETE CASCADE.
  DELETE FROM public.lessons
  WHERE group_id IN (
    SELECT id FROM public.groups
    WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = ANY(demo_user_ids))
  );

  -- 2. ДЗ, созданные демо-учителями (homework.teacher_id — прямая колонка,
  --    в отличие от lessons). Каскадно удалит homework_submissions.
  DELETE FROM public.homework
  WHERE teacher_id IN (SELECT id FROM public.teachers WHERE user_id = ANY(demo_user_ids));

  -- 3-5: доп. подчистка по демо-ученикам напрямую — страховка на случай,
  -- если демо-ученик когда-либо окажется в уроке НЕ демо-учителя (тогда
  -- каскад из шага 1 его не заденет).
  DELETE FROM public.lesson_raised_hands
  WHERE student_id IN (SELECT id FROM public.students WHERE user_id = ANY(demo_user_ids));

  DELETE FROM public.lesson_stage_progress
  WHERE student_id IN (SELECT id FROM public.students WHERE user_id = ANY(demo_user_ids));

  -- quiz_answers ссылается только на attempt_id (без student_id) и удаляется
  -- каскадно вместе с quiz_attempts — отдельный DELETE для него не нужен.
  DELETE FROM public.quiz_attempts
  WHERE student_id IN (SELECT id FROM public.students WHERE user_id = ANY(demo_user_ids));

  -- 6. Уведомления демо-пользователей (колонка называется recipient_user_id).
  DELETE FROM public.notifications
  WHERE recipient_user_id = ANY(demo_user_ids);

  -- 7. История ИИ-чата демо-учеников (таблица ai_chat_messages, ключ student_id).
  DELETE FROM public.ai_chat_messages
  WHERE student_id IN (SELECT id FROM public.students WHERE user_id = ANY(demo_user_ids));

  -- НЕ ТРОГАЕМ:
  -- - subjects, groups, courses (справочники, включая сами демо-группы)
  -- - books, materials (общие материалы)
  -- - auth.users, teachers, students (сами демо-аккаунты)

  RAISE NOTICE '[reset-demo] completed for % users', array_length(demo_user_ids, 1);
END;
$$;

COMMENT ON FUNCTION public.reset_demo_data() IS
  'Раз в сутки чистит данные, созданные демо-аккаунтами (is_demo=true в user_metadata). Не трогает справочники и сами аккаунты.';

GRANT EXECUTE ON FUNCTION public.reset_demo_data() TO postgres, service_role;

-- pg_cron job — раз в сутки в 22:00 UTC (= 3:00 ночи Ташкент UTC+5).
-- Идемпотентно: снимаем прежний job с этим именем перед пересозданием,
-- чтобы повторное применение миграции не плодило дубликаты (тот же
-- паттерн, что и в 20260620000036_auto_schedule.sql).
DO $$ BEGIN
  PERFORM cron.unschedule('reset-demo-data');
EXCEPTION WHEN others THEN NULL;
END $$;
SELECT cron.schedule('reset-demo-data', '0 22 * * *', $$SELECT public.reset_demo_data()$$);

-- =====================================================================
-- Демо-аккаунты для кнопки "Демо-режим" на /login.
-- Идемпотентно: если аккаунт с этим email/username уже существует
-- (например, создан вручную раньше), переиспользует его id и только
-- проставляет is_demo=true — новую запись не создаёт.
-- =====================================================================

DO $$
DECLARE
  v_teacher_user uuid;
  v_teacher_id   uuid;
  v_aziz_user    uuid;
  v_aziz_id      uuid;
  v_nodira_user  uuid;
  v_nodira_id    uuid;
  v_sherzod_user uuid;
  v_sherzod_id   uuid;
  v_group_3a     uuid;
  v_group_7a     uuid;
  v_group_10a    uuid;
BEGIN
  -- ── teacher_demo ──────────────────────────────────────────────────
  SELECT id INTO v_teacher_user FROM auth.users WHERE email = 'teacher_demo@teachers.snr.local';
  IF v_teacher_user IS NULL THEN
    v_teacher_user := 'd0d0d0d0-0000-0000-0000-000000000001';
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_teacher_user, 'authenticated', 'authenticated',
      'teacher_demo@teachers.snr.local', crypt('password123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_teacher_user, 'teacher_demo@teachers.snr.local',
      jsonb_build_object('sub', v_teacher_user::text, 'email', 'teacher_demo@teachers.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_teacher_user;
  END IF;

  SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_teacher_user;
  IF v_teacher_id IS NULL THEN
    INSERT INTO public.teachers (id, user_id, full_name, username)
    VALUES ('d0d0d0d0-1111-0000-0000-000000000001', v_teacher_user, 'Карим Алишер', 'teacher_demo')
    ON CONFLICT (username) DO NOTHING;
    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_teacher_user;
  END IF;

  -- ── aziz_03 (ученик, 3 класс) ─────────────────────────────────────
  SELECT id INTO v_aziz_user FROM auth.users WHERE email = 'aziz_03@students.snr.local';
  IF v_aziz_user IS NULL THEN
    v_aziz_user := 'd0d0d0d0-0000-0000-0000-000000000002';
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_aziz_user, 'authenticated', 'authenticated',
      'aziz_03@students.snr.local', crypt('password123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_aziz_user, 'aziz_03@students.snr.local',
      jsonb_build_object('sub', v_aziz_user::text, 'email', 'aziz_03@students.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_aziz_user;
  END IF;

  SELECT id INTO v_aziz_id FROM public.students WHERE user_id = v_aziz_user;
  IF v_aziz_id IS NULL THEN
    INSERT INTO public.students (id, user_id, username, full_name, grade)
    VALUES ('d0d0d0d0-1111-0000-0000-000000000002', v_aziz_user, 'aziz_03', 'Aziz Karimov', '3 класс')
    ON CONFLICT (username) DO NOTHING;
    SELECT id INTO v_aziz_id FROM public.students WHERE user_id = v_aziz_user;
  END IF;

  -- ── nodira_07 (ученица, 7 класс) ──────────────────────────────────
  SELECT id INTO v_nodira_user FROM auth.users WHERE email = 'nodira_07@students.snr.local';
  IF v_nodira_user IS NULL THEN
    v_nodira_user := 'd0d0d0d0-0000-0000-0000-000000000003';
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_nodira_user, 'authenticated', 'authenticated',
      'nodira_07@students.snr.local', crypt('password123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_nodira_user, 'nodira_07@students.snr.local',
      jsonb_build_object('sub', v_nodira_user::text, 'email', 'nodira_07@students.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_nodira_user;
  END IF;

  SELECT id INTO v_nodira_id FROM public.students WHERE user_id = v_nodira_user;
  IF v_nodira_id IS NULL THEN
    INSERT INTO public.students (id, user_id, username, full_name, grade)
    VALUES ('d0d0d0d0-1111-0000-0000-000000000003', v_nodira_user, 'nodira_07', 'Nodira Yusupova', '7 класс')
    ON CONFLICT (username) DO NOTHING;
    SELECT id INTO v_nodira_id FROM public.students WHERE user_id = v_nodira_user;
  END IF;

  -- ── sherzod_10 (ученик, 10 класс) ─────────────────────────────────
  SELECT id INTO v_sherzod_user FROM auth.users WHERE email = 'sherzod_10@students.snr.local';
  IF v_sherzod_user IS NULL THEN
    v_sherzod_user := 'd0d0d0d0-0000-0000-0000-000000000004';
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_sherzod_user, 'authenticated', 'authenticated',
      'sherzod_10@students.snr.local', crypt('password123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_sherzod_user, 'sherzod_10@students.snr.local',
      jsonb_build_object('sub', v_sherzod_user::text, 'email', 'sherzod_10@students.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_sherzod_user;
  END IF;

  SELECT id INTO v_sherzod_id FROM public.students WHERE user_id = v_sherzod_user;
  IF v_sherzod_id IS NULL THEN
    INSERT INTO public.students (id, user_id, username, full_name, grade)
    VALUES ('d0d0d0d0-1111-0000-0000-000000000004', v_sherzod_user, 'sherzod_10', 'Sherzod Tashkenbaev', '10 класс')
    ON CONFLICT (username) DO NOTHING;
    SELECT id INTO v_sherzod_id FROM public.students WHERE user_id = v_sherzod_user;
  END IF;

  -- ── Демо-группы (по одной на класс), ведёт teacher_demo ───────────
  IF v_teacher_id IS NOT NULL THEN
    SELECT id INTO v_group_3a FROM public.groups WHERE teacher_id = v_teacher_id AND name = 'Программирование 3-А (демо)';
    IF v_group_3a IS NULL THEN
      v_group_3a := 'd0d0d0d0-2222-0000-0000-000000000001';
      INSERT INTO public.groups (id, name, subject, teacher_id)
      VALUES (v_group_3a, 'Программирование 3-А (демо)', 'programming', v_teacher_id);
    END IF;

    SELECT id INTO v_group_7a FROM public.groups WHERE teacher_id = v_teacher_id AND name = 'Программирование 7-А (демо)';
    IF v_group_7a IS NULL THEN
      v_group_7a := 'd0d0d0d0-2222-0000-0000-000000000002';
      INSERT INTO public.groups (id, name, subject, teacher_id)
      VALUES (v_group_7a, 'Программирование 7-А (демо)', 'programming', v_teacher_id);
    END IF;

    SELECT id INTO v_group_10a FROM public.groups WHERE teacher_id = v_teacher_id AND name = 'Программирование 10-А (демо)';
    IF v_group_10a IS NULL THEN
      v_group_10a := 'd0d0d0d0-2222-0000-0000-000000000003';
      INSERT INTO public.groups (id, name, subject, teacher_id)
      VALUES (v_group_10a, 'Программирование 10-А (демо)', 'programming', v_teacher_id);
    END IF;

    IF v_aziz_id IS NOT NULL AND v_group_3a IS NOT NULL THEN
      INSERT INTO public.student_groups (student_id, group_id) VALUES (v_aziz_id, v_group_3a) ON CONFLICT DO NOTHING;
    END IF;
    IF v_nodira_id IS NOT NULL AND v_group_7a IS NOT NULL THEN
      INSERT INTO public.student_groups (student_id, group_id) VALUES (v_nodira_id, v_group_7a) ON CONFLICT DO NOTHING;
    END IF;
    IF v_sherzod_id IS NOT NULL AND v_group_10a IS NOT NULL THEN
      INSERT INTO public.student_groups (student_id, group_id) VALUES (v_sherzod_id, v_group_10a) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

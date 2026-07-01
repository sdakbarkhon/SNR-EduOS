-- =====================================================================
-- Migration 66 — Demo accounts v2.
--
-- Problem: teacher_demo/aziz_03/nodira_07/sherzod_10 (migration 65) were
-- flagged is_demo=true, but people also log into them directly with their
-- real credentials (they're memorable/documented usernames) and got shown
-- a "you're in demo mode" banner even on a completely normal login. Fix:
-- unflag those 4 (they become regular accounts, groups/lessons untouched)
-- and introduce 2 accounts on their own domain (@demo.snr.local) that only
-- exist to be the "Demo Mode" button's destination.
-- =====================================================================

-- pgcrypto IS already installed on this project, but in the `extensions`
-- schema (Supabase's convention for hosted projects) — not `public`, and not
-- necessarily on the search_path a migration runs with. Unqualified crypt()/
-- gen_salt() calls therefore fail with "function does not exist" (42883).
-- `IF NOT EXISTS` makes this a no-op if it's already there; the schema calls
-- below are qualified explicitly so this works regardless of search_path.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Unflag the old accounts — they keep their data, just stop being "demo".
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'is_demo'
WHERE email IN (
  'teacher_demo@teachers.snr.local',
  'aziz_03@students.snr.local',
  'nodira_07@students.snr.local',
  'sherzod_10@students.snr.local'
);

-- 2. Create the 2 new demo accounts (idempotent — reuses existing row by
-- email if already present, matching the pattern in migration 65).
DO $$
DECLARE
  v_teacher_user uuid;
  v_teacher_id   uuid;
  v_student_user uuid;
  v_student_id   uuid;
  v_group_id     uuid;
BEGIN
  -- ── demo_teacher ──────────────────────────────────────────────────
  SELECT id INTO v_teacher_user FROM auth.users WHERE email = 'demo_teacher@demo.snr.local';
  IF v_teacher_user IS NULL THEN
    v_teacher_user := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_teacher_user, 'authenticated', 'authenticated',
      'demo_teacher@demo.snr.local', extensions.crypt('demo2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_teacher_user, 'demo_teacher@demo.snr.local',
      jsonb_build_object('sub', v_teacher_user::text, 'email', 'demo_teacher@demo.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_teacher_user;
  END IF;

  SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_teacher_user;
  IF v_teacher_id IS NULL THEN
    INSERT INTO public.teachers (id, user_id, full_name)
    VALUES (gen_random_uuid(), v_teacher_user, 'Демо Учитель')
    RETURNING id INTO v_teacher_id;
  END IF;

  -- ── demo_student ──────────────────────────────────────────────────
  SELECT id INTO v_student_user FROM auth.users WHERE email = 'demo_student@demo.snr.local';
  IF v_student_user IS NULL THEN
    v_student_user := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_student_user, 'authenticated', 'authenticated',
      'demo_student@demo.snr.local', extensions.crypt('demo2026', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_student_user, 'demo_student@demo.snr.local',
      jsonb_build_object('sub', v_student_user::text, 'email', 'demo_student@demo.snr.local'),
      'email', now(), now(), now());
  ELSE
    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"is_demo":true}'::jsonb
    WHERE id = v_student_user;
  END IF;

  SELECT id INTO v_student_id FROM public.students WHERE user_id = v_student_user;
  IF v_student_id IS NULL THEN
    INSERT INTO public.students (id, user_id, username, full_name, grade)
    VALUES (gen_random_uuid(), v_student_user, 'demo_student', 'Демо Ученик', '7 класс')
    ON CONFLICT (username) DO NOTHING
    RETURNING id INTO v_student_id;
    IF v_student_id IS NULL THEN
      SELECT id INTO v_student_id FROM public.students WHERE user_id = v_student_user;
    END IF;
  END IF;

  -- ── Demo class taught by demo_teacher, demo_student enrolled ───────
  IF v_teacher_id IS NOT NULL THEN
    SELECT id INTO v_group_id FROM public.groups WHERE teacher_id = v_teacher_id AND name = 'Демо-класс';
    IF v_group_id IS NULL THEN
      INSERT INTO public.groups (id, name, subject, teacher_id)
      VALUES (gen_random_uuid(), 'Демо-класс', 'programming', v_teacher_id)
      RETURNING id INTO v_group_id;
    END IF;

    IF v_student_id IS NOT NULL AND v_group_id IS NOT NULL THEN
      INSERT INTO public.student_groups (student_id, group_id)
      VALUES (v_student_id, v_group_id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

COMMENT ON FUNCTION public.reset_demo_data() IS
  'Раз в сутки чистит данные демо-аккаунтов (is_demo=true в user_metadata) — сейчас это только demo_teacher/demo_student (миграция 66). teacher_demo/aziz_03/nodira_07/sherzod_10 разфлагованы этой миграцией и больше не затрагиваются.';

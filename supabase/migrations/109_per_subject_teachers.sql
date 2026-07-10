-- Migration 109 — PROMT 3, Часть 2: Учителя по предметам
--
-- 1. Добавить teachers.subject_slug (NULLable) — назначает учителя на предмет.
-- 2. Удалить старых 5 demo_teacher_01..05 (без привязки к предмету).
-- 3. Создать 5 РЕАЛЬНЫХ предметных учителей:
--    teacher_prog / robot / math / english / russian, password123.
--    Реалистичные ФИО, узб/рус, разного пола.
-- 4. Создать 25 ДЕМО-учителей: demo_teacher_{slug}_01..05 (5×5), пароль demo2026.
-- 5. Перезаселить group_teachers — 3 группы × 5 реальных предметных = 15 записей.
--    teacher_karim остаётся во всех 3 группах как куратор общего управления.
-- 6. subjects.teacher_id перепривязать: рабочий предмет → его учитель.
-- 7. demo_sessions — очистить старое (там были ссылки на удаляемых demo_teacher_01..05),
--    заново заселить сессии на всех 25 новых демо-учителей + существующих демо-учеников.
-- 8. Обновить claim_demo_account(p_kind, p_subject_slug, p_grade) — поддерживает
--    выбор демо-учителя по предмету.

BEGIN;

-- ── 1. teachers.subject_slug ─────────────────────────────────────────────
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS subject_slug text;

COMMENT ON COLUMN public.teachers.subject_slug IS
  'Slug рабочего предмета учителя: programming/robotics/math/english/russian. NULL = куратор общего управления (teacher_karim).';

CREATE INDEX IF NOT EXISTS idx_teachers_subject_slug ON public.teachers (subject_slug) WHERE subject_slug IS NOT NULL;

-- ── 2. Удалить старых demo_teacher_01..05 ────────────────────────────────
-- Сначала снимаем FK из demo_sessions, group_teachers, subjects.teacher_id
DELETE FROM public.demo_sessions
WHERE account_user_id IN (
  SELECT user_id FROM public.teachers WHERE username LIKE 'demo_teacher_0%'
);

DELETE FROM public.group_teachers
WHERE teacher_id IN (
  SELECT id FROM public.teachers WHERE username LIKE 'demo_teacher_0%'
);

-- subjects.teacher_id временно перепривязать на teacher_karim, чтобы NOT NULL не сломало
UPDATE public.subjects
SET teacher_id = (SELECT id FROM public.teachers WHERE username = 'teacher_karim')
WHERE teacher_id IN (SELECT id FROM public.teachers WHERE username LIKE 'demo_teacher_0%');

-- Удаляем teachers-записи
DELETE FROM public.teachers WHERE username LIKE 'demo_teacher_0%';

-- Удаляем auth.users по email-домену — если остались от предыдущих demo_teacher
DELETE FROM auth.users WHERE email LIKE 'demo_teacher_0%@demo.snr.local';

-- ── 3. 5 РЕАЛЬНЫХ предметных учителей ────────────────────────────────────
DO $$
DECLARE
  v_school_id CONSTANT uuid := 'a0a0a0a0-0000-0000-0000-000000000001';
  r RECORD;
  v_user_id uuid;
  v_teacher_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('teacher_prog',    'Rustam Rakhmatov',    'programming', 'password123', '@teachers.snr.local'),
      ('teacher_robot',   'Kamila Yusupova',     'robotics',    'password123', '@teachers.snr.local'),
      ('teacher_math',    'Elena Sokolova',      'math',        'password123', '@teachers.snr.local'),
      ('teacher_english', 'Diana Bekmuradova',   'english',     'password123', '@teachers.snr.local'),
      ('teacher_russian', 'Igor Pavlov',         'russian',     'password123', '@teachers.snr.local')
    ) AS t(username, full_name, slug, password, domain)
  LOOP
    -- 1) auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = r.username || r.domain;
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        r.username || r.domain, extensions.crypt(r.password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        now(), now(), '', '', '', '', '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id, r.username || r.domain,
        jsonb_build_object('sub', v_user_id::text, 'email', r.username || r.domain),
        'email', now(), now(), now());
    END IF;

    -- 2) teachers row
    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_user_id;
    IF v_teacher_id IS NULL THEN
      INSERT INTO public.teachers (user_id, username, full_name, subject_slug, school_id)
      VALUES (v_user_id, r.username, r.full_name, r.slug, v_school_id)
      RETURNING id INTO v_teacher_id;
    ELSE
      UPDATE public.teachers SET subject_slug = r.slug, full_name = r.full_name WHERE id = v_teacher_id;
    END IF;

    -- 3) group_teachers: во всех 3 группах
    INSERT INTO public.group_teachers (group_id, teacher_id, school_id)
    SELECT g.id, v_teacher_id, v_school_id FROM public.groups g
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- teacher_karim остаётся во всех 3 группах (был там уже, ре-вставляем на всякий случай)
  INSERT INTO public.group_teachers (group_id, teacher_id, school_id)
  SELECT g.id, t.id, v_school_id
  FROM public.groups g
  CROSS JOIN public.teachers t
  WHERE t.username = 'teacher_karim'
  ON CONFLICT DO NOTHING;
END $$;

-- ── 4. subjects.teacher_id перепривязать по slug ─────────────────────────
UPDATE public.subjects s
SET teacher_id = t.id
FROM public.teachers t
WHERE (
  (s.name = 'Программирование'  AND t.subject_slug = 'programming') OR
  (s.name = 'Робототехника'     AND t.subject_slug = 'robotics')    OR
  (s.name = 'Математика'        AND t.subject_slug = 'math')        OR
  (s.name = 'Английский язык'   AND t.subject_slug = 'english')     OR
  (s.name = 'Русский язык'      AND t.subject_slug = 'russian')
);

-- Заглушки оставляем на teacher_karim (не показываются в расписании всё равно)
UPDATE public.subjects
SET teacher_id = (SELECT id FROM public.teachers WHERE username = 'teacher_karim')
WHERE is_stub = true AND teacher_id IS NULL;

-- ── 5. 25 демо-учителей (5 на каждый предмет) ────────────────────────────
DO $$
DECLARE
  v_school_id CONSTANT uuid := 'a0a0a0a0-0000-0000-0000-000000000001';
  r RECORD;
  v_user_id uuid;
  v_teacher_id uuid;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- programming
      ('demo_teacher_prog_01', 'Bahodir Kasymov',    'programming'),
      ('demo_teacher_prog_02', 'Nargiza Alimova',    'programming'),
      ('demo_teacher_prog_03', 'Sardor Umarov',      'programming'),
      ('demo_teacher_prog_04', 'Malika Kholmatova',  'programming'),
      ('demo_teacher_prog_05', 'Timur Isakov',       'programming'),
      -- robotics
      ('demo_teacher_robot_01', 'Feruz Nazarov',     'robotics'),
      ('demo_teacher_robot_02', 'Zarina Yusupova',   'robotics'),
      ('demo_teacher_robot_03', 'Otabek Rakhmonov',  'robotics'),
      ('demo_teacher_robot_04', 'Dilnoza Karimova',  'robotics'),
      ('demo_teacher_robot_05', 'Bekzod Aliev',      'robotics'),
      -- math
      ('demo_teacher_math_01', 'Anastasia Petrova',  'math'),
      ('demo_teacher_math_02', 'Ravshan Xolmatov',   'math'),
      ('demo_teacher_math_03', 'Svetlana Ivanova',   'math'),
      ('demo_teacher_math_04', 'Jasur Nazarov',      'math'),
      ('demo_teacher_math_05', 'Natalya Kuznetsova', 'math'),
      -- english
      ('demo_teacher_english_01', 'Aziza Bekova',    'english'),
      ('demo_teacher_english_02', 'Oleg Smirnov',    'english'),
      ('demo_teacher_english_03', 'Sitora Mirzaeva', 'english'),
      ('demo_teacher_english_04', 'Ekaterina Volkova','english'),
      ('demo_teacher_english_05', 'Aziz Yusupov',    'english'),
      -- russian
      ('demo_teacher_russian_01', 'Vladimir Belov',  'russian'),
      ('demo_teacher_russian_02', 'Kamola Rakhimova','russian'),
      ('demo_teacher_russian_03', 'Sergey Sokolov',  'russian'),
      ('demo_teacher_russian_04', 'Munisa Karimova', 'russian'),
      ('demo_teacher_russian_05', 'Andrey Pavlov',   'russian')
    ) AS t(username, full_name, slug)
  LOOP
    SELECT id INTO v_user_id FROM auth.users WHERE email = r.username || '@demo.snr.local';
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        r.username || '@demo.snr.local', extensions.crypt('demo2026', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        now(), now(), '', '', '', '', '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id, r.username || '@demo.snr.local',
        jsonb_build_object('sub', v_user_id::text, 'email', r.username || '@demo.snr.local'),
        'email', now(), now(), now());
    END IF;

    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_user_id;
    IF v_teacher_id IS NULL THEN
      INSERT INTO public.teachers (user_id, username, full_name, subject_slug, school_id)
      VALUES (v_user_id, r.username, r.full_name, r.slug, v_school_id)
      RETURNING id INTO v_teacher_id;
    END IF;

    -- Демо-учителю group_teachers НЕ добавляем — это пул, назначится через
    -- claim_demo_account на время сессии (уроки будут показываться по subject_id).

    -- Заселяем demo_sessions: released=true, ждёт клика.
    INSERT INTO public.demo_sessions (account_user_id, released)
    SELECT v_user_id, true
    WHERE NOT EXISTS (SELECT 1 FROM public.demo_sessions WHERE account_user_id = v_user_id);
  END LOOP;
END $$;

-- ── 6. Обновить claim_demo_account: принимает subject_slug ───────────────
DROP FUNCTION IF EXISTS public.claim_demo_account(text, text);
DROP FUNCTION IF EXISTS public.claim_demo_account(text, text, text);

CREATE OR REPLACE FUNCTION public.claim_demo_account(
  p_kind text,
  p_grade text DEFAULT NULL,
  p_subject_slug text DEFAULT NULL
)
RETURNS TABLE(username text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_user_id uuid;
BEGIN
  SELECT ds.id, ds.account_user_id INTO v_session_id, v_user_id
  FROM public.demo_sessions ds
  JOIN auth.users u ON u.id = ds.account_user_id
  LEFT JOIN public.students s ON s.user_id = u.id
  LEFT JOIN public.teachers t ON t.user_id = u.id
  WHERE ds.released = true
    AND (
      -- student: prefix demo_student_{grade}_XX
      (p_kind = 'student' AND s.username LIKE 'demo\_student\_' || p_grade || '\_%' ESCAPE '\')
      -- teacher: filter by subject_slug when provided; otherwise any demo teacher
      OR (p_kind = 'teacher' AND (
        (p_subject_slug IS NULL AND t.username LIKE 'demo\_teacher\_%' ESCAPE '\')
        OR (p_subject_slug IS NOT NULL AND t.subject_slug = p_subject_slug)
      ))
    )
  ORDER BY random()
  FOR UPDATE OF ds SKIP LOCKED
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.demo_sessions
  SET released = false, claimed_at = now(), last_activity = now()
  WHERE id = v_session_id;

  RETURN QUERY
  SELECT COALESCE(s.username, t.username), u.email::text
  FROM auth.users u
  LEFT JOIN public.students s ON s.user_id = u.id
  LEFT JOIN public.teachers t ON t.user_id = u.id
  WHERE u.id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_demo_account(text, text, text) TO authenticated, anon;

-- ── 7. Регистрация ───────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('109')
ON CONFLICT (version) DO NOTHING;

COMMIT;

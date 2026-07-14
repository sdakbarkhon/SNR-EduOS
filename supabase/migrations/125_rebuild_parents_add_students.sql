-- Промт 8.2 — переработка структуры родителей + 3 новых ученика для реализма демо.
--
-- Часть 1 (аудит, задокументирован): parents/parent_students/parent_invites
-- сейчас ПУСТЫ (0 строк), в auth.users нет ни одной parent-подобной email —
-- удалять нечего. Это НЕ первый заход: миграция 80 когда-то уже создавала
-- именно эти usernames (rustam_03/farrukh_10/malika_07/parent_ismailov/
-- parent_rakhimov/parent_karimov и другие), но с ДРУГИМ распределением по
-- семьям — та миграция зарегистрирована применённой (schema_migrations),
-- но её данные были стёрты более поздним полным сбросом. Номер 80 занят,
-- поэтому здесь — новая миграция 125 с тем же проверенным шаблоном auth-
-- вставки (auth.users/auth.identities поле-в-поле, см. комментарий в
-- миграции 80), но новым распределением семей.
--
-- Часть 4: email из промта (bakhtiyor.ismailov@example.uz и т.п.) НЕ
-- используются как auth.users.email — таблица public.parents вообще не
-- имеет колонки email, и signInWithUsername (packages/core/src/auth/
-- username.ts, PARENT_EMAIL_DOMAIN='parents.snr.local') резолвит логин
-- через синтетический домен @parents.snr.local, как у всех остальных
-- ролей. Использование произвольного домена сломало бы вход. Синтетические
-- email из промта нигде не хранятся (негде и не нужно).

BEGIN;

-- ---------------------------------------------------------------------
-- Часть 2: переименование 3 существующих реальных учеников — ТОЛЬКО ФИО,
-- user_id/username/пароли/учебные данные не трогаем.
-- ---------------------------------------------------------------------
UPDATE public.students SET full_name = 'Ismailov Sherzod' WHERE username = 'sherzod_10';
UPDATE public.students SET full_name = 'Rakhimova Nodira' WHERE username = 'nodira_07';
UPDATE public.students SET full_name = 'Karimov Aziz'     WHERE username = 'aziz_03';

-- ---------------------------------------------------------------------
-- Часть 3: 3 новых ученика (auth.users/identities поле-в-поле как в
-- миграции 80; curator_id = teacher_karim, как у существующих 3 реальных).
-- ---------------------------------------------------------------------
CREATE TEMP TABLE tmp_new_students (
  user_id uuid DEFAULT gen_random_uuid(),
  student_id uuid DEFAULT gen_random_uuid(),
  username text,
  password text,
  full_name text,
  birth_date date,
  group_id uuid
) ON COMMIT DROP;

INSERT INTO tmp_new_students (username, password, full_name, birth_date, group_id) VALUES
  ('rustam_03',  'student2026', 'Rakhimov Rustam', '2018-05-14', '05730827-d2fd-4345-b6e8-7d583456202f'),  -- 3-А
  ('farrukh_10', 'student2026', 'Karimov Farrukh', '2011-03-22', '9afc95f3-e5e7-4882-a224-37cf58dc5c3b'),  -- 10-А
  ('malika_07',  'student2026', 'Karimova Malika', '2014-09-08', '3ca98359-d4ee-446e-8816-835af6c5dd47');  -- 7-А

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
  email_change_token_new, email_change, email_change_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
  phone, phone_change, phone_change_token, email_change_token_current,
  email_change_confirm_status, reauthentication_token, is_sso_user, is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000', t.user_id, 'authenticated', 'authenticated',
  t.username || '@students.snr.local', extensions.crypt(t.password, extensions.gen_salt('bf')), now(),
  null, '', null, '', null,
  '', '', null, null,
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('username', t.username, 'email_verified', true),
  null, now(), now(),
  null, '', '', '',
  0, '', false, false
FROM tmp_new_students t;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(), t.user_id,
  jsonb_build_object('sub', t.user_id::text, 'email', t.username || '@students.snr.local', 'email_verified', false, 'phone_verified', false),
  'email', t.user_id::text, now(), now(), now()
FROM tmp_new_students t;

INSERT INTO public.students (id, user_id, username, full_name, birth_date, school_id, status, balance, curator_id)
SELECT t.student_id, t.user_id, t.username, t.full_name, t.birth_date,
       'a0a0a0a0-0000-0000-0000-000000000001', 'active', 0, '67c9ac94-a651-4619-a087-33190c2a2cec'
FROM tmp_new_students t;

INSERT INTO public.student_groups (student_id, group_id, school_id)
SELECT t.student_id, t.group_id, 'a0a0a0a0-0000-0000-0000-000000000001'
FROM tmp_new_students t;
-- ^ AFTER INSERT-триггер trg_student_group_added_direct_chats на этой таблице
--   сам создаёт по 6 direct chat_threads (куратор + 5 предметных учителей)
--   на каждого нового ученика — не создаём их вручную.

INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
SELECT ct.id, t.user_id, 'student'
FROM tmp_new_students t
JOIN public.chat_threads ct ON ct.group_id = t.group_id AND ct.kind = 'group';

-- ---------------------------------------------------------------------
-- Часть 4: 3 новых родителя + parent_students (охватывает и новых, и уже
-- существующих переименованных учеников — student_id резолвится из
-- public.students по username, а не только из tmp_new_students).
-- ---------------------------------------------------------------------
CREATE TEMP TABLE tmp_new_parents (
  user_id uuid DEFAULT gen_random_uuid(),
  parent_id uuid DEFAULT gen_random_uuid(),
  username text,
  password text,
  full_name text
) ON COMMIT DROP;

INSERT INTO tmp_new_parents (username, password, full_name) VALUES
  ('parent_ismailov', 'parent2026', 'Ismailov Bakhtiyor'),
  ('parent_rakhimov', 'parent2026', 'Rakhimov Odil'),
  ('parent_karimov',  'parent2026', 'Karimov Sardor');

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
  email_change_token_new, email_change, email_change_sent_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
  phone, phone_change, phone_change_token, email_change_token_current,
  email_change_confirm_status, reauthentication_token, is_sso_user, is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000', t.user_id, 'authenticated', 'authenticated',
  t.username || '@parents.snr.local', extensions.crypt(t.password, extensions.gen_salt('bf')), now(),
  null, '', null, '', null,
  '', '', null, null,
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('username', t.username, 'email_verified', true),
  null, now(), now(),
  null, '', '', '',
  0, '', false, false
FROM tmp_new_parents t;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(), t.user_id,
  jsonb_build_object('sub', t.user_id::text, 'email', t.username || '@parents.snr.local', 'email_verified', false, 'phone_verified', false),
  'email', t.user_id::text, now(), now(), now()
FROM tmp_new_parents t;

INSERT INTO public.parents (id, user_id, full_name, school_id)
SELECT t.parent_id, t.user_id, t.full_name, 'a0a0a0a0-0000-0000-0000-000000000001'
FROM tmp_new_parents t;

CREATE TEMP TABLE tmp_parent_children (parent_username text, student_username text) ON COMMIT DROP;
INSERT INTO tmp_parent_children (parent_username, student_username) VALUES
  ('parent_ismailov', 'sherzod_10'),
  ('parent_rakhimov', 'nodira_07'),
  ('parent_rakhimov', 'rustam_03'),
  ('parent_karimov',  'aziz_03'),
  ('parent_karimov',  'farrukh_10'),
  ('parent_karimov',  'malika_07');

INSERT INTO public.parent_students (parent_id, student_id, school_id)
SELECT p.parent_id, s.id, 'a0a0a0a0-0000-0000-0000-000000000001'
FROM tmp_parent_children pc
JOIN tmp_new_parents p ON p.username = pc.parent_username
JOIN public.students s ON s.username = pc.student_username;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('125')
ON CONFLICT DO NOTHING;

COMMIT;

-- Хотфикс П8.1 (Итерация 6, наполнение): 8 новых реальных учеников
-- (10-А/7-А/3-А класс), 3 доп. демо-ученика ("Программирование N-А (демо)"),
-- 6 родительских аккаунтов с parent_students связями.
--
-- Auth-записи скопированы ПОЛЕ В ПОЛЕ с проверенного рабочего шаблона
-- sherzod_10 (миграция 70) — см. отчёт с точными значениями, которые были
-- показаны на согласование. Ключевые моменты шаблона:
--   * instance_id = 00000000-0000-0000-0000-000000000000
--   * confirmation_token/recovery_token/email_change_token_* = '' (пустая
--     строка, НЕ NULL)
--   * raw_app_meta_data = {"provider":"email","providers":["email"]}
--   * raw_user_meta_data = {"username":<username>,"email_verified":true}
--     для обычных аккаунтов; {"is_demo":true} (без прочих полей) для
--     демо-аккаунтов — сверено с существующими demo_student_10/demo_teacher.
--   * encrypted_password = extensions.crypt(pwd, extensions.gen_salt('bf'))
--   * auth.identities.provider_id = user_id (не email!)
--   * identity_data.email СОГЛАСОВАН с auth.users.email везде (в отличие
--     от sherzod_10, где они исторически разъехались на разные домены —
--     решено не повторять это как баг, а не как часть шаблона).
--
-- Пароли: ученики/демо-extra — 'password123' / 'demo2026'; родители —
-- 'parent2026'. Хэшируются через extensions.crypt(), в открытом виде
-- нигде не хранятся.

BEGIN;

-- ---------------------------------------------------------------------
-- Part 0: временные таблицы с сопоставлением username -> сгенерированные ID
-- ---------------------------------------------------------------------
CREATE TEMP TABLE tmp_new_students (
  user_id uuid DEFAULT gen_random_uuid(),
  student_id uuid DEFAULT gen_random_uuid(),
  username text,
  password text,
  full_name text,
  group_id uuid
) ON COMMIT DROP;

INSERT INTO tmp_new_students (username, password, full_name, group_id) VALUES
  ('aziza_10',   'password123', 'Aziza Ismailova',  '0ebed461-a7cc-46c6-8f0d-cf302f67831e'),
  ('farrukh_10', 'password123', 'Farrukh Rakhimov', '0ebed461-a7cc-46c6-8f0d-cf302f67831e'),
  ('diyora_10',  'password123', 'Diyora Karimova',  '0ebed461-a7cc-46c6-8f0d-cf302f67831e'),
  ('bekzod_07',  'password123', 'Bekzod Rakhimov',  'fb4852ca-2019-43a6-914f-7d770748df92'),
  ('malika_07',  'password123', 'Malika Yusupova',  'fb4852ca-2019-43a6-914f-7d770748df92'),
  ('sardor_07',  'password123', 'Sardor Aliev',     'fb4852ca-2019-43a6-914f-7d770748df92'),
  ('rustam_03',  'password123', 'Rustam Nazarov',   '8ac8428a-8336-4883-bf47-1d325cf40d49'),
  ('zarina_03',  'password123', 'Zarina Ismailova', '8ac8428a-8336-4883-bf47-1d325cf40d49');

CREATE TEMP TABLE tmp_new_demo_students (
  user_id uuid DEFAULT gen_random_uuid(),
  student_id uuid DEFAULT gen_random_uuid(),
  username text,
  password text,
  full_name text,
  group_id uuid
) ON COMMIT DROP;

INSERT INTO tmp_new_demo_students (username, password, full_name, group_id) VALUES
  ('demo_student_extra_10', 'demo2026', 'Демо Ученик 10 (extra)', 'd0d0d0d0-2222-0000-0000-000000000003'),
  ('demo_student_extra_7',  'demo2026', 'Демо Ученик 7 (extra)',  'd0d0d0d0-2222-0000-0000-000000000002'),
  ('demo_student_extra_3',  'demo2026', 'Демо Ученик 3 (extra)',  'd0d0d0d0-2222-0000-0000-000000000001');

CREATE TEMP TABLE tmp_new_parents (
  user_id uuid DEFAULT gen_random_uuid(),
  parent_id uuid DEFAULT gen_random_uuid(),
  username text,
  password text,
  full_name text
) ON COMMIT DROP;

INSERT INTO tmp_new_parents (username, password, full_name) VALUES
  ('parent_ismailov', 'parent2026', 'Nargiza Ismailova'),
  ('parent_rakhimov', 'parent2026', 'Bakhtiyor Rakhimov'),
  ('parent_karimov',  'parent2026', 'Kamola Karimova'),
  ('parent_yusupov',  'parent2026', 'Odil Yusupov'),
  ('parent_aliev',    'parent2026', 'Zulfiya Alieva'),
  ('parent_nazarov',  'parent2026', 'Farida Nazarova');

CREATE TEMP TABLE tmp_parent_children (parent_username text, student_username text) ON COMMIT DROP;
INSERT INTO tmp_parent_children (parent_username, student_username) VALUES
  ('parent_ismailov', 'aziza_10'),
  ('parent_ismailov', 'zarina_03'),
  ('parent_rakhimov', 'farrukh_10'),
  ('parent_rakhimov', 'bekzod_07'),
  ('parent_karimov',  'diyora_10'),
  ('parent_yusupov',  'malika_07'),
  ('parent_aliev',    'sardor_07'),
  ('parent_nazarov',  'rustam_03');

-- ---------------------------------------------------------------------
-- Part 1: 8 реальных учеников
-- ---------------------------------------------------------------------
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

-- (auth.identities.email is a GENERATED column — lower(identity_data->>'email') —
-- so it is derived automatically and must not appear in the column list.)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(), t.user_id,
  jsonb_build_object('sub', t.user_id::text, 'email', t.username || '@students.snr.local', 'email_verified', false, 'phone_verified', false),
  'email', t.user_id::text, now(), now(), now()
FROM tmp_new_students t;

INSERT INTO public.students (id, user_id, username, full_name, school_id, status, balance)
SELECT t.student_id, t.user_id, t.username, t.full_name, 'a0a0a0a0-0000-0000-0000-000000000001', 'active', 0
FROM tmp_new_students t;

INSERT INTO public.student_groups (student_id, group_id, school_id)
SELECT t.student_id, t.group_id, 'a0a0a0a0-0000-0000-0000-000000000001'
FROM tmp_new_students t;

INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
SELECT ct.id, t.user_id, 'student'
FROM tmp_new_students t
JOIN public.chat_threads ct ON ct.group_id = t.group_id AND ct.kind = 'group';

-- ---------------------------------------------------------------------
-- Part 2: 3 дополнительных демо-ученика (для "Программирование N-А (демо)")
-- ---------------------------------------------------------------------
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
  t.username || '@demo.snr.local', extensions.crypt(t.password, extensions.gen_salt('bf')), now(),
  null, '', null, '', null,
  '', '', null, null,
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('is_demo', true),
  null, now(), now(),
  null, '', '', '',
  0, '', false, false
FROM tmp_new_demo_students t;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(), t.user_id,
  jsonb_build_object('sub', t.user_id::text, 'email', t.username || '@demo.snr.local', 'email_verified', false, 'phone_verified', false),
  'email', t.user_id::text, now(), now(), now()
FROM tmp_new_demo_students t;

INSERT INTO public.students (id, user_id, username, full_name, school_id, status, balance)
SELECT t.student_id, t.user_id, t.username, t.full_name, 'a0a0a0a0-0000-0000-0000-000000000001', 'active', 0
FROM tmp_new_demo_students t;

INSERT INTO public.student_groups (student_id, group_id, school_id)
SELECT t.student_id, t.group_id, 'a0a0a0a0-0000-0000-0000-000000000001'
FROM tmp_new_demo_students t;

INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
SELECT ct.id, t.user_id, 'student'
FROM tmp_new_demo_students t
JOIN public.chat_threads ct ON ct.group_id = t.group_id AND ct.kind = 'group';

-- ---------------------------------------------------------------------
-- Part 3: 6 родителей + parent_students
-- ---------------------------------------------------------------------
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

INSERT INTO public.parent_students (parent_id, student_id, school_id)
SELECT p.parent_id, s.student_id, 'a0a0a0a0-0000-0000-0000-000000000001'
FROM tmp_parent_children pc
JOIN tmp_new_parents p ON p.username = pc.parent_username
JOIN tmp_new_students s ON s.username = pc.student_username;

COMMIT;

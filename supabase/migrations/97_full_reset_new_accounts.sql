-- =====================================================================
-- Migration 97 — БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 1: полная очистка БД + новая
-- структура аккаунтов (1 реальный учитель, 3 реальных ученика, 90 демо-
-- учеников, 5 демо-учителей).
--
-- Контекст: BOLSHOE_OBNOVLENIE.md §Этап 1. Полный сброс всех пользова-
-- тельских данных (уроки/ДЗ/оценки/чаты/материалы/аккаунты) кроме
-- admin/superadmin, с пересозданием чистой структуры под тестовый прогон.
-- Решения по неоднозначным пунктам — см. resheniya.md, раздел "Этап 1".
--
-- Порядок DELETE построен по полному графу внешних ключей public-схемы
-- (запрошен через information_schema перед написанием миграции) — снизу
-- вверх, листья первыми. Единственный циклический момент — lessons.
-- demo_material_id -> lesson_materials и lessons.active_stage_id ->
-- lesson_stages, оба ссылаются НА lessons в обратную сторону — разрывается
-- явным UPDATE ... SET ... = NULL перед удалением lesson_materials/
-- lesson_stages.
--
-- h5p_content (таблица) и storage-bucket h5p-content НЕ трогаются —
-- vendored H5P runtime, не пользовательские данные (правило §1.2).
-- daily_facts НЕ трогается — общий контент приложения ("факт дня"), не
-- привязан к конкретному пользователю/группе.
-- =====================================================================

-- =====================================================================
-- PART 0 — group_teachers: новый механизм со-кураторства демо-учителей.
--
-- Решение (см. resheniya.md): выделенная junction-таблица group_teachers,
-- а не co_teacher_ids[] массив и не переиспользование subjects.teacher_id.
-- is_my_teacher_group(group_id) — уже существующий центральный RLS-хелпер,
-- используемый почти во всех teacher-policy (lessons ×4, homework SELECT/
-- INSERT, course_materials/lesson_materials/classwork/announcements/
-- lesson_grades INSERT, ...). Добавление ОДНОЙ третьей OR-ветки в этот
-- хелпер автоматически даёт демо-учителям доступ ко всем этим таблицам
-- без правки каждой политики по отдельности. Отдельно патчатся только 9
-- политик, которые в обход хелпера проверяют teacher_id = current_teacher_id()
-- напрямую на самой groups/student_groups/students/grades/ai_chat_messages/
-- leave_requests/chat_participants (найдены полным grep по всем policy
-- всей public-схемы через pg_policies, см. investigation этой сессии).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.group_teachers (
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL DEFAULT current_school_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, teacher_id)
);
ALTER TABLE public.group_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own group_teachers rows" ON public.group_teachers;
CREATE POLICY "read own group_teachers rows" ON public.group_teachers FOR SELECT
  USING (
    teacher_id = current_teacher_id()
    OR (fn_is_admin() AND school_id = current_school_id())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "admin manages group_teachers" ON public.group_teachers;
CREATE POLICY "admin manages group_teachers" ON public.group_teachers FOR ALL
  USING ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin())
  WITH CHECK ((fn_is_admin() AND school_id = current_school_id()) OR is_super_admin());

CREATE OR REPLACE FUNCTION public.is_my_teacher_group(p_group_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = p_group_id
        AND teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.subjects
      WHERE group_id = p_group_id
        AND teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
    )
    OR
    EXISTS (
      SELECT 1 FROM public.group_teachers gt
      WHERE gt.group_id = p_group_id
        AND gt.teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
    )
$function$;

-- ── 9 straggler policies patched to reuse is_my_teacher_group() ──────────

DROP POLICY IF EXISTS "teacher reads own groups" ON public.groups;
CREATE POLICY "teacher reads own groups" ON public.groups FOR SELECT
  USING ((is_my_teacher_group(id) AND school_id = current_school_id()) OR is_super_admin());

DROP POLICY IF EXISTS "teacher reads memberships in own groups" ON public.student_groups;
CREATE POLICY "teacher reads memberships in own groups" ON public.student_groups FOR SELECT
  USING ((is_my_teacher_group(group_id) AND school_id = current_school_id()) OR is_super_admin());

DROP POLICY IF EXISTS "teacher reads students in own groups" ON public.students;
CREATE POLICY "teacher reads students in own groups" ON public.students FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.student_groups sg
        WHERE sg.student_id = students.id AND is_my_teacher_group(sg.group_id)
      ) AND school_id = current_school_id()
    ) OR is_super_admin()
  );

DROP POLICY IF EXISTS "teacher reads grades in own groups" ON public.grades;
CREATE POLICY "teacher reads grades in own groups" ON public.grades FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.student_groups sg
        WHERE sg.student_id = grades.student_id AND is_my_teacher_group(sg.group_id)
      ) AND school_id = current_school_id()
    ) OR is_super_admin()
  );

DROP POLICY IF EXISTS "teacher reads ai messages of own groups" ON public.ai_chat_messages;
CREATE POLICY "teacher reads ai messages of own groups" ON public.ai_chat_messages FOR SELECT
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.students s
        JOIN public.student_groups sg ON sg.student_id = s.id
        WHERE s.id = ai_chat_messages.student_id AND is_my_teacher_group(sg.group_id)
      ) AND school_id = current_school_id()
    ) OR is_super_admin()
  );

DROP POLICY IF EXISTS "teacher manages leave_requests" ON public.leave_requests;
CREATE POLICY "teacher manages leave_requests" ON public.leave_requests FOR ALL
  USING (
    (
      EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.id = leave_requests.lesson_id AND is_my_teacher_group(l.group_id)
      ) AND school_id = current_school_id()
    ) OR is_super_admin()
  );

DROP POLICY IF EXISTS "admin/teacher add participants" ON public.chat_participants;
CREATE POLICY "admin/teacher add participants" ON public.chat_participants FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (fn_is_admin() AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id()))
    OR (
      current_teacher_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.chat_threads t
        WHERE t.id = chat_participants.thread_id AND t.kind = 'group' AND is_my_teacher_group(t.group_id)
      )
    )
  );

DROP POLICY IF EXISTS "admin/teacher remove participants" ON public.chat_participants;
CREATE POLICY "admin/teacher remove participants" ON public.chat_participants FOR DELETE
  USING (
    is_super_admin()
    OR (fn_is_admin() AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id()))
    OR (
      current_teacher_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.chat_threads t
        WHERE t.id = chat_participants.thread_id AND t.kind = 'group' AND is_my_teacher_group(t.group_id)
      )
    )
  );

DROP POLICY IF EXISTS "admin/teacher update participants" ON public.chat_participants;
CREATE POLICY "admin/teacher update participants" ON public.chat_participants FOR UPDATE
  USING (
    is_super_admin()
    OR (fn_is_admin() AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id()))
    OR (
      current_teacher_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.chat_threads t
        WHERE t.id = chat_participants.thread_id AND t.kind = 'group' AND is_my_teacher_group(t.group_id)
      )
    )
  );

-- =====================================================================
-- PART 1 — ПОЛНАЯ ОЧИСТКА ДАННЫХ (§1.2/1.3). Порядок снизу вверх по FK.
-- schools и h5p_content / daily_facts НЕ затрагиваются.
-- =====================================================================

-- уровень 0 — листья
DELETE FROM public.ai_chat_messages;
DELETE FROM public.announcement_reads;
DELETE FROM public.announcement_user_reads;
DELETE FROM public.attendance;
DELETE FROM public.book_favorites;
DELETE FROM public.charges;
DELETE FROM public.classwork_submissions;
DELETE FROM public.test_answers;
DELETE FROM public.quiz_answers;
DELETE FROM public.homework_subtask_submissions;
DELETE FROM public.lesson_stage_progress;
DELETE FROM public.lesson_raised_hands;
DELETE FROM public.lesson_excuse_requests;
DELETE FROM public.lesson_grades;
DELETE FROM public.kahoot_sessions;
DELETE FROM public.leave_requests;
DELETE FROM public.payments;
DELETE FROM public.notification_settings;
DELETE FROM public.notifications;
DELETE FROM public.project_attachments;
DELETE FROM public.project_stage_progress;
DELETE FROM public.parent_invites;
DELETE FROM public.chat_read_state;
DELETE FROM public.grades;

-- уровень 1
DELETE FROM public.quiz_questions;
DELETE FROM public.quiz_attempts;
DELETE FROM public.test_question_options;
DELETE FROM public.test_questions;
DELETE FROM public.classwork_questions;
DELETE FROM public.homework_subtasks;
DELETE FROM public.test_submissions;
DELETE FROM public.project_stages;
DELETE FROM public.project_submissions;

-- уровень 2
DELETE FROM public.classwork;
DELETE FROM public.homework_submissions;
DELETE FROM public.projects;
DELETE FROM public.chat_messages;

-- разрыв циклической ссылки lessons <-> lesson_materials / lesson_stages
UPDATE public.lessons SET demo_material_id = NULL, active_stage_id = NULL;

-- уровень 2b
DELETE FROM public.lesson_materials;
DELETE FROM public.lesson_stages;

-- уровень 3
DELETE FROM public.homework;
DELETE FROM public.course_materials;

-- уровень 4
DELETE FROM public.lessons;

-- уровень 5
DELETE FROM public.chat_participants;
DELETE FROM public.chat_threads;
DELETE FROM public.announcements;
DELETE FROM public.books;

-- уровень 6
DELETE FROM public.subjects;
DELETE FROM public.student_groups;
DELETE FROM public.groups;

-- уровень 7
DELETE FROM public.parent_students;
DELETE FROM public.parents;

-- уровень 8
DELETE FROM public.students;

-- уровень 9
DELETE FROM public.group_teachers;
DELETE FROM public.teachers;

-- уровень 10 — auth.users кроме admin/superadmin (§1.3)
DELETE FROM auth.identities
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email NOT IN ('admin@admins.snr.local', 'superadmin@admins.snr.local')
  );
DELETE FROM auth.users
  WHERE email NOT IN ('admin@admins.snr.local', 'superadmin@admins.snr.local');

-- Storage: НЕ удаляется здесь. Supabase блокирует прямой DELETE FROM
-- storage.objects (protect_delete() trigger — "Use the Storage API
-- instead"), а Storage API требует service_role ключ, который эта сессия
-- сознательно не запрашивает (см. resheniya.md, раздел "Этап 1 / Storage
-- cleanup"). Осиротевшие файлы в bucket'ах (avatars/books/course-materials/
-- homework-files/homework-submissions/homework-tests/lesson-materials/
-- materials/project-files/slide-images/stage-attachments) остаются на
-- диске, но безвредны: RLS продолжает их защищать, и ни одна новая запись
-- на них больше не ссылается. h5p-content всё равно не трогаем (vendored).

-- =====================================================================
-- PART 2 — ПЕРЕСОЗДАНИЕ СТРУКТУРЫ (§1.4).
-- Школа переиспользуется (уже существует, id a0a0a0a0-...-000000000001,
-- не удалялась) — current_school_id() продолжит резолвиться на неё.
-- =====================================================================

DO $$
DECLARE
  -- current_school_id() resolves via auth.uid(), which is NULL when this
  -- migration runs through the Management API's raw-SQL execution context
  -- (no authenticated app session) — every school_id-defaulted column below
  -- is set explicitly instead of relying on the column DEFAULT.
  v_school_id CONSTANT uuid := 'a0a0a0a0-0000-0000-0000-000000000001';

  v_group_10a uuid;
  v_group_7a  uuid;
  v_group_3a  uuid;

  v_karim_user uuid;
  v_karim_id   uuid;

  r RECORD;
  v_user_id uuid;
  v_student_id uuid;
  v_teacher_id uuid;
  v_group_id uuid;

  v_thread_id uuid;
BEGIN
  -- ── Группы (§1.4) — NOT EXISTS guard (groups.name has no UNIQUE
  -- constraint, so ON CONFLICT DO NOTHING would silently no-op on rerun
  -- instead of deduping) ───────────────────────────────────────────────
  SELECT id INTO v_group_10a FROM public.groups WHERE name = '10-А класс';
  IF v_group_10a IS NULL THEN
    INSERT INTO public.groups (name, subject, course_price, schedule_days, school_id)
    VALUES ('10-А класс', 'programming', 0, '', v_school_id)
    RETURNING id INTO v_group_10a;
  END IF;

  SELECT id INTO v_group_7a FROM public.groups WHERE name = '7-А класс';
  IF v_group_7a IS NULL THEN
    INSERT INTO public.groups (name, subject, course_price, schedule_days, school_id)
    VALUES ('7-А класс', 'programming', 0, '', v_school_id)
    RETURNING id INTO v_group_7a;
  END IF;

  SELECT id INTO v_group_3a FROM public.groups WHERE name = '3-А класс';
  IF v_group_3a IS NULL THEN
    INSERT INTO public.groups (name, subject, course_price, schedule_days, school_id)
    VALUES ('3-А класс', 'programming', 0, '', v_school_id)
    RETURNING id INTO v_group_3a;
  END IF;

  -- ── teacher_karim — реальный учитель, куратор всех трёх групп ───────
  -- ФИО: решение по неоднозначному исходному тексту задания — см.
  -- resheniya.md, раздел "Этап 1 / ФИО teacher_karim".
  SELECT id INTO v_karim_user FROM auth.users WHERE email = 'teacher_karim@teachers.snr.local';
  IF v_karim_user IS NULL THEN
    v_karim_user := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_karim_user, 'authenticated', 'authenticated',
      'teacher_karim@teachers.snr.local', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', '', '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_karim_user, 'teacher_karim@teachers.snr.local',
      jsonb_build_object('sub', v_karim_user::text, 'email', 'teacher_karim@teachers.snr.local'),
      'email', now(), now(), now());
  END IF;

  SELECT id INTO v_karim_id FROM public.teachers WHERE user_id = v_karim_user;
  IF v_karim_id IS NULL THEN
    INSERT INTO public.teachers (user_id, username, full_name, school_id)
    VALUES (v_karim_user, 'teacher_karim', 'Karim Alisher Botirov', v_school_id)
    RETURNING id INTO v_karim_id;
  END IF;

  UPDATE public.groups SET teacher_id = v_karim_id WHERE id IN (v_group_10a, v_group_7a, v_group_3a);

  -- ── Реальные ученики (§1.4, §7 учётные данные) ──────────────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('sherzod_10', 'Sherzod Tashkenbaev', '10-А класс', '10 класс'),
      ('nodira_07',  'Nodira Yusupova',     '7-А класс',  '7 класс'),
      ('aziz_03',    'Aziz Karimov',        '3-А класс',  '3 класс')
    ) AS t(username, full_name, group_name, grade)
  LOOP
    SELECT id INTO v_group_id FROM public.groups WHERE name = r.group_name;

    SELECT id INTO v_user_id FROM auth.users WHERE email = r.username || '@students.snr.local';
    IF v_user_id IS NULL THEN
      v_user_id := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        phone_change, phone_change_token, email_change_token_current, reauthentication_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
        r.username || '@students.snr.local', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        now(), now(), '', '', '', '', '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id, r.username || '@students.snr.local',
        jsonb_build_object('sub', v_user_id::text, 'email', r.username || '@students.snr.local'),
        'email', now(), now(), now());
    END IF;

    SELECT id INTO v_student_id FROM public.students WHERE user_id = v_user_id;
    IF v_student_id IS NULL THEN
      INSERT INTO public.students (user_id, username, full_name, grade, curator_id, school_id)
      VALUES (v_user_id, r.username, r.full_name, r.grade, v_karim_id, v_school_id)
      RETURNING id INTO v_student_id;
    END IF;

    IF v_group_id IS NOT NULL THEN
      INSERT INTO public.student_groups (student_id, group_id, school_id) VALUES (v_student_id, v_group_id, v_school_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- ── Демо-ученики: 30 на группу × 3 = 90 (§1.4) ──────────────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('demo_student_10_01', 'Alisher Norqulov', '10-А класс', '10 класс'),
      ('demo_student_10_02', 'Rayhona Karimov', '10-А класс', '10 класс'),
      ('demo_student_10_03', 'Yulduz Rustamov', '10-А класс', '10 класс'),
      ('demo_student_10_04', 'Madina Xakimov', '10-А класс', '10 класс'),
      ('demo_student_10_05', 'Jasur Rashidov', '10-А класс', '10 класс'),
      ('demo_student_10_06', 'Islom Toshev', '10-А класс', '10 класс'),
      ('demo_student_10_07', 'Umida Rakhimov', '10-А класс', '10 класс'),
      ('demo_student_10_08', 'Yusuf Yusupov', '10-А класс', '10 класс'),
      ('demo_student_10_09', 'Timur Aliev', '10-А класс', '10 класс'),
      ('demo_student_10_10', 'Laylo Jalilov', '10-А класс', '10 класс'),
      ('demo_student_10_11', 'Ibrohim Boltaev', '10-А класс', '10 класс'),
      ('demo_student_10_12', 'Gulbahor Nematov', '10-А класс', '10 класс'),
      ('demo_student_10_13', 'Sanjar Nurmatov', '10-А класс', '10 класс'),
      ('demo_student_10_14', 'Sitora Tashkenbaev', '10-А класс', '10 класс'),
      ('demo_student_10_15', 'Kamron Sharipov', '10-А класс', '10 класс'),
      ('demo_student_10_16', 'Diyora Abdullaev', '10-А класс', '10 класс'),
      ('demo_student_10_17', 'Muzaffar Zokirov', '10-А класс', '10 класс'),
      ('demo_student_10_18', 'Dilnoza Sultonov', '10-А класс', '10 класс'),
      ('demo_student_10_19', 'Zuhra Turaev', '10-А класс', '10 класс'),
      ('demo_student_10_20', 'Malika Botirov', '10-А класс', '10 класс'),
      ('demo_student_10_21', 'Lola Fayzullaev', '10-А класс', '10 класс'),
      ('demo_student_10_22', 'Sardor Ergashev', '10-А класс', '10 класс'),
      ('demo_student_10_23', 'Jahongir Mirzaev', '10-А класс', '10 класс'),
      ('demo_student_10_24', 'Barno Yuldashev', '10-А класс', '10 класс'),
      ('demo_student_10_25', 'Kamila Otajonov', '10-А класс', '10 класс'),
      ('demo_student_10_26', 'Farrukh Qodirov', '10-А класс', '10 класс'),
      ('demo_student_10_27', 'Aziza Ismailov', '10-А класс', '10 класс'),
      ('demo_student_10_28', 'Sirojiddin Nazarov', '10-А класс', '10 класс'),
      ('demo_student_10_29', 'Rustam Xolmatov', '10-А класс', '10 класс'),
      ('demo_student_10_30', 'Bobur Saidov', '10-А класс', '10 класс'),
      ('demo_student_7_01', 'Zarina Nazarov', '7-А класс', '7 класс'),
      ('demo_student_7_02', 'Sherali Sultonov', '7-А класс', '7 класс'),
      ('demo_student_7_03', 'Rustam Norqulov', '7-А класс', '7 класс'),
      ('demo_student_7_04', 'Nurbek Karimov', '7-А класс', '7 класс'),
      ('demo_student_7_05', 'Bobur Abdullaev', '7-А класс', '7 класс'),
      ('demo_student_7_06', 'Shokhrukh Botirov', '7-А класс', '7 класс'),
      ('demo_student_7_07', 'Sabina Ismailov', '7-А класс', '7 класс'),
      ('demo_student_7_08', 'Umid Boltaev', '7-А класс', '7 класс'),
      ('demo_student_7_09', 'Sitora Qodirov', '7-А класс', '7 класс'),
      ('demo_student_7_10', 'Rayhona Yusupov', '7-А класс', '7 класс'),
      ('demo_student_7_11', 'Nargiza Aliev', '7-А класс', '7 класс'),
      ('demo_student_7_12', 'Mohira Nematov', '7-А класс', '7 класс'),
      ('demo_student_7_13', 'Lola Turaev', '7-А класс', '7 класс'),
      ('demo_student_7_14', 'Gulnora Ergashev', '7-А класс', '7 класс'),
      ('demo_student_7_15', 'Diyora Rakhimov', '7-А класс', '7 класс'),
      ('demo_student_7_16', 'Kamola Xolmatov', '7-А класс', '7 класс'),
      ('demo_student_7_17', 'Malika Sharipov', '7-А класс', '7 класс'),
      ('demo_student_7_18', 'Nasiba Xakimov', '7-А класс', '7 класс'),
      ('demo_student_7_19', 'Ravshan Mirzaev', '7-А класс', '7 класс'),
      ('demo_student_7_20', 'Barno Jalilov', '7-А класс', '7 класс'),
      ('demo_student_7_21', 'Shahnoza Rustamov', '7-А класс', '7 класс'),
      ('demo_student_7_22', 'Otabek Saidov', '7-А класс', '7 класс'),
      ('demo_student_7_23', 'Umida Zokirov', '7-А класс', '7 класс'),
      ('demo_student_7_24', 'Bekzod Fayzullaev', '7-А класс', '7 класс'),
      ('demo_student_7_25', 'Iroda Safarov', '7-А класс', '7 класс'),
      ('demo_student_7_26', 'Laylo Rashidov', '7-А класс', '7 класс'),
      ('demo_student_7_27', 'Yulduz Yuldashev', '7-А класс', '7 класс'),
      ('demo_student_7_28', 'Aziz Otajonov', '7-А класс', '7 класс'),
      ('demo_student_7_29', 'Gulbahor Tashkenbaev', '7-А класс', '7 класс'),
      ('demo_student_7_30', 'Ulugbek Toshev', '7-А класс', '7 класс'),
      ('demo_student_3_01', 'Gulbahor Karimov', '3-А класс', '3 класс'),
      ('demo_student_3_02', 'Timur Rustamov', '3-А класс', '3 класс'),
      ('demo_student_3_03', 'Munisa Jalilov', '3-А класс', '3 класс'),
      ('demo_student_3_04', 'Sherali Boltaev', '3-А класс', '3 класс'),
      ('demo_student_3_05', 'Sherzod Norqulov', '3-А класс', '3 класс'),
      ('demo_student_3_06', 'Rustam Fayzullaev', '3-А класс', '3 класс'),
      ('demo_student_3_07', 'Sanjar Safarov', '3-А класс', '3 класс'),
      ('demo_student_3_08', 'Kamila Yusupov', '3-А класс', '3 класс'),
      ('demo_student_3_09', 'Aziza Qodirov', '3-А класс', '3 класс'),
      ('demo_student_3_10', 'Zuhra Rashidov', '3-А класс', '3 класс'),
      ('demo_student_3_11', 'Davron Saidov', '3-А класс', '3 класс'),
      ('demo_student_3_12', 'Shahnoza Rakhimov', '3-А класс', '3 класс'),
      ('demo_student_3_13', 'Farrukh Xakimov', '3-А класс', '3 класс'),
      ('demo_student_3_14', 'Nurbek Sultonov', '3-А класс', '3 класс'),
      ('demo_student_3_15', 'Nasiba Ismailov', '3-А класс', '3 класс'),
      ('demo_student_3_16', 'Sardor Turaev', '3-А класс', '3 класс'),
      ('demo_student_3_17', 'Muzaffar Ergashev', '3-А класс', '3 класс'),
      ('demo_student_3_18', 'Zarina Otajonov', '3-А класс', '3 класс'),
      ('demo_student_3_19', 'Rayhona Mirzaev', '3-А класс', '3 класс'),
      ('demo_student_3_20', 'Nodir Yuldashev', '3-А класс', '3 класс'),
      ('demo_student_3_21', 'Feruza Toshev', '3-А класс', '3 класс'),
      ('demo_student_3_22', 'Yulduz Nazarov', '3-А класс', '3 класс'),
      ('demo_student_3_23', 'Jahongir Tashkenbaev', '3-А класс', '3 класс'),
      ('demo_student_3_24', 'Ravshan Zokirov', '3-А класс', '3 класс'),
      ('demo_student_3_25', 'Mohira Botirov', '3-А класс', '3 класс'),
      ('demo_student_3_26', 'Lola Abdullaev', '3-А класс', '3 класс'),
      ('demo_student_3_27', 'Sabina Nematov', '3-А класс', '3 класс'),
      ('demo_student_3_28', 'Islom Sharipov', '3-А класс', '3 класс'),
      ('demo_student_3_29', 'Umida Aliev', '3-А класс', '3 класс'),
      ('demo_student_3_30', 'Aziz Xolmatov', '3-А класс', '3 класс')
    ) AS t(username, full_name, group_name, grade)
  LOOP
    SELECT id INTO v_group_id FROM public.groups WHERE name = r.group_name;

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
        '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
        now(), now(), '', '', '', '', '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id, r.username || '@demo.snr.local',
        jsonb_build_object('sub', v_user_id::text, 'email', r.username || '@demo.snr.local'),
        'email', now(), now(), now());
    END IF;

    SELECT id INTO v_student_id FROM public.students WHERE user_id = v_user_id;
    IF v_student_id IS NULL THEN
      INSERT INTO public.students (user_id, username, full_name, grade, curator_id, school_id)
      VALUES (v_user_id, r.username, r.full_name, r.grade, v_karim_id, v_school_id)
      ON CONFLICT (school_id, username) DO NOTHING
      RETURNING id INTO v_student_id;
    END IF;

    IF v_group_id IS NOT NULL AND v_student_id IS NOT NULL THEN
      INSERT INTO public.student_groups (student_id, group_id, school_id) VALUES (v_student_id, v_group_id, v_school_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  -- ── Демо-учителя: 5, со-кураторы всех трёх групп (§1.5) ─────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('demo_teacher_01', 'Dilnoza Karimova'),
      ('demo_teacher_02', 'Rustam Aliev'),
      ('demo_teacher_03', 'Gulnora Yusupova'),
      ('demo_teacher_04', 'Jasur Rakhimov'),
      ('demo_teacher_05', 'Feruza Nazarova')
    ) AS t(username, full_name)
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
        '{"provider":"email","providers":["email"]}'::jsonb, '{"is_demo":true}'::jsonb,
        now(), now(), '', '', '', '', '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_user_id, r.username || '@demo.snr.local',
        jsonb_build_object('sub', v_user_id::text, 'email', r.username || '@demo.snr.local'),
        'email', now(), now(), now());
    END IF;

    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = v_user_id;
    IF v_teacher_id IS NULL THEN
      INSERT INTO public.teachers (user_id, username, full_name, school_id)
      VALUES (v_user_id, r.username, r.full_name, v_school_id)
      RETURNING id INTO v_teacher_id;
    END IF;

    INSERT INTO public.group_teachers (group_id, teacher_id, school_id)
    VALUES (v_group_10a, v_teacher_id, v_school_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.group_teachers (group_id, teacher_id, school_id)
    VALUES (v_group_7a, v_teacher_id, v_school_id) ON CONFLICT DO NOTHING;
    INSERT INTO public.group_teachers (group_id, teacher_id, school_id)
    VALUES (v_group_3a, v_teacher_id, v_school_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- ── Групповые чаты: куратор + все со-учителя + все ученики (§1.7) ──
  FOR r IN SELECT id, name FROM public.groups WHERE id IN (v_group_10a, v_group_7a, v_group_3a)
  LOOP
    SELECT id INTO v_thread_id FROM public.chat_threads WHERE group_id = r.id AND kind = 'group';
    IF v_thread_id IS NULL THEN
      INSERT INTO public.chat_threads (kind, group_id, title, school_id)
      VALUES ('group', r.id, r.name, v_school_id)
      RETURNING id INTO v_thread_id;
    END IF;

    -- куратор
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_thread_id, v_karim_user, 'curator')
    ON CONFLICT (thread_id, user_id) DO NOTHING;

    -- со-учителя (демо)
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    SELECT v_thread_id, t.user_id, 'curator'
    FROM public.group_teachers gt
    JOIN public.teachers t ON t.id = gt.teacher_id
    WHERE gt.group_id = r.id
    ON CONFLICT (thread_id, user_id) DO NOTHING;

    -- ученики группы
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    SELECT v_thread_id, s.user_id, 'student'
    FROM public.student_groups sg
    JOIN public.students s ON s.id = sg.student_id
    WHERE sg.group_id = r.id
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END LOOP;
END $$;

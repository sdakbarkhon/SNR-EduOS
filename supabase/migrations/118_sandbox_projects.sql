-- =====================================================================
-- Migration 118 — Промт 5Б: сохранённые проекты в песочнице ученика.
--
-- Автосохранение текущей работы (is_autosave=true, ровно один слот на
-- связку ученик+сервис) + именованные проекты (is_autosave=false,
-- до 20 на ученика на сервис — лимит проверяется в query-слое, не в БД,
-- как и MAX_TOPICS в curriculum-plans/parse). Ничего не пишет в
-- lessons/homework/submissions — новая изолированная таблица.
--
-- Отклонения от спеки пользователя (см. resheniya_2.md):
-- 1. student_id → REFERENCES students(id), не profiles(id) — таблицы
--    profiles в этой схеме не существует (тот же вывод, что для
--    teacher_id в миграции 116). RLS сверяет через current_student_id()
--    (auth.uid() → students.id), а не сырое auth.uid() — тот же паттерн,
--    что у всех остальных student-owned таблиц в этой схеме.
-- 2. service_id ограничен CHECK на РЕАЛЬНЫЙ набор значений, а не список
--    из спеки: 'python'/'cpp' — единственные языки, которые сейчас
--    поддерживает CodeSandbox (apps/web/app/(app)/projects/SandboxView.tsx)
--    — 'javascript'/'html-css' в текущем коде не существуют ни как опция
--    языка, ни как отдельный content_type. Плюс 12 iframe-инструментов из
--    SANDBOX_TOOLS/SERVICE_CONFIG (на будущее — external_url для них,
--    schema-only в этом промте, UI не подключён: iframe-песочницы не
--    имеют канала обратной связи для чтения состояния из чужого iframe).
-- =====================================================================

BEGIN;

-- ── 1. Таблица ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sandbox_projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id     uuid NOT NULL REFERENCES public.schools(id) DEFAULT public.current_school_id(),
  name          text NOT NULL DEFAULT 'Без названия',
  service_id    text NOT NULL CHECK (service_id IN (
                  'python', 'cpp',
                  'wokwi', 'codesandbox', 'geogebra', 'phet', 'desmos',
                  'blockly_games', 'visualgo', 'p5js', 'excalidraw',
                  'learningapps', 'sqlonline', 'h5p'
                )),
  code          text,
  external_url  text,
  is_autosave   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Ровно один автосейв на связку ученик+сервис.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_projects_autosave_slot
  ON public.sandbox_projects (student_id, service_id) WHERE is_autosave = true;

-- Имя именованного проекта уникально в рамках ученик+сервис (защита в
-- БД поверх клиентской валидации — Часть 3 спеки).
CREATE UNIQUE INDEX IF NOT EXISTS idx_sandbox_projects_named_unique_name
  ON public.sandbox_projects (student_id, service_id, name) WHERE is_autosave = false;

CREATE INDEX IF NOT EXISTS idx_sandbox_projects_student_service
  ON public.sandbox_projects (student_id, service_id, is_autosave);

-- ── 2. updated_at ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_sandbox_projects_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sandbox_projects_updated_at ON public.sandbox_projects;
CREATE TRIGGER trg_sandbox_projects_updated_at
  BEFORE UPDATE ON public.sandbox_projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_sandbox_projects_updated_at();

-- ── 3. RLS — строго owner-only, ни учитель, ни родитель, ни админ ─────────
-- Демо-ученики работают как реальные: current_student_id() резолвит
-- auth.uid() → students.id одинаково для демо- и реальной сессии, никакого
-- отдельного is_demo-фильтра здесь не нужно (RLS уже полностью
-- изолирует по владельцу — в отличие от group-scoped таблиц, где
-- fn_stamp_is_demo защищает ЧУЖИЕ реальные строки, здесь чужих строк
-- демо-сессия физически не может достать через эту политику).

ALTER TABLE public.sandbox_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sandbox_projects_select_own" ON public.sandbox_projects;
CREATE POLICY "sandbox_projects_select_own" ON public.sandbox_projects FOR SELECT
  USING (student_id = public.current_student_id());

DROP POLICY IF EXISTS "sandbox_projects_insert_own" ON public.sandbox_projects;
CREATE POLICY "sandbox_projects_insert_own" ON public.sandbox_projects FOR INSERT
  WITH CHECK (student_id = public.current_student_id());

DROP POLICY IF EXISTS "sandbox_projects_update_own" ON public.sandbox_projects;
CREATE POLICY "sandbox_projects_update_own" ON public.sandbox_projects FOR UPDATE
  USING (student_id = public.current_student_id())
  WITH CHECK (student_id = public.current_student_id());

DROP POLICY IF EXISTS "sandbox_projects_delete_own" ON public.sandbox_projects;
CREATE POLICY "sandbox_projects_delete_own" ON public.sandbox_projects FOR DELETE
  USING (student_id = public.current_student_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sandbox_projects TO authenticated;

-- ── 4. Демо-очистка: пул-аккаунты (demo_student_*) теряют sandbox_projects
-- при истечении демо-сессии — та же логика, что lesson_stage_progress/
-- quiz_attempts/ai_chat_messages (миграция 110, "v_is_pool" ветка):
-- одноразовый пул-аккаунт полностью очищается, иначе следующий человек,
-- которому достанется demo_student_7_03, увидит чужие сохранённые
-- проекты. CREATE OR REPLACE — тело функции безопасно переопределить,
-- сигнатура (uuid, timestamptz) не меняется.

CREATE OR REPLACE FUNCTION public.reset_demo_data_for_user(
  p_user_id uuid,
  p_since timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  v_student_id uuid;
  v_is_pool boolean := false;
BEGIN
  SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = p_user_id;
  SELECT id INTO v_student_id FROM public.students WHERE user_id = p_user_id;

  IF v_student_id IS NOT NULL THEN
    SELECT username LIKE 'demo\_%' ESCAPE '\' INTO v_is_pool
    FROM public.students WHERE id = v_student_id;
  END IF;

  IF v_teacher_id IS NOT NULL THEN
    DELETE FROM public.notifications WHERE source_id IN (
      SELECT id FROM public.homework WHERE teacher_id = v_teacher_id AND is_demo);
    DELETE FROM public.notifications WHERE source_id IN (
      SELECT l.id FROM public.lessons l
      JOIN public.subjects s ON s.id = l.subject_id
      WHERE l.is_demo AND s.teacher_id = v_teacher_id);
    DELETE FROM public.notifications WHERE source_id IN (
      SELECT id FROM public.lesson_grades WHERE graded_by = v_teacher_id AND is_demo);

    DELETE FROM public.lessons l
    WHERE l.is_demo
      AND l.subject_id IN (SELECT id FROM public.subjects WHERE teacher_id = v_teacher_id);

    DELETE FROM public.lesson_stages ls
    WHERE ls.is_demo AND EXISTS (
      SELECT 1 FROM public.lessons l
      JOIN public.subjects s ON s.id = l.subject_id
      WHERE l.id = ls.lesson_id AND s.teacher_id = v_teacher_id);
    DELETE FROM public.homework          WHERE teacher_id  = v_teacher_id AND is_demo;
    DELETE FROM public.attendance        WHERE marked_by   = v_teacher_id AND is_demo;
    DELETE FROM public.lesson_grades     WHERE graded_by   = v_teacher_id AND is_demo;
    DELETE FROM public.lesson_materials  WHERE uploaded_by = v_teacher_id AND is_demo;
    DELETE FROM public.course_materials  WHERE uploaded_by = v_teacher_id AND is_demo;
  END IF;

  IF v_student_id IS NOT NULL THEN
    DELETE FROM public.homework_submissions  WHERE student_id = v_student_id AND is_demo;
    DELETE FROM public.test_submissions      WHERE student_id = v_student_id AND is_demo;
    DELETE FROM public.classwork_submissions WHERE student_id = v_student_id AND is_demo;
    DELETE FROM public.attendance            WHERE student_id = v_student_id AND is_demo;
    DELETE FROM public.lesson_grades         WHERE student_id = v_student_id AND is_demo;

    IF v_is_pool THEN
      DELETE FROM public.lesson_stage_progress WHERE student_id = v_student_id;
      DELETE FROM public.quiz_attempts         WHERE student_id = v_student_id;
      DELETE FROM public.lesson_raised_hands   WHERE student_id = v_student_id;
      DELETE FROM public.ai_chat_messages      WHERE student_id = v_student_id;
      DELETE FROM public.attendance            WHERE student_id = v_student_id;
      DELETE FROM public.lesson_grades         WHERE student_id = v_student_id;
      -- Промт 5Б: sandbox_projects тоже без is_demo-колонки (RLS и так
      -- полностью owner-scoped) — пул-аккаунт очищается целиком, как и
      -- прочие таблицы без is_demo в этой ветке.
      DELETE FROM public.sandbox_projects      WHERE student_id = v_student_id;
    ELSIF p_since IS NOT NULL THEN
      DELETE FROM public.lesson_stage_progress WHERE student_id = v_student_id AND completed_at > p_since;
      DELETE FROM public.quiz_attempts         WHERE student_id = v_student_id AND started_at  > p_since;
      DELETE FROM public.lesson_raised_hands   WHERE student_id = v_student_id AND raised_at   > p_since;
      DELETE FROM public.ai_chat_messages      WHERE student_id = v_student_id AND created_at  > p_since;
      DELETE FROM public.sandbox_projects      WHERE student_id = v_student_id AND updated_at  > p_since;
    END IF;
  END IF;

  IF v_is_pool THEN
    DELETE FROM public.chat_messages  WHERE sender_id = p_user_id;
    DELETE FROM public.notifications  WHERE recipient_user_id = p_user_id;
  ELSIF p_since IS NOT NULL THEN
    DELETE FROM public.chat_messages  WHERE sender_id = p_user_id AND created_at > p_since;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_demo_data_for_user(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_demo_data_for_user(uuid, timestamptz) TO service_role;

-- ── 5. Регистрация ───────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('118')
ON CONFLICT (version) DO NOTHING;

COMMIT;

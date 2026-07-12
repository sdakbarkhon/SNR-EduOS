-- =====================================================================
-- Migration 122 — Промт 7.2 Часть 1: личные чаты ученик ↔ учитель.
--
-- Схема: chat_threads.kind уже допускает 'direct' (миграция 78), но этот
-- путь никогда не использовался (0 direct-тредов в hosted, подтверждено
-- ресерчем — legacy-миграция строк из старой public.messages нашла 0
-- строк). Вместо отдельной таблицы direct_chats расширяем chat_threads
-- двумя nullable-колонками student_id/teacher_id (по аналогии с тем, как
-- group_id/title уже являются "payload"-колонками для kind='group') —
-- это переиспользует всю существующую инфраструктуру (RLS через
-- is_my_thread(), realtime publication, query-слой getMyThreadSummaries/
-- getThreadMessages/sendChatMessage/markThreadRead, компонент
-- MessagesView.tsx) без дублирования. Обоснование выбора — в
-- resheniya_2.md.
--
-- "Куратор" — НЕ отдельный тип чата: это тот же personal-чат с учителем,
-- который просто оказался куратором группы ученика (UI подсвечивает его
-- по совпадению chat_threads.teacher_id с groups.teacher_id, см. Часть 3).
--
-- Область автосоздания: только РЕАЛЬНЫЕ (не демо-пул) ученики — в hosted
-- 90 демо-учеников уже сидят в student_groups (пул на 30/группу), и
-- создание 90×6=540 пустых чатов было бы чистым мусором (демо-сессии
-- эфемерны, is_demo-очистка на chat_* таблицы не распространяется — см.
-- список 10 is_demo-таблиц миграции 110, chat_threads туда не входит).
-- Реальных учеников сейчас 3 (по одному на группу) — 3×6=18 чатов.
-- =====================================================================

BEGIN;

-- ── 1. Колонки + уникальность "ровно один direct-тред на пару" ─────────

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_direct_pair_unique_idx
  ON public.chat_threads (student_id, teacher_id) WHERE kind = 'direct';

CREATE INDEX IF NOT EXISTS chat_threads_direct_student_idx
  ON public.chat_threads (student_id) WHERE kind = 'direct';
CREATE INDEX IF NOT EXISTS chat_threads_direct_teacher_idx
  ON public.chat_threads (teacher_id) WHERE kind = 'direct';

-- ── 2. fn_ensure_direct_chat — идемпотентный конструктор одного треда ──
-- SECURITY DEFINER: вызывается из триггеров/DO-блока с любым auth.uid()
-- (в т.ч. NULL при миграции), сам решает student_id/teacher_id → user_id.

CREATE OR REPLACE FUNCTION public.fn_ensure_direct_chat(p_student_id uuid, p_teacher_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_student_user_id uuid;
  v_teacher_user_id uuid;
  v_thread_id uuid;
BEGIN
  SELECT school_id, user_id INTO v_school_id, v_student_user_id
    FROM public.students WHERE id = p_student_id;
  SELECT user_id INTO v_teacher_user_id
    FROM public.teachers WHERE id = p_teacher_id;

  IF v_school_id IS NULL OR v_student_user_id IS NULL OR v_teacher_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.chat_threads (kind, school_id, student_id, teacher_id)
  VALUES ('direct', v_school_id, p_student_id, p_teacher_id)
  ON CONFLICT (student_id, teacher_id) WHERE kind = 'direct' DO NOTHING
  RETURNING id INTO v_thread_id;

  IF v_thread_id IS NULL THEN
    SELECT id INTO v_thread_id FROM public.chat_threads
      WHERE kind = 'direct' AND student_id = p_student_id AND teacher_id = p_teacher_id;
  END IF;

  INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
  VALUES (v_thread_id, v_student_user_id, 'student')
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
  VALUES (v_thread_id, v_teacher_user_id, 'teacher')
  ON CONFLICT (thread_id, user_id) DO NOTHING;
END;
$$;

-- ── 3. Триггеры, держащие direct-чаты в синхроне с составом классов ────
-- Все три — SECURITY DEFINER, все фильтруют демо-учеников тем же
-- паттерном, что миграция 110 (username LIKE 'demo\_%' ESCAPE '\').

-- 3a. Новый ученик зачислен в группу → чат с куратором + всеми
-- предметниками этой группы.
CREATE OR REPLACE FUNCTION public.tg_student_group_added_direct_chats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username text;
  r RECORD;
BEGIN
  SELECT username INTO v_username FROM public.students WHERE id = NEW.student_id;
  IF v_username IS NULL OR v_username LIKE 'demo\_%' ESCAPE '\' THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT own.teacher_id
    FROM public.groups g
    JOIN LATERAL (
      SELECT g.teacher_id AS teacher_id WHERE g.teacher_id IS NOT NULL
      UNION
      SELECT s.teacher_id FROM public.subjects s WHERE s.group_id = g.id AND s.teacher_id IS NOT NULL
    ) own ON true
    WHERE g.id = NEW.group_id
  LOOP
    PERFORM public.fn_ensure_direct_chat(NEW.student_id, r.teacher_id);
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_student_group_added_direct_chats ON public.student_groups;
CREATE TRIGGER trg_student_group_added_direct_chats
AFTER INSERT ON public.student_groups
FOR EACH ROW EXECUTE FUNCTION public.tg_student_group_added_direct_chats();

-- 3b. Предмету назначен/сменён учитель → чат с каждым (реальным) учеником
-- этой группы.
CREATE OR REPLACE FUNCTION public.tg_subject_teacher_direct_chats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.teacher_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.teacher_id IS NOT DISTINCT FROM OLD.teacher_id THEN RETURN NEW; END IF;

  FOR r IN
    SELECT sg.student_id
    FROM public.student_groups sg
    JOIN public.students st ON st.id = sg.student_id
    WHERE sg.group_id = NEW.group_id
      AND st.username NOT LIKE 'demo\_%' ESCAPE '\'
  LOOP
    PERFORM public.fn_ensure_direct_chat(r.student_id, NEW.teacher_id);
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_subject_teacher_direct_chats ON public.subjects;
CREATE TRIGGER trg_subject_teacher_direct_chats
AFTER INSERT OR UPDATE OF teacher_id ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.tg_subject_teacher_direct_chats();

-- 3c. Смена куратора группы → чат нового куратора с каждым (реальным)
-- учеником группы (чат старого куратора как предметника, если он им
-- остаётся, не трогаем — у каждого учителя ровно один персональный чат
-- с учеником вне зависимости от роли/предмета).
CREATE OR REPLACE FUNCTION public.tg_group_curator_direct_chats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD;
BEGIN
  IF NEW.teacher_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.teacher_id IS NOT DISTINCT FROM OLD.teacher_id THEN RETURN NEW; END IF;

  FOR r IN
    SELECT sg.student_id
    FROM public.student_groups sg
    JOIN public.students st ON st.id = sg.student_id
    WHERE sg.group_id = NEW.id
      AND st.username NOT LIKE 'demo\_%' ESCAPE '\'
  LOOP
    PERFORM public.fn_ensure_direct_chat(r.student_id, NEW.teacher_id);
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_group_curator_direct_chats ON public.groups;
CREATE TRIGGER trg_group_curator_direct_chats
AFTER UPDATE OF teacher_id ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.tg_group_curator_direct_chats();

-- ── 4. Одноразовый backfill — текущие реальные ученики × их учителя ────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT sg.student_id, own.teacher_id
    FROM public.student_groups sg
    JOIN public.students st ON st.id = sg.student_id
    JOIN public.groups g ON g.id = sg.group_id
    JOIN LATERAL (
      SELECT g.teacher_id AS teacher_id WHERE g.teacher_id IS NOT NULL
      UNION
      SELECT s.teacher_id FROM public.subjects s WHERE s.group_id = g.id AND s.teacher_id IS NOT NULL
    ) own ON true
    WHERE st.username NOT LIKE 'demo\_%' ESCAPE '\'
  LOOP
    PERFORM public.fn_ensure_direct_chat(r.student_id, r.teacher_id);
  END LOOP;
END $$;

-- ── 5. RLS — исключаем kind='direct' из школьного admin-обхода ─────────
-- is_super_admin() остаётся сквозным бэкдором (как везде в проекте);
-- fn_is_admin() (школьный админ) и родители не получают доступа к
-- personal-чатам — родители и так никогда не становятся chat_participants
-- direct-треда, поэтому для них никаких правок не требуется, только для
-- fn_is_admin()-веток.

DROP POLICY IF EXISTS "participants read their threads" ON public.chat_threads;
CREATE POLICY "participants read their threads" ON public.chat_threads
  FOR SELECT
  USING (
    is_my_thread(id)
    OR is_super_admin()
    OR (kind <> 'direct' AND school_id = current_school_id() AND fn_is_admin())
  );

DROP POLICY IF EXISTS "admin/teacher create threads" ON public.chat_threads;
CREATE POLICY "admin/teacher create threads" ON public.chat_threads
  FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (kind <> 'direct' AND school_id = current_school_id() AND fn_is_admin())
    OR (
      school_id = current_school_id() AND current_teacher_id() IS NOT NULL
      AND (kind <> 'direct' OR teacher_id = current_teacher_id())
    )
  );

DROP POLICY IF EXISTS "admin update threads" ON public.chat_threads;
CREATE POLICY "admin update threads" ON public.chat_threads
  FOR UPDATE
  USING (is_super_admin() OR (kind <> 'direct' AND school_id = current_school_id() AND fn_is_admin()));

DROP POLICY IF EXISTS "admin delete threads" ON public.chat_threads;
CREATE POLICY "admin delete threads" ON public.chat_threads
  FOR DELETE
  USING (is_super_admin() OR (kind <> 'direct' AND school_id = current_school_id() AND fn_is_admin()));

DROP POLICY IF EXISTS "read own or co-participant rows" ON public.chat_participants;
CREATE POLICY "read own or co-participant rows" ON public.chat_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_my_thread(thread_id)
    OR is_super_admin()
    OR (fn_is_admin() AND EXISTS (
          SELECT 1 FROM public.chat_threads t
          WHERE t.id = chat_participants.thread_id
            AND t.school_id = current_school_id()
            AND t.kind <> 'direct'
        ))
  );

DROP POLICY IF EXISTS "participants read messages" ON public.chat_messages;
CREATE POLICY "participants read messages" ON public.chat_messages
  FOR SELECT
  USING (
    is_my_thread(thread_id)
    OR is_super_admin()
    OR (
      fn_is_admin() AND school_id = current_school_id()
      AND NOT EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = chat_messages.thread_id AND t.kind = 'direct')
    )
  );

DROP POLICY IF EXISTS "sender edits within 15min or admin" ON public.chat_messages;
CREATE POLICY "sender edits within 15min or admin" ON public.chat_messages
  FOR UPDATE
  USING (
    (sender_id = auth.uid() AND created_at > now() - interval '15 minutes')
    OR is_super_admin()
    OR (
      fn_is_admin() AND school_id = current_school_id()
      AND NOT EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = chat_messages.thread_id AND t.kind = 'direct')
    )
  );

-- chat_read_state policies already scope strictly to user_id = auth.uid()
-- (no fn_is_admin() bypass exists there) — no change needed.
-- chat_participants INSERT/UPDATE/DELETE policies already require
-- t.kind = 'group', so they simply don't cover 'direct' rows — client-side
-- mutation of direct-thread participants stays impossible, matching intent
-- (only fn_ensure_direct_chat, SECURITY DEFINER, manages them).

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('122')
ON CONFLICT (version) DO NOTHING;

COMMIT;

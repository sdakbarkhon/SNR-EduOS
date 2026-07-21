-- =====================================================================
-- Migration 145 — Убираем demo_%-фильтр из триггеров создания личных
-- (direct) чатов + одноразовый backfill для учеников, оставшихся после
-- сокращения групп до 10 человек (Шаг 2 из 2 плана "сократить учеников").
--
-- Контекст: Пачка 2 сняла флаг is_demo у бывших demo_student-аккаунтов —
-- они теперь РАВНОЗНАЧНЫЕ реальные ученики (username при этом НЕ
-- переименовывался, по решению менеджера — Шаг 2, вариант Б). Но триггеры
-- миграции 122 (tg_student_group_added_direct_chats/
-- tg_subject_teacher_direct_chats/tg_group_curator_direct_chats) всё ещё
-- жёстко фильтруют по username LIKE 'demo\_%' — из-за этого авто-создание
-- личных чатов для этих учеников не срабатывает никогда. fn_ensure_direct_chat
-- сама по себе такого фильтра не содержит — правка только в 3 триггер-
-- функциях, остальная их логика не меняется НИ НА СТРОКУ.
--
-- Порядок исполнения (важно): эта миграция ЗАДУМАНА как безопасная к
-- порядку относительно удаления 66 утверждённых учеников (см. отдельный
-- скрипт scripts/delete-66-students-trim-to-10.mjs) — backfill ниже
-- фильтрует по NOT IN (66 утверждённых username), а не просто "все
-- не-demo", так что даже если применить эту миграцию ДО запуска скрипта
-- удаления, она не создаст чатов удаляемым 66. Тем не менее РЕКОМЕНДОВАННЫЙ
-- порядок — СНАЧАЛА скрипт удаления, ПОТОМ эта миграция: пока 66 ещё не
-- удалены, но триггер-фильтр уже снят, любое случайное изменение
-- student_groups/subjects/groups в этом окне (например, кто-то вручную
-- поправит расписание) заставит триггеры создать чаты и для кого-то из
-- удаляемых 66 — сами по себе они безвредны (снесутся каскадом при
-- удалении), но это лишний шум. Удаление сначала полностью убирает это
-- окно.
-- =====================================================================

BEGIN;

-- ── 1. Убираем username LIKE 'demo\_%' гейт из 3 триггер-функций ───────
-- (fn_ensure_direct_chat, вызываемая ими, такого фильтра не содержит — не трогаем)

-- 1a. Новый ученик зачислен в группу → чат с куратором + предметниками.
CREATE OR REPLACE FUNCTION public.tg_student_group_added_direct_chats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username text;
  r RECORD;
BEGIN
  SELECT username INTO v_username FROM public.students WHERE id = NEW.student_id;
  IF v_username IS NULL THEN
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

-- 1b. Предмету назначен/сменён учитель → чат с каждым учеником группы.
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
  LOOP
    PERFORM public.fn_ensure_direct_chat(r.student_id, NEW.teacher_id);
  END LOOP;

  RETURN NEW;
END $$;

-- 1c. Смена куратора группы → чат нового куратора с каждым учеником группы.
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
  LOOP
    PERFORM public.fn_ensure_direct_chat(r.student_id, NEW.teacher_id);
  END LOOP;

  RETURN NEW;
END $$;

-- ── 2. Backfill — недостающие чаты для оставшихся учеников ─────────────
-- Идемпотентно (fn_ensure_direct_chat: INSERT ... ON CONFLICT DO NOTHING) —
-- существующие 6 чатов у sherzod_10/farrukh_10/malika_07/nodira_07/
-- aziz_03/rustam_03 не дублируются, эти вызовы для них просто no-op. Гейт
-- ниже — NOT IN (66 утверждённых на удаление username), а не общий "не
-- demo", чтобы быть безопасным к порядку относительно скрипта удаления
-- (см. шапку файла). Ожидается ~144 новых строк (24 ученика × 6
-- недостающих чатов каждому).

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
    WHERE st.username NOT IN (
      'demo_student_10_01', 'demo_student_10_02', 'demo_student_10_03', 'demo_student_10_04',
      'demo_student_10_05', 'demo_student_10_06', 'demo_student_10_07', 'demo_student_10_09',
      'demo_student_10_10', 'demo_student_10_11', 'demo_student_10_12', 'demo_student_10_15',
      'demo_student_10_18', 'demo_student_10_19', 'demo_student_10_20', 'demo_student_10_21',
      'demo_student_10_22', 'demo_student_10_25', 'demo_student_10_26', 'demo_student_10_27',
      'demo_student_10_29', 'demo_student_10_30',
      'demo_student_7_02', 'demo_student_7_03', 'demo_student_7_04', 'demo_student_7_05',
      'demo_student_7_06', 'demo_student_7_07', 'demo_student_7_09', 'demo_student_7_12',
      'demo_student_7_13', 'demo_student_7_15', 'demo_student_7_16', 'demo_student_7_17',
      'demo_student_7_18', 'demo_student_7_19', 'demo_student_7_20', 'demo_student_7_22',
      'demo_student_7_23', 'demo_student_7_24', 'demo_student_7_25', 'demo_student_7_26',
      'demo_student_7_27', 'demo_student_7_28',
      'demo_student_3_02', 'demo_student_3_03', 'demo_student_3_04', 'demo_student_3_05',
      'demo_student_3_06', 'demo_student_3_07', 'demo_student_3_09', 'demo_student_3_10',
      'demo_student_3_11', 'demo_student_3_12', 'demo_student_3_13', 'demo_student_3_15',
      'demo_student_3_17', 'demo_student_3_18', 'demo_student_3_19', 'demo_student_3_20',
      'demo_student_3_21', 'demo_student_3_23', 'demo_student_3_24', 'demo_student_3_26',
      'demo_student_3_27', 'demo_student_3_29'
    )
  LOOP
    PERFORM public.fn_ensure_direct_chat(r.student_id, r.teacher_id);
  END LOOP;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('145')
ON CONFLICT (version) DO NOTHING;

COMMIT;

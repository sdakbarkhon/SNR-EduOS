-- ============================================================================
-- Миграция 271: личный чат уходит вместе со связью.
-- ============================================================================
--
-- ═══ ЧТО СЛОМАНО ═══════════════════════════════════════════════════════════
--
-- Личные чаты «ученик + учитель» ЗАВОДЯТСЯ двумя триггерами (назначили предмет
-- на группу; записали ученика в группу) и не убираются НИКОГДА. Убирающего
-- триггера нет ни одного.
--
-- Замер 06.09.2026: 152 личные ветки, из них 11 осиротевших — связи «этот
-- учитель ведёт этого ученика» больше нет. Десять из одиннадцати у одного
-- человека: Елена не ведёт десятый класс, а чаты с его учениками остались.
--
-- ═══ ЧТО ДЕЛАЕМ, А ЧЕГО НЕ ДЕЛАЕМ ══════════════════════════════════════════
--
-- СНИМАЕМ УЧАСТИЕ. Обе строки `chat_participants` — и ученика, и учителя.
-- Ветка исчезает из списка у обоих: список строится из веток, доступных
-- участнику.
--
-- ВЕТКУ И ПЕРЕПИСКУ НЕ ТРОГАЕМ. Решение заказчика, и оно верное: 26 сообщений
-- в этих ветках — это разговор учителя с учеником, а не мусор. Удалить их
-- необратимо ради опрятности списка — обмен неравный. С куратором так уже
-- вышло: тридцать веток и семьдесят девять сообщений, назад не вернуть.
--
-- ВЕРНЁТСЯ СВЯЗЬ — ВЕРНЁТСЯ И ЧАТ. Заводящие триггеры зовут
-- `fn_ensure_direct_chat`, а она находит существующую ветку по паре
-- (student_id, teacher_id) и просто дописывает участников. Переписка окажется
-- на месте.
--
-- ═══ ЧТО СЧИТАЕТСЯ СВЯЗЬЮ ══════════════════════════════════════════════════
--
-- Учитель ведёт ХОТЯ БЫ ОДИН предмет в ХОТЯ БЫ ОДНОЙ группе этого ученика.
--
-- ДВА ПРЕДМЕТА У ОДНОГО УЧИТЕЛЯ — самый вероятный источник ошибки. Сняли
-- математику, осталась физика: связь ЕСТЬ, участие снимать нельзя. Поэтому
-- проверка смотрит не на снятый предмет, а на всё, что осталось ПОСЛЕ
-- изменения, — триггеры AFTER, и к моменту проверки строка уже новая.
--
-- ПРО КУРАТОРА НЕ СПРАШИВАЕМ. Заводящие триггеры (миграция про личные чаты)
-- считают куратора группы (`groups.teacher_id`) поводом для чата. Роль убрана
-- из продукта, колонка пуста у всех восьми групп (проверено 06.09.2026), и
-- новая проверка про неё не спрашивает вовсе — иначе мы бы держали чат по
-- признаку, которого больше нет.
-- ============================================================================

BEGIN;

-- ── 1. Нужен ли ещё этот личный чат ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_direct_chat_still_linked(
  p_student_id uuid,
  p_teacher_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.student_groups sg
      JOIN public.subjects s ON s.group_id = sg.group_id
     WHERE sg.student_id = p_student_id
       AND s.teacher_id = p_teacher_id
  );
$function$;

COMMENT ON FUNCTION public.fn_direct_chat_still_linked(uuid, uuid) IS
  'Ведёт ли этот учитель этого ученика хоть где-нибудь: хотя бы один предмет в хотя бы одной его группе. Куратора группы НЕ считает — роль убрана из продукта.';

-- ── 2. Снять участие, если связи не осталось ────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_drop_direct_chat_participation(
  p_student_id uuid,
  p_teacher_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_thread uuid;
BEGIN
  IF p_student_id IS NULL OR p_teacher_id IS NULL THEN RETURN; END IF;
  IF public.fn_direct_chat_still_linked(p_student_id, p_teacher_id) THEN RETURN; END IF;

  SELECT id INTO v_thread FROM public.chat_threads
   WHERE kind = 'direct' AND student_id = p_student_id AND teacher_id = p_teacher_id;
  IF v_thread IS NULL THEN RETURN; END IF;

  -- ОБЕ строки участия: ветка должна пропасть у обоих, а не у одного.
  -- Сама ветка и сообщения остаются на месте.
  DELETE FROM public.chat_participants
   WHERE thread_id = v_thread
     AND user_id IN (
       (SELECT user_id FROM public.students WHERE id = p_student_id),
       (SELECT user_id FROM public.teachers WHERE id = p_teacher_id)
     );
END;
$function$;

-- ── 3. Сняли учителя с предмета ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_subject_teacher_direct_chats_off()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  v_прежний uuid;
  v_группа  uuid;
  r RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_прежний := OLD.teacher_id;
    v_группа  := OLD.group_id;
  ELSE
    -- Учитель не менялся — делать нечего.
    IF NEW.teacher_id IS NOT DISTINCT FROM OLD.teacher_id THEN RETURN NEW; END IF;
    v_прежний := OLD.teacher_id;
    v_группа  := OLD.group_id;
  END IF;

  IF v_прежний IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  FOR r IN SELECT sg.student_id FROM public.student_groups sg WHERE sg.group_id = v_группа
  LOOP
    PERFORM public.fn_drop_direct_chat_participation(r.student_id, v_прежний);
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS trg_subject_teacher_direct_chats_off ON public.subjects;
CREATE TRIGGER trg_subject_teacher_direct_chats_off
  AFTER UPDATE OF teacher_id OR DELETE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_subject_teacher_direct_chats_off();

-- ── 4. Ученик вышел из группы ───────────────────────────────────────────────
--
-- Из чата КЛАССА его выводит прежний триггер `tg_student_group_chat` — он
-- умеет это с самого начала. Здесь про личные: они не убирались ничем.
CREATE OR REPLACE FUNCTION public.tg_student_group_direct_chats_off()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT s.teacher_id
      FROM public.subjects s
     WHERE s.group_id = OLD.group_id AND s.teacher_id IS NOT NULL
  LOOP
    PERFORM public.fn_drop_direct_chat_participation(OLD.student_id, r.teacher_id);
  END LOOP;
  RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS trg_student_group_direct_chats_off ON public.student_groups;
CREATE TRIGGER trg_student_group_direct_chats_off
  AFTER DELETE ON public.student_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_student_group_direct_chats_off();

-- ── 5. Разовая уборка одиннадцати осиротевших ───────────────────────────────
--
-- Триггеры ловят только НОВЫЕ события; накопленное надо снять один раз. Ветки
-- и сообщения не трогаются — уходит только участие, 22 строки по замеру.
DELETE FROM public.chat_participants p
 USING public.chat_threads t
 WHERE p.thread_id = t.id
   AND t.kind = 'direct'
   AND t.student_id IS NOT NULL
   AND t.teacher_id IS NOT NULL
   AND NOT public.fn_direct_chat_still_linked(t.student_id, t.teacher_id);

-- ── 6. Самопроверка ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_осталось integer;
  v_веток    integer;
  v_сообщений integer;
BEGIN
  -- Ни одной строки участия в осиротевшей ветке остаться не должно.
  SELECT count(*) INTO v_осталось
    FROM public.chat_participants p
    JOIN public.chat_threads t ON t.id = p.thread_id
   WHERE t.kind = 'direct' AND t.student_id IS NOT NULL AND t.teacher_id IS NOT NULL
     AND NOT public.fn_direct_chat_still_linked(t.student_id, t.teacher_id);
  IF v_осталось <> 0 THEN
    RAISE EXCEPTION '271: в осиротевших ветках осталось % строк участия', v_осталось;
  END IF;

  -- А сами ветки и переписка обязаны уцелеть.
  SELECT count(*) INTO v_веток FROM public.chat_threads WHERE kind = 'direct';
  SELECT count(*) INTO v_сообщений FROM public.chat_messages;
  IF v_веток < 152 THEN
    RAISE EXCEPTION '271: личных веток стало % — их удалять было нельзя', v_веток;
  END IF;
  IF v_сообщений < 477 THEN
    RAISE EXCEPTION '271: сообщений стало % — переписку удалять было нельзя', v_сообщений;
  END IF;

  RAISE NOTICE '271: участие снято, веток %, сообщений % — целы', v_веток, v_сообщений;
END $$;

COMMIT;

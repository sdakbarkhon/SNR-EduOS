-- ============================================================================
-- Миграция 262: заказ на разбор учебника. Файл вместо плана.
-- ============================================================================
--
-- ═══ ЗАЧЕМ ═════════════════════════════════════════════════════════════════
--
-- Кнопка «Собрать из учебника» создавала ПЛАН и запускала его разбор. Задумано
-- иначе: модель читает книгу, составляет темы и ОТДАЁТ ФАЙЛ. План в системе не
-- появляется — учитель открывает файл, правит темы и приносит его второй
-- кнопкой.
--
-- Разбор толстого учебника идёт минутами, а функция на serverless живёт
-- пятнадцать секунд. Значит «нажал — скачал» одним запросом невозможно: нужна
-- запись-заказ, которую фон доводит до готового файла, и по которой учитель
-- узнаёт, что файл готов. Эта таблица и есть такая запись.
--
-- ЗАЧЕМ НЕ ПЛАН СО СТАТУСОМ. План занимает пару (группа, предмет), на которую
-- наложено ограничение уникальности: пока висит черновик, учитель не может ни
-- собрать план из другой книги, ни загрузить готовый. Брошенный черновик —
-- это запертая пара и вопрос «почему у меня висит недоделанный план» через
-- месяц.
--
-- ═══ ДВОЙНОЕ НАЖАТИЕ ═══════════════════════════════════════════════════════
--
-- Разбор книги — самый дорогой вызов в проекте. У плана от двойного нажатия
-- спасала случайность: пара (группа, предмет) уникальна, и второй план просто
-- не заводился. У заказа такой случайности нет, поэтому запрет ставится явно:
-- частичный уникальный индекс на живой заказ. Второе нажатие не создаёт
-- второй заказ — оно упирается в существующий, и вызывающий возвращает его же.
--
-- ═══ СРОК ХРАНЕНИЯ ═════════════════════════════════════════════════════════
--
-- Тридцать дней (решение заказчика). Файл заказа — это 3-8 КБ на 30-60 тем,
-- но бакет `curriculum-plans` уже болен: пять файлов, четыре из них не
-- привязаны ни к чему. Заводить ещё один источник мусора без срока нельзя.
-- Уборка прицепом к существующему крону, отдельного не заводим.
-- ============================================================================

-- ── 1. Таблица заказов ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.curriculum_plan_drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  -- Кто заказал. CASCADE: уволили учителя — его заказы уходят с ним.
  teacher_id  uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  -- Для чего заказ: пара нужна, чтобы файл был подписан и чтобы запрет
  -- двойного нажатия считался по тому же, по чему считает человек.
  group_id    uuid NOT NULL REFERENCES public.groups(id)   ON DELETE CASCADE,
  subject_id  uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  -- Книга-источник. CASCADE: удалили книгу — заказ на неё смысла не имеет.
  book_id     uuid NOT NULL REFERENCES public.books(id)    ON DELETE CASCADE,
  title       text NOT NULL,

  status      text NOT NULL DEFAULT 'queued',
  -- Процент и стадия — те же, что у плана: экран показывает не примету, а
  -- настоящий шаг, потому что учебник на тридцать мегабайт качается долго.
  progress_percent integer NOT NULL DEFAULT 0,
  progress_stage   text,
  -- Причина отказа словами. Пусто у удавшихся.
  error_message    text,

  -- Путь готового файла в бакете curriculum-plans. Пусто, пока не готов.
  result_path text,
  topics_count integer,

  created_at  timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  -- Срок хранения: тридцать дней от заведения. Уборка сверяется с ним.
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '30 days'),

  CONSTRAINT curriculum_plan_drafts_status_check
    CHECK (status IN ('queued', 'running', 'done', 'failed'))
);

COMMENT ON TABLE public.curriculum_plan_drafts IS
  'Заказ на разбор учебника: модель читает книгу и складывает темы файлом (CSV) в бакет curriculum-plans. План при этом НЕ создаётся — учитель правит файл и приносит его кнопкой загрузки. Живёт 30 дней, дальше убирается вместе с файлом.';
COMMENT ON COLUMN public.curriculum_plan_drafts.result_path IS
  'Путь готового CSV в бакете curriculum-plans (<teacher_id>/drafts/<id>.csv). NULL, пока заказ не выполнен или отказал.';
COMMENT ON COLUMN public.curriculum_plan_drafts.error_message IS
  'Причина отказа человеческими словами: модель не ответила, книга не прочиталась, файл не записался. Учитель должен видеть причину, а не «не вышло».';

CREATE INDEX IF NOT EXISTS idx_cpd_teacher ON public.curriculum_plan_drafts (teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cpd_school  ON public.curriculum_plan_drafts (school_id);
CREATE INDEX IF NOT EXISTS idx_cpd_expires ON public.curriculum_plan_drafts (expires_at);

-- ЗАПРЕТ ДВОЙНОГО НАЖАТИЯ. Один живой заказ на «учитель + книга + группа +
-- предмет». Частичный: выполненные и отказавшие не мешают заказать снова.
CREATE UNIQUE INDEX IF NOT EXISTS curriculum_plan_drafts_alive_uniq
  ON public.curriculum_plan_drafts (teacher_id, book_id, group_id, subject_id)
  WHERE status IN ('queued', 'running');

-- ── 2. Права: сначала отобрать, потом выдать ────────────────────────────────
--
-- Именно в таком порядке и поимённо. На функции подсказки мы уже спотыкались:
-- права, доставшиеся роли по умолчанию, тихо переживают REVOKE ... FROM PUBLIC,
-- если роль названа не была.
ALTER TABLE public.curriculum_plan_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.curriculum_plan_drafts FROM PUBLIC;
REVOKE ALL ON TABLE public.curriculum_plan_drafts FROM anon;
REVOKE ALL ON TABLE public.curriculum_plan_drafts FROM authenticated;
GRANT SELECT ON TABLE public.curriculum_plan_drafts TO authenticated;
GRANT ALL    ON TABLE public.curriculum_plan_drafts TO service_role;

-- ЧИТАЕТ ТОЛЬКО СВОЙ И СУПЕРАДМИН. Ни админ школы, ни коллега: заказ — это
-- черновик, промежуточная работа одного человека, и показывать её соседу
-- незачем.
DROP POLICY IF EXISTS curriculum_plan_drafts_own ON public.curriculum_plan_drafts;
CREATE POLICY curriculum_plan_drafts_own ON public.curriculum_plan_drafts
  FOR SELECT TO authenticated
  USING (
    teacher_id = public.current_teacher_id()
    OR public.is_super_admin()
  );

-- ПИШЕТ ТОЛЬКО СЛУЖЕБНЫЙ КЛЮЧ. Заказ заводит ручка, ход разбора пишет фон —
-- оба ходят служебным ключом. Правил записи для authenticated нет вовсе:
-- нечего давать браузеру право двигать процент чужой работы.

-- ── 3. Уборка по сроку ──────────────────────────────────────────────────────
--
-- Возвращает пути файлов, которые надо снести из хранилища, и удаляет строки.
-- Файлы удаляет вызывающий: SQL до Storage не дотягивается, а разносить
-- удаление по двум местам без общего ответа значило бы копить сирот — ровно
-- ту болезнь, от которой в бакете уже четыре файла ни к чему не привязаны.
CREATE OR REPLACE FUNCTION public.fn_purge_expired_plan_drafts()
RETURNS TABLE(result_path text)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH удалённые AS (
    DELETE FROM public.curriculum_plan_drafts
     WHERE expires_at < now()
     RETURNING result_path
  )
  -- Строки возвращаются ВСЕ, включая отказавшие без файла: вызывающий считает
  -- по ним, сколько заказов убрано, а пути отбирает сам. Отфильтруй мы пусто
  -- здесь — число убранных заказов в логе стало бы враньём.
  SELECT result_path FROM удалённые
$$;

REVOKE ALL ON FUNCTION public.fn_purge_expired_plan_drafts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_purge_expired_plan_drafts() FROM anon;
REVOKE ALL ON FUNCTION public.fn_purge_expired_plan_drafts() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_purge_expired_plan_drafts() TO service_role;

COMMENT ON FUNCTION public.fn_purge_expired_plan_drafts() IS
  'Убирает заказы старше срока и возвращает пути их файлов, чтобы вызывающий снёс их из хранилища. Зовётся прицепом к существующему крону.';

-- ── 4. Самопроверка ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_pol   integer;
  v_grant integer;
BEGIN
  SELECT count(*) INTO v_pol FROM pg_policies
   WHERE schemaname='public' AND tablename='curriculum_plan_drafts';
  IF v_pol <> 1 THEN
    RAISE EXCEPTION '262: правил на заказах % вместо одного (чтение своего)', v_pol;
  END IF;

  -- У anon не должно остаться ничего, у authenticated — только чтение.
  SELECT count(*) INTO v_grant FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='curriculum_plan_drafts' AND grantee='anon';
  IF v_grant <> 0 THEN
    RAISE EXCEPTION '262: у anon осталось % прав на заказы', v_grant;
  END IF;

  SELECT count(*) INTO v_grant FROM information_schema.role_table_grants
   WHERE table_schema='public' AND table_name='curriculum_plan_drafts'
     AND grantee='authenticated' AND privilege_type <> 'SELECT';
  IF v_grant <> 0 THEN
    RAISE EXCEPTION '262: у authenticated % прав сверх чтения', v_grant;
  END IF;

  RAISE NOTICE '262: заказы заведены, чтение своё, записи из браузера нет';
END $$;

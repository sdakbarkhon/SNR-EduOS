-- ============================================================================
-- Миграция 266: занятость учителя — по всем его школам.
-- ============================================================================
--
-- ═══ ЧТО СЛОМАНО ═══════════════════════════════════════════════════════════
--
-- Проверки «учитель уже занят в это время» нет НИГДЕ: ни ограничения, ни
-- индекса, ни триггера на `lessons` (проверено живым запросом 06.09.2026),
-- а в коде занятость считается только внутри ГРУППЫ — раскладка спрашивает
-- уроки одной группы и смотрит, не наезжает ли новый на них.
--
-- Пока учитель работал в одной школе, это было полбеды: в базе и сейчас лежат
-- 5 пар наложений у 2 учителей, все внутри одной школы. С двумя школами беда
-- становится другой по сути — человек оказывается на двух уроках разом в
-- РАЗНЫХ зданиях, и заметить это некому: свои уроки в другой школе он не
-- видит, правило доступа сузило `lessons` до выбранной школы.
--
-- ═══ ПОЧЕМУ ФУНКЦИЯ, А НЕ ТРИГГЕР ══════════════════════════════════════════
--
-- Триггер, запрещающий наложение, звучит соблазнительно — он накрыл бы все
-- пути разом. Но он накрыл бы и ночной откат демо-школы, который пересоздаёт
-- уроки пачкой, и любую служебную заливку: одно наложение в данных — и
-- восстановление падает целиком. Ронять ночной откат ради проверки, которой
-- вчера не было вовсе, нельзя.
--
-- Поэтому здесь ЧИТАЮЩАЯ функция. Запрет ставит код — в одном месте, через
-- которое проходят все три пути создания урока (одиночный, массовый и из
-- учебного плана), — а предпросмотр той же функцией красит занятые слоты.
--
-- ═══ ПОЧЕМУ ФУНКЦИЯ НЕ ПРИНИМАЕТ УЧИТЕЛЯ ДОВОДОМ ═══════════════════════════
--
-- Она отвечает только про ТОГО, КТО СПРАШИВАЕТ (`current_teacher_id()`).
-- Возьми она чужой идентификатор — и любой вошедший смог бы выяснить, занят ли
-- посторонний учитель в среду в десять. Это чужое расписание, и отдавать его
-- через SECURITY DEFINER нельзя.
--
-- Служебному ключу функция отвечает пусто: `current_teacher_id()` под ним
-- пуст, а «не знаю» безопаснее трактовать как «не занят» — иначе фоновые
-- заливки начали бы упираться в проверку, для которой у них нет человека.
--
-- ═══ ЧТО СЧИТАЕТСЯ «ЕГО УРОКОМ» ════════════════════════════════════════════
--
-- Урок предмета, чей учитель — он (`subjects.teacher_id`). Это и есть модель
-- «один предмет — один учитель» из миграции 109. Привязка `group_teachers`
-- сюда НЕ идёт намеренно: она говорит «допущен к группе», а не «ведёт этот
-- урок», и по ней занятым оказался бы и тот, кто в это время свободен.
--
-- Статусы не различаются: у урока их три — scheduled, in_progress, completed,
-- и «отменён» среди них нет. Любой существующий урок занимает время.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_my_teacher_busy_between(
  p_from timestamptz,
  p_to   timestamptz
)
RETURNS TABLE(starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT l.starts_at,
         COALESCE(l.ends_at, l.starts_at + make_interval(mins => COALESCE(l.duration_minutes, 45)))
    FROM public.lessons l
    JOIN public.subjects s ON s.id = l.subject_id
   WHERE public.current_teacher_id() IS NOT NULL
     AND s.teacher_id = public.current_teacher_id()
     -- Пересечение полуинтервалов: начался раньше конца окна И кончился позже
     -- его начала. Урок, впритык примыкающий к окну, занятым не считается.
     AND l.starts_at < p_to
     AND COALESCE(l.ends_at, l.starts_at + make_interval(mins => COALESCE(l.duration_minutes, 45))) > p_from
   ORDER BY l.starts_at
$function$;

REVOKE ALL ON FUNCTION public.fn_my_teacher_busy_between(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_my_teacher_busy_between(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_my_teacher_busy_between(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_my_teacher_busy_between(timestamptz, timestamptz) TO service_role;

COMMENT ON FUNCTION public.fn_my_teacher_busy_between(timestamptz, timestamptz) IS
  'Занятые промежутки СПРАШИВАЮЩЕГО учителя за окно времени — по всем его школам, мимо правила доступа к урокам. Отвечает только про current_teacher_id(): чужое расписание через неё не достать. Служебному ключу отвечает пусто. Зовут её запрет создания урока внахлёст и предпросмотр занятых слотов.';

-- ── Самопроверка ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_прав integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'fn_my_teacher_busy_between' AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION '266: функция занятости не завелась';
  END IF;

  -- Тело обязано спрашивать про СЕБЯ. Без этого условия функция стала бы
  -- способом читать чужое расписание.
  IF (SELECT prosrc FROM pg_proc
       WHERE proname = 'fn_my_teacher_busy_between' AND pronamespace = 'public'::regnamespace)
     NOT LIKE '%current_teacher_id%' THEN
    RAISE EXCEPTION '266: функция не привязана к спрашивающему';
  END IF;

  -- anon и PUBLIC не должны её звать вовсе.
  SELECT count(*) INTO v_прав
    FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.proname = 'fn_my_teacher_busy_between'
     AND p.pronamespace = 'public'::regnamespace
     AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) = 'anon');
  IF v_прав <> 0 THEN
    RAISE EXCEPTION '266: у anon или PUBLIC % прав на функцию занятости', v_прав;
  END IF;

  RAISE NOTICE '266: занятость учителя считается по всем его школам';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- 252. ХОД УРОКА ВЕДЁТ УЧИТЕЛЬ. УЧЕНИК — ТОЛЬКО В ВИТРИНЕ.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ЧТО СЛУЧИЛОСЬ. Заказчик вошёл обычным учеником настоящей школы и увидел на
-- экране урока панель «Управление этапами» с кнопкой «Активировать» у каждого
-- этапа. Панель с экрана убрана (коммит 6dca81fd), но это была кнопка С ПРАВОМ:
-- запрос в обход экрана проходил по-настоящему и переключал этап всему классу
-- поверх учителя.
--
-- ОТКУДА ЭТИ ПРАВА. Они заведены под ВИТРИНУ: посетитель играет за ученика,
-- живого учителя рядом нет, и вести урок некому — значит ведёт он сам. Но
-- оговорки «только в демо-школе» ни в одной из них не оказалось.
--
-- ОГОВОРКА ПО ШКОЛЕ, А НЕ ПО АВТОСТАРТУ. Две из четырёх политик опирались на
-- schools.autostart_enabled: где автостарт выключен, там ученик хозяин. Сегодня
-- автостарт включён у всех трёх настоящих школ, поэтому дыра не стреляла — но
-- выключить его может кто угодно и когда угодно, и право вернулось бы молча.
-- Признак витрины — schools.is_demo, он и стоит теперь во всех четырёх.
--
-- ЧТО НЕ ТРОГАЕМ. Учительские политики не изменены ни одной буквой: все четыре
-- ниже — PERMISSIVE и только ученические, они ИЛИются с учительскими на той же
-- команде. Автостарт и автозавершение как механизмы не тронуты — уходит лишь
-- ссылка на них из ученических правил.
--
-- ЧТО ОСТАВЛЕНО СОЗНАТЕЛЬНО. `lesson_stages."student navigates active lesson
-- slide"` (миграция 150) — это не «ход урока», а живая работа настоящего урока:
-- ученик и учитель ведут показ вдвоём, щелчок любого двигает слайд всем.
-- Закрыть её значило бы сломать настоящий урок. Она в этой миграции не
-- участвует.
--
-- ДАННЫЕ НЕ ТРОГАЮТСЯ: ни одной строки не пишется, только политики.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Переключить этап идущего урока ──────────────────────────────────────
-- Было: любой ученик своей группы, любая школа.
DROP POLICY IF EXISTS "student advances own in-progress lesson stage" ON public.lessons;
CREATE POLICY "student advances own in-progress lesson stage"
  ON public.lessons FOR UPDATE TO authenticated
  USING (
    (
      public.is_my_group(group_id)
      AND status = 'in_progress'
      AND school_id = public.current_school_id()
      AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.is_demo)
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.is_my_group(group_id)
      AND status = 'in_progress'
      AND school_id = public.current_school_id()
      AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.is_demo)
      -- Прежняя проверка: активным можно поставить только этап ЭТОГО урока.
      AND (
        active_stage_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.lesson_stages ls
           WHERE ls.id = lessons.active_stage_id AND ls.lesson_id = lessons.id
        )
      )
    )
    OR public.is_super_admin()
  );

-- ── 2. Запустить запланированный урок ──────────────────────────────────────
-- Было: любой ученик своей группы, любая школа.
DROP POLICY IF EXISTS "student starts own scheduled lesson" ON public.lessons;
CREATE POLICY "student starts own scheduled lesson"
  ON public.lessons FOR UPDATE TO authenticated
  USING (
    (
      public.is_my_group(group_id)
      AND status = 'scheduled'
      AND school_id = public.current_school_id()
      AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.is_demo)
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.is_my_group(group_id)
      AND status = 'in_progress'
      AND school_id = public.current_school_id()
      AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.is_demo)
    )
    OR public.is_super_admin()
  );

-- ── 3. Завершить идущий урок ───────────────────────────────────────────────
-- Было: там, где ВЫКЛЮЧЕН автостарт (плюс в демо — только первые два дня).
-- Стало: только в демо-школе, и те же первые два дня. Для настоящих школ это
-- не изменение поведения: автостарт включён у всех трёх, право и так не
-- срабатывало. Изменение в том, что теперь оно не вернётся от переключателя
-- автостарта.
DROP POLICY IF EXISTS "student ends own in-progress lesson" ON public.lessons;
CREATE POLICY "student ends own in-progress lesson"
  ON public.lessons FOR UPDATE TO authenticated
  USING (
    (
      public.is_my_group(group_id)
      AND status = 'in_progress'
      AND school_id = public.current_school_id()
      AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.is_demo)
      AND public.fn_lesson_day_index(id) <= 2
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      public.is_my_group(group_id)
      AND status = 'completed'
      AND school_id = public.current_school_id()
      AND EXISTS (SELECT 1 FROM public.schools s WHERE s.id = lessons.school_id AND s.is_demo)
      AND public.fn_lesson_day_index(id) <= 2
    )
    OR public.is_super_admin()
  );

-- ── 4. Пометить итоговый этап выполненным ──────────────────────────────────
-- Близнец третьей: заведена в 117 ровно для того, чтобы ученический
-- endLesson() мог закрыть summary-этап вторым запросом. Оставить её открытой,
-- закрыв третью, значило бы оставить половину права без применения.
-- Было: любой ученик своей группы, любая школа, любой урок — даже не идущий.
DROP POLICY IF EXISTS "student completes own group lesson summary stage" ON public.lesson_stages;
CREATE POLICY "student completes own group lesson summary stage"
  ON public.lesson_stages FOR UPDATE TO authenticated
  USING (
    (
      stage_role = 'summary'
      AND school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1 FROM public.lessons l
          JOIN public.schools s ON s.id = l.school_id
         WHERE l.id = lesson_stages.lesson_id
           AND public.is_my_group(l.group_id)
           AND s.is_demo
      )
    )
    OR public.is_super_admin()
  )
  WITH CHECK (
    (
      stage_role = 'summary'
      AND school_id = public.current_school_id()
      AND EXISTS (
        SELECT 1 FROM public.lessons l
          JOIN public.schools s ON s.id = l.school_id
         WHERE l.id = lesson_stages.lesson_id
           AND public.is_my_group(l.group_id)
           AND s.is_demo
      )
    )
    OR public.is_super_admin()
  );

-- ── Самопроверка: все четыре на месте и все четыре знают про демо ──────────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM pg_policies
   WHERE (tablename = 'lessons' AND policyname IN (
            'student advances own in-progress lesson stage',
            'student starts own scheduled lesson',
            'student ends own in-progress lesson'))
      OR (tablename = 'lesson_stages' AND policyname =
            'student completes own group lesson summary stage');
  IF n <> 4 THEN
    RAISE EXCEPTION '252: ожидалось 4 ученические политики, найдено %', n;
  END IF;

  SELECT count(*) INTO n
    FROM pg_policies
   WHERE ((tablename = 'lessons' AND policyname IN (
             'student advances own in-progress lesson stage',
             'student starts own scheduled lesson',
             'student ends own in-progress lesson'))
       OR (tablename = 'lesson_stages' AND policyname =
             'student completes own group lesson summary stage'))
     AND (coalesce(qual, '') || coalesce(with_check, '')) LIKE '%is_demo%';
  IF n <> 4 THEN
    RAISE EXCEPTION '252: оговорка про демо есть только у % политик из 4', n;
  END IF;
END $$;

COMMIT;

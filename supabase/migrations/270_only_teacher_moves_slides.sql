-- ============================================================================
-- Миграция 270: слайды переключает только учитель.
-- ============================================================================
--
-- ═══ ЧТО ОТМЕНЯЕТСЯ ════════════════════════════════════════════════════════
--
-- Правило `student navigates active lesson slide` из МИГРАЦИИ 150
-- («ведут вдвоём: щелчок любого двигает всем»). Оно разрешало ученику писать
-- `lesson_stages.current_slide_index` в идущем уроке своей группы.
--
-- Решение заказчика 06.09.2026: ведёт учитель. Ученик слайд ВИДИТ и следует
-- за учителем по подписке, но двинуть его не может.
--
-- ═══ ЧТО ОСТАЁТСЯ ══════════════════════════════════════════════════════════
--
-- СИНХРОННОСТЬ. Она держится на чтении и на подписке, а не на праве записи:
-- ученик читал `lesson_stages` и раньше и продолжит читать. Меняется ровно
-- одно — кто может ЗАПИСАТЬ новый номер слайда.
--
-- ЗАВЕРШЕНИЕ ЭТАПА «ИТОГ». Правило `student completes own group lesson
-- summary stage` не трогается: это другое действие и другая колонка.
--
-- УЧИТЕЛЬ. `teacher updates own subject lesson stages` остаётся как было.
--
-- ═══ ПОЧЕМУ ПРОСТО СНЕСТИ, А НЕ СУЗИТЬ ═════════════════════════════════════
--
-- Сузить нечем: правило и так разрешало ровно один случай — свой класс,
-- идущий урок, активный этап. Убрать из него ученика значит убрать правило
-- целиком; переписывать его в «разрешаю ничего» было бы притворством.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS "student navigates active lesson slide" ON public.lesson_stages;

-- ── Самопроверка ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_учитель integer;
  v_итог    integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'lesson_stages'
       AND policyname = 'student navigates active lesson slide'
  ) THEN
    RAISE EXCEPTION '270: правило ученика на слайды осталось';
  END IF;

  -- Учительское правило и завершение «Итога» обязаны уцелеть: снести лишнее
  -- здесь значило бы сломать сам урок.
  SELECT count(*) INTO v_учитель FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'lesson_stages'
     AND policyname = 'teacher updates own subject lesson stages';
  IF v_учитель <> 1 THEN
    RAISE EXCEPTION '270: пропало правило записи учителя';
  END IF;

  SELECT count(*) INTO v_итог FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'lesson_stages'
     AND policyname = 'student completes own group lesson summary stage';
  IF v_итог <> 1 THEN
    RAISE EXCEPTION '270: пропало правило завершения этапа «Итог» учеником';
  END IF;

  RAISE NOTICE '270: слайды переключает только учитель';
END $$;

COMMIT;

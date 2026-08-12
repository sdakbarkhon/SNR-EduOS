-- =====================================================================
-- Migration 192 — h5p_content.school_id получает значение по умолчанию.
--
-- ЗАЧЕМ. Миграция 190 привязала вставку в h5p_content к школе автора:
--   WITH CHECK (… school_id = current_school_id() …)
-- А редактор H5P (apps/h5p/app/editor/EditorForm.tsx:138) вставляет строку
-- БЕЗ school_id — колонка nullable и без умолчания, поэтому туда ложился
-- NULL. До 190 это проходило (и строка потом была не видна никому: политика
-- чтения сравнивает school_id с current_school_id()), после 190 такая
-- вставка получит отказ.
--
-- Чинить это в приложении — значит требовать от каждого писателя знать свою
-- школу; в проекте принят обратный приём: DEFAULT current_school_id() на
-- колонке (так сделано у daily_facts, teacher_library_materials и других,
-- миграции 71/72/147). Ставим его же.
--
-- Существующие строки не трогаются: DEFAULT действует только на новые
-- вставки. Строк с пустой школой в таблице нет (проверено перед 190).
-- =====================================================================

ALTER TABLE public.h5p_content
  ALTER COLUMN school_id SET DEFAULT public.current_school_id();

DO $$
DECLARE
  v_default text;
BEGIN
  SELECT column_default INTO v_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'h5p_content' AND column_name = 'school_id';

  IF v_default IS NULL OR v_default NOT LIKE '%current_school_id%' THEN
    RAISE EXCEPTION '192: у h5p_content.school_id не появилось умолчание current_school_id()';
  END IF;
END $$;

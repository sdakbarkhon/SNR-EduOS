BEGIN;

-- Iter5 P14, Задача 3.Б: UI-only rename Scratch → TurboWarp (see i18n/lib changes
-- in the same commit). This migration only renames the ONE demo lesson title
-- created by migration 67 — content_type stays 'scratch' in the DB (enum
-- unchanged), and the "Анимация кота" stage itself is left untouched.

UPDATE public.lessons
SET title = 'Танцующий кот в TurboWarp'
WHERE title = 'Танцующий кот в Scratch'
  AND group_id = (
    SELECT id FROM public.groups WHERE name = 'Демо-класс'
  );

-- Idempotency check + log (safe to re-run: WHERE above won't match after the
-- first successful rename, so updated_count will just report 0 on reruns).
DO $$
DECLARE
  updated_count int;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.lessons
  WHERE title = 'Танцующий кот в TurboWarp'
    AND group_id = (
      SELECT id FROM public.groups WHERE name = 'Демо-класс'
    );

  IF updated_count = 0 THEN
    RAISE NOTICE 'Warning: lesson "Танцующий кот в TurboWarp" not found after rename. Migration 67 may not have been applied, or the source lesson was already renamed/removed.';
  ELSE
    RAISE NOTICE 'Renamed % lesson(s) to "Танцующий кот в TurboWarp"', updated_count;
  END IF;
END $$;

COMMIT;

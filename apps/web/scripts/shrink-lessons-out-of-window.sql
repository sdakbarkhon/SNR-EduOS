-- Урезка длительности уроков вне окна 19-25 июля до 45 минут
-- Применить вручную через Supabase Dashboard SQL Editor
-- Идемпотентно: повторный запуск ничего не изменит
--
-- Примечание Claude: в исходном промте UPDATE включал `updated_at = now()`,
-- но у lessons такой колонки нет (подтверждено live-запросом к hosted БД —
-- PostgREST: "column lessons.updated_at does not exist") — убрано, иначе
-- весь UPDATE упал бы с ошибкой в Dashboard SQL Editor.

BEGIN;

-- Предпросмотр: сколько строк будет затронуто
SELECT count(*) AS to_update
FROM lessons
WHERE starts_at::date IN (
  '2026-07-17', '2026-07-18',
  '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31'
)
  AND (ends_at - starts_at) > interval '45 minutes';

-- Собственно UPDATE
UPDATE lessons
SET ends_at = starts_at + interval '45 minutes'
WHERE starts_at::date IN (
  '2026-07-17', '2026-07-18',
  '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31'
)
  AND (ends_at - starts_at) > interval '45 minutes';

-- Проверка после UPDATE
SELECT starts_at::date AS lesson_date,
       count(*) AS total,
       count(*) FILTER (WHERE (ends_at - starts_at) = interval '45 minutes') AS at_45min,
       count(*) FILTER (WHERE (ends_at - starts_at) > interval '45 minutes') AS still_long
FROM lessons
WHERE starts_at::date IN (
  '2026-07-17', '2026-07-18',
  '2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31'
)
GROUP BY starts_at::date
ORDER BY starts_at::date;

COMMIT;

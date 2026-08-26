-- Пачка 5.1 — сброс lesson_stages_embedding_queue после провала backfill'а
-- на text-embedding-004 (модель не существует на v1beta, живой 404 —
-- см. apps/web/lib/ai/embeddings.ts, теперь на gemini-embedding-001 с
-- outputDimensionality:768). Все 298 записей застряли на attempts=3
-- (MAX_ATTEMPTS в /api/cron/rag-process-queue и
-- /api/admin/rag/process-batch) — при attempts>=3 они больше не попадают
-- в выборку обработки ни в cron, ни в admin batch (оба фильтруют
-- attempts < 3), т.е. навсегда заблокированы без сброса.
--
-- Утилита, НЕ миграция — применить вручную через Supabase Dashboard SQL
-- Editor. Безопасно повторяемо (просто обнуляет счётчик, не создаёт и не
-- удаляет строки).

-- 26.08.2026 — ШКОЛУ УКАЗАТЬ ЯВНО.
-- Раньше UPDATE шёл по всей очереди сразу, то есть по обеим школам. Гейта в
-- .sql-файле не сделать — его применяют руками в Dashboard, поэтому защита
-- здесь одна: подставить идентификатор школы вместо ВПИШИТЕ_ШКОЛУ. Как есть
-- запрос не выполнится — Postgres не примет незакрытую кавычку, и это
-- сознательно.
--   демо:   a0a0a0a0-0000-0000-0000-000000000001
--   боевая: b0b0b0b0-0000-0000-0000-000000000001
UPDATE public.lesson_stages_embedding_queue
SET attempts = 0, last_error = NULL
WHERE attempts >= 3
  AND school_id = ВПИШИТЕ_ШКОЛУ;

-- Проверить после применения:
--   SELECT count(*) FROM lesson_stages_embedding_queue WHERE attempts >= 3;
--   -- ожидание: 0
--   SELECT count(*) FROM lesson_stages_embedding_queue;
--   -- ожидание: ~298 (все снова доступны для /api/admin/rag/process-batch)

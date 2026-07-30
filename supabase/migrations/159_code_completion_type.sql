-- =====================================================================
-- Migration 159 — новый тип контента "code_completion" (Drag & Drop
-- заполнение пропусков в коде): Большой фикс, Блок 6.5.
--
-- ИСПРАВЛЕНИЯ К ПРОМТУ (после разведки):
--
--   1) НОМЕР — промт просил "158", но 158 уже занят
--      (158_teacher_announcements_feed_rls.sql, применён этим же заходом
--      сессии ранее). Следующий свободный — 159.
--
--   2) НЕТ колонки "payload" на lesson_stages — черновик промта выдумал
--      её. Реальная схема (supabase/migrations/20260620000035_lesson_stages_v2.sql)
--      уже имеет "config jsonb NOT NULL DEFAULT '{}'" — задокументированную
--      как раз под "JSON-конфигурация под тип" (комментарий в исходной
--      миграции). Используем её, а не добавляем новую колонку — то же
--      место, что уже использует часть внешних сервисов (config->>'url').
--
--   3) У homework, в отличие от lesson_stages, НЕТ generic jsonb-колонки
--      (attachments jsonb — список файлов учителя, не type-specific
--      payload; сама миграция 95 явно комментирует "homework has no jsonb
--      config column, so a dedicated column is simpler here" про
--      external_url). Добавлена новая выделенная колонка
--      code_completion_data jsonb — то же решение, тем же обоснованием.
--
--   4) homework_submissions.ai_feedback jsonb — НЕ переиспользован для
--      ответов ученика: это специализированная колонка ИИ-проверки
--      (миграция 140, в связке с ai_grade/ai_review_status/ai_reviewed_at/
--      teacher_approved_*), переиспользование создало бы коллизию смысла.
--      Новая выделенная колонка code_completion_answers jsonb.
--
--   5) CHECK-ограничения — расширены СПИСКОМ ИЗ ЖИВОГО текста последней
--      миграции, тронувшей каждое (lesson_stages: 141_add_typerun_content_type.sql,
--      17 значений; homework: 95_expand_homework_types_and_piston_languages.sql,
--      16 значений), а не наугад — иначе DROP+ADD стёр бы уже
--      существующие разрешённые значения (typerun/h5p и т.д.).
--
-- !!! ЭТА МИГРАЦИЯ НЕ ПРИМЕНЕНА К ПРОД-БАЗЕ ЭТИМ ЗАХОДОМ — то же
-- ограничение среды, что у 153-158: нет прямого Postgres-подключения/
-- привязанного Supabase CLI, только PostgREST через SUPABASE_SERVICE_ROLE_KEY
-- (не DDL). Ручной шаг заказчика: применить через Supabase Dashboard →
-- SQL Editor. Скрипты генерации (create-code-completion.mjs,
-- create-code-completion-homework.mjs) НЕ запускались этим заходом —
-- INSERT с content_type='code_completion' упадёт на CHECK-ограничении,
-- пока миграция не применена; они готовы к запуску заказчиком/в
-- следующем заходе после применения.
-- =====================================================================

BEGIN;

-- lesson_stages.content_type — 17 живых значений (миграция 141) + code_completion.
ALTER TABLE public.lesson_stages DROP CONSTRAINT lesson_stages_content_type_check;
ALTER TABLE public.lesson_stages ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation'::text, 'code'::text, 'wokwi'::text, 'codesandbox'::text,
    'quiz_qia'::text, 'quiz_kahoot'::text,
    'geogebra'::text, 'phet'::text, 'desmos'::text, 'blockly_games'::text, 'visualgo'::text,
    'p5js'::text, 'excalidraw'::text, 'learningapps'::text, 'sqlonline'::text,
    'h5p'::text, 'typerun'::text, 'code_completion'::text
  ]));

-- homework.content_type — 16 живых значений (миграция 95) + code_completion.
ALTER TABLE public.homework DROP CONSTRAINT homework_content_type_check;
ALTER TABLE public.homework ADD CONSTRAINT homework_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'file'::text, 'test'::text, 'programming'::text, 'bundle'::text,
    'wokwi'::text, 'codesandbox'::text, 'geogebra'::text, 'phet'::text, 'desmos'::text,
    'blockly_games'::text, 'visualgo'::text, 'p5js'::text, 'excalidraw'::text,
    'learningapps'::text, 'sqlonline'::text, 'h5p'::text, 'code_completion'::text
  ]));

-- homework: выделенная колонка под {code_template, gaps[], language,
-- task_description} — у homework нет generic jsonb-слота, в отличие от
-- lesson_stages.config.
ALTER TABLE public.homework ADD COLUMN IF NOT EXISTS code_completion_data jsonb;

-- homework_submissions: ответы ученика (gapId -> выбранный вариант) + счёт.
-- Отдельно от ai_feedback (та колонка — под другую фичу, ИИ-проверку).
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS code_completion_answers jsonb;

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('159')
ON CONFLICT DO NOTHING;

COMMIT;

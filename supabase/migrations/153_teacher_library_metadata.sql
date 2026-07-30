-- =====================================================================
-- Migration 153 — метаданные для "Материалы кафедры" (teacher_library_materials):
-- author, description, material_type, kb_bucket-ссылка на существующий
-- файл вместо повторной загрузки.
--
-- КОНТЕКСТ (Регенерация 29.07, Этап 12): "Материалы кафедры" уже
-- полностью существуют как teacher_library_materials (миграция 147/148)
-- — таблица, RLS, CRUD-функции (packages/core/src/queries/library.ts),
-- UI (вкладка "Библиотека учителей" в KnowledgeBaseFilePicker.tsx +
-- новая отдельная вкладка TeacherLibraryTabView.tsx, Этап 12). Эта
-- миграция ТОЛЬКО добавляет 4 новые nullable-колонки для более богатых
-- карточек материала (автор/описание/тип вроде "сборник"/"конспект", и
-- возможность сослаться на уже существующий файл в бакете "books" вместо
-- копирования байт) — ничего не меняет в уже работающих RLS/запросах,
-- существующие строки не трогает (все новые колонки nullable/с DEFAULT).
--
-- !!! ВАЖНО — ЭТА МИГРАЦИЯ НЕ ПРИМЕНЕНА К ПРОД-БАЗЕ ЭТИМ ЗАХОДОМ !!!
-- В этой рабочей среде нет прямого подключения к Postgres и не настроен
-- Supabase CLI, привязанный к прод-проекту (нет DATABASE_URL/POSTGRES_URL
-- в .env.local, нет .supabase/config с project_id, нет пакета pg —
-- только SUPABASE_SERVICE_ROLE_KEY, который даёт доступ к PostgREST/
-- Storage API, но не выполняет произвольный DDL). Применение этой
-- миграции — ручной шаг заказчика: `supabase db push` (после `supabase
-- link --project-ref <ref>`) либо вставить текст ниже в SQL Editor
-- Supabase Dashboard. Весь код Этапа 12 (UI + бэкфилл-скрипт) НАМЕРЕННО
-- написан так, чтобы работать БЕЗ этой миграции — ни один из этих
-- столбцов нигде не читается/не пишется в текущем коде приложения.
-- После применения миграции UI можно расширить полями author/description/
-- material_type — это отдельный, не срочный шаг.
-- =====================================================================

BEGIN;

ALTER TABLE public.teacher_library_materials
  ADD COLUMN IF NOT EXISTS author        text,
  ADD COLUMN IF NOT EXISTS description   text,
  ADD COLUMN IF NOT EXISTS material_type text
    CHECK (material_type IS NULL OR material_type IN ('сборник', 'конспект', 'план', 'учебник', 'методичка', 'презентация')),
  -- Ссылка на уже существующий файл в другом бакете (тот же приём, что
  -- lesson_materials.kb_bucket, миграция 115_lesson_materials_kb_link.sql)
  -- — storage_path в этом случае указывает в бакет kb_bucket, а не
  -- "materials". NULL = обычный файл, как раньше (в бакете "materials").
  ADD COLUMN IF NOT EXISTS kb_bucket     text
    CHECK (kb_bucket IS NULL OR kb_bucket IN ('materials', 'books'));

COMMENT ON COLUMN public.teacher_library_materials.material_type IS
  'Тип материала для карточки (Этап 12 регенерации 29.07) — опциональная категоризация, не влияет на RLS/доступ.';
COMMENT ON COLUMN public.teacher_library_materials.kb_bucket IS
  'Если задан — storage_path указывает в этот бакет вместо "materials" (copy-by-reference на уже существующий файл, напр. книгу из БЗ, без дублирования байт). NULL — обычный случай, файл лежит в "materials".';

-- ── Данные — material_type для 10 демо-материалов кафедры ───────────────
-- Финал Этапа 12, Фикс 1: без этого шага колонка была бы добавлена, но
-- пустой у всех существующих строк (бейдж в UI просто не показывался бы).
-- Материалы созданы apps/web/scripts/backfill-department-materials.mjs
-- (зеркало книг библиотеки) — 10 конкретных title, известных заранее,
-- матчатся по title+school_id (тот же приём, что идемпотентность в самом
-- скрипте). Если этот скрипт ещё не был запущен на момент применения
-- миграции — просто 0 строк обновится, не ошибка.
UPDATE public.teacher_library_materials SET material_type = 'учебник'   WHERE title = 'Электроника для детей'          AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'учебник'   WHERE title = 'Hello Ruby'                      AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'сборник'   WHERE title = 'Занимательная анатомия роботов'  AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'сборник'   WHERE title = 'Магия математики'                AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'конспект'  WHERE title = 'Весёлая математика'              AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'методичка' WHERE title = 'Python для детей'                AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'конспект'  WHERE title = 'JavaScript для детей'            AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'методичка' WHERE title = 'Arduino для начинающих'          AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'план'      WHERE title = 'Занимательная грамматика'        AND material_type IS NULL;
UPDATE public.teacher_library_materials SET material_type = 'план'      WHERE title = 'English for Kids'                AND material_type IS NULL;

-- ── Регистрация ──────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('153')
ON CONFLICT (version) DO NOTHING;

COMMIT;

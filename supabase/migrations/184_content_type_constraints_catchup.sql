-- =====================================================================
-- Migration 184 — три CHECK-ограничения догоняют канонический список типов.
--
-- ЕДИНЫЙ ИСТОЧНИК В КОДЕ — EXTERNAL_SERVICE_ORDER (apps/web/lib/
-- external-services.ts), 14 внешних сервисов:
--   wokwi, codesandbox, geogebra, phet, desmos, blockly_games, visualgo,
--   p5js, excalidraw, learningapps, sqlonline, typerun, scratch, google_docs
-- Именно этот массив перебирают форма этапа урока, форма домашнего задания
-- (CreateHomeworkForm.tsx:368) и набор типов подзадач
-- (HomeworkAiGenerateModal.tsx:35, generate-homework/route.ts:20). То есть
-- всё, что в нём есть, учитель может выбрать мышью уже сегодня.
--
-- ЖИВОЕ СОСТОЯНИЕ ОГРАНИЧЕНИЙ, снято pg_get_constraintdef 10.08.2026 (не из
-- handoff и не из прошлых отчётов — перепроверено запросом):
--
--   lesson_stages_content_type_check     20 значений — ПОЛНОЕ, не трогаем
--   homework_content_type_check          19 — нет 'typerun'
--   homework_subtasks_type_check         15 — нет 'typerun', 'scratch', 'google_docs'
--   sandbox_projects_service_id_check    14 — нет 'scratch', 'typerun', 'google_docs'
--
-- ПОЧЕМУ ЭТО НЕ ТЕОРИЯ, А ТРИ ЖИВЫХ ОТКАЗА:
--
-- 1. sandbox_projects / 'scratch'. Сохранение работ Scratch пишет ровно
--    service_id='scratch' (projects/scratch/actions.ts:23,97). База откажет,
--    а server action вернёт немое {ok:false} — ученик увидит, что «ничего не
--    произошло», без единого слова объяснения.
-- 2. homework / 'typerun'. typerun входит в UNIVERSAL_SERVICES, то есть
--    getServicesForSubject отдаёт его для ЛЮБОГО предмета. Учитель выбирает
--    его в форме ДЗ — и получает отказ базы.
-- 3. homework_subtasks / три типа. Набор типов подзадач собирается как
--    ["file","test","code", ...EXTERNAL_SERVICE_ORDER] — 17 штук, и все 17
--    показаны галочками в модалке генерации. Таблица сейчас пуста (0 строк),
--    поэтому расхождение молчит: первый же составной ДЗ с этими типами
--    упёрся бы в базу.
--
-- ЧЕТВЁРТОЕ РАСХОЖДЕНИЕ, найденное сверкой (в постановке его не было):
-- у sandbox_projects не хватает не только 'scratch', но и 'typerun' с
-- 'google_docs'. Ограничение перечисляет РОСТЕР инструментов песочницы —
-- в нём уже лежат 11 сервисов, которые код сегодня не пишет ни одной
-- строкой. Значит его смысл «какие инструменты существуют», а не «какие
-- реально сохраняются», и по этому смыслу он отстал ровно на три
-- новейших инструмента. Добавляем все три сразу, чтобы не чинить тот же
-- ящик третий раз. Оговорка честная: сегодня в sandbox_projects пишутся
-- только 'python', 'cpp' (SandboxView, режимы CodeSandbox) и 'scratch'.
--
-- ЧТО ПРОВЕРЕНО НА ДАННЫХ ПЕРЕД ПРАВКОЙ (точными счётчиками):
--   sandbox_projects   1 строка   — 'python'
--   homework          59 строк    — programming 18, code_completion 13, file 13, test 12, wokwi 3
--   homework_subtasks  0 строк
--   lesson_stages    767 строк    — presentation 427, quiz_qia 126, NULL 126, wokwi 42,
--                                   code 34, code_completion 6, visualgo 3, quiz_kahoot 2, scratch 1
-- Все значения входят и в старые, и в новые списки. Мы только РАСШИРЯЕМ
-- перечисление, поэтому строк, которые перестанут проходить проверку, нет
-- по построению.
--
-- ЧЕГО ЗДЕСЬ НЕТ НАМЕРЕННО:
--   * lesson_stages_content_type_check не трогается — он уже полон;
--   * никакого кода Scratch: экраны и выкладка редактора — отдельные задачи;
--   * 'google_sheets' и 'google_slides' НЕ добавляются никуда. Проверено:
--     это идентификаторы КАРТОЧЕК песочницы (sandbox-tools.ts, SandboxView),
--     а не типы контента — в колонки базы они не попадают вовсе. Тип на все
--     три вида файла один, 'google_docs' (миграция 181);
--   * строка реестра не вписывается — apply-migration.mjs добавляет её сам и
--     без ON CONFLICT (собственный INSERT дал бы откат всей миграции).
-- =====================================================================

BEGIN;

-- ── 1. homework.content_type: +typerun ───────────────────────────────
-- 5 базовых + h5p + 14 внешних = 20 значений.
ALTER TABLE public.homework
  DROP CONSTRAINT IF EXISTS homework_content_type_check;
ALTER TABLE public.homework
  ADD CONSTRAINT homework_content_type_check CHECK (
    content_type = ANY (ARRAY[
      'file', 'test', 'programming', 'bundle', 'code_completion',
      'h5p',
      'wokwi', 'codesandbox', 'geogebra', 'phet', 'desmos', 'blockly_games',
      'visualgo', 'p5js', 'excalidraw', 'learningapps', 'sqlonline',
      'typerun', 'scratch', 'google_docs'
    ]::text[])
  );

-- ── 2. homework_subtasks.type: +typerun, +scratch, +google_docs ──────
-- 3 базовых + h5p + 14 внешних = 18 значений.
ALTER TABLE public.homework_subtasks
  DROP CONSTRAINT IF EXISTS homework_subtasks_type_check;
ALTER TABLE public.homework_subtasks
  ADD CONSTRAINT homework_subtasks_type_check CHECK (
    type = ANY (ARRAY[
      'file', 'test', 'code',
      'h5p',
      'wokwi', 'codesandbox', 'geogebra', 'phet', 'desmos', 'blockly_games',
      'visualgo', 'p5js', 'excalidraw', 'learningapps', 'sqlonline',
      'typerun', 'scratch', 'google_docs'
    ]::text[])
  );

-- ── 3. sandbox_projects.service_id: +scratch, +typerun, +google_docs ─
-- 2 базовых (режимы CodeSandbox) + h5p + 14 внешних = 17 значений.
ALTER TABLE public.sandbox_projects
  DROP CONSTRAINT IF EXISTS sandbox_projects_service_id_check;
ALTER TABLE public.sandbox_projects
  ADD CONSTRAINT sandbox_projects_service_id_check CHECK (
    service_id = ANY (ARRAY[
      'python', 'cpp',
      'h5p',
      'wokwi', 'codesandbox', 'geogebra', 'phet', 'desmos', 'blockly_games',
      'visualgo', 'p5js', 'excalidraw', 'learningapps', 'sqlonline',
      'typerun', 'scratch', 'google_docs'
    ]::text[])
  );

COMMENT ON CONSTRAINT sandbox_projects_service_id_check ON public.sandbox_projects IS
  'Ростер инструментов песочницы. Держать в синхроне с EXTERNAL_SERVICE_ORDER '
  '(apps/web/lib/external-services.ts) плюс python/cpp (режимы CodeSandbox) и h5p. '
  'Миграция 184.';

COMMIT;

-- ── ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ — только чтение ────────────────────────
--   1) все 14 канонических типов присутствуют в каждом из трёх ограничений;
--   2) число значений: homework 20, homework_subtasks 18, sandbox_projects 17;
--   3) существующие строки проходят: ограничения добавлены без NOT VALID,
--      то есть Postgres проверил их при ADD CONSTRAINT — если бы строка не
--      прошла, миграция упала бы и откатилась целиком.

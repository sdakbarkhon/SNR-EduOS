-- Пачка 4, Путь А — полная очистка уроков 18-31 июля 2026 перед пересборкой
-- расписания в новой структуре (5/6/7 уроков×45мин, см.
-- apps/web/scripts/create-lesson-slots-jul18-31.mjs).
-- Применить вручную через Supabase Dashboard SQL Editor. НЕ применялось
-- автоматически.
--
-- ГРАНИЦЫ ДИАПАЗОНА (проверено live-запросом к hosted БД):
--   - 2026-07-17 — 9 уроков, СТАТУС in_progress у части из них — этот файл
--     их НЕ трогает (диапазон строго starts_at::date BETWEEN '2026-07-18'
--     AND '2026-07-31', 17-е туда не попадает).
--   - 2026-08-01 и позже — 189 уроков, тоже вне диапазона, не затрагиваются.
--
-- FK-ГРАФ (восстановлен по всем supabase/migrations/*.sql — прямого доступа
-- к information_schema через PostgREST нет, миграции — источник истины):
-- ВСЕ найденные внешние ключи на lessons/lesson_stages/quiz_questions/
-- classwork — либо ON DELETE CASCADE, либо ON DELETE SET NULL. НИ ОДНОГО
-- ON DELETE RESTRICT/NO ACTION не найдено — значит один DELETE FROM lessons
-- каскадно вычищает ВСЁ дерево, явные DELETE по каждой таблице не нужны.
--
-- CASCADE-цепочка от lessons.id:
--   lesson_stages, attendance, lesson_materials, classwork,
--   lesson_excuse_requests, lesson_raised_hands, ai_chat_messages (lesson_id),
--   lesson_grades, leave_requests
-- CASCADE-цепочка от lesson_stages.id:
--   quiz_questions, quiz_attempts, kahoot_sessions, lesson_stage_progress,
--   course_materials (через stage_id — см. ниже)
-- CASCADE от quiz_questions.id: quiz_answers
-- CASCADE от classwork.id: 2 дочерние таблицы (classwork submissions)
--
-- SET NULL (НЕ удаляются, только FK обнуляется — не требует действий):
--   homework.lesson_id, grades(legacy).lesson_id, payments.lesson_id,
--   course_materials.lesson_id, ai_chat_messages.stage_id,
--   lessons.active_stage_id (сам себе, неважно — урок удаляется целиком).
--   Live-проверка: все эти счётчики для 18-31 июля = 0, КРОМЕ
--   course_materials (13 строк — см. ниже), которые всё равно удалятся
--   через CASCADE по stage_id, так что SET NULL по lesson_id для них уже
--   не имеет значения.
--
-- ВАЖНАЯ НАХОДКА: 13 записей в course_materials (Библиотека) окажутся
-- удалены каскадом — это НЕ побочный ущерб, а корректное поведение: это
-- автоопубликованные (миграция 124) копии theory-презентаций из 11 уроков
-- 19-24 июля, которые УЖЕ были сгенерированы Gemini в старой структуре и
-- теперь пересобираются с нуля в новой. Оставлять их в Библиотеке —
-- держать ссылки на контент уроков, которых по новому расписанию не будет
-- ("Условные предложения: First Conditional", "Орфоэпические нормы
-- русского языка", "Модули и пакеты в Python" и т.д. — все presentation,
-- title совпадает с topic уже сгенerированных уроков).
--
-- ai_usage_log НЕ входит в скоуп — таблица (day, requests_count,
-- updated_at), никакой связи с lessons/lesson_stages нет, не затрагивается
-- этим DELETE ни прямо, ни каскадно.

BEGIN;

-- ── Предпросмотр: счётчики ДО удаления ──────────────────────────────────
SELECT 'lessons' AS table_name, count(*) AS to_delete
FROM lessons WHERE starts_at::date BETWEEN '2026-07-18' AND '2026-07-31'
UNION ALL
SELECT 'lesson_stages', count(*) FROM lesson_stages
  WHERE lesson_id IN (SELECT id FROM lessons WHERE starts_at::date BETWEEN '2026-07-18' AND '2026-07-31')
UNION ALL
SELECT 'quiz_questions', count(*) FROM quiz_questions
  WHERE stage_id IN (SELECT id FROM lesson_stages WHERE lesson_id IN
    (SELECT id FROM lessons WHERE starts_at::date BETWEEN '2026-07-18' AND '2026-07-31'))
UNION ALL
SELECT 'course_materials (via stage_id)', count(*) FROM course_materials
  WHERE stage_id IN (SELECT id FROM lesson_stages WHERE lesson_id IN
    (SELECT id FROM lessons WHERE starts_at::date BETWEEN '2026-07-18' AND '2026-07-31'))
UNION ALL
SELECT 'attendance', count(*) FROM attendance
  WHERE lesson_id IN (SELECT id FROM lessons WHERE starts_at::date BETWEEN '2026-07-18' AND '2026-07-31')
UNION ALL
SELECT 'lesson_grades', count(*) FROM lesson_grades
  WHERE lesson_id IN (SELECT id FROM lessons WHERE starts_at::date BETWEEN '2026-07-18' AND '2026-07-31')
UNION ALL
SELECT '2026-07-17 lessons (must stay untouched)', count(*)
  FROM lessons WHERE starts_at::date = '2026-07-17'
UNION ALL
SELECT '2026-08-01+ lessons (must stay untouched)', count(*)
  FROM lessons WHERE starts_at::date >= '2026-08-01';

-- ── Собственно удаление — один DELETE, остальное каскадно ───────────────
DELETE FROM lessons
WHERE starts_at::date BETWEEN '2026-07-18' AND '2026-07-31';

-- ── Проверка ПОСЛЕ удаления (должны быть 0, кроме двух последних) ───────
SELECT 'lessons' AS table_name, count(*) AS remaining
FROM lessons WHERE starts_at::date BETWEEN '2026-07-18' AND '2026-07-31'
UNION ALL
SELECT 'lesson_stages (orphans — must be 0)', count(*) FROM lesson_stages ls
  WHERE NOT EXISTS (SELECT 1 FROM lessons l WHERE l.id = ls.lesson_id)
UNION ALL
SELECT '2026-07-17 lessons (must be unchanged — see предпросмотр выше)', count(*)
  FROM lessons WHERE starts_at::date = '2026-07-17'
UNION ALL
SELECT '2026-08-01+ lessons (must be unchanged — see предпросмотр выше)', count(*)
  FROM lessons WHERE starts_at::date >= '2026-08-01';

COMMIT;

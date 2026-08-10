-- 181, 10.08.2026 — тип содержимого 'google_docs'.
--
-- Google Документы, Таблицы и Презентации внутри платформы: ученик работает
-- с файлом, не уходя на сторонний сайт.
--
-- ВСТРАИВАНИЕ РАБОТАЕТ БЕЗ ПОДПИСОК И РЕГИСТРАЦИИ ШКОЛЫ. Официальный способ —
-- параметр rm=embedded: он убирает шапку Google и оставляет чистый редактор.
-- Проверено живьём на всех трёх видах файла: ни X-Frame-Options, ни
-- Content-Security-Policy: frame-ancestors Google не присылает, то есть показ
-- в рамке разрешён. Вход в аккаунт Google не требуется — при доступе «все по
-- ссылке: редактор» правка идёт анонимно (в сетевых запросах документ
-- синхронизируется под пользователем ANONYMOUS_...).
--
-- ОДИН ТИП НА ТРИ ВИДА ФАЙЛА, а не три отдельных:
--   • превращение ссылки во встраиваемую у них одинаковое;
--   • вид однозначно читается из самого адреса (/document/, /spreadsheets/,
--     /presentation/), хранить его отдельно незачем;
--   • учитель физически не может ошибиться, выбрав «Таблицы» и вставив
--     ссылку на документ.
-- В песочнице карточек всё же три — там ученик создаёт НОВЫЙ файл, и вид
-- нужно выбрать до открытия.
--
-- ЧТО ДЕЛАЕТ МИГРАЦИЯ. Расширяет два CHECK-ограничения: lesson_stages (этап
-- урока) и homework (задание). Второе — не про запас: в packages/core тип
-- ContentType собран как 'file' | 'test' | ... | ExternalServiceType, то есть
-- добавление 'google_docs' в ExternalServiceType автоматически делает его
-- допустимым и для ДЗ на уровне типов. Не расширь мы здесь и второй CHECK —
-- типы обещали бы то, чего база не принимает. Тот же порядок, что у миграции
-- 177 (scratch).
--
-- ЭТАП ПОКАЗА. Доступ к файлам открыт по ссылке: править может любой, кто её
-- получил. Раздача прав каждому ученику отдельно — следующая задача, здесь
-- сознательно не делается.

ALTER TABLE public.lesson_stages
  DROP CONSTRAINT IF EXISTS lesson_stages_content_type_check;

ALTER TABLE public.lesson_stages
  ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation', 'code', 'wokwi', 'codesandbox', 'quiz_qia', 'quiz_kahoot',
    'geogebra', 'phet', 'desmos', 'blockly_games', 'visualgo', 'p5js',
    'excalidraw', 'learningapps', 'sqlonline', 'h5p', 'typerun',
    'code_completion', 'scratch', 'google_docs'
  ]::text[]));

ALTER TABLE public.homework
  DROP CONSTRAINT IF EXISTS homework_content_type_check;

ALTER TABLE public.homework
  ADD CONSTRAINT homework_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'file', 'test', 'programming', 'bundle', 'wokwi', 'codesandbox',
    'geogebra', 'phet', 'desmos', 'blockly_games', 'visualgo', 'p5js',
    'excalidraw', 'learningapps', 'sqlonline', 'h5p', 'code_completion',
    'scratch', 'google_docs'
  ]::text[]));

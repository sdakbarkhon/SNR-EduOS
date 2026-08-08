-- 177, 08.08.2026 — тип содержимого 'scratch'.
--
-- Scratch возвращается в проект третий раз и на этот раз со своим хостингом.
-- История: он уже был (миграции 68, 69 переименовали его в TurboWarp), потом
-- его убрали совсем (миграция 90). Причина обоих шагов одна — scratch.mit.edu
-- запрещает показ своего редактора в рамке на чужом домене, встроить его
-- физически нельзя.
--
-- Теперь на snr-scratch.vercel.app развёрнута официальная сборка scratch-gui
-- (AGPL-3.0) отдельным проектом Vercel. Это тот же редактор: те же блоки,
-- спрайты и звуки. На своём домене запрета встраивания нет.
--
-- ЧТО ДЕЛАЕТ МИГРАЦИЯ. Расширяет два CHECK-ограничения: lesson_stages
-- (этап урока) и homework (задание). Второе добавлено НЕ про запас: в
-- packages/core тип ContentType собран как
-- 'file' | 'test' | ... | ExternalServiceType, то есть добавление 'scratch'
-- в ExternalServiceType автоматически делает его допустимым и для ДЗ на
-- уровне типов. Не расширь мы здесь и второй CHECK — типы обещали бы то,
-- чего база не принимает, ровно как у всех двенадцати сервисов до него.
--
-- Ограничение «только 1-5 класс» на уровне БД НЕ ставится: номера класса в
-- таблице groups нет (только name вида «3-А класс»), и вычислять его в
-- CHECK-ограничении разбором строки — хрупко. Ограничение живёт в форме
-- учителя (apps/web/lib/group-grade.ts + TeacherLessonDetailView), где и
-- принимается решение о показе пункта. В песочнице Scratch открыт всем
-- классам — так просил заказчик.

ALTER TABLE public.lesson_stages
  DROP CONSTRAINT IF EXISTS lesson_stages_content_type_check;

ALTER TABLE public.lesson_stages
  ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation', 'code', 'wokwi', 'codesandbox', 'quiz_qia', 'quiz_kahoot',
    'geogebra', 'phet', 'desmos', 'blockly_games', 'visualgo', 'p5js',
    'excalidraw', 'learningapps', 'sqlonline', 'h5p', 'typerun',
    'code_completion', 'scratch'
  ]::text[]));

ALTER TABLE public.homework
  DROP CONSTRAINT IF EXISTS homework_content_type_check;

ALTER TABLE public.homework
  ADD CONSTRAINT homework_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'file', 'test', 'programming', 'bundle', 'wokwi', 'codesandbox',
    'geogebra', 'phet', 'desmos', 'blockly_games', 'visualgo', 'p5js',
    'excalidraw', 'learningapps', 'sqlonline', 'h5p', 'code_completion',
    'scratch'
  ]::text[]));

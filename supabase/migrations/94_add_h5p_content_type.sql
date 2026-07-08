-- УЧ.9 часть 5: добавить 'h5p' в lesson_stages.content_type CHECK — миграция 93
-- создала только таблицу h5p_content, но не разрешила сам content_type.

ALTER TABLE public.lesson_stages DROP CONSTRAINT lesson_stages_content_type_check;
ALTER TABLE public.lesson_stages ADD CONSTRAINT lesson_stages_content_type_check
  CHECK (content_type = ANY (ARRAY[
    'presentation'::text, 'code'::text, 'wokwi'::text, 'codesandbox'::text,
    'quiz_qia'::text, 'quiz_kahoot'::text,
    'geogebra'::text, 'phet'::text, 'desmos'::text, 'blockly_games'::text, 'visualgo'::text,
    'p5js'::text, 'excalidraw'::text, 'learningapps'::text, 'sqlonline'::text,
    'h5p'::text
  ]));

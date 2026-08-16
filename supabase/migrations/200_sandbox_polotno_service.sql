-- Миграция 200: в ростер инструментов песочницы добавлен 'polotno'.
--
-- ЗАЧЕМ. В песочницу заводится ПРОБНАЯ карточка редактора Polotno (конструктор
-- в духе Canva, встраивается прямо в нашу страницу, без чужой рамки). Работы
-- сохраняются по образцу Scratch — та же таблица public.sandbox_projects и тот
-- же приватный бакет scratch-projects, второй схемы не заводится.
--
-- Единственное, что этому мешало: колонка service_id ограничена перечнем
-- допустимых значений (sandbox_projects_service_id_check, миграция 184), и
-- 'polotno' в нём нет — вставка падала бы на проверке. Здесь ровно одно
-- изменение: 17 значений становятся 18.
--
-- Больше ничего: ни новых таблиц, ни новых политик, ни нового бакета. Права на
-- работы остаются теми же, что у Scratch (миграции 118 и 182): ученик видит
-- только свои, учитель — только работы своих классов из урока или задания.
--
-- ЕСЛИ ПРОБА НЕ ПОНРАВИТСЯ. Откат — вернуть перечень из миграции 184 и удалить
-- строки с service_id = 'polotno'; ничего другого эта миграция не трогает.

ALTER TABLE public.sandbox_projects
  DROP CONSTRAINT IF EXISTS sandbox_projects_service_id_check;

ALTER TABLE public.sandbox_projects
  ADD CONSTRAINT sandbox_projects_service_id_check CHECK (
    service_id = ANY (ARRAY[
      'python', 'cpp',
      'h5p',
      'wokwi', 'codesandbox', 'geogebra', 'phet', 'desmos', 'blockly_games',
      'visualgo', 'p5js', 'excalidraw', 'learningapps', 'sqlonline',
      'typerun', 'scratch', 'google_docs',
      'polotno'
    ]::text[])
  );

COMMENT ON CONSTRAINT sandbox_projects_service_id_check ON public.sandbox_projects IS
  'Ростер инструментов песочницы. Держать в синхроне с EXTERNAL_SERVICE_ORDER '
  '(apps/web/lib/external-services.ts) плюс python/cpp (режимы CodeSandbox), h5p '
  'и polotno (встроенный редактор, не внешний сервис). Миграции 184 и 200.';

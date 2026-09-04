-- ============================================================================
-- Миграция 258: список внешних сервисов задаётся у предмета справочника.
-- ============================================================================
--
-- ═══ ЧТО БЫЛО ══════════════════════════════════════════════════════════════
--
-- Карта в коде, ключуемая РУССКИМ НАЗВАНИЕМ предмета (SUBJECT_SERVICE_MAP,
-- apps/web/lib/external-services.ts), — ровно пять имён:
--
--   Программирование → codesandbox, blockly_games, visualgo, p5js, sqlonline
--   Робототехника    → wokwi, blockly_games
--   Математика       → geogebra, desmos
--   Английский язык  → learningapps
--   Русский язык     → learningapps
--
-- Предмет, которого в карте нет, получал «научную заглушку» phet плюс три
-- универсальных — ЧЕТЫРЕ сервиса из четырнадцати. Так живут «Схемотехника»,
-- «Science» и любой предмет, который школа заведёт завтра: список за неё
-- решён в коде и сузить или расширить его она не может.
--
-- ═══ ЧТО СТАНОВИТСЯ ════════════════════════════════════════════════════════
--
-- Колонка `services` у предмета справочника. Список задаёт школа галочками в
-- форме предмета — своё решение, а не наше угадывание по названию.
--
-- ═══ УМОЛЧАНИЕ — ВСЕ ЧЕТЫРНАДЦАТЬ ══════════════════════════════════════════
--
-- Решение заказчика. Довод: список сервисов — инструмент СУЖЕНИЯ, и сужать
-- должен человек осознанно. Пустое умолчание отнимает молча: учитель новой
-- «Алгебры» просто не найдёт GeoGebra и не поймёт почему. Лишнюю галочку
-- видно и снять её — одно движение; недостающей не видно вовсе.
--
-- Умолчание стоит на КОЛОНКЕ, а не только в форме: предмет заводится не
-- только ею (быстрый старт, единое окно), и путь в обход формы не должен
-- оставлять предмет без сервисов.
--
-- ═══ СУЩЕСТВУЮЩИМ — ИХ СЕГОДНЯШНИЙ НАБОР ═══════════════════════════════════
--
-- Чтобы у них не изменилось НИЧЕГО. Пять предметов из карты получают свои
-- сервисы плюс универсальные; все остальные — phet плюс универсальные, то
-- есть ровно то, что видят сегодня. Расширить набор «Схемотехнике» — решение
-- школы, и теперь оно ей доступно: одна галочка в форме предмета.
--
-- ДАННЫЕ ЭТО НЕ МЕНЯЕТ в смысле поведения: то, что учитель видел вчера, он
-- увидит и завтра. Меняется только место, где это записано.
-- ============================================================================

-- ── 1. Колонка ──────────────────────────────────────────────────────────────
ALTER TABLE public.school_subjects
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT ARRAY[
    'wokwi', 'codesandbox', 'geogebra', 'phet', 'desmos', 'blockly_games',
    'visualgo', 'p5js', 'excalidraw', 'learningapps', 'sqlonline', 'typerun',
    'scratch', 'google_docs'
  ]::text[];

COMMENT ON COLUMN public.school_subjects.services IS
  'Внешние сервисы, предлагаемые учителю этого предмета (ключи EXTERNAL_SERVICE_ORDER). Умолчание — все четырнадцать: список сужает школа галочками, а не код по названию предмета.';

-- ── 2. Существующим — их сегодняшний набор ──────────────────────────────────
-- Универсальные (excalidraw, typerun, google_docs) сегодня добавляются к
-- любому предмету, поэтому входят в каждый набор ниже.
UPDATE public.school_subjects SET services = ARRAY[
  'codesandbox', 'blockly_games', 'visualgo', 'p5js', 'sqlonline',
  'excalidraw', 'typerun', 'google_docs']::text[]
 WHERE name = 'Программирование';

UPDATE public.school_subjects SET services = ARRAY[
  'wokwi', 'blockly_games', 'excalidraw', 'typerun', 'google_docs']::text[]
 WHERE name = 'Робототехника';

UPDATE public.school_subjects SET services = ARRAY[
  'geogebra', 'desmos', 'excalidraw', 'typerun', 'google_docs']::text[]
 WHERE name = 'Математика';

UPDATE public.school_subjects SET services = ARRAY[
  'learningapps', 'excalidraw', 'typerun', 'google_docs']::text[]
 WHERE name IN ('Английский язык', 'Русский язык');

-- Всё остальное — «научная заглушка» плюс универсальные: ровно то, что эти
-- предметы получают сегодня, не значась в карте.
UPDATE public.school_subjects SET services = ARRAY[
  'phet', 'excalidraw', 'typerun', 'google_docs']::text[]
 WHERE name NOT IN (
   'Программирование', 'Робототехника', 'Математика',
   'Английский язык', 'Русский язык'
 );

-- ── 3. Самопроверка ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_total    integer;
  v_empty    integer;
  v_prog     integer;
  v_default  integer;
BEGIN
  SELECT count(*) INTO v_total FROM public.school_subjects;
  SELECT count(*) INTO v_empty FROM public.school_subjects
   WHERE services IS NULL OR cardinality(services) = 0;
  SELECT count(*) INTO v_prog FROM public.school_subjects
   WHERE name = 'Программирование' AND cardinality(services) = 8;
  SELECT count(*) INTO v_default FROM public.school_subjects
   WHERE cardinality(services) = 4;
  RAISE NOTICE '258: предметов %, без сервисов %, «Программирование» с восемью %, с четырьмя %',
    v_total, v_empty, v_prog, v_default;
  IF v_empty <> 0 THEN
    RAISE EXCEPTION '258: % предметов остались без сервисов', v_empty;
  END IF;

  -- Ключи должны быть из известного набора: опечатка здесь означала бы
  -- сервис, которого нет, и пустое место в форме.
  IF EXISTS (
    SELECT 1 FROM public.school_subjects ss, unnest(ss.services) AS s(key)
     WHERE s.key NOT IN (
       'wokwi', 'codesandbox', 'geogebra', 'phet', 'desmos', 'blockly_games',
       'visualgo', 'p5js', 'excalidraw', 'learningapps', 'sqlonline', 'typerun',
       'scratch', 'google_docs')
  ) THEN
    RAISE EXCEPTION '258: в services попал неизвестный ключ сервиса';
  END IF;
END $$;

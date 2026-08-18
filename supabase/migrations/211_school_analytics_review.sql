-- Миграция 211: разбор аналитики от ИИ — хранение и правила обновления.
--
-- ЗАЧЕМ ХРАНИТЬ. Разбор — это обращение к модели. Считать его на каждое
-- открытие экрана значит платить за каждое открытие: директор зашёл трижды за
-- утро — три вызова с одинаковым ответом, потому что данные между заходами не
-- поменялись. Здесь лежит последний разбор школы и слепок чисел, по которым он
-- сделан.
--
-- КОГДА ОБНОВЛЯТЬ (правило целиком живёт в коде роута, здесь только хранилище):
--   * разбора нет вовсе — считаем;
--   * слепок чисел изменился И прошли сутки с прошлого разбора — считаем;
--   * администратор нажал «Обновить» — считаем;
--   * иначе показываем сохранённый.
-- Пара «слепок + сутки» выбрана не случайно. Один слепок мало: в живой школе
-- любая новая оценка меняет средний балл во втором знаке, и разбор считался бы
-- по десять раз в день, слово в слово одинаковый. Одни сутки тоже мало: в
-- каникулы данные стоят, а мы бы платили ежедневно. Вместе — не чаще раза в
-- сутки и только если есть чему меняться.
--
-- ОДНА СТРОКА НА ШКОЛУ. История разборов не хранится намеренно: это не
-- документ и не отчёт, а пересказ сегодняшних чисел. Вчерашний пересказ
-- вчерашних чисел никому не нужен, а таблица росла бы вечно.

CREATE TABLE IF NOT EXISTS public.school_analytics_reviews (
  school_id    uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  review_text  text NOT NULL,
  -- Слепок чисел, по которым сделан разбор: средний балл, посещаемость,
  -- число оценок и прочее, свёрнутое в строку. Сравнение строк, а не чисел
  -- по одному, — чтобы добавление нового показателя не требовало новой
  -- колонки.
  facts_hash   text NOT NULL,
  model        text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.school_analytics_reviews IS
  'Последний разбор аналитики от ИИ по школе. Одна строка на школу: это '
  'пересказ сегодняшних чисел, а не документ — история не нужна.';

-- ── Права ──────────────────────────────────────────────────────────────────
-- Читают только администратор своей школы и суперадминистратор. Ученик и
-- родитель не читают вовсе: разбор говорит, кому нужна помощь, и адресован он
-- тем, кто эту помощь организует.
-- Пишет только служебный ключ (роут генерации) — политики INSERT/UPDATE для
-- authenticated нет, и это не упущение.
ALTER TABLE public.school_analytics_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin reads own school review" ON public.school_analytics_reviews;
CREATE POLICY "admin reads own school review" ON public.school_analytics_reviews
  FOR SELECT TO authenticated
  USING (
    (public.fn_is_admin() AND school_id = public.current_school_id())
    OR public.is_super_admin()
  );

REVOKE ALL ON public.school_analytics_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.school_analytics_reviews TO authenticated;

-- ── Самопроверка ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_admin  uuid;
  v_school uuid;
  v_seen   integer;
BEGIN
  SELECT s.id INTO v_school FROM public.schools s WHERE s.is_demo LIMIT 1;
  SELECT a.user_id INTO v_admin FROM public.admins a
   WHERE a.school_id = v_school AND a.user_id IS NOT NULL LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE NOTICE 'нет админа для проверки — самопроверка пропущена';
    RETURN;
  END IF;

  INSERT INTO public.school_analytics_reviews (school_id, review_text, facts_hash)
  VALUES (v_school, 'проверка', 'x')
  ON CONFLICT (school_id) DO NOTHING;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_seen FROM public.school_analytics_reviews;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF v_seen <> 1 THEN
    RAISE EXCEPTION 'админ видит % строк вместо своей одной', v_seen;
  END IF;

  DELETE FROM public.school_analytics_reviews WHERE review_text = 'проверка';
  RAISE NOTICE 'Миграция 211: хранилище разбора заведено, админ видит только свою школу';
END $$;

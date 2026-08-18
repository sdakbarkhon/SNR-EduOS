-- Миграция 209: настоящий учёт расходов на ИИ.
--
-- ЧТО БЫЛО. Единственный учёт — ai_usage_log(day, requests_count, updated_at):
-- дата и число обращений за сутки. Ни токенов, ни денег, ни вида задачи, ни
-- модели, ни школы. Колонка ai_chat_messages.tokens_used существует, но в неё
-- ничто не пишет — во всех строках ноль. Поэтому разбивку по задачам и цену
-- одного урока посчитать было физически нечем.
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ. Заводит журнал обращений: одна строка на один вызов
-- модели. Прежний счётчик НЕ трогается — на нём держится дневной предел
-- (get_ai_usage_today, 250 в сутки), и ломать его нельзя.
--
-- ПОЧЕМУ ТОКЕНЫ, А НЕ СРАЗУ ДЕНЬГИ. Цена модели меняется — за время проекта
-- прайс Flash вырос вчетверо, а записанные в коде константы устарели и никто
-- этого не заметил. Токены — факт, они не меняются задним числом. Деньги
-- считаются поверх при показе, по текущему прайсу, и пересчёт старых периодов
-- по новой цене остаётся возможным.
--
-- ПОЧЕМУ NULLABLE ШКОЛА И ЧЕЛОВЕК. Часть вызовов идёт вне школьного контекста
-- (разбор файла до привязки, служебные прогоны скриптами) — терять такую
-- запись из-за NOT NULL хуже, чем принять её без школы.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Вид задачи. Текст, а не enum: новый вид не должен требовать миграции.
  -- Значения задаёт lib/ai/ai-tasks.ts — один список на всё приложение.
  task          text NOT NULL,
  model         text NOT NULL,

  -- Токены как отдал провайдер (usageMetadata). NULL — значит ответ пришёл
  -- без счётчика: так бывает при отказе, и врать нулём в этом случае нельзя.
  input_tokens  integer,
  output_tokens integer,
  total_tokens  integer,

  school_id     uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  -- Кто инициировал. Ровно один из двух заполнен, или ни одного (служебный вызов).
  student_id    uuid REFERENCES public.students(id) ON DELETE SET NULL,
  teacher_id    uuid REFERENCES public.teachers(id) ON DELETE SET NULL,

  ok            boolean NOT NULL,
  error_reason  text,
  duration_ms   integer,

  CONSTRAINT ai_usage_events_actor_chk
    CHECK (student_id IS NULL OR teacher_id IS NULL)
);

-- Считать месяц, задачу и школу — три самых частых среза отчёта.
CREATE INDEX IF NOT EXISTS ai_usage_events_created_idx ON public.ai_usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_task_idx    ON public.ai_usage_events (task, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_events_school_idx  ON public.ai_usage_events (school_id, created_at DESC);

COMMENT ON TABLE public.ai_usage_events IS
  'Журнал обращений к модели: одна строка на вызов. Токены — как отдал '
  'провайдер; деньги считаются при показе по текущему прайсу. Прежний '
  'ai_usage_log остаётся и держит дневной предел.';

-- ── Права ──────────────────────────────────────────────────────────────────
-- Пишет только служебный ключ (gemini-client). Читает только суперадмин:
-- это расходы всей установки, школьному администратору они не адресованы.
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super admin reads ai usage" ON public.ai_usage_events;
CREATE POLICY "super admin reads ai usage" ON public.ai_usage_events
  FOR SELECT USING (public.is_super_admin());

REVOKE ALL ON public.ai_usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_usage_events TO authenticated;

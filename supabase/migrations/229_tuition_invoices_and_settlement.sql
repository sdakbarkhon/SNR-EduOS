-- =====================================================================
-- 229. Счета за обучение и погашение с баланса. Заход 3 по платежам.
--
-- Что заводится:
--   * school_now(school_id)            — «сейчас» школы;
--   * school_current_month(school_id)  — первое число ЕЁ месяца;
--   * v_tuition_invoice_blockers       — кому счёт не выставлен и почему;
--   * fn_issue_monthly_invoices()      — выставление счетов, 1 числа;
--   * fn_settle_open_invoices()        — погашение с баланса, раз в час.
--
-- ALTER TABLE в этой миграции НЕТ НИ ОДНОГО. Ни одна таблица не блокируется,
-- дедлока, как при 227, быть не может.
--
-- РАСПИСАНИЕ pg_cron ВЫНЕСЕНО В КОНЕЦ ФАЙЛА И ЗАКОММЕНТИРОВАНО. Применение
-- этого файла НИЧЕГО НЕ ЗАПУСКАЕТ: сначала смотрим на функции живьём, потом
-- включаем расписание отдельной командой. Задание, включённое вместе с
-- функциями, начало бы работать раньше, чем человек увидел первый счёт.
-- =====================================================================

BEGIN;

-- ── 1. «Сейчас» школы ───────────────────────────────────────────────────────
--
-- ТРЕТЬЕ ИЗЛОЖЕНИЕ ОДНОГО ПРАВИЛА. Те же два числа записаны ещё в двух местах:
--   * apps/web/lib/school-time.ts        (веб)
--   * packages/core/src/utils/schoolTime.ts (общий слой)
-- Правило: у школы с `frozen_date` «сейчас» — этот день в 10:15 по Ташкенту,
-- всегда один и тот же момент; у остальных — настоящие часы. Менять правило
-- нужно во ВСЕХ ТРЁХ местах разом, ссылки стоят в каждом.
--
-- Почему копия неизбежна: задание живёт внутри базы и до TypeScript не
-- дотянется, а вынести его на Vercel нельзя — там оба места под расписание
-- заняты, и бесплатный тариф даёт запуск не чаще раза в сутки.
--
-- 'Asia/Tashkent' вместо константы '+05:00' — читаемее, а совпадение полное:
-- в Ташкенте нет перевода часов, смещение постоянное.
--
-- SECURITY DEFINER: функцию зовут задания и представление, и правила доступа
-- к `schools` не должны превращать «школа заморожена» в «школы нет».
CREATE OR REPLACE FUNCTION public.school_now(p_school_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN s.frozen_date IS NULL THEN now()
    ELSE (s.frozen_date::text || ' 10:15:00+05')::timestamptz
  END
  FROM public.schools s
  WHERE s.id = p_school_id
$$;

COMMENT ON FUNCTION public.school_now(uuid) IS
  '«Сейчас» школы: у замороженной — её день в 10:15 по Ташкенту, у остальных '
  'настоящие часы. То же правило в apps/web/lib/school-time.ts и '
  'packages/core/src/utils/schoolTime.ts — менять во всех трёх. Миграция 229.';

CREATE OR REPLACE FUNCTION public.school_current_month(p_school_id uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT date_trunc('month', public.school_now(p_school_id) AT TIME ZONE 'Asia/Tashkent')::date
$$;

COMMENT ON FUNCTION public.school_current_month(uuid) IS
  'Первое число месяца по времени школы. У демо-школы это всегда июль 2026 — '
  'ровно этого мы и добиваемся. Миграция 229.';

-- ── 2. Кому счёт не выставлен и почему ──────────────────────────────────────
--
-- ПРЕДСТАВЛЕНИЕ, А НЕ ТАБЛИЦА. Причина целиком выводится из текущего
-- состояния: нет группы, две группы, цена класса не задана. Хранить это
-- строками значило бы завести данные, которые протухают в ту же секунду,
-- когда админ впишет цену. Представление всегда говорит правду и ничего не
-- хранит.
--
-- security_invoker = on: правила доступа применяются к тому, кто читает, а не
-- к владельцу представления. Иначе экран админа увидел бы чужие школы.
CREATE OR REPLACE VIEW public.v_tuition_invoice_blockers
WITH (security_invoker = on) AS
SELECT
  st.school_id,
  st.id                                          AS student_id,
  st.full_name,
  public.school_current_month(st.school_id)      AS period_month,
  coalesce(cnt.groups, 0)                        AS groups_count,
  CASE
    WHEN coalesce(cnt.groups, 0) = 0 THEN 'no_group'
    WHEN cnt.groups > 1              THEN 'many_groups'
    ELSE                                  'no_price'
  END                                            AS reason
FROM public.students st
LEFT JOIN LATERAL (
  -- min() по uuid в Postgres нет, поэтому берём первый элемент массива:
  -- строк не больше одной там, где это важно (проверка groups = 1 ниже).
  SELECT count(*)::int AS groups, (array_agg(sg.group_id))[1] AS group_id
    FROM public.student_groups sg
   WHERE sg.student_id = st.id
) cnt ON true
LEFT JOIN public.groups g ON g.id = cnt.group_id
WHERE st.status <> 'frozen'
  -- Либо групп не ровно одна, либо цена не задана.
  AND (cnt.groups IS DISTINCT FROM 1 OR coalesce(g.course_price, 0) = 0)
  -- Счёт за этот месяц уже есть — значит препятствия нет.
  AND NOT EXISTS (
    SELECT 1 FROM public.tuition_invoices ti
     WHERE ti.student_id = st.id
       AND ti.period_month = public.school_current_month(st.school_id)
  );

COMMENT ON VIEW public.v_tuition_invoice_blockers IS
  'Ученики, которым счёт за текущий месяц школы выставить нельзя, и причина: '
  'no_group / many_groups / no_price. Считается на лету. Миграция 229.';

-- ── 3. Погашение открытых счетов с баланса ──────────────────────────────────
--
-- Правило заказчика: не хватило — счёт висит открытым, баланс не трогаем, в
-- минус не уходим. Родитель пополнил — следующий запуск закроет счёт сам.
--
-- ПОЧЕМУ ЗАМОК НА СТРОКЕ УЧЕНИКА. Между «прочитали баланс» и «списали» может
-- вклиниться и второй запуск задания, и пополнение от кассы. Замок делает
-- проверку и списание неделимыми. Третий рубеж — уникальность
-- uq_balance_entries_invoice_charge из 227: один счёт — одно погашение,
-- сколько бы раз ни запустили.
CREATE OR REPLACE FUNCTION public.fn_settle_open_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r          record;
  v_balance  numeric;
  v_paid     integer := 0;
BEGIN
  FOR r IN
    SELECT ti.id, ti.student_id, ti.school_id, ti.amount
      FROM public.tuition_invoices ti
     WHERE ti.status = 'open'
     -- Старые счета гасятся первыми: долг закрывается по порядку.
     ORDER BY ti.student_id, ti.period_month
  LOOP
    SELECT s.balance INTO v_balance
      FROM public.students s
     WHERE s.id = r.student_id
     FOR UPDATE;

    CONTINUE WHEN v_balance IS NULL OR v_balance < r.amount;

    -- Баланс уменьшит триггер trg_apply_balance_entry из 227 — здесь только
    -- строка журнала. ON CONFLICT: повторный запуск не спишет второй раз.
    INSERT INTO public.balance_entries (school_id, student_id, amount, kind, invoice_id, note)
    VALUES (r.school_id, r.student_id, -r.amount, 'invoice_charge', r.id,
            'Погашение счёта за обучение')
    ON CONFLICT DO NOTHING;

    UPDATE public.tuition_invoices
       SET status = 'paid', paid_at = now()
     WHERE id = r.id AND status = 'open';

    v_paid := v_paid + 1;
  END LOOP;

  RETURN v_paid;
END;
$fn$;

COMMENT ON FUNCTION public.fn_settle_open_invoices() IS
  'Гасит открытые счета с баланса ученика, если денег хватает. Не хватило — '
  'счёт остаётся открытым. Возвращает число закрытых. Миграция 229.';

-- ── 4. Выставление счетов ───────────────────────────────────────────────────
--
-- Месяц берётся из времени ШКОЛЫ, а не из часов сервера. Для демо-школы это
-- всегда июль 2026, а уникальность «ребёнок + месяц» превращает это в
-- приятное свойство: по одному счёту на ребёнка, один раз, и больше никогда.
--
-- Кого пропускаем и почему:
--   * ученик не ровно в одной группе — цена стала бы догадкой. Лучше видимый
--     пропуск, чем тихо выставленная не та сумма (решение заказчика);
--   * цена класса ноль — по решению захода 2 ноль значит «не задана», а не
--     «бесплатно». Счёт на ноль был бы мусором в истории;
--   * ученик заморожен (status = 'frozen') — обучение на паузе. Должник
--     (status = 'debtor') счёт получает: он учится, просто не заплатил.
-- Всех пропущенных видно в v_tuition_invoice_blockers с причиной.
--
-- Архивные школы (is_active = false) не выставляют счетов вовсе.
CREATE OR REPLACE FUNCTION public.fn_issue_monthly_invoices()
-- invoice_month, а не period_month: одноимённая колонка есть в
-- tuition_invoices, и внутри INSERT ниже имя стало бы двусмысленным.
RETURNS TABLE (school_name text, invoice_month date, issued integer, skipped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r_school   record;
  v_month    date;
  v_issued   integer;
  v_skipped  integer;
BEGIN
  FOR r_school IN
    SELECT s.id, s.name FROM public.schools s WHERE s.is_active ORDER BY s.name
  LOOP
    v_month := public.school_current_month(r_school.id);

    WITH one_group AS (
      SELECT sg.student_id, (array_agg(sg.group_id))[1] AS group_id
        FROM public.student_groups sg
        JOIN public.students st ON st.id = sg.student_id
       WHERE st.school_id = r_school.id
         AND st.status <> 'frozen'
       GROUP BY sg.student_id
      HAVING count(*) = 1
    ),
    billable AS (
      SELECT og.student_id, og.group_id, g.course_price
        FROM one_group og
        JOIN public.groups g ON g.id = og.group_id
       WHERE g.course_price > 0
    ),
    ins AS (
      INSERT INTO public.tuition_invoices
        (school_id, student_id, group_id, period_month, amount)
      SELECT r_school.id, b.student_id, b.group_id, v_month, b.course_price
        FROM billable b
      ON CONFLICT (student_id, period_month) DO NOTHING
      RETURNING 1
    )
    SELECT count(*)::integer INTO v_issued FROM ins;

    SELECT count(*)::integer INTO v_skipped
      FROM public.v_tuition_invoice_blockers b
     WHERE b.school_id = r_school.id;

    school_name  := r_school.name;
    invoice_month := v_month;
    issued       := v_issued;
    skipped      := v_skipped;
    RETURN NEXT;
  END LOOP;

  -- Сразу пробуем погасить: у кого на балансе хватает, тот и не увидит долга.
  PERFORM public.fn_settle_open_invoices();
END;
$fn$;

COMMENT ON FUNCTION public.fn_issue_monthly_invoices() IS
  'Выставляет счета за месяц КАЖДОЙ школы по её собственному времени и сразу '
  'пробует погасить их с баланса. Пропущенных смотреть в '
  'v_tuition_invoice_blockers. Миграция 229.';

-- ── 5. Самопроверка: миграция не должна лечь наполовину ─────────────────────
DO $check$
DECLARE
  v_missing text := '';
BEGIN
  IF to_regprocedure('public.school_now(uuid)') IS NULL THEN
    v_missing := v_missing || ' school_now';
  END IF;
  IF to_regprocedure('public.school_current_month(uuid)') IS NULL THEN
    v_missing := v_missing || ' school_current_month';
  END IF;
  IF to_regprocedure('public.fn_settle_open_invoices()') IS NULL THEN
    v_missing := v_missing || ' fn_settle_open_invoices';
  END IF;
  IF to_regprocedure('public.fn_issue_monthly_invoices()') IS NULL THEN
    v_missing := v_missing || ' fn_issue_monthly_invoices';
  END IF;
  IF to_regclass('public.v_tuition_invoice_blockers') IS NULL THEN
    v_missing := v_missing || ' v_tuition_invoice_blockers';
  END IF;
  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Миграция 229 легла наполовину, не хватает:%', v_missing;
  END IF;

  -- Демо-школа обязана получить свой замороженный месяц, а не текущий.
  IF EXISTS (
    SELECT 1 FROM public.schools s
     WHERE s.frozen_date IS NOT NULL
       AND public.school_current_month(s.id)
           <> date_trunc('month', s.frozen_date)::date
  ) THEN
    RAISE EXCEPTION 'Миграция 229: месяц замороженной школы не совпал с её frozen_date';
  END IF;
END;
$check$;

COMMIT;

-- =====================================================================
-- РАСПИСАНИЕ — ВЫПОЛНЯТЬ ОТДЕЛЬНО, ПОСЛЕ ПРОВЕРКИ ФУНКЦИЙ.
--
-- Этот блок закомментирован НАМЕРЕННО: применение файла выше ничего не
-- запускает. Сначала посмотрите на функции живьём (вызвать их можно прямо
-- из Dashboard), убедитесь, что счета выставляются те и тем, — и только
-- потом выполните блок ниже отдельной командой.
--
-- Окна выбраны так, чтобы не пересечься с уже работающим:
--   02:00 UTC — разбор очереди векторов (Vercel) и чистка объявлений (pg_cron);
--   19:15 UTC — ночной откат демо (Vercel);
--   каждую минуту — автостарт и автозавершение уроков (pg_cron).
-- Выставление счетов встаёт на 01:10 UTC первого числа (06:10 по Ташкенту,
-- утро первого числа), погашение — на 25-ю минуту каждого часа. Ни одно из
-- существующих заданий не приходится на эти минуты.
--
--   SELECT cron.schedule(
--     'tuition-issue-monthly',
--     '10 1 1 * *',
--     $cron$ SELECT public.fn_issue_monthly_invoices() $cron$
--   );
--
--   SELECT cron.schedule(
--     'tuition-settle-hourly',
--     '25 * * * *',
--     $cron$ SELECT public.fn_settle_open_invoices() $cron$
--   );
--
-- Проверить, что встало:  SELECT jobid, jobname, schedule, active FROM cron.job;
-- Выключить обратно:      SELECT cron.unschedule('tuition-issue-monthly');
--                         SELECT cron.unschedule('tuition-settle-hourly');
-- =====================================================================

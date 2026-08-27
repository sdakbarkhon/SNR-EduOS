-- =====================================================================
-- 230. Граница школы у платёжных заданий + предпросмотр выставления.
--
-- ЗАЧЕМ. Обе функции из 229 — `fn_issue_monthly_invoices()` и
-- `fn_settle_open_invoices()` — БЕЗ АРГУМЕНТОВ и ходят по ВСЕМ школам. Пока их
-- зовёт только крон, это правильно. Но заход 5 даёт админу школы кнопку
-- «Выставить счета сейчас», и нажатие такой кнопки выставило бы счета ещё и
-- ЧУЖОЙ школе. Это не украшение интерфейса — это отсутствующая граница.
--
-- КАК. У обеих функций появляется необязательный `p_school_id uuid DEFAULT
-- NULL`:
--   * NULL          — все школы. Ровно так их зовёт крон, и текст его
--                     расписания менять НЕ НУЖНО: вызов без аргумента
--                     по-прежнему работает;
--   * идентификатор — одна школа. Так их зовёт кнопка админа.
--
-- ПОЧЕМУ DROP, А НЕ CREATE OR REPLACE. Добавление параметра со значением по
-- умолчанию создаёт НОВУЮ функцию (сигнатура другая), и вызов без аргументов
-- стал бы неоднозначным между старой и новой — Postgres такой вызов отвергает.
-- Поэтому старые снимаются, новые ставятся, и вызов без аргумента снова
-- единственный.
--
-- Тела функций перенесены из 229 БЕЗ изменений в логике: добавлено только
-- условие по школе. Правила «не ровно одна группа», «цена ноль», «замороженный
-- ученик пропускается», «в минус не уходим», «повторный запуск не плодит»
-- остались теми же.
--
-- ТРЕТЬЯ ФУНКЦИЯ — ПРЕДПРОСМОТР. `fn_issue_preview(school)` считает, что
-- случится, ЕСЛИ нажать: сколько счетов выставится, на какую сумму, скольких
-- пропустим. Считает В МОМЕНТ ВЫЗОВА, а не заранее: между открытием экрана и
-- нажатием кнопки админ мог поменять цену класса, и подтверждение обязано
-- показывать сегодняшнюю правду.
--
-- ALTER TABLE в этой миграции НЕТ НИ ОДНОГО. Таблицы не меняются, `students`
-- не блокируется, дедлока, как при 227, быть не может.
-- =====================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.fn_issue_monthly_invoices();
DROP FUNCTION IF EXISTS public.fn_settle_open_invoices();

-- ── Погашение открытых счетов с баланса ─────────────────────────────────────
-- Тело — из 229, добавлено только сужение по школе.
CREATE OR REPLACE FUNCTION public.fn_settle_open_invoices(p_school_id uuid DEFAULT NULL)
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
       AND (p_school_id IS NULL OR ti.school_id = p_school_id)
     -- Старые счета гасятся первыми: долг закрывается по порядку.
     ORDER BY ti.student_id, ti.period_month
  LOOP
    SELECT s.balance INTO v_balance
      FROM public.students s
     WHERE s.id = r.student_id
     FOR UPDATE;

    CONTINUE WHEN v_balance IS NULL OR v_balance < r.amount;

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

COMMENT ON FUNCTION public.fn_settle_open_invoices(uuid) IS
  'Гасит открытые счета с баланса. Без аргумента — по всем школам (так зовёт '
  'крон), с аргументом — по одной. Миграция 230, тело из 229.';

-- ── Выставление счетов ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_issue_monthly_invoices(p_school_id uuid DEFAULT NULL)
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
    SELECT s.id, s.name
      FROM public.schools s
     WHERE s.is_active
       AND (p_school_id IS NULL OR s.id = p_school_id)
     ORDER BY s.name
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
      -- Отменённый счёт занимает ту же пару «ребёнок + месяц», поэтому
      -- повторный запуск его НЕ воскресит. Так и задумано: отмена — решение
      -- человека, и задание не должно его отменять. Вернуть счёт может тот же
      -- админ кнопкой «Вернуть» — см. заход 5.
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

  -- Гасим ровно ту же школу (или все, если звали без аргумента).
  PERFORM public.fn_settle_open_invoices(p_school_id);
END;
$fn$;

COMMENT ON FUNCTION public.fn_issue_monthly_invoices(uuid) IS
  'Выставляет счета за месяц школы и сразу пробует погасить. Без аргумента — '
  'по всем школам (так зовёт крон), с аргументом — по одной. Миграция 230.';

-- ── Предпросмотр: что случится, если нажать ─────────────────────────────────
--
-- Считается В МОМЕНТ ВЫЗОВА. Подтверждение перед необратимым действием обязано
-- показывать сегодняшнюю правду: между открытием экрана и нажатием кнопки
-- админ мог вписать цену классу, и вчерашние числа соврали бы.
--
-- Условие «кому выставим» — буква в букву то же, что в самом выставлении.
CREATE OR REPLACE FUNCTION public.fn_issue_preview(p_school_id uuid)
RETURNS TABLE (invoice_month date, will_issue integer, will_skip integer, total_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH one_group AS (
    SELECT sg.student_id, (array_agg(sg.group_id))[1] AS group_id
      FROM public.student_groups sg
      JOIN public.students st ON st.id = sg.student_id
     WHERE st.school_id = p_school_id
       AND st.status <> 'frozen'
     GROUP BY sg.student_id
    HAVING count(*) = 1
  ),
  billable AS (
    SELECT og.student_id, g.course_price
      FROM one_group og
      JOIN public.groups g ON g.id = og.group_id
     WHERE g.course_price > 0
       -- Счёт за этот месяц уже есть (в любом состоянии) — второй не появится.
       AND NOT EXISTS (
         SELECT 1 FROM public.tuition_invoices ti
          WHERE ti.student_id = og.student_id
            AND ti.period_month = public.school_current_month(p_school_id)
       )
  )
  SELECT
    public.school_current_month(p_school_id)                       AS invoice_month,
    (SELECT count(*)::integer FROM billable)                       AS will_issue,
    (SELECT count(*)::integer FROM public.v_tuition_invoice_blockers b
      WHERE b.school_id = p_school_id)                             AS will_skip,
    (SELECT coalesce(sum(course_price), 0) FROM billable)          AS total_amount
$fn$;

COMMENT ON FUNCTION public.fn_issue_preview(uuid) IS
  'Что случится, если выставить счета прямо сейчас: месяц, сколько счетов, на '
  'какую сумму, скольких пропустим. Считается в момент вызова. Миграция 230.';

-- ── Самопроверка ────────────────────────────────────────────────────────────
DO $check$
DECLARE
  v_missing text := '';
BEGIN
  IF to_regprocedure('public.fn_issue_monthly_invoices(uuid)') IS NULL THEN
    v_missing := v_missing || ' fn_issue_monthly_invoices(uuid)';
  END IF;
  IF to_regprocedure('public.fn_settle_open_invoices(uuid)') IS NULL THEN
    v_missing := v_missing || ' fn_settle_open_invoices(uuid)';
  END IF;
  IF to_regprocedure('public.fn_issue_preview(uuid)') IS NULL THEN
    v_missing := v_missing || ' fn_issue_preview(uuid)';
  END IF;
  IF v_missing <> '' THEN
    RAISE EXCEPTION 'Миграция 230 легла наполовину, не хватает:%', v_missing;
  END IF;

  -- Старые безаргументные версии должны исчезнуть: иначе вызов без аргумента
  -- станет неоднозначным и крон упадёт в тот же миг, когда его включат.
  IF to_regprocedure('public.fn_issue_monthly_invoices()') IS NOT NULL
     OR to_regprocedure('public.fn_settle_open_invoices()') IS NOT NULL THEN
    RAISE EXCEPTION 'Миграция 230: остались старые версии без аргументов — вызов из крона станет неоднозначным';
  END IF;
END;
$check$;

COMMIT;

-- =====================================================================
-- РАСПИСАНИЕ НЕ ТРОГАЕТСЯ ЭТОЙ МИГРАЦИЕЙ.
--
-- Блок из 229 остаётся верным дословно: `SELECT
-- public.fn_issue_monthly_invoices()` и `SELECT
-- public.fn_settle_open_invoices()` — вызов без аргумента после этой миграции
-- по-прежнему единственный и означает «все школы». Если расписание уже
-- включено, переставлять его не нужно: pg_cron хранит текст команды, а не
-- ссылку на функцию.
-- =====================================================================

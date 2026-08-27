-- =====================================================================
-- Migration 227 — основание оплаты обучения: счета, баланс, платежи.
--
-- Заход 1 из одиннадцати (см. docs/payments/model.md). Здесь ТОЛЬКО схема:
-- четыре таблицы, пять перечислений, ограничения, правила доступа и один
-- триггер. Ни одной строки данных, ни одного задания, ни одного экрана.
--
-- МОДЕЛЬ ОДНОЙ ФРАЗОЙ. Платёж кассы НЕ гасит счёт напрямую: он пополняет
-- баланс ребёнка, а счёт гасится с баланса. Поэтому на вопрос «почему счёт не
-- оплачен» всегда есть ровно один ответ — «на балансе не хватило», и родитель
-- его видит.
--
--   намерение → платёж кассы → движение «+» → баланс → движение «−» → счёт
--
-- ПОЧЕМУ ШКОЛА БЕЗ ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ. У остальных таблиц школа
-- проставляется сама, через current_school_id(). Эта функция смотрит на
-- auth.uid(), то есть на вошедшего человека. Вебхук кассы входит НЕ как
-- человек, а служебным ключом — auth.uid() пуст, значение по умолчанию вернёт
-- NULL и запись упадёт на NOT NULL. Поэтому здесь школа обязательна и без
-- умолчания: тот, кто пишет строку, обязан её назвать. Молчаливая подстановка
-- в платежах опаснее явной ошибки.
--
-- ЧТО ЗАЩИЩАЕТ ОТ ПОРЧИ — ТРИ УНИКАЛЬНОСТИ, и это главное в миграции:
--   1) «ребёнок + месяц» на счёте — ежемесячное задание не создаст второй счёт
--      за тот же месяц, сколько бы раз ни запустилось;
--   2) «провайдер + номер транзакции кассы» на платеже — повторная доставка от
--      кассы (все три провайдера повторяют при таймауте) не создаст дубль;
--   3) «один платёж — одно пополнение» и «один счёт — одно погашение» на
--      движениях — третий рубеж на случай ошибки уже в нашем коде.
--
-- СТАРЫЕ payments И charges НЕ ТРОГАЮТСЯ. Решение заказчика: они пусты, на них
-- висят два запроса на чтение, снесём отдельным заходом, когда новая модель
-- заработает.
--
-- ПРИМЕНЕНИЕ РУЧНОЕ. Строку реестра в теле файла не пишем: её вставляет
-- apply-migration.mjs внутри своей транзакции, и собственный INSERT дал бы
-- нарушение уникальности и откат всей миграции.
-- =====================================================================

BEGIN;

-- ── 1. Перечисления ──────────────────────────────────────────────────────
-- Состояние счёта. «Отменён» — это не «оплачен» и не «висит»: так админ
-- закрывает счёт, выставленный по ошибке, не удаляя историю.
CREATE TYPE public.invoice_status AS ENUM ('open', 'paid', 'canceled');

-- Вид движения по балансу. 'adjustment' — ручная правка админом (в обе
-- стороны), 'refund' — возврат денег наружу.
CREATE TYPE public.balance_entry_kind AS ENUM ('topup', 'invoice_charge', 'adjustment', 'refund');

-- Три провайдера сразу, хотя делаем пока Payme: значение в перечислении стоит
-- дешевле, чем ALTER TYPE в бою, а каркас заявлен под трёх.
CREATE TYPE public.payment_provider AS ENUM ('payme', 'click', 'uzum');

-- Состояния транзакции Payme один в один: 1, 2, -1, -2. Названия человеческие,
-- перевод в числа протокола — дело кода вебхука.
CREATE TYPE public.payment_tx_state AS ENUM ('created', 'performed', 'canceled', 'canceled_after_perform');

-- Состояние намерения. 'expired' — родитель ушёл с кассы и не вернулся.
CREATE TYPE public.payment_intent_status AS ENUM ('pending', 'paid', 'expired', 'canceled');

-- ── 2. Публичный номер намерения ─────────────────────────────────────────
-- Кассе нужен ЦЕЛЫЙ номер заказа, а у нас все ключи — uuid. Порядковый номер
-- не годится: соседние номера можно перебрать и попасть в чужой заказ.
--
-- Берём случайное 12-значное число. Занятых номеров — сотни, возможных —
-- девятьсот миллиардов; перебор бессмыслен. Это НЕ перемешанный порядковый
-- номер, как в переданных материалах: там перемешивание сделано на 32 битах, и
-- ровно на границе 32 бит у автора случилась авария — половина заказов
-- «не находилась».
--
-- Настоящая гарантия неповторимости — уникальный индекс ниже, а не эта
-- функция. Десять попыток здесь лишь избавляют вызывающего от почти всех
-- столкновений; если все десять заняты, вставка честно упадёт на уникальности,
-- и повторить её — дело кода.
CREATE OR REPLACE FUNCTION public.fn_new_payment_public_no()
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_no bigint;
BEGIN
  FOR i IN 1..10 LOOP
    v_no := 100000000000 + floor(random() * 899999999999)::bigint;
    IF NOT EXISTS (SELECT 1 FROM public.payment_intents WHERE public_no = v_no) THEN
      RETURN v_no;
    END IF;
  END LOOP;
  RETURN v_no;
END $$;

-- ── 3. Намерение оплатить ────────────────────────────────────────────────
-- Родитель нажал «Пополнить» и ввёл сумму. Счёта, на который можно сослаться,
-- в этот момент нет — пополнение идёт произвольной суммой, — поэтому кассе
-- передаётся номер намерения. По нему вебхук находит школу, ребёнка и
-- ожидаемую сумму: три ответа из одного числа.
CREATE TABLE public.payment_intents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount       numeric(12,2) NOT NULL,
  amount_tiyin bigint        NOT NULL,
  public_no    bigint        NOT NULL DEFAULT public.fn_new_payment_public_no(),
  provider     public.payment_provider      NOT NULL,
  status       public.payment_intent_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '2 hours',

  CONSTRAINT payment_intents_public_no_key UNIQUE (public_no),
  CONSTRAINT payment_intents_amount_positive     CHECK (amount > 0),
  CONSTRAINT payment_intents_tiyin_positive      CHECK (amount_tiyin > 0),
  -- Тийины существуют ровно на границе с кассой. Здесь база следит, что сумма
  -- в сумах и сумма в тийинах не разъехались: ошибка в переводе даёт
  -- расхождение ровно в сто раз и вылезает не сразу, а на сверке в вебхуке.
  CONSTRAINT payment_intents_tiyin_matches_amount CHECK (amount_tiyin::numeric = round(amount * 100)),
  CONSTRAINT payment_intents_public_no_shape      CHECK (public_no BETWEEN 100000000000 AND 999999999999)
);

CREATE INDEX idx_payment_intents_student ON public.payment_intents (student_id, created_at DESC);
CREATE INDEX idx_payment_intents_school  ON public.payment_intents (school_id);
CREATE INDEX idx_payment_intents_pending ON public.payment_intents (status, expires_at) WHERE status = 'pending';

-- ── 4. Платёж провайдера ─────────────────────────────────────────────────
-- Журнал протокола: что именно сказала касса и когда. Одна таблица на трёх
-- провайдеров, а не три таблицы — так советует и автор переданных материалов,
-- сделавший отдельную под Payme и пожалевший.
CREATE TABLE public.payment_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       uuid NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  student_id      uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  intent_id       uuid NOT NULL REFERENCES public.payment_intents(id) ON DELETE RESTRICT,
  provider        public.payment_provider NOT NULL,
  -- Номер транзакции на стороне кассы. Текст, а не число: у Payme это строка
  -- из двадцати четырёх знаков, у других провайдеров формат свой.
  external_id     text NOT NULL,
  state           public.payment_tx_state NOT NULL DEFAULT 'created',
  reason          integer NULL,
  amount          numeric(12,2) NOT NULL,
  amount_tiyin    bigint        NOT NULL,
  -- Времена кассы приходят в миллисекундах и хранятся как есть: переводить их
  -- в наши отметки времени значит терять то, что можно предъявить в споре.
  created_time_ms bigint NULL,
  perform_time_ms bigint NULL,
  cancel_time_ms  bigint NULL,
  -- Поля счёта, как их прислала касса, целиком. Нужны для GetStatement и для
  -- разбора спорных случаев.
  account         jsonb NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- ГЛАВНАЯ ЗАЩИТА ОТ ПОВТОРНОЙ ДОСТАВКИ. Все три провайдера повторяют вызов,
  -- если не дождались ответа. Второй записи о том же платеже база не создаст.
  CONSTRAINT payment_transactions_provider_external_key UNIQUE (provider, external_id),
  CONSTRAINT payment_transactions_amount_positive       CHECK (amount > 0),
  CONSTRAINT payment_transactions_tiyin_positive        CHECK (amount_tiyin > 0),
  CONSTRAINT payment_transactions_tiyin_matches_amount  CHECK (amount_tiyin::numeric = round(amount * 100)),
  -- Отменённая транзакция обязана нести время отмены, проведённая — время
  -- проведения. Иначе «отменена» и «отменена, но неизвестно когда» стали бы
  -- одним и тем же состоянием.
  CONSTRAINT payment_transactions_perform_time CHECK (
    state <> 'performed' OR perform_time_ms IS NOT NULL),
  CONSTRAINT payment_transactions_cancel_time CHECK (
    state NOT IN ('canceled', 'canceled_after_perform') OR cancel_time_ms IS NOT NULL)
);

CREATE INDEX idx_payment_transactions_intent  ON public.payment_transactions (intent_id);
CREATE INDEX idx_payment_transactions_student ON public.payment_transactions (student_id, created_at DESC);
CREATE INDEX idx_payment_transactions_school  ON public.payment_transactions (school_id);
-- Для прохода, отменяющего зависшие: Payme требует, чтобы транзакция,
-- провисевшая без подтверждения 12 часов, отменила себя сама.
CREATE INDEX idx_payment_transactions_stale   ON public.payment_transactions (state, created_at)
  WHERE state = 'created';

-- ── 5. Счёт за месяц ─────────────────────────────────────────────────────
CREATE TABLE public.tuition_invoices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     uuid NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  student_id    uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- Из какой группы взята цена. RESTRICT, а не CASCADE: удаление группы не
  -- должно уносить историю выставленных счетов.
  group_id      uuid NOT NULL REFERENCES public.groups(id) ON DELETE RESTRICT,
  period_month  date NOT NULL,
  -- Сумма КОПИРУЕТСЯ в счёт, а не берётся из цены группы каждый раз. Иначе
  -- админ, поднявший цену в декабре, задним числом изменил бы все счета за
  -- год. Это же даёт возможность править сумму одного счёта, не трогая
  -- остальные.
  amount        numeric(12,2) NOT NULL,
  amount_source text NOT NULL DEFAULT 'group_price',
  adjusted_by   uuid NULL REFERENCES public.admins(id) ON DELETE SET NULL,
  adjusted_at   timestamptz NULL,
  adjust_reason text NULL,
  status        public.invoice_status NOT NULL DEFAULT 'open',
  paid_at       timestamptz NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- ГЛАВНАЯ ЗАЩИТА ВСЕЙ КОНСТРУКЦИИ. Сколько бы раз ни запустилось
  -- ежемесячное задание — вручную, повторно, дважды за ночь — второго счёта за
  -- тот же месяц не появится.
  CONSTRAINT tuition_invoices_student_month_key UNIQUE (student_id, period_month),
  CONSTRAINT tuition_invoices_amount_not_negative CHECK (amount >= 0),
  -- Месяц обязан быть первым числом: иначе «июль» и «июль» окажутся разными
  -- датами и уникальность выше просто не сработает.
  CONSTRAINT tuition_invoices_period_is_first_day CHECK (
    period_month = date_trunc('month', period_month::timestamp)::date),
  CONSTRAINT tuition_invoices_amount_source CHECK (
    amount_source IN ('group_price', 'admin_adjusted')),
  -- Оплачен ровно тогда, когда есть время оплаты. Два признака одного факта
  -- обязаны совпадать, иначе они разъедутся.
  CONSTRAINT tuition_invoices_paid_has_time CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
  -- Правленый счёт обязан помнить, кто и когда его правил.
  CONSTRAINT tuition_invoices_adjusted_has_author CHECK (
    (amount_source = 'admin_adjusted') = (adjusted_by IS NOT NULL AND adjusted_at IS NOT NULL))
);

CREATE INDEX idx_tuition_invoices_student ON public.tuition_invoices (student_id, period_month DESC);
CREATE INDEX idx_tuition_invoices_school  ON public.tuition_invoices (school_id, status);
-- Для прохода, гасящего открытые счета: от старого к новому.
CREATE INDEX idx_tuition_invoices_open    ON public.tuition_invoices (status, period_month)
  WHERE status = 'open';

-- ── 6. Движение по балансу ───────────────────────────────────────────────
-- Единственный источник правды о балансе. students.balance остаётся, но
-- становится быстрым слепком, который пересчитывает триггер ниже.
CREATE TABLE public.balance_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      uuid NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  student_id     uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- Со знаком: плюс — пришло, минус — ушло. Нулевого движения не бывает.
  amount         numeric(12,2) NOT NULL,
  kind           public.balance_entry_kind NOT NULL,
  invoice_id     uuid NULL REFERENCES public.tuition_invoices(id)     ON DELETE RESTRICT,
  transaction_id uuid NULL REFERENCES public.payment_transactions(id) ON DELETE RESTRICT,
  note           text NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT balance_entries_amount_not_zero CHECK (amount <> 0),
  -- Погашение счёта обязано ссылаться на счёт и уменьшать баланс.
  CONSTRAINT balance_entries_charge_shape CHECK (
    kind <> 'invoice_charge' OR (invoice_id IS NOT NULL AND amount < 0)),
  -- Пополнение обязано ссылаться на платёж и увеличивать баланс.
  CONSTRAINT balance_entries_topup_shape CHECK (
    kind <> 'topup' OR (transaction_id IS NOT NULL AND amount > 0)),
  -- Возврат уменьшает баланс.
  CONSTRAINT balance_entries_refund_shape CHECK (kind <> 'refund' OR amount < 0)
);

-- Один счёт гасится ровно один раз. Частичный индекс, а не ограничение:
-- ссылка на счёт бывает пустой у пополнений.
CREATE UNIQUE INDEX uq_balance_entries_invoice_charge
  ON public.balance_entries (invoice_id) WHERE kind = 'invoice_charge';

-- Один платёж пополняет баланс ровно один раз. Третий рубеж защиты от
-- повторной доставки — на случай, когда первые два обошла наша же ошибка.
CREATE UNIQUE INDEX uq_balance_entries_topup
  ON public.balance_entries (transaction_id) WHERE kind = 'topup';

CREATE INDEX idx_balance_entries_student ON public.balance_entries (student_id, created_at DESC);
CREATE INDEX idx_balance_entries_school  ON public.balance_entries (school_id);

-- ── 7. Баланс: слепок, который держит себя сам ───────────────────────────
-- Баланс НИКОГДА не читается и не переписывается: две одновременные операции
-- потеряли бы одну из них. Здесь только прибавление, а его база делает
-- неделимо — под замком строки ученика.
CREATE OR REPLACE FUNCTION public.fn_apply_balance_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.students
     SET balance = balance + NEW.amount
   WHERE id = NEW.student_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Движение по балансу ссылается на несуществующего ученика %', NEW.student_id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_apply_balance_entry
AFTER INSERT ON public.balance_entries
FOR EACH ROW EXECUTE FUNCTION public.fn_apply_balance_entry();

-- Журнал только пополняется. Ошиблись — добавляется обратная строка, а не
-- правится старая. Триггер стоит НАД правилами доступа: он остановит и
-- служебный ключ, для которого правила не действуют.
CREATE OR REPLACE FUNCTION public.fn_balance_entries_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'Движения по балансу нельзя править и удалять — добавьте обратную строку'
    USING ERRCODE = 'P0001';
END $$;

CREATE TRIGGER trg_balance_entries_append_only
BEFORE UPDATE OR DELETE ON public.balance_entries
FOR EACH ROW EXECUTE FUNCTION public.fn_balance_entries_append_only();

-- ── 8. Две проверки на существующих таблицах ─────────────────────────────
-- Обе безболезненны: сегодня у всех семи групп цена 0 и у всех учеников
-- баланс 0.00.

-- Последний рубеж правила «баланс не уходит в минус». Даже если ошибётся код,
-- база не пустит.
ALTER TABLE public.students
  ADD CONSTRAINT students_balance_not_negative CHECK (balance >= 0);

ALTER TABLE public.groups
  ADD CONSTRAINT groups_course_price_not_negative CHECK (course_price >= 0);

-- ── 9. Правила доступа ───────────────────────────────────────────────────
-- Образец взят с существующих payments/charges, слово в слово: родитель видит
-- своих детей, ученик — себя, админ — свою школу, суперадмин — всё на чтение.
ALTER TABLE public.tuition_invoices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balance_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Счета: ученик, родитель, админ своей школы.
CREATE POLICY "student reads own invoices" ON public.tuition_invoices
  FOR SELECT USING (
    (student_id = current_student_id() AND school_id = current_school_id())
    OR is_super_admin());

CREATE POLICY "parent and admin read invoices" ON public.tuition_invoices
  FOR SELECT USING (
    is_my_child(student_id)
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin());

-- Движения по балансу: те же трое.
CREATE POLICY "student reads own balance entries" ON public.balance_entries
  FOR SELECT USING (
    (student_id = current_student_id() AND school_id = current_school_id())
    OR is_super_admin());

CREATE POLICY "parent and admin read balance entries" ON public.balance_entries
  FOR SELECT USING (
    is_my_child(student_id)
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin());

-- Намерения: родитель видит свои, чтобы экран ожидания знал, чем кончилось.
-- Ученику намерения не показываем: платит родитель.
CREATE POLICY "parent and admin read intents" ON public.payment_intents
  FOR SELECT USING (
    is_my_child(student_id)
    OR (school_id = current_school_id() AND fn_is_admin())
    OR is_super_admin());

-- Платежи провайдера НЕ ЧИТАЕТ НИКТО ИЗ ЛЮДЕЙ. Это технический журнал
-- протокола: родителю он ничего не объясняет, а хранит внешние номера
-- транзакций. Родитель видит результат — движение по балансу и состояние
-- счёта. Единственное правило — для суперадмина, ради сверки по школам.
CREATE POLICY "superadmin reads transactions" ON public.payment_transactions
  FOR SELECT USING (is_super_admin());

-- Правил на запись НЕТ НИ ОДНОГО и ни для одной роли. Пишет только служебный
-- ключ: ежемесячное задание, вебхук кассы и действия админки, которые и
-- сегодня ходят служебным ключом (см. lib/admin-api.ts). Учитель не упомянут
-- нигде — деньги не его дело.

-- ── 10. Страж суперадмина ────────────────────────────────────────────────
-- Тот же ограничительный страж, что стоит на 58 школьных таблицах с миграции
-- 222: суперадмин не пишет в школьные данные, список разрешённого пуст.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tuition_invoices', 'balance_entries', 'payment_intents', 'payment_transactions']
  LOOP
    EXECUTE format(
      'CREATE POLICY "superadmin write guard insert" ON public.%I AS RESTRICTIVE FOR INSERT
         WITH CHECK ((NOT is_super_admin()) OR sa_write_allowed(%L))', t, t);
    EXECUTE format(
      'CREATE POLICY "superadmin write guard update" ON public.%I AS RESTRICTIVE FOR UPDATE
         USING ((NOT is_super_admin()) OR sa_write_allowed(%L))
         WITH CHECK ((NOT is_super_admin()) OR sa_write_allowed(%L))', t, t, t);
    EXECUTE format(
      'CREATE POLICY "superadmin write guard delete" ON public.%I AS RESTRICTIVE FOR DELETE
         USING ((NOT is_super_admin()) OR sa_write_allowed(%L))', t, t);
  END LOOP;
END $$;

-- ── 11. Проверка, что вышло именно то, что задумано ──────────────────────
DO $$
DECLARE
  v_tables integer;
  v_guards integer;
  v_uniq   integer;
BEGIN
  SELECT count(*) INTO v_tables FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('tuition_invoices', 'balance_entries', 'payment_intents', 'payment_transactions');
  IF v_tables <> 4 THEN
    RAISE EXCEPTION 'Миграция 227: создано таблиц %, ожидалось 4', v_tables;
  END IF;

  SELECT count(*) INTO v_guards FROM pg_policies
   WHERE schemaname = 'public' AND permissive = 'RESTRICTIVE'
     AND policyname LIKE 'superadmin write guard%'
     AND tablename IN ('tuition_invoices', 'balance_entries', 'payment_intents', 'payment_transactions');
  IF v_guards <> 12 THEN
    RAISE EXCEPTION 'Миграция 227: стражей суперадмина %, ожидалось 12', v_guards;
  END IF;

  -- Три уникальности, ради которых всё и затевалось.
  SELECT count(*) INTO v_uniq FROM pg_indexes
   WHERE schemaname = 'public'
     AND indexname IN ('tuition_invoices_student_month_key',
                       'payment_transactions_provider_external_key',
                       'uq_balance_entries_invoice_charge',
                       'uq_balance_entries_topup');
  IF v_uniq <> 4 THEN
    RAISE EXCEPTION 'Миграция 227: уникальностей %, ожидалось 4', v_uniq;
  END IF;

  RAISE NOTICE 'Миграция 227: четыре таблицы, двенадцать стражей, четыре уникальности — на месте.';
END $$;

COMMIT;

-- Миграция 220: журнал действий суперадминистратора.
--
-- ЗАЧЕМ. У суперадмина пять экранов и тринадцать кнопок, которые что-то
-- меняют: школы, администраторы школ, собственные пароль и почта. Сегодня о
-- любом из этих действий не остаётся ни следа — колонок «кто изменил» в базе
-- нет ни одной, отдельного журнала тоже. Школа может исчезнуть вместе со всеми
-- данными, и узнать, кто и когда её удалил, будет неоткуда.
--
-- ГЛАВНОЕ ПРАВИЛО, НА КОТОРОМ ВСЁ ДЕРЖИТСЯ: запись делается ДО действия. Не
-- легла — действие не выполняется. Отсюда читается просто: ЗАПИСИ НЕТ, ЗНАЧИТ
-- И ДЕЙСТВИЯ НЕ БЫЛО.
--
-- Почему именно так, а не «сделали, потом записали». Откатить постфактум
-- физически нельзя: удаление школы сносит строки в базе, файлы в хранилище и
-- учётные записи в auth — три разные системы, одной транзакции над ними не
-- существует. А журнал, который можно обойти сбоем, окажется пустым ровно в
-- тот раз, когда он нужен.
--
-- ЧТО ЛОЖИТСЯ. Одна запись на действие, ставится заранее, со словом
-- «начато». Если действие потом не получилось, рядом ложится вторая — «не
-- удалось» или «отказано», со ссылкой на первую. Обновлений нет ни одного:
-- журнал только дописывается.
--
--   started  — действие начато. Без пары это и означает «выполнено»
--   done     — завершено, и у результата есть что запомнить. Ставится только
--              там, где итог несёт сведения, которых до действия не было:
--              номер заведённой школы или админа, сколько файлов и учёток
--              унесло удаление школы. Для остальных семи кнопок второй строки
--              нет — запоминать после них нечего
--   failed   — сорвалось по технической причине
--   denied   — отказала наша собственная проверка: позвал не суперадмин,
--              попытка тронуть демо-школу или демо-админа, название при
--              удалении набрано неверно
--
-- ЧЕГО ЗДЕСЬ НЕТ И НЕ БУДЕТ — СЕКРЕТОВ. Пароли, коды и токены в журнал не
-- попадают, и это не дисциплина, а устройство: функция записи ОТВЕРГАЕТ
-- подробности, среди ключей которых есть похожий на секрет, — падает с
-- ошибкой, а не вычищает молча. Тихая очистка научила бы нас ей доверять и
-- однажды подвела бы.
--
-- ЧИСТКИ НЕТ НАМЕРЕННО. Журнал, который сам себя стирает, теряет смысл именно
-- там, где нужен, — на старых следах. Роста бояться нечего: суперадмин один,
-- кнопок тринадцать, это порядка полутора тысяч записей в год, то есть пара
-- мегабайт. Крон не заводится.
--
-- ЧЕГО ЭТА МИГРАЦИЯ НЕ ЗАКРЫВАЕТ. Прав на запись у суперадмина в 54 таблицы,
-- где экрана нет вовсе. Сюда попадает только то, что сделано КНОПКАМИ. Прямое
-- изменение в базе мимо интерфейса ловится лишь триггерами на этих таблицах —
-- это отдельная большая задача. На экране журнала об этом сказано прямо,
-- чтобы пустой список не читался как «ничего не делали».

-- ── 1. Таблица ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.superadmin_journal (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),

  -- Кто. Имя хранится СНИМКОМ на момент действия: суперадмина могут
  -- переименовать, а в журнале должно остаться то, что было тогда.
  actor_user_id uuid,
  actor_name    text,

  action        text NOT NULL,
  outcome       text NOT NULL,

  -- Над чем. Название тоже снимком: после удаления школы её имя больше
  -- негде взять, а искать в журнале человек будет именно по имени.
  target_type   text,
  target_id     text,
  target_name   text,

  -- Подробности: что было и что стало — ТОЛЬКО изменённые поля. Полная копия
  -- строки раздула бы журнал и натащила бы в него лишнее.
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Ссылка на запись «начато» у строки об отказе.
  ref           bigint,

  CONSTRAINT superadmin_journal_outcome_check
    CHECK (outcome IN ('started', 'done', 'failed', 'denied')),

  -- Перечень действий закрыт НАМЕРЕННО. Появится одиннадцатая кнопка —
  -- придётся написать миграцию, и это правильно: журнал не должен молча
  -- принимать то, чего в нём договорились не заводить.
  CONSTRAINT superadmin_journal_action_check
    CHECK (action IN (
      'school.create', 'school.update', 'school.archive', 'school.delete',
      'admin.create', 'admin.update', 'admin.delete', 'admin.reset_password',
      'self.google_email', 'self.password',
      'access.denied'
    ))
);

-- Экран показывает свежее сверху и фильтрует по виду действия.
CREATE INDEX IF NOT EXISTS superadmin_journal_at_idx
  ON public.superadmin_journal (at DESC);
CREATE INDEX IF NOT EXISTS superadmin_journal_action_idx
  ON public.superadmin_journal (action, at DESC);

COMMENT ON TABLE public.superadmin_journal IS
  'Журнал действий суперадминистратора. Только дописывается: изменение и '
  'удаление отозваны у всех ролей, включая служебный ключ. Пишется ДО '
  'действия — записи нет, значит действия не было. Миграция 220.';

-- ── 2. Секреты не попадают в журнал ─────────────────────────────────────────
-- Обходит подробности НА ЛЮБОЙ глубине и падает, увидев ключ, похожий на
-- секрет. Именно падает: молчаливая очистка выглядела бы как защита, но
-- пропустила бы поле, названное чуть иначе, и никто бы не заметил.
CREATE OR REPLACE FUNCTION public.journal_assert_no_secrets(p_details jsonb)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
BEGIN
  IF p_details IS NULL THEN
    RETURN;
  END IF;

  -- Заодно потолок на размер: журнал — про решения человека, а не про свалку
  -- данных, и раздувать его подробностями незачем.
  IF length(p_details::text) > 20000 THEN
    RAISE EXCEPTION 'journal_details_too_big';
  END IF;

  FOR k IN
    WITH RECURSIVE walk(v) AS (
      SELECT p_details
      UNION ALL
      SELECT c.value
        FROM walk w
        CROSS JOIN LATERAL (
          -- CASE внутри обязателен: jsonb_each падает на не-объекте, и одним
          -- лишь WHERE его не остановить — набор строк вычисляется раньше.
          SELECT value FROM jsonb_each(
            CASE WHEN jsonb_typeof(w.v) = 'object' THEN w.v ELSE '{}'::jsonb END)
          UNION ALL
          SELECT value FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(w.v) = 'array' THEN w.v ELSE '[]'::jsonb END)
        ) c
    )
    SELECT t.key
      FROM walk w2
      CROSS JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(w2.v) = 'object' THEN w2.v ELSE '{}'::jsonb END) AS t(key, value)
  LOOP
    -- ПРО ГОЛОЕ СЛОВО «code» — ЕГО ЗДЕСЬ НЕТ, И ЭТО ОСОЗНАННО.
    -- Первый вариант списка его содержал, и холостой прогон тут же поймал
    -- беду: у школы есть колонка code — её короткий код, который человек
    -- набирает при входе, — и создание школы падало бы на ровном месте, ещё
    -- до самого создания. Секретные «коды» перечислены поимённо ниже: у них
    -- у всех есть уточняющее слово, и со школьным кодом они не путаются.
    IF lower(k) LIKE '%password%'
       OR lower(k) LIKE '%secret%'
       OR lower(k) LIKE '%token%'
       OR lower(k) IN ('pwd', 'pass', 'api_key', 'apikey', 'private_key',
                       'credentials', 'otp', 'sms_code', 'verification_code',
                       'confirmation_code', 'code_hash', 'code_plain', 'code_verifier')
    THEN
      RAISE EXCEPTION 'journal_secret_field: %', k;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.journal_assert_no_secrets(jsonb) IS
  'Отвергает подробности с ключом, похожим на секрет, на любой глубине. '
  'Падает, а не вычищает. Миграция 220.';

-- ── 3. Запись ───────────────────────────────────────────────────────────────
-- Единственный путь в таблицу. Прав на прямую вставку нет ни у кого, включая
-- служебный ключ приложения: писать можно только этой функцией и только то,
-- что она пропустит.
CREATE OR REPLACE FUNCTION public.superadmin_journal_write(
  p_action        text,
  p_outcome       text,
  p_actor_user_id uuid    DEFAULT NULL,
  p_actor_name    text    DEFAULT NULL,
  p_target_type   text    DEFAULT NULL,
  p_target_id     text    DEFAULT NULL,
  p_target_name   text    DEFAULT NULL,
  p_details       jsonb   DEFAULT '{}'::jsonb,
  p_ref           bigint  DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  PERFORM public.journal_assert_no_secrets(p_details);

  INSERT INTO public.superadmin_journal
    (actor_user_id, actor_name, action, outcome, target_type, target_id, target_name, details, ref)
  VALUES
    (p_actor_user_id, p_actor_name, p_action, p_outcome, p_target_type, p_target_id,
     p_target_name, COALESCE(p_details, '{}'::jsonb), p_ref)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.superadmin_journal_write(text, text, uuid, text, text, text, text, jsonb, bigint) IS
  'Единственный путь записи в журнал. Отвергает секреты и неизвестные виды '
  'действий. Зовёт только служебный ключ с сервера. Миграция 220.';

-- ── 4. Подделать, стереть и подправить — нельзя ─────────────────────────────
-- Правил доступа нет ни одного: анониму и вошедшему таблица недоступна вовсе.
ALTER TABLE public.superadmin_journal ENABLE ROW LEVEL SECURITY;

-- Служебный ключ приложения обходит правила доступа (BYPASSRLS), но НЕ обходит
-- отзыв прав — на этом и держится защита. Ему остаётся ровно чтение: экран
-- журнала должен уметь показать записи.
REVOKE ALL ON TABLE public.superadmin_journal FROM PUBLIC;
REVOKE ALL ON TABLE public.superadmin_journal FROM anon, authenticated, service_role;
GRANT SELECT ON TABLE public.superadmin_journal TO service_role;

REVOKE ALL ON FUNCTION public.superadmin_journal_write(text, text, uuid, text, text, text, text, jsonb, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_journal_write(text, text, uuid, text, text, text, text, jsonb, bigint) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_journal_write(text, text, uuid, text, text, text, text, jsonb, bigint) TO service_role;

REVOKE ALL ON FUNCTION public.journal_assert_no_secrets(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.journal_assert_no_secrets(jsonb) FROM anon, authenticated;

-- ЧЕСТНАЯ ОГОВОРКА, КОТОРУЮ НАДО ЗНАТЬ. Всё выше защищает журнал от
-- приложения и от суперадмина в интерфейсе. От человека с доступом к самой
-- базе — к SQL-редактору Supabase — не защищает и не может: он владелец, и
-- отобрать права у самого себя нельзя. Заказчик об этом предупреждён.

NOTIFY pgrst, 'reload schema';

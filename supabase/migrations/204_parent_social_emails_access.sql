-- Миграция 204: почта Google и Apple у родителя — только для администратора.
--
-- ЗАЧЕМ. Миграция 201 добавила в public.parents колонки google_email и
-- apple_email. Задумано это как будущий ключ входа через Google. Но правила
-- доступа к таблице писались, когда в строке лежали только имя и телефон, и
-- новые колонки молча унаследовали их. Проверено живыми запросами до правки:
--
--   1) ПОЛИТИКА «parent updates own record» (миграция 74) —
--      USING/WITH CHECK (user_id = auth.uid() OR (school_id = current_school_id()
--      AND fn_is_admin()) OR is_super_admin()).
--      Ограничения по колонкам у политик нет в принципе: разрешено менять
--      строку — значит разрешено менять ЛЮБУЮ её колонку. То есть родитель мог
--      сам вписать себе google_email. Когда почта станет ключом входа, это
--      означало бы «сам себе выдал право входа по выбранному адресу».
--
--   2) ПОЛИТИКА «parent reads co-participant parent names» (миграция 82) —
--      «вижу родителя, с которым состою в одном чат-треде». Отдаёт СТРОКУ
--      целиком, а с 201 в строке лежат обе почты (и телефон, который был там
--      и раньше). Приложению из этой строки нужны ровно два поля: user_id и
--      full_name (packages/core/src/queries/chat.ts) — но запросить можно было
--      любое.
--
-- ПОЧЕМУ НЕ КОЛОНОЧНЫЕ ПРАВА. Напрашивается REVOKE UPDATE (google_email) —
-- но у authenticated стоит грант на ВСЮ таблицу, а при табличном гранте
-- колоночный REVOKE не действует. Пришлось бы отобрать право на таблицу и
-- выдать заново поимённо по колонкам; тогда каждый будущий ALTER TABLE ADD
-- COLUMN тихо оставался бы недоступным до отдельного GRANT. Слишком хрупко.
--
-- ЧТО НЕ ЛОМАЕТСЯ. Проверено по коду перед правкой: единственное место во всём
-- репозитории, которое вообще пишет в public.parents — updateParent в
-- apps/web/lib/admin-api.ts, и идёт оно служебным ключом из админской формы.
-- Родительские экраны (веб и мобильный) в свою строку не пишут ничего: право
-- на изменение у родителя есть, а кода, который бы им пользовался, нет.
-- Поэтому запрет ниже сделан узким — только две колонки — и то, что родитель
-- начнёт править завтра, он править сможет.

-- ── 1. Почты вписывает только администратор школы ───────────────────────────
-- Триггер, а не политика: политика работает построчно и запретила бы вместе с
-- почтой всю остальную строку. Тот же приём, что в миграции 203.
CREATE OR REPLACE FUNCTION public.fn_guard_parent_social_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Почты не тронуты — правило не про эту правку.
  IF NEW.google_email IS NOT DISTINCT FROM OLD.google_email
     AND NEW.apple_email IS NOT DISTINCT FROM OLD.apple_email THEN
    RETURN NEW;
  END IF;

  -- Без пользовательской сессии: служебный ключ (админская форма ходит именно
  -- так — apps/web/lib/admin-api.ts::getServiceClient), миграции, крон.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Администратор своей школы (и суперадмин) — можно.
  IF public.is_school_admin_of(NEW.school_id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'parent_social_email_admin_only'
    USING HINT = 'Почту Google и Apple ID у родителя вписывает администратор школы.';
END;
$$;

COMMENT ON FUNCTION public.fn_guard_parent_social_emails() IS
  'Родитель не может вписать себе google_email/apple_email — иначе он сам себе '
  'выдаёт право входа по выбранному адресу. Остальные колонки своей строки '
  'родитель меняет как и раньше.';

DROP TRIGGER IF EXISTS trg_guard_parent_social_emails ON public.parents;
CREATE TRIGGER trg_guard_parent_social_emails
  BEFORE UPDATE ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_parent_social_emails();

-- ── 2. Имя собеседника — да, его почта — нет ────────────────────────────────
-- Политику из 82 заменяем представлением ровно с двумя колонками. Условие
-- «мы состоим в одном треде» переезжает внутрь представления слово в слово.
--
-- Представление НАМЕРЕННО не security_invoker: владелец (postgres) обходит RLS,
-- поэтому широкая политика на parents больше не нужна, а отбор делает сам текст
-- представления. Колонок с почтой в нём нет — запросить их неоткуда.
--
-- security_barrier — чтобы отбор «мы в одном треде» нельзя было обойти дешёвой
-- функцией в WHERE, которая выполнится раньше условия представления и вытащит
-- имена родителей из чужих тредов.
CREATE OR REPLACE VIEW public.chat_parent_names WITH (security_barrier = true) AS
  SELECT p.user_id, p.full_name
  FROM public.parents p
  WHERE EXISTS (
    SELECT 1
    FROM public.chat_participants cp1
    JOIN public.chat_participants cp2 ON cp1.thread_id = cp2.thread_id
    WHERE cp1.user_id = p.user_id
      AND cp2.user_id = auth.uid()
  );

COMMENT ON VIEW public.chat_parent_names IS
  'Имена родителей для чата: только те, с кем текущий пользователь состоит в '
  'общем треде, и только user_id + full_name. Заменяет политику '
  '"parent reads co-participant parent names", которая отдавала строку целиком.';

-- Отбираем ВСЁ и выдаём обратно только чтение. Отбирать обязательно: в проекте
-- стоят ALTER DEFAULT PRIVILEGES, которые выдают anon и authenticated полный
-- набор прав на каждый новый объект в public. Для этого представления это было
-- бы дырой хуже исходной: представление построено на одной таблице, значит оно
-- обновляемое, а владелец (postgres) обходит RLS — то есть через него можно
-- было бы переименовать или удалить строку соседа по чату в обход всех политик.
-- Проверено живым UPDATE до этой правки: проходил.
REVOKE ALL ON public.chat_parent_names FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.chat_parent_names TO authenticated;

-- Теперь чужую строку в parents родитель не читает вовсе: остаётся только
-- «parent reads own record» (своя строка, плюс администратор своей школы и
-- суперадмин). Админский просмотр чатов ходит по админской ветке той же
-- политики и этой правкой не задет.
DROP POLICY IF EXISTS "parent reads co-participant parent names" ON public.parents;

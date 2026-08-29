-- Миграция 235 — имя администратора видно тому, с кем он в одной переписке.
--
-- ЧТО НАЙДЕНО. У public.admins ровно ОДНО правило чтения, и родительской
-- ветки в нём нет:
--
--   "admin reads own record":
--     (user_id = auth.uid() AND school_id = current_school_id()) OR is_super_admin()
--
-- Проверено живьём от роли authenticated с подставленным токеном настоящего
-- родителя боевой школы: SELECT из public.admins возвращает ему НОЛЬ строк.
-- Ни одной, включая админа собственной школы.
--
-- ЧЕМ ЭТО ЛОМАЕТ СОГЛАСОВАННОЕ. Имена участников чата собираются ровно из
-- трёх источников: public.teachers, public.students и представления
-- chat_parent_names (миграция 204). Источника имён администратора среди них
-- НЕТ. Значит в комнате поддержки (миграция 234) родитель увидел бы ответы с
-- пустым именем отправителя — а решение заказчика было «двоих одновременно
-- отвечающих не блокируем, показываем имя отправителя у каждого сообщения».
-- Без имени это решение не работает: родитель не отличит одного админа от
-- другого, а у боевой школы их трое.
--
-- ПОЧЕМУ ПРЕДСТАВЛЕНИЕ, А НЕ НОВОЕ ПРАВИЛО НА ТАБЛИЦЕ. Правило на admins
-- пустило бы строку ЦЕЛИКОМ: построчные правила Postgres колонок не
-- различают, а в строке лежат логин (username) и почта для входа через
-- Google. Родителю нужно одно поле — имя. Поэтому наружу отдаётся
-- представление ровно из двух колонок, а правило на самой таблице не
-- трогается вовсе и остаётся закрытым.
--
-- ЭТО ПОВТОРЕНИЕ УЖЕ ПРИНЯТОГО РЕШЕНИЯ. Миграция 204 сделала ровно это же
-- для родителей: chat_parent_names отдаёт user_id и full_name тем, кто с этим
-- родителем в одной переписке. Здесь тот же отбор, те же две колонки, тот же
-- security_barrier, то же право SELECT для authenticated. Расхождение с 204
-- было бы хуже совпадения: два похожих представления с разными правилами
-- рано или поздно разъедутся.
--
-- КТО ЧТО УВИДИТ. Отбор один: «мы с этим админом состоим в одной переписке».
-- Вида чата он не касается вовсе, поэтому работает и для комнат поддержки из
-- 234, и для любых будущих. Кто с админом нигде не пересекается — получает
-- ноль строк: и учитель, и родитель другой школы, и админ другой школы.

CREATE OR REPLACE VIEW public.chat_admin_names
WITH (security_barrier = true) AS
  SELECT a.user_id,
         a.full_name
    FROM public.admins a
   WHERE EXISTS (
     SELECT 1
       FROM public.chat_participants cp1
       JOIN public.chat_participants cp2 ON cp1.thread_id = cp2.thread_id
      WHERE cp1.user_id = a.user_id
        AND cp2.user_id = auth.uid()
   );

COMMENT ON VIEW public.chat_admin_names IS
  'Имя администратора для тех, кто с ним в одной переписке. Две колонки '
  'вместо строки целиком: в admins лежат логин и почта для входа. '
  'Правило чтения самой таблицы admins не менялось. Близнец '
  'chat_parent_names из миграции 204.';

-- ПРАВА: СНАЧАЛА ОТОБРАТЬ, ПОТОМ ВЫДАТЬ. Это не перестраховка — без REVOKE
-- здесь дыра, найденная холостым прогоном этой самой миграции.
--
-- В Supabase на схему public выставлены ALTER DEFAULT PRIVILEGES, и новый
-- объект, созданный ролью postgres, СРАЗУ получает anon и authenticated с
-- полным набором прав, включая INSERT/UPDATE/DELETE. Для обычной таблицы это
-- безобидно: её прикрывает RLS. Здесь — нет, и по двум причинам сразу:
--
--   * представление простое, поэтому Postgres считает его автообновляемым
--     (information_schema.views.is_insertable_into = YES);
--   * владелец представления — postgres, security_invoker не выставлен,
--     значит обращение к public.admins идёт от владельца и правила доступа
--     на admins НЕ ПРИМЕНЯЮТСЯ.
--
-- Вместе это значит, что вошедший мог бы писать в public.admins прямо через
-- представление — завести себе администратора. Прогон показал у нового
-- представления ровно этот набор прав, а у близнеца из 204 — только SELECT
-- для authenticated и ничего для anon. Приводим к тому же.
REVOKE ALL ON public.chat_admin_names FROM PUBLIC;
REVOKE ALL ON public.chat_admin_names FROM anon;
REVOKE ALL ON public.chat_admin_names FROM authenticated;
GRANT SELECT ON public.chat_admin_names TO authenticated;

-- ── ПРОВЕРКИ ПОСЛЕ ПРИМЕНЕНИЯ ────────────────────────────────────────
--
-- 1. Представление есть, колонок ровно две. Ждём user_id и full_name.
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='chat_admin_names'
--  ORDER BY ordinal_position;
--
-- 2. Настройки совпадают с chat_parent_names. Ждём security_barrier=true
--    у обоих.
--
-- SELECT relname, reloptions FROM pg_class
--  WHERE relname IN ('chat_admin_names','chat_parent_names');
--
-- 3. Права: у authenticated РОВНО SELECT, у anon НИ ОДНОГО. Сверить с
--    близнецом из 204 — наборы должны совпасть до строки.
--
-- SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS права
--   FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name IN ('chat_admin_names','chat_parent_names')
--    AND grantee IN ('anon','authenticated','PUBLIC')
--  GROUP BY table_name, grantee ORDER BY table_name, grantee;
--
-- 4. Правило чтения самой таблицы admins НЕ изменилось. Ждём ровно одно
--    правило с прежним текстом.
--
-- SELECT policyname, qual FROM pg_policies
--  WHERE schemaname='public' AND tablename='admins' AND cmd='SELECT';
--
-- 5. Пока админы ни в одной переписке не состоят, представление пусто для
--    всех — это верно, а не поломка. Строки появятся, когда админ окажется
--    в комнате: комнаты поддержки заводит функция из миграции 234.
--
-- SELECT count(*) AS строк FROM public.chat_admin_names;

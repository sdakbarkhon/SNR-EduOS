-- Миграция 198: родитель видит ИМЯ администратора своей школы — и только имя.
--
-- ЧТО БЫЛО СЛОМАНО. На объявлениях от администрации автор приходил пустым, и
-- оба приложения подставляли запасное «Администрация школы». Причина найдена
-- чтением каталога: на public.admins защита строк включена, а политика чтения
-- ровно одна —
--     "admin reads own record" [SELECT] для authenticated:
--     USING ((user_id = auth.uid() AND school_id = current_school_id())
--            OR is_super_admin())
-- Родитель не подходит ни под одно из условий и получает НОЛЬ строк. Проверено
-- под настоящей сессией родителя: select("*"), select("id, full_name") и
-- select("id, full_name, school_id") — все три возвращают пустой список.
--
-- ЧЕГО ДЕЛАТЬ БЫЛО НЕЛЬЗЯ.
--
--  1. Добавить родителю политику на саму таблицу. Защита строк работает
--     ПОСТРОЧНО, а не поколоночно: вместе с ФИО родитель получил бы `user_id`
--     (связь с учётной записью) и `username` — ЛОГИН администратора, которым
--     тот входит в админ-панель (миграция 194). Это прямая утечка.
--
--  2. Отозвать у роли authenticated права на отдельные колонки. Колоночные
--     права общие для всей роли: под них попал бы и сам администратор, и
--     `select("*")` в админ-панели (app/admin/layout.tsx, admin/profile,
--     lib/admin-api.ts) перестал бы работать.
--
-- ЧТО СДЕЛАНО. Вычисляемое поле у самих объявлений: функция от строки
-- `announcements`, возвращающая ОДНУ строку текста — ФИО администратора. Ни
-- новой читаемой таблицы, ни представления, ни единого лишнего поля.
--
--  • отдаётся ровно одно значение — full_name; user_id, username, created_at
--    и school_id администратора недостижимы никаким запросом;
--  • только для объявления, которое спрашивающий И ТАК уже читает (функция
--    вызывается на уже прошедшей через RLS строке);
--  • только для администратора СВОЕЙ школы — `school_id = current_school_id()`;
--    у администратора чужой школы функция вернёт NULL, и приложение подставит
--    прежнее запасное «Администрация школы»;
--  • у объявления от учителя (admin_id IS NULL) — NULL, как и было.
--
-- Базовая политика public.admins не тронута ни одной строкой: всё, что было
-- закрыто, закрыто по-прежнему.

CREATE OR REPLACE FUNCTION public.admin_name(public.announcements)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.full_name
  FROM public.admins a
  WHERE a.id = $1.admin_id
    AND a.school_id = public.current_school_id()
$$;

COMMENT ON FUNCTION public.admin_name(public.announcements) IS
  'Вычисляемое поле PostgREST: ФИО автора-администратора объявления. Отдаёт '
  'только имя и только для администратора школы спрашивающего; для чужой школы '
  'и для объявлений учителей — NULL. Заведено миграцией 198, чтобы родитель '
  'видел автора, не получив доступа к строке admins (там лежит логин админа).';

-- Права: выполнять может только вошедший пользователь.
--
-- `REVOKE ... FROM PUBLIC` одного мало: у Supabase на схему public настроены
-- права по умолчанию, которые выдают EXECUTE новым функциям ЯВНО ролям anon,
-- authenticated и service_role. Явный грант снимается только явным отзывом —
-- проверено холостым прогоном: после одного лишь REVOKE FROM PUBLIC в списке
-- прав оставалось «anon=X/postgres», и аноним функцию вызывал.
REVOKE ALL ON FUNCTION public.admin_name(public.announcements) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_name(public.announcements) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_name(public.announcements) TO authenticated;

-- PostgREST держит схему в кэше — без этого вычисляемое поле не появится в API
-- до следующей перезагрузки сервиса.
NOTIFY pgrst, 'reload schema';

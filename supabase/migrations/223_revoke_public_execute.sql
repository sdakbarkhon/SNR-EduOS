-- Миграция 223: пять функций базы больше нельзя позвать с улицы.
--
-- ЗАЧЕМ. У этих пяти функций право выполнения стояло у PUBLIC, у anon и у
-- authenticated. Открытый ключ Supabase лежит в исходниках страницы — значит
-- позвать их мог любой, кто открыл сайт. Все пять объявлены SECURITY DEFINER,
-- то есть работают от владельца и правила доступа к таблицам обходят: там,
-- где обычному человеку запись запрещена, вызов такой функции её выполняет.
--
-- ЧТО МОГ ПОСТОРОННИЙ, по возрастанию тяжести:
--
--   fn_auto_start_lessons, fn_auto_end_lessons — запустить и закрыть уроки
--     раньше срока. Само по себе это делает задание раз в минуту, поэтому
--     чужой вызов лишь ускоряет на минуту. Но закрытие урока РАЗДАЁТ
--     автоматические прогулы всем неотмеченным, и раздаст их до звонка.
--
--   fn_cleanup_expired_announcements — удалить просроченные объявления обеих
--     школ. Тоже делает задание, раз в сутки в 02:00.
--
--   fn_ensure_direct_chat — СОБРАТЬ ЛИЧНЫЙ ЧАТ между любым учеником и любым
--     учителем, в том числе из РАЗНЫХ школ: функция берёт школу из строки
--     ученика и не проверяет ни школу учителя, ни то, что зовущий — один из
--     двоих. Сама себя не воспроизводит: ни одно задание её не зовёт.
--
--   notify_user_and_parents — прислать ученику и ВСЕМ ЕГО РОДИТЕЛЯМ
--     уведомление с любым заголовком и текстом, которое выглядит как
--     школьное. Подделка чистая: сама такая строка не появится никогда.
--
-- Последние две — настоящая дыра, первые три — ускорение того, что и так
-- произойдёт.
--
-- ПОЧЕМУ БЕЗОПАСНО ЗАКРЫВАТЬ. Настоящих вызывающих у этих пяти ровно два
-- вида, и оба право сохраняют:
--
--   1. ЗАДАНИЯ В БАЗЕ. Три задания pg_cron (auto-start-lessons,
--      auto-end-lessons, cleanup-expired-announcements) заведены под ролью
--      postgres — проверено полем username в cron.job. postgres здесь
--      владелец функций, и право у владельца не отбирается.
--
--   2. ТРИГГЕРЫ. notify_user_and_parents зовут восемь триггерных функций
--      (оповещения об оценке, домашке, материале, объявлении, уроке,
--      решении по заявлению), fn_ensure_direct_chat — три (создание группы,
--      смена куратора, добавление ученика в группу). ВСЕ ОДИННАДЦАТЬ
--      объявлены SECURITY DEFINER: внутри такой функции действующим
--      пользователем считается её владелец, то есть postgres, и вложенный
--      вызов проверяется по его правам, а не по правам вошедшего. Отзыв у
--      anon и authenticated на них не влияет.
--
--   3. НАШЕГО КОДА СРЕДИ ВЫЗЫВАЮЩИХ НЕТ ВОВСЕ. Поиск по apps/ и packages/
--      не нашёл ни одного вызова этих пяти имён — ни пользовательским
--      клиентом, ни служебным.
--
-- ПОЧЕМУ ОТЗЫВ ИДЁТ И У PUBLIC, А НЕ ТОЛЬКО У ДВУХ РОЛЕЙ. В правах каждой из
-- пяти сейчас записано «=X/postgres» — это и есть выдача всем (PUBLIC), она
-- добавляется поверх именных. Снять только anon и authenticated мало: PUBLIC
-- продолжил бы пускать их обеих. Поэтому снимаем сначала у PUBLIC, потом
-- именно у этих двух ролей — на случай, если именная выдача переживёт первый
-- отзыв.
--
-- ЧЕГО ЭТА МИГРАЦИЯ НЕ ДЕЛАЕТ. Тела функций не тронуты ни одной буквой:
-- автостарт и автозавершение уроков работают ровно как вчера, чистка
-- объявлений по-прежнему без фильтра школы (это отдельная задача заказчика),
-- правила доступа к таблицам не тронуты (их закрыла миграция 222).

BEGIN;

-- ── 1. Уроки: старт и завершение ────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.fn_auto_start_lessons() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_auto_start_lessons() FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_auto_end_lessons() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_auto_end_lessons() FROM anon, authenticated;

-- ── 2. Чистка просроченных объявлений ───────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.fn_cleanup_expired_announcements() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_cleanup_expired_announcements() FROM anon, authenticated;

-- ── 3. Личный чат ученик ↔ учитель ──────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.fn_ensure_direct_chat(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_ensure_direct_chat(uuid, uuid) FROM anon, authenticated;

-- ── 4. Уведомление ученику и его родителям ──────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.notify_user_and_parents(uuid, text, text, text, text, uuid)
  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_user_and_parents(uuid, text, text, text, text, uuid)
  FROM anon, authenticated;

-- ── 5. Служебная роль остаётся ──────────────────────────────────────────────
-- Сейчас у неё право уже есть, но выдаём явно: чтобы завтрашний серверный
-- вызов не упёрся в отказ, если именную выдачу когда-нибудь снесут заодно.
-- service_role ходит только со стороны сервера, её ключ в браузер не попадает.
GRANT EXECUTE ON FUNCTION public.fn_auto_start_lessons() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_auto_end_lessons() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_expired_announcements() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_ensure_direct_chat(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_user_and_parents(uuid, text, text, text, text, uuid)
  TO service_role;

COMMIT;

-- ── После применения проверить руками ───────────────────────────────────────
--   SELECT proname, array_to_string(proacl, ' ')
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND proname IN ('fn_auto_start_lessons', 'fn_auto_end_lessons',
--                      'fn_cleanup_expired_announcements',
--                      'fn_ensure_direct_chat', 'notify_user_and_parents');
--   Ожидание: в каждой строке остались только postgres=X/postgres и
--   service_role=X/postgres. Ни «=X/», ни anon, ни authenticated.
--
--   И через минуту после применения — что задания живы:
--   SELECT jobname, status, end_time FROM cron.job_run_details d
--     JOIN cron.job j USING (jobid) ORDER BY end_time DESC LIMIT 5;
--   Ожидание: succeeded.

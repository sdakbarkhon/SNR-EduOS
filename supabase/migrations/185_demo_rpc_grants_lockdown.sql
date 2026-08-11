-- =====================================================================
-- Migration 185 — остаток дыры демо-входа: право вызова у claim_demo_slot
-- и sweep_expired_demo_leases приводится к тому, кто их реально вызывает.
--
-- ПРОДОЛЖЕНИЕ МИГРАЦИИ 183. Тогда закрыли два входа: выдача слота стала
-- ограничена демо-школой, а публичный POST /api/demo/claim (открытый вообще
-- без авторизации) удалён из кода. Осталась третья дверь — грант.
--
-- ЧТО НЕ ТАК СЕЙЧАС (снято has_function_privilege 11.08.2026, не из handoff):
--
--   claim_demo_slot(text,text,integer)   anon НЕТ · authenticated ЕСТЬ · service_role ЕСТЬ
--   sweep_expired_demo_leases()          anon ЕСТЬ · authenticated ЕСТЬ · service_role ЕСТЬ
--
-- 1. claim_demo_slot. Функция ВОЗВРАЩАЕТ адрес учётной записи и пароль
--    (тело, строка 117: CASE WHEN p_role='parent' THEN 'parent2026' ELSE
--    'password123' END). Право вызова у authenticated означает, что любой
--    вошедший — включая обычного ученика — может дёрнуть RPC напрямую через
--    PostgREST и получить пару «адрес + пароль» демо-аккаунта. Это ровно тот
--    же класс утечки, что закрывали в 183, просто через другую дверь.
--
--    Грант достался ей по наследству: 133 → 134 → 135 → 163, каждая
--    редакция дословно повторяла `GRANT EXECUTE ... TO anon, authenticated,
--    service_role`. В 133 это было оправдано: демо-вход задумывался как
--    вызов ИЗ БРАУЗЕРА до входа в систему. Сегодня путь другой.
--
-- 2. sweep_expired_demo_leases. Миграция 133 (строки 287-288) явно написала
--    «внутренний, не exposed»: REVOKE ALL FROM PUBLIC + GRANT только
--    service_role. Живая база с этим разошлась — право есть у anon и
--    authenticated. Возвращаем к тому, что было задумано.
--
-- ПОЧЕМУ ЭТО НИЧЕГО НЕ СЛОМАЕТ — проверено фактом, а не рассуждением:
--
--   • claim_demo_slot вызывается из ОДНОГО места на весь репозиторий:
--     apps/web/app/actions/auth.ts:244, demoLogin(). Клиент там —
--     createAdminClient() (lib/supabase/admin.ts, SUPABASE_SERVICE_ROLE_KEY),
--     то есть service_role, у которого право остаётся.
--     Мобильная claimDemoSlot() удалена 11.08 (коммит fb61f23), её endpoint
--     закрыт ещё в 183. Edge-функций в проекте нет (supabase/functions
--     отсутствует).
--
--   • sweep_expired_demo_leases из приложения не вызывается вообще. Внутри
--     базы её зовут двое: claim_demo_slot и get_occupied_teacher_subjects.
--     ОБЕ — SECURITY DEFINER с владельцем postgres, а внутри такой функции
--     право на вызов вложенной проверяется по владельцу, а не по тому, кто
--     позвал. Значит get_occupied_teacher_subjects (её право вызова у anon и
--     authenticated мы НЕ трогаем) продолжит подчищать протухшие аренды как
--     раньше.
--
-- ЧТО ОСТАЁТСЯ НЕТРОНУТЫМ: heartbeat_demo_slot и release_demo_slot. У них
-- право вызова у anon есть намеренно — их дёргают по ходу и по завершении
-- демо-сессии, и никаких учётных данных они не возвращают (bool и void).
--
-- Пароли-литералы внутри claim_demo_slot этой миграцией НЕ трогаются: после
-- отзыва гранта они не покидают сервер (единственный вызывающий — server
-- action), а их замена — отдельная задача, см. CLAUDE_CHAT_HANDOFF.md.
-- =====================================================================

-- ── 1. claim_demo_slot — только служебная роль ───────────────────────
-- Сигнатура точная, снята pg_get_function_identity_arguments: перегрузок
-- (text,text) больше нет, её удалила миграция 135.
REVOKE EXECUTE ON FUNCTION public.claim_demo_slot(text, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_demo_slot(text, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_demo_slot(text, text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_demo_slot(text, text, integer) TO service_role;

-- ── 2. sweep_expired_demo_leases — как задумывала 133 ────────────────
REVOKE EXECUTE ON FUNCTION public.sweep_expired_demo_leases() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sweep_expired_demo_leases() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sweep_expired_demo_leases() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.sweep_expired_demo_leases() TO service_role;

-- ── 3. Самопроверка: миграция обязана упасть, если результат не тот ──
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.claim_demo_slot(text,text,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.claim_demo_slot(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'claim_demo_slot всё ещё вызывается anon/authenticated';
  END IF;

  IF has_function_privilege('anon', 'public.sweep_expired_demo_leases()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.sweep_expired_demo_leases()', 'EXECUTE') THEN
    RAISE EXCEPTION 'sweep_expired_demo_leases всё ещё вызывается anon/authenticated';
  END IF;

  -- Обратная половина: служебная роль обязана СОХРАНИТЬ право, иначе
  -- демо-вход умрёт молча.
  IF NOT has_function_privilege('service_role', 'public.claim_demo_slot(text,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role потерял право на claim_demo_slot — демо-вход сломан';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.sweep_expired_demo_leases()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role потерял право на sweep_expired_demo_leases';
  END IF;

  -- Соседи не задеты.
  IF NOT has_function_privilege('anon', 'public.heartbeat_demo_slot(text)', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.release_demo_slot(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'задеты heartbeat/release — они должны были остаться как были';
  END IF;

  RAISE NOTICE 'Миграция 185: права приведены в порядок, соседи не задеты';
END $$;

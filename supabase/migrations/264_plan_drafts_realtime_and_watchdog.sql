-- ============================================================================
-- Миграция 264: заказы на разбор — живая подписка и сторож зависших.
-- ============================================================================
--
-- Две вещи, обе про одно: экран заказов не должен врать.
--
-- ═══ 1. ПОДПИСКА, КОТОРАЯ МОЛЧАЛА ══════════════════════════════════════════
--
-- PlanDraftsList подписан на `curriculum_plan_drafts` с первого дня, но канал
-- не приносил НИ ОДНОГО события: таблицы нет в публикации `supabase_realtime`,
-- а её список фиксирован (20260614000013). Ход разбора двигал только запасной
-- опрос раз в пять секунд — то есть страница жила на подпорке, а основной путь
-- был мёртв и молчал об этом.
--
-- REPLICA IDENTITY FULL обязательна, а не «на всякий случай». Правило чтения
-- заказов (миграция 262) смотрит на `teacher_id` — колонку НЕ ключевую. В WAL
-- при UPDATE не-ключевые колонки попадают только при FULL; без неё authorizer
-- не может вычислить правило и МОЛЧА выбрасывает событие. Ровно этим болели
-- lessons (20260623000037) и curriculum_plans (160) — тот же случай, третий раз.
--
-- Расширяем публикацию РОВНО НА ОДНУ таблицу. Чужих не трогаем.
--
-- ═══ 2. СТОРОЖ ЗАВИСШИХ ЗАКАЗОВ ════════════════════════════════════════════
--
-- Фон переводит заказ в 'running' первым же шагом и ставит 'done' либо 'failed'
-- в конце. Если между этими точками процесс умрёт — упёрлись в maxDuration,
-- инстанс перезапустили, сеть оборвалась — заказ остаётся 'running' навсегда.
-- Последствия у этого не косметические:
--
--   • первая кнопка гаснет НАВСЕГДА: живой заказ её выключает;
--   • частичный уникальный индекс держит четвёрку занятой, и тот же учебник
--     нельзя заказать снова ни этой, ни другой вкладкой;
--   • занятое под файл место остаётся в бакете сиротой — `отказ` его сносит,
--     но при убийстве процесса `отказ` не успевает отработать.
--
-- Снять это из интерфейса нечем: правил записи для браузера у таблицы нет
-- вовсе, и это правильно. Значит снимать должен сервер.
--
-- ПОЧЕМУ ДЕСЯТЬ МИНУТ. Живой заказ столько не живёт физически: ручка разбора
-- объявляет maxDuration = 300, и на трёхсотой секунде платформа убивает
-- функцию сама. Настоящие замеры — 46 секунд на «Python для детей» (04.09.2026)
-- и 65 секунд на файле учителя (07.08.2026). Десять минут — ДВОЙНОЙ запас к
-- потолку платформы: живого мы не добьём никогда, даже если между часами базы
-- и часами функции набежит перекос, а очередь придержит запуск. Брать шесть или
-- семь минут значило бы считать вплотную к потолку без единого запаса, а брать
-- час — держать учителя перед погасшей кнопкой лишние пятьдесят минут.
--
-- ОТСЧЁТ ОТ created_at, а не от начала работы: отдельной отметки старта у
-- заказа нет, а фон запускается через секунды после заведения — на десяти
-- минутах эта разница не значит ничего. Заодно это единственный способ добить
-- заказ, который так и остался 'queued': до него фон не дошёл вовсе.
--
-- ФАЙЛ СЧИТАЕТСЯ, А НЕ ЧИТАЕТСЯ. `result_path` у зависшего заказа пуст: он
-- проставляется последним, вместе с «готово». Но путь занятого места известен
-- заранее и собирается по правилу — <school_id>/<teacher_id>/drafts/<id>.csv,
-- то самое соглашение из packages/core/src/storage/path.ts. Функция возвращает
-- его вызывающему, тот сносит файл. SQL до хранилища не дотягивается — тот же
-- порядок в два хода, что у уборки по сроку.
-- ============================================================================

BEGIN;

-- ── 1. Подписка ─────────────────────────────────────────────────────────────
ALTER TABLE public.curriculum_plan_drafts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public' AND tablename = 'curriculum_plan_drafts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.curriculum_plan_drafts;
    END IF;
  ELSE
    -- Публикации нет вовсе — заводим её этой одной таблицей. Тот же запасной
    -- ход, что у 160: без него миграция упала бы на пустой базе.
    CREATE PUBLICATION supabase_realtime FOR TABLE public.curriculum_plan_drafts;
  END IF;
END $$;

-- ── 2. Сторож ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_fail_stuck_plan_drafts(
  p_старше interval DEFAULT interval '10 minutes'
)
RETURNS TABLE(id uuid, брошенный_файл text)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH добитые AS (
    UPDATE public.curriculum_plan_drafts
       SET status        = 'failed',
           -- Причина человеческими словами: учитель должен понять, что делать
           -- дальше, а не гадать над «не вышло».
           error_message = 'Разбор не завершился за отведённое время и был остановлен. Закажите ещё раз; если повторится — учебник слишком тяжёлый для разбора.',
           finished_at   = now()
     WHERE status IN ('queued', 'running')
       AND created_at < now() - p_старше
    RETURNING curriculum_plan_drafts.id,
              curriculum_plan_drafts.school_id,
              curriculum_plan_drafts.teacher_id
  )
  SELECT д.id,
         д.school_id::text || '/' || д.teacher_id::text || '/drafts/' || д.id::text || '.csv'
    FROM добитые д
$$;

REVOKE ALL ON FUNCTION public.fn_fail_stuck_plan_drafts(interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_fail_stuck_plan_drafts(interval) FROM anon;
REVOKE ALL ON FUNCTION public.fn_fail_stuck_plan_drafts(interval) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_fail_stuck_plan_drafts(interval) TO service_role;

COMMENT ON FUNCTION public.fn_fail_stuck_plan_drafts(interval) IS
  'Добивает заказы, застрявшие в queued/running дольше срока (по умолчанию 10 минут — двойной запас к потолку ручки разбора в 300 секунд), и возвращает вычисленные пути занятых ими файлов, чтобы вызывающий снёс их из хранилища. Зовётся прицепом к существующему крону, рядом с уборкой по сроку.';

-- ── 3. Самопроверка ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_ident "char";
  v_есть  boolean;
  v_прав  integer;
BEGIN
  SELECT relreplident INTO v_ident
    FROM pg_class WHERE oid = 'public.curriculum_plan_drafts'::regclass;
  IF v_ident <> 'f' THEN
    RAISE EXCEPTION '264: у заказов REPLICA IDENTITY «%» вместо full — события подписки будут молча теряться', v_ident;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public' AND tablename = 'curriculum_plan_drafts'
  ) INTO v_есть;
  IF NOT v_есть THEN
    RAISE EXCEPTION '264: заказы в публикацию supabase_realtime не попали';
  END IF;

  -- Ни anon, ни authenticated, ни PUBLIC не должны уметь звать сторожа: он
  -- пишет. Смотрим настоящий список прав функции, а не представление
  -- information_schema — оно показывает только роли текущего пользователя.
  IF (SELECT proacl IS NULL FROM pg_proc
       WHERE proname = 'fn_fail_stuck_plan_drafts'
         AND pronamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION '264: у сторожа список прав пуст — значит выполнять его может кто угодно';
  END IF;

  SELECT count(*) INTO v_прав
    FROM pg_proc p, aclexplode(p.proacl) a
   WHERE p.proname = 'fn_fail_stuck_plan_drafts'
     AND p.pronamespace = 'public'::regnamespace
     AND (a.grantee = 0 OR pg_get_userbyid(a.grantee) IN ('anon', 'authenticated'));
  IF v_прав <> 0 THEN
    RAISE EXCEPTION '264: у браузерных ролей % прав на сторожа', v_прав;
  END IF;

  RAISE NOTICE '264: заказы в публикации, сторож заведён на десять минут';
END $$;

COMMIT;

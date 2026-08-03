-- Migration 164 — ремонт миграции 163: она падала на
-- chat_threads_group_title_unique_idx (group_id, title) WHERE kind='group'.
--
-- ЧТО РЕАЛЬНО ПРОИЗОШЛО (проверено read-only на живой БД перед написанием
-- этого файла — SELECT-запросами, без единой записи).
--
-- Миграция 78 создаёт РОВНО ОДИН group-тред на группу. Миграция 81 (её же
-- собственный комментарий) осознанно ослабляет unique-индекс до
-- (group_id, title), чтобы разрешить ВТОРОЙ group-тред на группу —
-- родительский, с участниками-родителями вместо участников-учеников, и с
-- title = "<имя группы> — Родители" (supabase/migrations/81_..., строки 94
-- и 150: `title = r_group.name || ' — Родители'`). То есть по замыслу у
-- каждой группы ДОЛЖНО быть два РАЗНЫХ по title треда, а не два одинаковых.
--
-- 163 считала пару «битый + нормальный» дублями и лечила битый в
-- title = groups.name — БЕЗ суффикса «— Родители». Ровно это и вызывало
-- конфликт: битый (родительский) тред получал title, дословно совпадающий
-- с уже существующим ученическим тредом той же группы.
--
-- Проверено на живой БД (read-only, до записи этого файла): всего 3 битых
-- title в системе (kind='group' во всех трёх), все — родительские треды на
-- 3 группы (10-А/3-А/7-А). У всех трёх участники — ИСКЛЮЧИТЕЛЬНО
-- curator+parent (ни одного student), у соседних нормальных тредов той же
-- группы — curator+student. Сообщений во всех трёх битых — 0. Настоящих
-- дублей (group_id, title), совпадающих ДО этой миграции, в базе нет вообще —
-- коллизия возникала только КАК ПОБОЧНЫЙ ЭФФЕКТ собственно UPDATE из 163,
-- не как факт исходных данных.
--
-- ЧТО ДЕЛАЕТ ЭТА МИГРАЦИЯ (3 независимых, идемпотентных шага):
--
--   Шаг 1 — «умный» ремонт по составу участников (ГЛАВНАЯ ПРАВКА vs 163):
--     kind='group', title содержит U+FFFD →
--       есть участник role_in_thread='student' → title = groups.name
--       иначе (curator/parent/admin/bot, без student) →
--                                                 title = groups.name || ' — Родители'
--     Для всех трёх известных случаев это даёт title, НЕ совпадающий с
--     соседним ученическим тредом — пересчитано на живых данных ПЕРЕД
--     записью этого файла: после шага 1 коллизий (group_id, title) — 0.
--     Восстанавливает именно то, что задумывалось миграцией 81, а не
--     выдуманный текст.
--
--   Шаг 2 — дедуп НАСТОЯЩИХ дублей (defensive fallback, п.1/п.2 задания).
--     Что если ПОСЛЕ шага 1 (или у данных, которых сейчас нет — другая
--     среда, будущий баг сидирования) всё равно останется пара kind='group'
--     тредов с ОДИНАКОВЫМ (group_id, title)? Тогда: канонический — старший
--     по created_at, остальные — дубли.
--       * participants дубля, которых ещё нет у канонического, ПЕРЕНОСЯТСЯ
--         (ON CONFLICT DO NOTHING) — участник дубля не должен потерять чат.
--       * если у дубля есть сообщения — ПЕРЕНОСЯТСЯ (UPDATE thread_id) на
--         канонический, а не теряются.
--       * дубль удаляется; chat_participants/chat_messages/chat_read_state
--         этого треда уходят каскадом — ON DELETE CASCADE у всех трёх
--         (migration 78, строки 66/78/92) — второй раз руками делать не
--         нужно. В ТЕКУЩЕЙ БД этому шагу нечего обрабатывать (см.
--         подтверждение «коллизий после шага 1: 0» выше) — шаг существует
--         на случай, если это когда-нибудь перестанет быть верным.
--
--   Шаг 3 — зачистка одиночных «сирот» (п.3 задания: «логика 163 заново для
--     оставшихся»). Если какой-то битый title пережил шаг 1 (title без
--     совпадающей kind='group'+groups строки — например будущий admin_ai/
--     direct с испорченным title, которых сейчас нет вообще ни одного —
--     проверено), то title обнуляется в NULL. Это не костыль:
--     apps/web/app/parent/(app)/_ui/threads.ts::toVM() уже умеет
--     `s.title ?? "Групповой чат"` — тот же fallback, что задумывался в 163,
--     без риска столкнуться с чужим title при угадывании его руками здесь.
--
-- ИДЕМПОТЕНТНОСТЬ. Каждый шаг фильтруется по «title всё ещё содержит U+FFFD»
-- либо «(group_id,title) всё ещё дублируется» — второй прогон не находит
-- кандидатов ни на одном из трёх шагов и ничего не меняет.
--
-- ПОРТИРУЕМОСТЬ. Всё в одном PL/pgSQL DO-блоке на чистом синтаксисе (циклы
-- + GET DIAGNOSTICS), без \gset и других psql-meta-команд — файл выполняется
-- как есть в Supabase Dashboard SQL Editor, не только через psql CLI.

BEGIN;

DO $$
DECLARE
  v_broken_before        integer;
  v_dupe_pairs_before     integer;
  v_step1_repaired        integer := 0;
  v_step2_participants    integer := 0;
  v_step2_messages        integer := 0;
  v_step2_threads_removed integer := 0;
  v_step3_nulled          integer := 0;
  v_broken_after          integer;
  v_dupe_pairs_after      integer;
  v_tmp                   integer;
  v_group_row             record;
  v_dupe_row              record;
  v_canonical_id          uuid;
BEGIN
  -- ── «До» ──────────────────────────────────────────────────────────────
  SELECT count(*) INTO v_broken_before
  FROM public.chat_threads
  WHERE title LIKE '%' || chr(65533) || '%';

  SELECT count(*) INTO v_dupe_pairs_before
  FROM (
    SELECT group_id, title
    FROM public.chat_threads
    WHERE kind = 'group'
    GROUP BY group_id, title
    HAVING count(*) > 1
  ) d;

  RAISE NOTICE '164 «ДО»: битых title (любой kind) = %, дублирующих пар (group_id,title) = %',
    v_broken_before, v_dupe_pairs_before;

  -- ── Шаг 1: умный ремонт по составу участников ──────────────────────────
  UPDATE public.chat_threads t
  SET title = CASE
    WHEN EXISTS (
      SELECT 1 FROM public.chat_participants cp
      WHERE cp.thread_id = t.id AND cp.role_in_thread = 'student'
    )
    THEN g.name
    ELSE g.name || ' — Родители'
  END
  FROM public.groups g
  WHERE t.kind = 'group'
    AND t.group_id = g.id
    AND t.title LIKE '%' || chr(65533) || '%';
  GET DIAGNOSTICS v_step1_repaired = ROW_COUNT;

  RAISE NOTICE '164 Шаг 1: починено по составу участников = %', v_step1_repaired;

  -- ── Шаг 2: дедуп настоящих дублей (group_id, title) среди kind='group' ──
  FOR v_group_row IN
    SELECT group_id, title
    FROM public.chat_threads
    WHERE kind = 'group'
    GROUP BY group_id, title
    HAVING count(*) > 1
  LOOP
    -- Канонический — старший по created_at.
    SELECT id INTO v_canonical_id
    FROM public.chat_threads
    WHERE kind = 'group' AND group_id = v_group_row.group_id AND title = v_group_row.title
    ORDER BY created_at ASC
    LIMIT 1;

    FOR v_dupe_row IN
      SELECT id
      FROM public.chat_threads
      WHERE kind = 'group' AND group_id = v_group_row.group_id AND title = v_group_row.title
        AND id <> v_canonical_id
    LOOP
      -- 2a. Участники дубля, которых ещё нет у канонического.
      INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread, joined_at)
      SELECT v_canonical_id, cp.user_id, cp.role_in_thread, cp.joined_at
      FROM public.chat_participants cp
      WHERE cp.thread_id = v_dupe_row.id
      ON CONFLICT (thread_id, user_id) DO NOTHING;
      GET DIAGNOSTICS v_tmp = ROW_COUNT;
      v_step2_participants := v_step2_participants + v_tmp;

      -- 2b. Сообщения дубля — на канонический, не теряются.
      UPDATE public.chat_messages
      SET thread_id = v_canonical_id
      WHERE thread_id = v_dupe_row.id;
      GET DIAGNOSTICS v_tmp = ROW_COUNT;
      v_step2_messages := v_step2_messages + v_tmp;

      -- 2c. Сам дубль — удаляем (остаток participants/read_state уходит
      -- каскадом, migration 78: ON DELETE CASCADE).
      DELETE FROM public.chat_threads WHERE id = v_dupe_row.id;
      v_step2_threads_removed := v_step2_threads_removed + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '164 Шаг 2: участников перенесено = %, сообщений перенесено = %, тредов-дублей удалено = %',
    v_step2_participants, v_step2_messages, v_step2_threads_removed;

  -- ── Шаг 3: зачистка одиночных «сирот» без пары/группы ──────────────────
  UPDATE public.chat_threads
  SET title = NULL
  WHERE title LIKE '%' || chr(65533) || '%';
  GET DIAGNOSTICS v_step3_nulled = ROW_COUNT;

  RAISE NOTICE '164 Шаг 3: title обнулено (не подошло под шаг 1) = %', v_step3_nulled;

  -- ── «После»: проверка ───────────────────────────────────────────────────
  SELECT count(*) INTO v_broken_after
  FROM public.chat_threads
  WHERE title LIKE '%' || chr(65533) || '%';

  SELECT count(*) INTO v_dupe_pairs_after
  FROM (
    SELECT group_id, title
    FROM public.chat_threads
    WHERE kind = 'group'
    GROUP BY group_id, title
    HAVING count(*) > 1
  ) d;

  IF v_broken_after > 0 THEN
    RAISE EXCEPTION '164: % title(ов) всё ещё содержат U+FFFD после ремонта', v_broken_after;
  END IF;
  IF v_dupe_pairs_after > 0 THEN
    RAISE EXCEPTION '164: % дублирующих пар (group_id,title) остались после дедупа', v_dupe_pairs_after;
  END IF;

  RAISE NOTICE '164 «ПОСЛЕ»: битых title = 0, дублирующих пар = 0 — чисто';
END $$;

COMMIT;

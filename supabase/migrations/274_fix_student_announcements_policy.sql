-- ============================================================================
-- Миграция 274: ученик больше не подделывает, не правит и не удаляет
-- объявления. НЕ ПРИМЕНЕНА.
-- ============================================================================
--
-- ⚠️ ПРОГОНЯТЬ ФАЙЛ ЦЕЛИКОМ, ОДНИМ КУСКОМ. Самопроверка сверяет текст политики
-- со снимком, снятым во временную таблицу ДО правки, а временная таблица
-- живёт до ближайшего COMMIT. Выделите половину файла в редакторе — правка
-- ляжет НЕПРОВЕРЕННОЙ, а отказ будет про несуществующую таблицу, а не про суть.
--
-- ═══ ЧТО СЛОМАНО ═══════════════════════════════════════════════════════════
--
-- Политика `student reads announcements` названа «читает», а объявлена
-- `FOR ALL`. FOR ALL покрывает SELECT, INSERT, UPDATE и DELETE. У UPDATE и
-- DELETE проверяется только `USING`, а `WITH CHECK` у политики нет вовсе —
-- значит и у INSERT берётся то же `USING`. Один фильтр «объявления моей
-- группы» отвечает сразу за четыре команды.
--
-- ═══ ДЫРА ШИРЕ, ЧЕМ КАЗАЛОСЬ: ЧЕТЫРЕ КОМАНДЫ И ТРИ РОЛИ ═══════════════════
--
-- Политика объявлена `TO PUBLIC` — применяется к КАЖДОЙ роли, не только к
-- ученику. А одна её ветвь истинна для любого человека школы:
--
--     (scope = 'all_my_groups' AND admin_id IS NOT NULL)
--     AND school_id = current_school_id()
--
-- Ни `is_my_group`, ни `current_student_id` тут не спрашиваются вовсе.
--
-- Пробы в демо-школе, каждая в своей точке сохранения с откатом:
--
--   ПОДДЕЛКА. Ученик вставляет объявление, подставив scope='all_my_groups' и
--   admin_id настоящего администратора (этот id он читает из любого видимого
--   ему объявления):                                        ->  1 строка,
--   и триггер trg_announce_notify разослал                  -> 36 уведомлений
--   по всей школе. То есть ученик выступает от имени администрации.
--
--   ПРАВКА чужого объявления (подмена заголовка)            ->  1 строка
--   УДАЛЕНИЕ чужого объявления                              ->  1 строка
--   УДАЛЕНИЕ одним запросом, без фильтра                    ->  7 строк
--   (семь — ровно столько, сколько ученику видно из одиннадцати)
--
--   Удаление того же админского объявления под другими ролями:
--     учитель  -> 1 строка,  родитель -> 1 строка,  админ -> 1 (это его).
--
-- ОГОВОРКА ЧЕСТНОСТИ, ДВА РАЗА. Первая редакция этой шапки утверждала, что
-- INSERT ученику отбивается и дыра только на чтение-и-уничтожение. Это была
-- неправда: проба не заполняла admin_id, и падала на нём, а не на политике.
-- И в разведке 07.09 у учителя с родителем стояли нули — тоже ошибка замера:
-- удачные пробы не откатывались поодиночке, ученик успевал снести цель, и
-- следующим ролям удалять было уже нечего. Все числа выше сняты заново.
--
-- ═══ ЧТО ДЕЛАЕМ ════════════════════════════════════════════════════════════
--
-- Сужаем политику до `FOR SELECT`. Текст `USING` переносится ДОСЛОВНО: снят
-- из живой базы через pg_get_expr, а не переписан руками — чтение ученика не
-- должно измениться ни на знак. Роль остаётся PUBLIC, вид PERMISSIVE.
--
-- Порядок: DROP POLICY, затем CREATE POLICY FOR SELECT. `ALTER POLICY` не
-- годится: сменить команду политики он не умеет.
--
-- После сужения запись в таблицу остаётся только у политик с проверкой
-- авторства (`created_by = current_teacher_id()` либо
-- `admin_id = current_admin_id()`), поэтому закрываются все четыре команды
-- разом: подделка, правка, удаление и массовое удаление.
--
-- ═══ ОСТАЛЬНЫЕ ДЕВЯТЬ ПОЛИТИК НЕ ТРОНУТЫ ═══════════════════════════════════
--
--   teacher or admin creates announcements   FOR ALL, только WITH CHECK
--   teacher or admin reads own announcements FOR ALL, только USING
--   teacher or admin updates own …           FOR ALL, USING + WITH CHECK
--   teacher or admin deletes own …           FOR ALL, только USING
--   parent reads … / teacher reads …         FOR SELECT
--   superadmin write guard insert/update/delete  RESTRICTIVE
--
-- Четыре первые тоже объявлены `FOR ALL`, но опасности в этом нет: у каждой
-- внутри `USING` либо `WITH CHECK` стоит проверка авторства, дальше своих
-- строк они не пускают.
--
-- ЧЕСТНАЯ ОГОВОРКА ПРО `reads own`. Она тоже «названа читающей, объявлена
-- FOR ALL» — тот же дефект, что чиним здесь. Её НЕ трогаем по решению
-- заказчика, а не потому, что нельзя: закрепление держит отдельная политика
-- `updates own`, удаление — `deletes own`, права складываются по ИЛИ, и
-- участие `reads own` для них не требуется. Сузить её до SELECT можно
-- отдельным заходом, и самопроверка ниже этому не мешает.
--
-- Триггер `trg_announce_notify` висит на INSERT и объявлен SECURITY DEFINER —
-- сужение политики его не задевает. Проверено прогоном: вставка админом и до,
-- и после правки заводит одинаковое число уведомлений.
--
-- ═══ НЕ ПРИМЕНЕНА ══════════════════════════════════════════════════════════
--
-- Файл коммитится, применяет человек через Dashboard. Что проверить после
-- применения — в resheniya_3.md, запись от 07.09.2026.
-- ============================================================================

BEGIN;

-- ── Снимок состояния ДО правки ──────────────────────────────────────────────
--
-- Текст политики не вписан в файл литералом намеренно: файл лежит с CRLF, а
-- база отдаёт перевод строки одним знаком, и сверка литерала падала бы на
-- невидимой разнице (наступали на это в этом же заходе). Снимок сравнивает
-- то, что вернула база, с тем, что вернула база.
DROP TABLE IF EXISTS _274_снимок;
CREATE TEMP TABLE _274_снимок ON COMMIT DROP AS
SELECT (SELECT pg_get_expr(pol.polqual, pol.polrelid)
          FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'announcements'
           AND pol.polname = 'student reads announcements')            AS using_,
       (SELECT pol.polpermissive
          FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'announcements'
           AND pol.polname = 'student reads announcements')            AS permissive_,
       (SELECT (pol.polroles = '{0}')
          FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'announcements'
           AND pol.polname = 'student reads announcements')            AS public_,
       (SELECT array_agg(policyname::text ORDER BY policyname)
          FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'announcements')  AS имена_;

-- ── Сужение до чтения ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "student reads announcements" ON public.announcements;

CREATE POLICY "student reads announcements"
  ON public.announcements
  FOR SELECT
  TO PUBLIC
  USING ((((((scope = 'group'::text) AND is_my_group(group_id)) OR ((scope = 'all_my_groups'::text) AND ((admin_id IS NOT NULL) OR ((created_by IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.teacher_id = announcements.created_by) AND is_my_group(g.id))))))) OR ((scope = 'student'::text) AND (target_student_id = current_student_id()))) AND (school_id = current_school_id())) OR is_super_admin()));

-- ── Самопроверка ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cmd        "char";
  v_using      text;
  v_permissive boolean;
  v_public     boolean;
  v_имена      text[];
  v_было       record;
  v_держат     integer;
BEGIN
  SELECT * INTO v_было FROM _274_снимок;
  IF v_было.using_ IS NULL THEN
    RAISE EXCEPTION '274: снимок исходной политики пуст — до правки её не существовало, это не та база';
  END IF;

  SELECT pol.polcmd, pg_get_expr(pol.polqual, pol.polrelid), pol.polpermissive,
         (pol.polroles = '{0}')
    INTO v_cmd, v_using, v_permissive, v_public
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'announcements'
     AND pol.polname = 'student reads announcements';

  IF v_cmd IS NULL THEN
    RAISE EXCEPTION '274: политика «student reads announcements» пропала — чтение объявлений у ученика сломано';
  END IF;

  -- 1. Команда обязана стать SELECT ('r'), а не остаться ALL ('*').
  IF v_cmd <> 'r' THEN
    RAISE EXCEPTION '274: политика осталась с командой «%» вместо SELECT — ученик по-прежнему подделывает, правит и удаляет объявления', v_cmd;
  END IF;

  -- 2. Текст USING обязан совпасть с исходным ДОСЛОВНО: иначе мы заодно
  --    изменили то, что ученик ВИДИТ, а этого делать нельзя.
  IF v_using IS DISTINCT FROM v_было.using_ THEN
    RAISE EXCEPTION '274: текст USING изменился — видимость объявлений у ученика стала другой.
БЫЛО: %
СТАЛО: %', v_было.using_, v_using;
  END IF;

  -- 3. Роль и вид политики не менялись.
  IF v_public IS DISTINCT FROM v_было.public_ OR v_permissive IS DISTINCT FROM v_было.permissive_ THEN
    RAISE EXCEPTION '274: у политики сменились роль или вид (PUBLIC % -> %, PERMISSIVE % -> %)',
      v_было.public_, v_public, v_было.permissive_, v_permissive;
  END IF;

  -- 4. НАБОР ИМЁН политик обязан совпасть со снимком. Считать их число
  --    бессмысленно: потеряли одну, добавили другую — счёт тот же, а таблица
  --    другая. И жёсткое «десять» уронило бы миграцию на любой базе, где
  --    политик легально не десять.
  SELECT array_agg(policyname::text ORDER BY policyname) INTO v_имена
    FROM pg_policies WHERE schemaname = 'public' AND tablename = 'announcements';
  IF v_имена IS DISTINCT FROM v_было.имена_ THEN
    RAISE EXCEPTION '274: набор политик на announcements изменился.
БЫЛО: %
СТАЛО: %', v_было.имена_, v_имена;
  END IF;

  -- 5. Три политики, на которых держится работа учителя и админа, обязаны
  --    остаться и обязаны покрывать свою команду. Проверяем ПОКРЫТИЕ, а не
  --    букву «ALL»: если кто-то потом правильно сузит их до своих команд,
  --    эта проверка не должна поднимать ложную тревогу.
  SELECT count(*) INTO v_держат
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'announcements' AND permissive = 'PERMISSIVE'
     AND ((policyname = 'teacher or admin creates announcements' AND cmd IN ('ALL','INSERT'))
       OR (policyname = 'teacher or admin updates own announcements' AND cmd IN ('ALL','UPDATE'))
       OR (policyname = 'teacher or admin deletes own announcements' AND cmd IN ('ALL','DELETE')));
  IF v_держат <> 3 THEN
    RAISE EXCEPTION '274: из трёх политик, держащих создание, закрепление и удаление у учителя и админа, нашлось % — работа с объявлениями сломана', v_держат;
  END IF;

  RAISE NOTICE '274: политика ученика сужена до SELECT, текст USING не изменился, роль и вид те же, набор политик совпал, три политики учителя и админа на месте';
END $$;

-- Итог видимой строкой: поток NOTICE редактор Supabase не показывает.
SELECT 'миграция 274 применена: политика ученика сужена до SELECT' AS итог;

COMMIT;

-- ============================================================================
-- Миграция 259: учитель может работать в нескольких школах — основание.
-- ============================================================================
--
-- ═══ ПУТЬ Б ════════════════════════════════════════════════════════════════
--
-- Одна запись учителя на человека плюс таблица связей со школами. Не «строка
-- на каждую школу» (путь А): у человека один логин, одно имя, один аватар и
-- одна учётная запись, и разводить их по школам значило бы заводить двойника,
-- которого потом придётся сводить обратно на каждом экране.
--
-- ЭТО ЕЩЁ И ЕДИНСТВЕННЫЙ ПУТЬ, КОТОРЫЙ НЕ ЛОМАЕТ ЗАБОРЫ. У `teachers` три
-- ограничения, которые в пути А пришлось бы снимать:
--
--   teachers_user_id_key           UNIQUE (user_id)
--   teachers_username_global_uniq  UNIQUE (lower(username))
--   trg_unique_login_email         триггер сверки логина и почты по всем ролям
--
-- В пути Б они не мешают ничему: запись одна, логин один, почта одна. Снимать
-- сейчас не надо ни один — и, что важнее, не надо и потом. Они же и держат
-- путь Б: второй строки на того же человека база просто не примет.
--
-- ═══ ЧТО ЗАВОДИТСЯ ═════════════════════════════════════════════════════════
--
--   1. public.teacher_schools      — связь «учитель работает в школе»;
--   2. public.is_school_teacher_of — «мой ли это учитель в этой школе»,
--                                    дословный аналог is_school_admin_of;
--   3. public.staff_active_school  — где хранится «школа, в которой я сейчас»
--                                    (разбор — ниже, у самой таблицы);
--   4. по строке связи каждому существующему учителю.
--
-- ═══ ЧЕГО ЭТА МИГРАЦИЯ НЕ ДЕЛАЕТ ═══════════════════════════════════════════
--
-- НИ ОДНО СУЩЕСТВУЮЩЕЕ ПРАВИЛО ДОСТУПА НЕ ТРОНУТО. `current_school_id()`
-- по-прежнему читает `teachers.school_id`, и все политики работают как вчера.
-- Перевод правил — следующий заход, отдельно и с прогоном.
--
-- `teachers.school_id` ОСТАЁТСЯ. Решение про домашнюю школу не принято, и на
-- этой колонке висит запись сообщений в чат. Трогать её здесь нечем.
--
-- Новые функции НИКЕМ НЕ ВЫЗЫВАЮТСЯ — они заведены, но ещё не подключены.
-- Так и задумано: основание кладётся отдельно от того, что на нём встанет.
-- ============================================================================

-- ── 1. Связь «учитель — школа» ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_schools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES public.schools(id)  ON DELETE CASCADE,
  -- Связь снимают, а не удаляют: учитель ушёл из школы, но его уроки, оценки
  -- и материалы остались, и «кто это был» должно читаться и через год.
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_schools_unique UNIQUE (teacher_id, school_id)
);

COMMENT ON TABLE public.teacher_schools IS
  'В каких школах работает учитель (путь Б). Одна запись teachers на человека, здесь — его школы. is_active = false означает «больше не работает», строка при этом остаётся: на неё ссылается всё, что он вёл.';

CREATE INDEX IF NOT EXISTS idx_teacher_schools_teacher ON public.teacher_schools (teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_schools_school  ON public.teacher_schools (school_id);

ALTER TABLE public.teacher_schools ENABLE ROW LEVEL SECURITY;

-- Читают: свой человек (свои связи видит сам), админ этой школы, суперадмин.
-- Этого достаточно и для экрана учителей у админа, и для будущего
-- переключателя школ у самого учителя.
DROP POLICY IF EXISTS teacher_schools_select ON public.teacher_schools;
CREATE POLICY teacher_schools_select ON public.teacher_schools
  FOR SELECT USING (
    public.is_super_admin()
    OR public.is_school_admin_of(school_id)
    OR EXISTS (
      SELECT 1 FROM public.teachers t
       WHERE t.id = teacher_schools.teacher_id AND t.user_id = auth.uid()
    )
  );

-- Пишет только администрация школы: «кто у нас работает» — её решение, а не
-- решение самого учителя.
DROP POLICY IF EXISTS teacher_schools_insert_admin ON public.teacher_schools;
CREATE POLICY teacher_schools_insert_admin ON public.teacher_schools
  FOR INSERT WITH CHECK (public.is_school_admin_of(school_id));

DROP POLICY IF EXISTS teacher_schools_update_admin ON public.teacher_schools;
CREATE POLICY teacher_schools_update_admin ON public.teacher_schools
  FOR UPDATE USING (public.is_school_admin_of(school_id))
  WITH CHECK (public.is_school_admin_of(school_id));

DROP POLICY IF EXISTS teacher_schools_delete_admin ON public.teacher_schools;
CREATE POLICY teacher_schools_delete_admin ON public.teacher_schools
  FOR DELETE USING (public.is_school_admin_of(school_id));

-- ── 2. «Мой ли это учитель в этой школе» ────────────────────────────────────
--
-- Дословный аналог is_school_admin_of (миграция 203): те же STABLE SECURITY
-- DEFINER, тот же пустой search_path, те же гранты, та же ветка суперадмина.
-- Для учителя такой функции не было НИ ОДНОЙ — каждая политика спрашивала
-- teachers.school_id по-своему.
CREATE OR REPLACE FUNCTION public.is_school_teacher_of(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.teacher_schools ts
      JOIN public.teachers t ON t.id = ts.teacher_id
     WHERE t.user_id = auth.uid()
       AND ts.school_id = p_school_id
       AND ts.is_active
  ) OR public.is_super_admin()
$$;

REVOKE ALL ON FUNCTION public.is_school_teacher_of(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_school_teacher_of(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_school_teacher_of(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_school_teacher_of(uuid) IS
  'Работает ли текущий пользователь учителем в этой школе (teacher_schools, is_active). Аналог is_school_admin_of для учителя. Пока не вызывается ни одним правилом — перевод правил отдельным заходом.';

-- ── 3. Школа, в которой я сейчас ────────────────────────────────────────────
--
-- ═══ ПОЧЕМУ ОТДЕЛЬНАЯ ТАБЛИЦА, А НЕ КУКА И НЕ КОЛОНКА ═════════════════════
--
-- НЕ КУКА. Правила доступа живут в базе и куки не видят. Если «текущая школа»
-- будет только в браузере, то `current_school_id()` про неё не узнает — а
-- именно он решает, чьи строки покажут. Кука годится для языка и выбранного
-- ребёнка, потому что там она ничего не решает; здесь решает всё.
--
-- НЕ КОЛОНКА В teachers. Три довода. Первый: это не свойство учителя, а
-- состояние сеанса — «куда он сейчас смотрит». Второй: любая запись в
-- teachers будит триггер сверки логина и почты, и переключение школы стало бы
-- поводом для лишней работы на каждое нажатие. Третий: завтра переключаться
-- захочет и админ, и менеджер — таблица примет их без правки схемы, колонка
-- в teachers не примет никого.
--
-- КЛЮЧ — ПОЛЬЗОВАТЕЛЬ, А НЕ УЧИТЕЛЬ. По той же причине: строка одна на
-- человека, кем бы он ни был.
CREATE TABLE IF NOT EXISTS public.staff_active_school (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.staff_active_school IS
  'Школа, в которой сотрудник работает СЕЙЧАС (переключатель школ). Состояние сеанса, а не свойство человека: ключ — пользователь. Пусто = школа не выбрана, читатель берёт домашнюю.';

ALTER TABLE public.staff_active_school ENABLE ROW LEVEL SECURITY;

-- Свою строку человек читает и меняет сам — но выбрать он может только ту
-- школу, где он действительно работает. Проверку делает база, а не форма.
DROP POLICY IF EXISTS staff_active_school_own ON public.staff_active_school;
CREATE POLICY staff_active_school_own ON public.staff_active_school
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS staff_active_school_set ON public.staff_active_school;
CREATE POLICY staff_active_school_set ON public.staff_active_school
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND public.is_school_teacher_of(school_id)
  );

DROP POLICY IF EXISTS staff_active_school_change ON public.staff_active_school;
CREATE POLICY staff_active_school_change ON public.staff_active_school
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_school_teacher_of(school_id));

-- Читатель «где я сейчас». НЕ ПОДКЛЮЧЁН НИ К ОДНОМУ ПРАВИЛУ: подключение —
-- следующий заход. Порядок: выбранная школа, если связь с ней жива; иначе
-- домашняя школа из teachers.school_id.
CREATE OR REPLACE FUNCTION public.fn_my_active_school()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (
      SELECT a.school_id
        FROM public.staff_active_school a
       WHERE a.user_id = auth.uid()
         AND EXISTS (
           SELECT 1 FROM public.teacher_schools ts
             JOIN public.teachers t ON t.id = ts.teacher_id
            WHERE t.user_id = auth.uid()
              AND ts.school_id = a.school_id
              AND ts.is_active
         )
    ),
    (SELECT t.school_id FROM public.teachers t WHERE t.user_id = auth.uid() LIMIT 1)
  )
$$;

REVOKE ALL ON FUNCTION public.fn_my_active_school() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_my_active_school() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_my_active_school() TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_my_active_school() IS
  'Школа, в которой сотрудник работает сейчас: выбранная (staff_active_school), если связь с ней жива, иначе домашняя teachers.school_id. Пока не вызывается ни одним правилом.';

-- ── 4. Связи существующим учителям ──────────────────────────────────────────
-- По одной на каждого: его нынешняя школа. Повторный запуск ничего не
-- задваивает — ограничение уникальности пары само об этом говорит.
INSERT INTO public.teacher_schools (teacher_id, school_id)
SELECT t.id, t.school_id FROM public.teachers t
ON CONFLICT (teacher_id, school_id) DO NOTHING;

-- ── 5. Самопроверка ─────────────────────────────────────────────────────────
DO $$
DECLARE
  v_teachers integer;
  v_links    integer;
  v_missing  integer;
BEGIN
  SELECT count(*) INTO v_teachers FROM public.teachers;
  SELECT count(*) INTO v_links    FROM public.teacher_schools;
  SELECT count(*) INTO v_missing
    FROM public.teachers t
   WHERE NOT EXISTS (
     SELECT 1 FROM public.teacher_schools ts
      WHERE ts.teacher_id = t.id AND ts.school_id = t.school_id
   );
  RAISE NOTICE '259: учителей %, связей %, без связи %', v_teachers, v_links, v_missing;
  IF v_missing <> 0 THEN
    RAISE EXCEPTION '259: % учителей остались без связи со своей школой', v_missing;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.teacher_schools ts
      JOIN public.teachers t ON t.id = ts.teacher_id
     WHERE ts.school_id <> t.school_id
  ) THEN
    RAISE NOTICE '259: есть связи со школой, отличной от домашней — это и есть цель, не ошибка';
  END IF;
END $$;

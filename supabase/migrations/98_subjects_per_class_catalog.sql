-- =====================================================================
-- Migration 98 — БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 2: каталог предметов по классам.
--
-- 2.1: is_active column (рабочий предмет vs заглушка).
-- 2.2/2.3: наполнение subjects для 10-А/7-А/3-А (migration 97), рабочие —
-- Программирование/Робототехника/Математика/Английский язык/Русский язык
-- (is_active=true), остальные — заглушки (is_active=false).
--
-- teacher_id для всех строк = teacher_karim: он единственный "реальный"
-- учитель, и все демо-учителя всё равно получают доступ к урокам этих
-- предметов через group_teachers/is_my_teacher_group (см. миграцию 97 +
-- apps/web/app/teacher/lessons/page.tsx fix), а не через subjects.teacher_id
-- напрямую — то есть значение teacher_id здесь чисто информационное
-- ("кто ведёт предмет"), не access-control.
-- =====================================================================

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DO $$
DECLARE
  v_karim_id uuid;
  v_group_10a uuid;
  v_group_7a uuid;
  v_group_3a uuid;
  v_school_id CONSTANT uuid := 'a0a0a0a0-0000-0000-0000-000000000001';
  r RECORD;
BEGIN
  SELECT id INTO v_karim_id FROM public.teachers WHERE username = 'teacher_karim';
  SELECT id INTO v_group_10a FROM public.groups WHERE name = '10-А класс';
  SELECT id INTO v_group_7a FROM public.groups WHERE name = '7-А класс';
  SELECT id INTO v_group_3a FROM public.groups WHERE name = '3-А класс';

  -- ── 3-А класс (8 предметов) ─────────────────────────────────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('Русский язык',       'BookOpen',     '#EF4444', true),
      ('Математика',         'Calculator',   '#F5A623', true),
      ('Английский язык',    'Languages',    '#F0556B', true),
      ('Природоведение',     'TreePine',     '#16A34A', false),
      ('ИЗО',                'Palette',      '#8B5CF6', false),
      ('Музыка',             'Music',        '#EC4899', false),
      ('Программирование',   'Code',         '#0EA5E9', true),
      ('Робототехника',      'Bot',          '#2D5BFF', true)
    ) AS t(name, icon, color, is_active)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE group_id = v_group_3a AND name = r.name) THEN
      INSERT INTO public.subjects (name, group_id, teacher_id, icon, color, is_active, school_id)
      VALUES (r.name, v_group_3a, v_karim_id, r.icon, r.color, r.is_active, v_school_id);
    END IF;
  END LOOP;

  -- ── 7-А класс (10 предметов) ────────────────────────────────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('Русский язык',       'BookOpen',     '#EF4444', true),
      ('Математика',         'Calculator',   '#F5A623', true),
      ('Английский язык',    'Languages',    '#F0556B', true),
      ('История',            'Scroll',       '#B5793A', false),
      ('Биология',           'Leaf',         '#2DBE7E', false),
      ('Химия',              'FlaskConical', '#9B5DE5', false),
      ('Физика',             'Atom',         '#39B6F5', false),
      ('География',          'Map',          '#14B8A6', false),
      ('Программирование',   'Code',         '#0EA5E9', true),
      ('Робототехника',      'Bot',          '#2D5BFF', true)
    ) AS t(name, icon, color, is_active)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE group_id = v_group_7a AND name = r.name) THEN
      INSERT INTO public.subjects (name, group_id, teacher_id, icon, color, is_active, school_id)
      VALUES (r.name, v_group_7a, v_karim_id, r.icon, r.color, r.is_active, v_school_id);
    END IF;
  END LOOP;

  -- ── 10-А класс (10 предметов) ───────────────────────────────────────
  FOR r IN
    SELECT * FROM (VALUES
      ('Русский язык',       'BookOpen',     '#EF4444', true),
      ('Математика',         'Calculator',   '#F5A623', true),
      ('Английский язык',    'Languages',    '#F0556B', true),
      ('История',            'Scroll',       '#B5793A', false),
      ('Биология',           'Leaf',         '#2DBE7E', false),
      ('Химия',              'FlaskConical', '#9B5DE5', false),
      ('Физика',             'Atom',         '#39B6F5', false),
      ('Обществознание',     'Users',        '#6366F1', false),
      ('Программирование',   'Code',         '#0EA5E9', true),
      ('Робототехника',      'Bot',          '#2D5BFF', true)
    ) AS t(name, icon, color, is_active)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE group_id = v_group_10a AND name = r.name) THEN
      INSERT INTO public.subjects (name, group_id, teacher_id, icon, color, is_active, school_id)
      VALUES (r.name, v_group_10a, v_karim_id, r.icon, r.color, r.is_active, v_school_id);
    END IF;
  END LOOP;
END $$;

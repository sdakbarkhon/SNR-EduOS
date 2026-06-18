-- =============================================================================
-- DEMO CLEANUP — run in Supabase Dashboard › SQL Editor
-- Goal: keep only Robotics + Informatics, groups 7А and 7Б,
--       teacher_ivan leads all four, Adilbek in 7А, Dilnoza in 7Б.
-- =============================================================================

-- ── STEP 1: Create missing groups ────────────────────────────────────────────
-- Robotics 7Б and Informatics 7Б (teacher_ivan, id cccc...)
INSERT INTO public.groups (id, name, subject, teacher_id, course_price, schedule_days)
VALUES
  ('b1000000-0000-0000-0000-000000000000', 'Робототехника 7Б', 'robotics',    'cccccccc-cccc-cccc-cccc-cccccccccccc', 1500000, 'Вт, Чт'),
  ('b2000000-0000-0000-0000-000000000000', 'Информатика 7Б',   'informatics', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1200000, 'Ср, Пт')
ON CONFLICT (id) DO NOTHING;

-- ── STEP 2: Transfer Informatics 7А to teacher_ivan ──────────────────────────
-- (was teacher eeeeeeee)
UPDATE public.groups
SET teacher_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
WHERE id = 'e0000000-0000-0000-0000-000000000000';

-- ── STEP 3: Fix Adilbek enrollments ──────────────────────────────────────────
-- Remove him from groups we're about to delete (c0, d0 — a0 and e0 stay)
DELETE FROM public.student_groups
WHERE student_id = 'a1111111-1111-1111-1111-111111111111'
  AND group_id IN (
    'c0000000-0000-0000-0000-000000000000',
    'd0000000-0000-0000-0000-000000000000'
  );

-- ── STEP 4: Fix Dilnoza enrollments ──────────────────────────────────────────
-- Remove from all old groups
DELETE FROM public.student_groups
WHERE student_id = 'b2222222-2222-2222-2222-222222222222';

-- Enroll in new 7Б groups
INSERT INTO public.student_groups (student_id, group_id)
VALUES
  ('b2222222-2222-2222-2222-222222222222', 'b1000000-0000-0000-0000-000000000000'),
  ('b2222222-2222-2222-2222-222222222222', 'b2000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;

-- Update Dilnoza grade to 7 class (matching 7Б)
UPDATE public.students
SET grade = '7 класс', status = 'active', balance = 500000
WHERE id = 'b2222222-2222-2222-2222-222222222222';

-- ── STEP 5: Delete groups being removed (CASCADE cleans lessons/homework/etc) ─
-- Order matters: delete dependent rows if foreign keys aren't CASCADE
-- student_groups already cleaned above, but let's be safe
DELETE FROM public.student_groups
WHERE group_id IN (
  'b0000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000',
  'a1000000-0000-0000-0000-000000000000',
  'a2000000-0000-0000-0000-000000000000'
);

DELETE FROM public.groups
WHERE id IN (
  'b0000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-000000000000',
  'd0000000-0000-0000-0000-000000000000',
  'f0000000-0000-0000-0000-000000000000',
  'a1000000-0000-0000-0000-000000000000',
  'a2000000-0000-0000-0000-000000000000'
);

-- ── VERIFY ────────────────────────────────────────────────────────────────────
SELECT id, name, subject, teacher_id FROM public.groups ORDER BY name;
SELECT sg.student_id, s.username, g.name as group_name
FROM public.student_groups sg
JOIN public.students s ON s.id = sg.student_id
JOIN public.groups g ON g.id = sg.group_id
ORDER BY s.username, g.name;


-- =============================================================================
-- DEMO SEED LESSONS — run after cleanup
-- 4 lessons for the demo: today + tomorrow
-- Current time in Tashkent (UTC+5) used via now()
-- =============================================================================

-- Robotics 7А · today · now+1h → now+2h30m · room 305
INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, room)
VALUES (
  gen_random_uuid(),
  'a0000000-0000-0000-0000-000000000000',
  9,
  'Servo-моторы и управление движением',
  NULL,
  'scheduled',
  now() + interval '1 hour',
  now() + interval '2 hours 30 minutes',
  '305'
);

-- Informatics 7А · today · now+3h → now+4h30m · room 306
INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, room)
VALUES (
  gen_random_uuid(),
  'e0000000-0000-0000-0000-000000000000',
  9,
  'Циклы и массивы в Python',
  NULL,
  'scheduled',
  now() + interval '3 hours',
  now() + interval '4 hours 30 minutes',
  '306'
);

-- Robotics 7Б · tomorrow · 10:00+05 = 05:00 UTC → 11:30+05 = 06:30 UTC
INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, room)
VALUES (
  gen_random_uuid(),
  'b1000000-0000-0000-0000-000000000000',
  1,
  'Введение в Arduino',
  NULL,
  'scheduled',
  (current_date + interval '1 day' + interval '5 hours'),
  (current_date + interval '1 day' + interval '6 hours 30 minutes'),
  '305'
);

-- Informatics 7Б · tomorrow · 12:00+05 = 07:00 UTC → 13:30+05 = 08:30 UTC
INSERT INTO public.lessons (id, group_id, lesson_no, topic, title, status, starts_at, ends_at, room)
VALUES (
  gen_random_uuid(),
  'b2000000-0000-0000-0000-000000000000',
  1,
  'Введение в программирование',
  NULL,
  'scheduled',
  (current_date + interval '1 day' + interval '7 hours'),
  (current_date + interval '1 day' + interval '8 hours 30 minutes'),
  '306'
);

-- ── VERIFY LESSONS ────────────────────────────────────────────────────────────
SELECT l.id, g.name as group_name, l.topic, l.starts_at, l.room
FROM public.lessons l
JOIN public.groups g ON g.id = l.group_id
WHERE l.starts_at > now() - interval '1 day'
ORDER BY l.starts_at;

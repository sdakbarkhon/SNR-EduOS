-- ====================================================================
-- Migration 46: notification kind cleanup
-- Extends kind check with leave_request, leave_decision, lesson_starting_soon.
-- Removes stale teacher-facing notifications that don't belong to teachers.
-- ====================================================================

-- 1. Extend kind constraint
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_kind_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_kind_check CHECK (kind IN (
    'announcement', 'new_homework', 'new_grade', 'homework_graded',
    'lesson_material', 'student_excused', 'student_submitted',
    'leave_request', 'leave_decision', 'lesson_starting_soon'
  ));

-- 2. Cleanup: remove notifications sent to teachers for kinds that teachers
--    should never receive (only student-facing events).
DELETE FROM public.notifications n
WHERE EXISTS (
    SELECT 1 FROM public.teachers t WHERE t.user_id = n.recipient_user_id
  )
  AND n.kind NOT IN (
    'student_submitted', 'student_excused',
    'leave_request', 'leave_decision', 'lesson_starting_soon'
  );

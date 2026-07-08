-- =====================================================================
-- Migration 106 — исправление отклонения: reset_expired_demo_sessions()
-- не удаляла посещаемость (attendance) и оценки за урок (lesson_grades),
-- созданные demo-аккаунтом за время сессии. Симметрично существующему
-- паттерну функции (каждая таблица фильтруется по своей "временной"
-- колонке > r.claimed_at):
--   - для demo-ученика: его attendance/lesson_grades по recorded_at/
--     graded_at (когда запись появилась — реальная отметка учителем
--     ставит marked_at/graded_at, но recorded_at покрывает и авто-
--     созданные заглушки посещаемости);
--   - для demo-учителя: attendance/lesson_grades, которые ОН отметил/
--     выставил (marked_by/graded_by), по marked_at/graded_at.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reset_expired_demo_sessions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_student_id uuid;
  v_teacher_id uuid;
BEGIN
  FOR r IN
    SELECT ds.id, ds.account_user_id, ds.claimed_at
    FROM public.demo_sessions ds
    WHERE ds.released = false
      AND ds.last_activity < now() - interval '3 hours'
  LOOP
    SELECT id INTO v_student_id FROM public.students WHERE user_id = r.account_user_id;
    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = r.account_user_id;

    IF v_student_id IS NOT NULL THEN
      DELETE FROM public.homework_submissions WHERE student_id = v_student_id AND created_at > r.claimed_at;
      DELETE FROM public.lesson_stage_progress WHERE student_id = v_student_id AND completed_at > r.claimed_at;
      DELETE FROM public.quiz_attempts WHERE student_id = v_student_id AND created_at > r.claimed_at;
      DELETE FROM public.lesson_raised_hands WHERE student_id = v_student_id AND created_at > r.claimed_at;
      DELETE FROM public.ai_chat_messages WHERE student_id = v_student_id AND created_at > r.claimed_at;
      -- Исправление отклонения: посещаемость и оценки за урок этого demo-ученика.
      DELETE FROM public.attendance WHERE student_id = v_student_id AND recorded_at > r.claimed_at;
      DELETE FROM public.lesson_grades WHERE student_id = v_student_id AND graded_at > r.claimed_at;
    END IF;

    IF v_teacher_id IS NOT NULL THEN
      -- lessons/homework/materials created by this demo teacher during the
      -- session — cascades to lesson_stages/lesson_materials/homework_submissions/etc.
      DELETE FROM public.lessons
        WHERE group_id IN (SELECT group_id FROM public.group_teachers WHERE teacher_id = v_teacher_id)
          AND created_at > r.claimed_at;
      DELETE FROM public.homework WHERE teacher_id = v_teacher_id AND created_at > r.claimed_at;
      DELETE FROM public.course_materials WHERE uploaded_by = v_teacher_id AND created_at > r.claimed_at;
      DELETE FROM public.lesson_materials WHERE uploaded_by = v_teacher_id AND created_at > r.claimed_at;
      -- Исправление отклонения: посещаемость/оценки, которые отметил/выставил этот demo-учитель.
      DELETE FROM public.attendance WHERE marked_by = v_teacher_id AND marked_at > r.claimed_at;
      DELETE FROM public.lesson_grades WHERE graded_by = v_teacher_id AND graded_at > r.claimed_at;
    END IF;

    DELETE FROM public.chat_messages WHERE sender_id = r.account_user_id AND created_at > r.claimed_at;
    DELETE FROM public.notifications WHERE recipient_user_id = r.account_user_id AND created_at > r.claimed_at;

    UPDATE public.demo_sessions SET released = true WHERE id = r.id;
  END LOOP;
END;
$function$;

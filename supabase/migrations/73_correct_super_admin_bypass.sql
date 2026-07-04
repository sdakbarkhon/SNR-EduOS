-- =====================================================================
-- Migration 73 — fix: correct super_admin bypass grouping in RLS policies.
--
-- Found during live post-apply verification of migration 71 (scenario A:
-- logging in as super_admin, checking visibility across tables). The
-- admins table showed 0 visible rows to super_admin when 1 exists, which
-- traced back to a systemic grouping error introduced by migration 71's
-- Part F rewrite.
--
-- Migration 71 appended the school clause as:
--   <original_condition> AND (is_super_admin() OR school_id = current_school_id())
-- This is WRONG whenever <original_condition> is itself an ownership/
-- existence check (student_id = current_student_id(), user_id = auth.uid(),
-- an EXISTS(...) join, etc.) — is_super_admin() only ever satisfies the
-- inner school-scoping clause, never the outer ownership clause, so a
-- super_admin (whose own id never equals another user's ownership key)
-- was silently denied by every one of these policies. It only "worked"
-- on students/teachers/groups/student_groups/subjects because those
-- tables also carry a separate, correctly-grouped "admin full access X"
-- policy ((fn_is_admin() AND school_id = current_school_id()) OR
-- is_super_admin()) that independently grants super_admin visibility —
-- Postgres ORs together all applicable SELECT policies for a role, so
-- the broader policy masked the narrower one's bug on those five tables.
-- Every other table (attendance, grades, homework, payments, messages,
-- projects, quizzes, tests, classwork, leave_requests, lesson-detail
-- tables, admins, etc.) had no such broader policy, so super_admin was
-- silently blind to essentially all of it.
--
-- Fix: regenerate every affected policy from its live pg_policies text
-- (149 policies across the tables below), changing the grouping to:
--   (<original_condition> AND school_id = current_school_id()) OR is_super_admin()
-- so is_super_admin() is now a genuine top-level bypass, matching the
-- pattern already used correctly for the "admin full access X" policies.
-- A regular user's access is unchanged — the original_condition and
-- school_id check still both apply to them exactly as before; only the
-- super_admin path changes from "never triggers" to "always bypasses".
--
-- Generated mechanically from the live qual/with_check text on hosted
-- (not retyped by hand) to guarantee every substitution is exact and
-- none are missed. Idempotent: ALTER POLICY always converges to the
-- same final USING/WITH CHECK text regardless of prior state.
-- =====================================================================

ALTER POLICY "admin reads own record" ON public.admins
  USING ((((user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own ai messages" ON public.ai_chat_messages
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own ai messages" ON public.ai_chat_messages
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads ai messages of own groups" ON public.ai_chat_messages
  USING ((((EXISTS ( SELECT 1
   FROM ((students s
     JOIN student_groups sg ON ((sg.student_id = s.id)))
     JOIN groups g ON ((g.id = sg.group_id)))
  WHERE ((s.id = ai_chat_messages.student_id) AND (g.teacher_id = current_teacher_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own reads" ON public.announcement_reads
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own reads" ON public.announcement_reads
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads reads of own announcements" ON public.announcement_reads
  USING ((((EXISTS ( SELECT 1
   FROM announcements a
  WHERE ((a.id = announcement_reads.announcement_id) AND (a.created_by = current_teacher_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "user inserts own ticker reads" ON public.announcement_user_reads
  WITH CHECK ((((user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "user reads own ticker reads" ON public.announcement_user_reads
  USING ((((user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads announcements" ON public.announcements
  USING ((((((scope = 'group'::text) AND is_my_group(group_id)) OR ((scope = 'all_my_groups'::text) AND (EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.teacher_id = announcements.created_by) AND is_my_group(g.id))))) OR ((scope = 'student'::text) AND (target_student_id = current_student_id())))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher creates announcements" ON public.announcements
  WITH CHECK ((((created_by = current_teacher_id()) AND ((scope <> 'group'::text) OR is_my_teacher_group(group_id)) AND ((scope <> 'student'::text) OR (EXISTS ( SELECT 1
   FROM (student_groups sg
     JOIN groups g ON ((g.id = sg.group_id)))
  WHERE ((sg.student_id = announcements.target_student_id) AND (g.teacher_id = current_teacher_id())))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher deletes own announcements" ON public.announcements
  USING ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads own announcements" ON public.announcements
  USING ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates own announcements" ON public.announcements
  USING ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own attendance" ON public.attendance
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher inserts attendance" ON public.attendance
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads attendance in own groups" ON public.attendance
  USING ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates attendance" ON public.attendance
  USING ((((is_finalized = false) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = attendance.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student deletes own favorites" ON public.book_favorites
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own favorites" ON public.book_favorites
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own favorites" ON public.book_favorites
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher deletes own books" ON public.books
  USING ((((uploaded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher inserts books" ON public.books
  WITH CHECK ((((uploaded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates own books" ON public.books
  USING ((((uploaded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own charges" ON public.charges
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads classwork in own group" ON public.classwork
  USING ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = classwork.lesson_id) AND is_my_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher deletes classwork" ON public.classwork
  USING ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher inserts classwork" ON public.classwork
  WITH CHECK ((((created_by = current_teacher_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = classwork.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads classwork in own group" ON public.classwork
  USING ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = classwork.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates classwork" ON public.classwork
  USING ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads classwork questions after submit" ON public.classwork_questions
  USING (((((EXISTS ( SELECT 1
   FROM ((classwork_submissions cs
     JOIN classwork c ON ((c.id = cs.classwork_id)))
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((cs.classwork_id = cs.classwork_id) AND (cs.student_id = current_student_id())))) OR (EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_questions.classwork_id) AND is_my_group(l.group_id)))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher manages classwork questions" ON public.classwork_questions
  USING ((((EXISTS ( SELECT 1
   FROM classwork c
  WHERE ((c.id = classwork_questions.classwork_id) AND (c.created_by = current_teacher_id()))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM classwork c
  WHERE ((c.id = classwork_questions.classwork_id) AND (c.created_by = current_teacher_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads classwork questions" ON public.classwork_questions
  USING ((((EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_questions.classwork_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own classwork submission" ON public.classwork_submissions
  WITH CHECK ((((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_submissions.classwork_id) AND is_my_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own classwork submissions" ON public.classwork_submissions
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own ungraded submission" ON public.classwork_submissions
  USING ((((student_id = current_student_id()) AND (grade IS NULL)) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher grades classwork submissions" ON public.classwork_submissions
  USING ((((EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_submissions.classwork_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_submissions.classwork_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads classwork submissions" ON public.classwork_submissions
  USING ((((EXISTS ( SELECT 1
   FROM (classwork c
     JOIN lessons l ON ((l.id = c.lesson_id)))
  WHERE ((c.id = classwork_submissions.classwork_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own materials" ON public.course_materials
  USING (((is_my_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher deletes own materials" ON public.course_materials
  USING ((((uploaded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher inserts materials" ON public.course_materials
  WITH CHECK (((is_my_teacher_group(group_id) AND (uploaded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads group materials" ON public.course_materials
  USING (((is_my_teacher_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates own materials" ON public.course_materials
  USING ((((uploaded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own grades" ON public.grades
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads grades in own groups" ON public.grades
  USING ((((EXISTS ( SELECT 1
   FROM (student_groups sg
     JOIN groups g ON ((g.id = sg.group_id)))
  WHERE ((sg.student_id = grades.student_id) AND (g.teacher_id = current_teacher_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own groups" ON public.groups
  USING (((is_my_group(id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads own groups" ON public.groups
  USING ((((teacher_id = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own homework" ON public.homework
  USING (((is_my_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher creates homework" ON public.homework
  WITH CHECK (((is_my_teacher_group(group_id) AND (teacher_id = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher deletes own homework" ON public.homework
  USING ((((teacher_id = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads homework in own groups" ON public.homework
  USING (((is_my_teacher_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates own homework" ON public.homework
  USING ((((teacher_id = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((teacher_id = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student creates own submission" ON public.homework_submissions
  WITH CHECK ((((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = homework_submissions.homework_id) AND is_my_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own submissions" ON public.homework_submissions
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own submission" ON public.homework_submissions
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher grades submissions" ON public.homework_submissions
  USING ((((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = homework_submissions.homework_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = homework_submissions.homework_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads submissions in own groups" ON public.homework_submissions
  USING ((((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = homework_submissions.homework_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads kahoot sessions" ON public.kahoot_sessions
  USING (((is_my_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = kahoot_sessions.stage_id)))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher manages kahoot sessions" ON public.kahoot_sessions
  USING (((is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = kahoot_sessions.stage_id)))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK (((is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = kahoot_sessions.stage_id)))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own leave_requests" ON public.leave_requests
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student selects own leave_requests" ON public.leave_requests
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher manages leave_requests" ON public.leave_requests
  USING ((((EXISTS ( SELECT 1
   FROM (lessons l
     JOIN groups g ON ((g.id = l.group_id)))
  WHERE ((l.id = leave_requests.lesson_id) AND (g.teacher_id = current_teacher_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student creates own excuse request" ON public.lesson_excuse_requests
  WITH CHECK ((((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_excuse_requests.lesson_id) AND is_my_group(l.group_id) AND (l.status = 'scheduled'::text))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student deletes own excuse request" ON public.lesson_excuse_requests
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own excuse requests" ON public.lesson_excuse_requests
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own excuse request" ON public.lesson_excuse_requests
  USING ((((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_excuse_requests.lesson_id) AND (l.status = 'scheduled'::text))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads excuse requests in own groups" ON public.lesson_excuse_requests
  USING ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_excuse_requests.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own lesson grades" ON public.lesson_grades
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher deletes lesson grades" ON public.lesson_grades
  USING ((((graded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher inserts lesson grades" ON public.lesson_grades
  WITH CHECK ((((graded_by = current_teacher_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_grades.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads lesson grades in own groups" ON public.lesson_grades
  USING ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_grades.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates lesson grades" ON public.lesson_grades
  USING ((((graded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((graded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "lesson_materials: delete" ON public.lesson_materials
  USING ((((uploaded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "lesson_materials: insert" ON public.lesson_materials
  WITH CHECK ((((uploaded_by = current_teacher_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_materials.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "lesson_materials: read" ON public.lesson_materials
  USING (((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_materials.lesson_id) AND is_my_group(l.group_id)))) OR (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_materials.lesson_id) AND is_my_teacher_group(l.group_id)))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "lesson_materials: update" ON public.lesson_materials
  USING ((((uploaded_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student raises own hand" ON public.lesson_raised_hands
  WITH CHECK ((((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_raised_hands.lesson_id) AND is_my_group(l.group_id) AND (l.status = 'in_progress'::text))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own raised hands" ON public.lesson_raised_hands
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher lowers raised hand" ON public.lesson_raised_hands
  USING ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_raised_hands.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_raised_hands.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads raised hands in own groups" ON public.lesson_raised_hands
  USING ((((EXISTS ( SELECT 1
   FROM lessons l
  WHERE ((l.id = lesson_raised_hands.lesson_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own stage progress" ON public.lesson_stage_progress
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own stage progress" ON public.lesson_stage_progress
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own stage progress" ON public.lesson_stage_progress
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher grades stage progress" ON public.lesson_stage_progress
  USING (((is_my_teacher_group(( SELECT l.group_id
   FROM (lessons l
     JOIN lesson_stages ls ON ((ls.lesson_id = l.id)))
  WHERE (ls.id = lesson_stage_progress.stage_id)
 LIMIT 1))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher inserts stage progress in own groups" ON public.lesson_stage_progress
  WITH CHECK (((is_my_teacher_group(( SELECT l.group_id
   FROM (lessons l
     JOIN lesson_stages ls ON ((ls.lesson_id = l.id)))
  WHERE (ls.id = lesson_stage_progress.stage_id)
 LIMIT 1))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads stage progress in own groups" ON public.lesson_stage_progress
  USING (((is_my_teacher_group(( SELECT l.group_id
   FROM (lessons l
     JOIN lesson_stages ls ON ((ls.lesson_id = l.id)))
  WHERE (ls.id = lesson_stage_progress.stage_id)
 LIMIT 1))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own group lesson stages" ON public.lesson_stages
  USING (((is_my_group(( SELECT lessons.group_id
   FROM lessons
  WHERE (lessons.id = lesson_stages.lesson_id)
 LIMIT 1))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher manages own lesson stages" ON public.lesson_stages
  USING (((is_my_teacher_group(( SELECT lessons.group_id
   FROM lessons
  WHERE (lessons.id = lesson_stages.lesson_id)
 LIMIT 1))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK (((is_my_teacher_group(( SELECT lessons.group_id
   FROM lessons
  WHERE (lessons.id = lesson_stages.lesson_id)
 LIMIT 1))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own lessons" ON public.lessons
  USING (((is_my_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads lessons in own groups" ON public.lessons
  USING (((is_my_teacher_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates own group lessons" ON public.lessons
  USING (((is_my_teacher_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK (((is_my_teacher_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teachers_delete_lessons" ON public.lessons
  USING (((is_my_teacher_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teachers_insert_lessons" ON public.lessons
  WITH CHECK (((is_my_teacher_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student marks own message read" ON public.messages
  USING ((((recipient_student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((recipient_student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own messages" ON public.messages
  USING (((((recipient_student_id = current_student_id()) OR ((group_id IS NOT NULL) AND is_my_group(group_id)) OR (sender_id = auth.uid()))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student sends message" ON public.messages
  WITH CHECK ((((sender_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own notif settings" ON public.notification_settings
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own notif settings" ON public.notification_settings
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own notif settings" ON public.notification_settings
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "user deletes own notifications" ON public.notifications
  USING ((((recipient_user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "user inserts own notifications" ON public.notifications
  WITH CHECK ((((recipient_user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "user reads own notifications" ON public.notifications
  USING ((((recipient_user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "user updates own notifications" ON public.notifications
  USING ((((recipient_user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((recipient_user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own payments" ON public.payments
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student manages own project attachments" ON public.project_attachments
  USING ((((EXISTS ( SELECT 1
   FROM project_submissions s
  WHERE ((s.id = project_attachments.submission_id) AND (s.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM project_submissions s
  WHERE ((s.id = project_attachments.submission_id) AND (s.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads project attachments" ON public.project_attachments
  USING ((((EXISTS ( SELECT 1
   FROM (project_submissions s
     JOIN projects p ON ((p.id = s.project_id)))
  WHERE ((s.id = project_attachments.submission_id) AND is_my_teacher_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student manages own stage progress" ON public.project_stage_progress
  USING ((((EXISTS ( SELECT 1
   FROM project_submissions s
  WHERE ((s.id = project_stage_progress.submission_id) AND (s.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM project_submissions s
  WHERE ((s.id = project_stage_progress.submission_id) AND (s.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads stage progress" ON public.project_stage_progress
  USING ((((EXISTS ( SELECT 1
   FROM (project_submissions s
     JOIN projects p ON ((p.id = s.project_id)))
  WHERE ((s.id = project_stage_progress.submission_id) AND is_my_teacher_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads project stages" ON public.project_stages
  USING ((((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_stages.project_id) AND is_my_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher manages project stages" ON public.project_stages
  USING ((((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_stages.project_id) AND is_my_teacher_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_stages.project_id) AND is_my_teacher_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student creates own project submission" ON public.project_submissions
  WITH CHECK ((((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_submissions.project_id) AND is_my_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own project submission" ON public.project_submissions
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own project submission" ON public.project_submissions
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher grades project submissions" ON public.project_submissions
  USING ((((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_submissions.project_id) AND is_my_teacher_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_submissions.project_id) AND is_my_teacher_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads group project submissions" ON public.project_submissions
  USING ((((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_submissions.project_id) AND is_my_teacher_group(p.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads group projects" ON public.projects
  USING (((is_my_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher creates projects" ON public.projects
  WITH CHECK (((is_my_teacher_group(group_id) AND (created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher deletes own projects" ON public.projects
  USING ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads group projects" ON public.projects
  USING (((is_my_teacher_group(group_id)) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates own projects" ON public.projects
  USING ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((created_by = current_teacher_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own quiz answers" ON public.quiz_answers
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM quiz_attempts a
  WHERE ((a.id = quiz_answers.attempt_id) AND (a.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own quiz answers" ON public.quiz_answers
  USING ((((EXISTS ( SELECT 1
   FROM quiz_attempts a
  WHERE ((a.id = quiz_answers.attempt_id) AND (a.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own quiz answers" ON public.quiz_answers
  USING ((((EXISTS ( SELECT 1
   FROM quiz_attempts a
  WHERE ((a.id = quiz_answers.attempt_id) AND (a.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads group quiz answers" ON public.quiz_answers
  USING ((((EXISTS ( SELECT 1
   FROM ((quiz_attempts a
     JOIN lesson_stages ls ON ((ls.id = a.stage_id)))
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE ((a.id = quiz_answers.attempt_id) AND is_my_teacher_group(l.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student inserts own quiz attempts" ON public.quiz_attempts
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own quiz attempts" ON public.quiz_attempts
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own quiz attempts" ON public.quiz_attempts
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads group quiz attempts" ON public.quiz_attempts
  USING (((is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_attempts.stage_id)))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates group quiz attempts" ON public.quiz_attempts
  USING (((is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_attempts.stage_id)))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads quiz questions" ON public.quiz_questions
  USING (((is_my_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_questions.stage_id)))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher manages quiz questions" ON public.quiz_questions
  USING (((is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_questions.stage_id)))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK (((is_my_teacher_group(( SELECT l.group_id
   FROM (lesson_stages ls
     JOIN lessons l ON ((l.id = ls.lesson_id)))
  WHERE (ls.id = quiz_questions.stage_id)))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own memberships" ON public.student_groups
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads memberships in own groups" ON public.student_groups
  USING ((((EXISTS ( SELECT 1
   FROM groups g
  WHERE ((g.id = student_groups.group_id) AND (g.teacher_id = current_teacher_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own profile" ON public.students
  USING ((((user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads students in own groups" ON public.students
  USING ((((EXISTS ( SELECT 1
   FROM (student_groups sg
     JOIN groups g ON ((g.id = sg.group_id)))
  WHERE ((sg.student_id = students.id) AND (g.teacher_id = current_teacher_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads own profile" ON public.teachers
  USING ((((user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates own profile" ON public.teachers
  USING ((((user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((user_id = auth.uid())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student creates own test answers" ON public.test_answers
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM test_submissions ts
  WHERE ((ts.id = test_answers.submission_id) AND (ts.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own test answers" ON public.test_answers
  USING ((((EXISTS ( SELECT 1
   FROM test_submissions ts
  WHERE ((ts.id = test_answers.submission_id) AND (ts.student_id = current_student_id()))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads test answers in own groups" ON public.test_answers
  USING ((((EXISTS ( SELECT 1
   FROM (test_submissions ts
     JOIN homework h ON ((h.id = ts.homework_id)))
  WHERE ((ts.id = test_answers.submission_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads test options" ON public.test_question_options
  USING ((((EXISTS ( SELECT 1
   FROM (test_questions q
     JOIN test_submissions ts ON ((ts.homework_id = q.homework_id)))
  WHERE ((q.id = test_question_options.question_id) AND (ts.student_id = current_student_id()) AND (ts.started_at IS NOT NULL))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher manages test options in own groups" ON public.test_question_options
  USING ((((EXISTS ( SELECT 1
   FROM (test_questions q
     JOIN homework h ON ((h.id = q.homework_id)))
  WHERE ((q.id = test_question_options.question_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM (test_questions q
     JOIN homework h ON ((h.id = q.homework_id)))
  WHERE ((q.id = test_question_options.question_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads test questions" ON public.test_questions
  USING ((((EXISTS ( SELECT 1
   FROM test_submissions ts
  WHERE ((ts.homework_id = test_questions.homework_id) AND (ts.student_id = current_student_id()) AND (ts.started_at IS NOT NULL))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher manages test questions in own groups" ON public.test_questions
  USING ((((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_questions.homework_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_questions.homework_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student creates own test submission" ON public.test_submissions
  WITH CHECK ((((student_id = current_student_id()) AND (EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_submissions.homework_id) AND is_my_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student reads own test submissions" ON public.test_submissions
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "student updates own test submission" ON public.test_submissions
  USING ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((student_id = current_student_id())) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher reads test submissions in own groups" ON public.test_submissions
  USING ((((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_submissions.homework_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

ALTER POLICY "teacher updates test submissions" ON public.test_submissions
  USING ((((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_submissions.homework_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin())
  WITH CHECK ((((EXISTS ( SELECT 1
   FROM homework h
  WHERE ((h.id = test_submissions.homework_id) AND is_my_teacher_group(h.group_id))))) AND (school_id = current_school_id())) OR is_super_admin());

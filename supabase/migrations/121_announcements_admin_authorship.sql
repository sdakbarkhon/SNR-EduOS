-- =====================================================================
-- Migration 121 — Промт 7.1 Часть 2: разрешить admin-объявления.
--
-- Баг: apps/web/app/admin/announcements/AdminAnnouncementsView.tsx уже
-- существовал и вызывал createAnnouncement(db, {teacherId: creatorId, ...})
-- с creatorId = auth.uid() (page.tsx передавал user?.id напрямую, не
-- teachers.id). Insert падал на FK: announcements.created_by REFERENCES
-- teachers(id), а auth.uid() никогда не совпадает ни с одной строкой
-- teachers.id (независимые UUID-пространства). Даже для super_admin (для
-- которого RLS-обход OR is_super_admin() пропустил бы политику) INSERT всё
-- равно падал на FK раньше, чем на RLS. fn_announce_notify()'s
-- is_admin_author-ветка (EXISTS(... WHERE admins.id = NEW.created_by))
-- была mёртвым кодом по той же причине — created_by физически не мог
-- содержать admins.id.
--
-- Решение (вариант Б из согласованных с пользователем — отдельная
-- nullable-колонка + CHECK "ровно один автор"): не трогает существующую
-- teacher-логику (created_by/current_teacher_id() остаются как есть),
-- только добавляет параллельный путь для admin_id/current_admin_id().
-- Альтернатива "created_by → auth.users(id)" (по прецеденту
-- parents.created_by) отклонена — потребовала бы менять уже рабочую
-- teacher-ветку RLS/query-слоя, что явно запрещено пользователем.
-- =====================================================================

BEGIN;

-- ── 1. admin_id колонка + CHECK "ровно один автор" ──────────────────────

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS admin_id uuid REFERENCES public.admins(id) ON DELETE CASCADE;

-- Существующие строки: investigation подтвердила (все успешные INSERT до
-- этой миграции проходили только через teacher-путь, admin-путь всегда
-- падал на FK) — created_by IS NOT NULL на 100% строк. CHECK безопасен без
-- бэкофилла.
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_author_check;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_author_check CHECK (
    (created_by IS NOT NULL AND admin_id IS NULL)
    OR (created_by IS NULL AND admin_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_announcements_admin_id
  ON public.announcements (admin_id) WHERE admin_id IS NOT NULL;

-- ── 2. current_admin_id() — тот же паттерн, что current_teacher_id() ────

CREATE OR REPLACE FUNCTION public.current_admin_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.admins WHERE user_id = auth.uid() LIMIT 1;
$$;

-- ── 3. RLS: teacher-ветки не трогаем, только добавляем admin-ветку ──────

DROP POLICY IF EXISTS "student reads announcements" ON public.announcements;
CREATE POLICY "student reads announcements" ON public.announcements
  USING (
    (
      (
        (
          scope = 'group' AND is_my_group(group_id)
        )
        OR (
          scope = 'all_my_groups' AND (
            -- admin-автор: "все мои группы" = вся школа (у админа нет
            -- собственных групп-курируемых, в отличие от учителя-куратора).
            admin_id IS NOT NULL
            OR (created_by IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.groups g
                  WHERE g.teacher_id = announcements.created_by AND is_my_group(g.id)
                ))
          )
        )
        OR (
          scope = 'student' AND target_student_id = current_student_id()
        )
      )
      AND school_id = current_school_id()
    )
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "teacher creates announcements" ON public.announcements;
CREATE POLICY "teacher or admin creates announcements" ON public.announcements
  WITH CHECK (
    (
      created_by = current_teacher_id()
      AND (scope <> 'group' OR is_my_teacher_group(group_id))
      AND (scope <> 'student' OR EXISTS (
            SELECT 1 FROM public.student_groups sg JOIN public.groups g ON g.id = sg.group_id
            WHERE sg.student_id = announcements.target_student_id AND g.teacher_id = current_teacher_id()))
      AND school_id = current_school_id()
    )
    OR (
      admin_id = current_admin_id()
      AND fn_is_admin()
      -- Админ не таргетирует одного ученика в этой форме (UI не даёт такой
      -- выбор) — только 'group' (конкретная группа школы) или
      -- 'all_my_groups' (вся школа).
      AND scope IN ('group', 'all_my_groups')
      AND (scope <> 'group' OR EXISTS (
            SELECT 1 FROM public.groups g WHERE g.id = announcements.group_id AND g.school_id = current_school_id()))
      AND school_id = current_school_id()
    )
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "teacher reads own announcements" ON public.announcements;
CREATE POLICY "teacher or admin reads own announcements" ON public.announcements
  USING (
    (created_by = current_teacher_id() AND school_id = current_school_id())
    OR (admin_id = current_admin_id() AND school_id = current_school_id())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "teacher updates own announcements" ON public.announcements;
CREATE POLICY "teacher or admin updates own announcements" ON public.announcements
  USING (
    (created_by = current_teacher_id() AND school_id = current_school_id())
    OR (admin_id = current_admin_id() AND school_id = current_school_id())
    OR is_super_admin()
  )
  WITH CHECK (
    (created_by = current_teacher_id() AND school_id = current_school_id())
    OR (admin_id = current_admin_id() AND school_id = current_school_id())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "teacher deletes own announcements" ON public.announcements;
CREATE POLICY "teacher or admin deletes own announcements" ON public.announcements
  USING (
    (created_by = current_teacher_id() AND school_id = current_school_id())
    OR (admin_id = current_admin_id() AND school_id = current_school_id())
    OR is_super_admin()
  );

-- ── 4. fn_announce_notify: is_admin_author больше не мёртвый код ────────
-- Teacher-ветки (scope='group' student-loop, scope='all_my_groups' через
-- groups.teacher_id, scope='student') побайтово идентичны прежней версии
-- (миграция 83) — меняется только источник is_admin_author (был:
-- EXISTS(... admins.id = NEW.created_by), физически недостижимо; стал:
-- NEW.admin_id IS NOT NULL) и добавлена admin-ветка для 'all_my_groups'
-- (вся школа, а не "группы автора" — у админа таких нет).

CREATE OR REPLACE FUNCTION public.fn_announce_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin_author boolean;
  r record;
BEGIN
  is_admin_author := NEW.admin_id IS NOT NULL;

  IF NEW.scope = 'group' THEN
    FOR r IN
      SELECT sg.student_id
      FROM public.student_groups sg
      WHERE sg.group_id = NEW.group_id
    LOOP
      PERFORM public.notify_user_and_parents(
        r.student_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
      );
    END LOOP;

    IF is_admin_author THEN
      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
      SELECT t.user_id, 'announcement_new', NEW.title, left(NEW.body, 100), '/teacher/announcements', NEW.id
      FROM public.groups g JOIN public.teachers t ON t.id = g.teacher_id
      WHERE g.id = NEW.group_id AND t.user_id IS NOT NULL;
    END IF;

  ELSIF NEW.scope = 'all_my_groups' THEN
    IF is_admin_author THEN
      -- Вся школа: у админа нет "своих" курируемых групп.
      FOR r IN
        SELECT DISTINCT sg.student_id
        FROM public.groups g
        JOIN public.student_groups sg ON sg.group_id = g.id
        WHERE g.school_id = NEW.school_id
      LOOP
        PERFORM public.notify_user_and_parents(
          r.student_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
        );
      END LOOP;

      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id)
      SELECT t.user_id, 'announcement_new', NEW.title, left(NEW.body, 100), '/teacher/announcements', NEW.id
      FROM public.teachers t WHERE t.school_id = NEW.school_id AND t.user_id IS NOT NULL;
    ELSE
      FOR r IN
        SELECT DISTINCT sg.student_id
        FROM public.groups g
        JOIN public.student_groups sg ON sg.group_id = g.id
        WHERE g.teacher_id = NEW.created_by
      LOOP
        PERFORM public.notify_user_and_parents(
          r.student_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
        );
      END LOOP;
    END IF;

  ELSIF NEW.scope = 'student' THEN
    PERFORM public.notify_user_and_parents(
      NEW.target_student_id, 'announcement', NEW.title, left(NEW.body, 100), '/announcements', NEW.id
    );
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('121')
ON CONFLICT (version) DO NOTHING;

COMMIT;

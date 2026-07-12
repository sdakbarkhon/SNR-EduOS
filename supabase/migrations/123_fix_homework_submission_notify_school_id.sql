-- =====================================================================
-- Migration 123 — Промт 7.3: notify-триггеры не задавали
-- notifications.school_id явно (весь класс бага, не только один случай).
--
-- Обнаружено при попытке service-role backfill'а homework_submissions:
-- notifications.school_id NOT NULL DEFAULT current_school_id(), а
-- current_school_id() резолвится через auth.uid() — под service-role
-- (auth.uid() IS NULL) это NULL, вставка в notifications падает, и ВСЯ
-- внешняя транзакция (включая исходный INSERT в homework_submissions)
-- откатывается. Тот же класс бага уже был исправлен для оценок в
-- миграции 101 (notify_user_and_parents), но остался непочиненным в
-- нескольких других notify-триггерах — под обычной браузерной сессией
-- (auth.uid() есть) это никогда не проявлялось, поэтому было незаметно
-- до первого service-role вызова.
--
-- По итогам аудита (grep всех функций с "INSERT INTO public.notifications")
-- нашлось ЧЕТЫРЕ места с этим паттерном:
--   1. fn_homework_submission_notify — напрямую блокировал Часть 3 этого
--      промта (сдача ДЗ).
--   2. fn_announce_notify — две ветки (scope='group'/'all_my_groups' от
--      админа, уведомление учителей) — напрямую блокирует Часть 5 этого
--      промта (объявления).
--   3. fn_excuse_notify, 4. fn_leave_request_notify — не используются в
--      этом промте напрямую, но тот же паттерн бага; чиним заодно, чтобы
--      не наступать на те же грабли в будущем service-role сценарии
--      (см. feedback_rls_migration_rigor: чинить весь класс бага, а не
--      точечно).
--
-- Фикс везде одинаковый: берём school_id из уже имеющегося в функции
-- join'а (homework/lessons/groups), а не полагаемся на DEFAULT — тот же
-- паттерн, что notify_user_and_parents уже использует с миграции 101.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_homework_submission_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t_user uuid; sname text; htitle text; hschool uuid;
BEGIN
  IF NEW.submitted_at IS NULL THEN RETURN NEW; END IF;
  SELECT t.user_id, h.title, h.school_id INTO t_user, htitle, hschool
  FROM public.homework h JOIN public.teachers t ON t.id = h.teacher_id WHERE h.id = NEW.homework_id;
  SELECT full_name INTO sname FROM public.students WHERE id = NEW.student_id;
  IF t_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id, school_id)
    VALUES (t_user, 'student_submitted', 'Ученик сдал работу',
            coalesce(sname,'') || ': ' || coalesce(htitle,''), '/teacher/homework/' || NEW.homework_id, NEW.id,
            coalesce(hschool, NEW.school_id));
  END IF;
  RETURN NEW;
END;
$function$;

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
      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id, school_id)
      SELECT t.user_id, 'announcement_new', NEW.title, left(NEW.body, 100), '/teacher/announcements', NEW.id, NEW.school_id
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

      INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id, school_id)
      SELECT t.user_id, 'announcement_new', NEW.title, left(NEW.body, 100), '/teacher/announcements', NEW.id, NEW.school_id
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

CREATE OR REPLACE FUNCTION public.fn_excuse_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t_user uuid; sname text; lschool uuid;
BEGIN
  SELECT t.user_id, l.school_id INTO t_user, lschool
  FROM public.lessons l JOIN public.groups g ON g.id = l.group_id JOIN public.teachers t ON t.id = g.teacher_id
  WHERE l.id = NEW.lesson_id;
  SELECT full_name INTO sname FROM public.students WHERE id = NEW.student_id;
  IF t_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id, school_id)
    VALUES (t_user, 'student_excused', 'Ученик отпросился',
            coalesce(sname,'') || ': ' || coalesce(NEW.reason,''), '/teacher/lessons/' || NEW.lesson_id, NEW.id,
            lschool);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_leave_request_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t_user  uuid;
  sname   text;
  ltitle  text;
  lschool uuid;
BEGIN
  SELECT t.user_id, l.school_id INTO t_user, lschool
  FROM public.lessons l
  JOIN public.groups   g ON g.id = l.group_id
  JOIN public.teachers t ON t.id = g.teacher_id
  WHERE l.id = NEW.lesson_id
  LIMIT 1;

  SELECT full_name INTO sname FROM public.students WHERE id = NEW.student_id;
  SELECT coalesce(title, topic, 'урок') INTO ltitle FROM public.lessons WHERE id = NEW.lesson_id;

  IF t_user IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_user_id, kind, title, body, link, source_id, school_id)
    VALUES (
      t_user,
      'leave_request',
      coalesce(sname, 'Ученик') || ' просит отпроситься',
      'Причина: ' || coalesce(NEW.reason, ''),
      '/teacher/lessons/' || NEW.lesson_id,
      NEW.id,
      lschool
    );
  END IF;
  RETURN NEW;
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('123')
ON CONFLICT (version) DO NOTHING;

COMMIT;

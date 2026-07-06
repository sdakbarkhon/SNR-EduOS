-- Итерация 6, Промт 9: переименование teacher_demo -> teacher_karim +
-- родительский групповой чат класса (второй kind='group' тред на группу).
--
-- Известные ID (перепроверены отдельными запросами перед написанием):
--   teacher_demo / teacher_karim: user_id 46b5c585-4fb9-4778-8896-b20166549777,
--     teachers.id e6fc7339-0f8e-401c-adde-4577b28a41db.
--   Демо-аккаунт demo_teacher (@demo.snr.local) — ДРУГОЙ аккаунт, не трогается.
--
-- Часть 0 обнаружена в ходе расследования (не было в исходном ТЗ): миграция 78
-- создала UNIQUE INDEX chat_threads_group_unique_idx ON chat_threads(group_id)
-- WHERE kind='group' — допускает только ОДИН group-тред на group_id. Часть B/C
-- этой миграции требует ВТОРОЙ group-тред на тот же group_id (родительский),
-- что немедленно нарушило бы этот constraint. Ослабляем его до (group_id, title)
-- — сохраняет защиту от случайных дублей, но разрешает по одному ученическому
-- и одному родительскому треду на группу. RLS/UI ничего не знают о разнице
-- между "ученическим" и "родительским" group-тредом — они различаются только
-- участниками (chat_participants) и title, так что никаких других изменений
-- в чат-схеме/RLS не требуется.
--
-- Также обнаружено: миграция 78 создавала ученические group-треды ОДНОРАЗОВЫМ
-- DO-блоком (backfill), а не триггером — при создании новой группы после
-- миграции 78 тред вообще не создавался. Формулировка задания ("если уже есть
-- триггер на INSERT groups — расширь его") предполагала, что он есть; на деле
-- его не было. Поэтому Триггер 3 ниже создаёт СРАЗУ ОБА треда (ученический +
-- родительский) на INSERT новой группы — это закрывает и предполагаемый, и
-- реально обнаруженный пробел одним триггером.

BEGIN;

-- ---------------------------------------------------------------------
-- Part 0: ослабить уникальный индекс, чтобы разрешить второй group-тред
-- на группу (родительский, отличается только title).
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS public.chat_threads_group_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_group_title_unique_idx
  ON public.chat_threads (group_id, title) WHERE (kind = 'group');

-- ---------------------------------------------------------------------
-- Part A: переименование teacher_demo -> teacher_karim
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users
  WHERE email = 'teacher_demo@teachers.snr.local';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'teacher_demo not found, skipping rename';
    RETURN;
  END IF;

  UPDATE auth.users
  SET email = 'teacher_karim@teachers.snr.local',
      raw_user_meta_data = raw_user_meta_data
        || jsonb_build_object('username', 'teacher_karim')
  WHERE id = v_user_id;

  UPDATE auth.identities
  SET identity_data = identity_data
    || jsonb_build_object('email', 'teacher_karim@teachers.snr.local')
  WHERE user_id = v_user_id;

  UPDATE public.teachers
  SET username = 'teacher_karim'
  WHERE user_id = v_user_id;
END $$;

-- ---------------------------------------------------------------------
-- Part B: одноразовый backfill родительских group-тредов для уже
-- существующих групп, у которых есть 1+ родителей учеников.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r_group RECORD;
  v_thread_id uuid;
  v_curator_user_id uuid;
BEGIN
  FOR r_group IN
    SELECT g.id, g.name, g.school_id, g.teacher_id
    FROM public.groups g
    WHERE EXISTS (
      SELECT 1 FROM public.student_groups sg
      JOIN public.parent_students ps ON ps.student_id = sg.student_id
      WHERE sg.group_id = g.id
    )
  LOOP
    SELECT t.user_id INTO v_curator_user_id
    FROM public.teachers t WHERE t.id = r_group.teacher_id;

    SELECT id INTO v_thread_id FROM public.chat_threads
    WHERE kind = 'group'
      AND group_id = r_group.id
      AND title = r_group.name || ' — Родители';

    IF v_thread_id IS NULL THEN
      INSERT INTO public.chat_threads (kind, school_id, group_id, title, created_at, updated_at)
      VALUES ('group', r_group.school_id, r_group.id,
              r_group.name || ' — Родители', now(), now())
      RETURNING id INTO v_thread_id;

      IF v_curator_user_id IS NOT NULL THEN
        INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
        VALUES (v_thread_id, v_curator_user_id, 'curator')
        ON CONFLICT (thread_id, user_id) DO NOTHING;
      END IF;
    END IF;

    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    SELECT v_thread_id, p.user_id, 'parent'
    FROM public.parents p
    JOIN public.parent_students ps ON ps.parent_id = p.id
    JOIN public.student_groups sg ON sg.student_id = ps.student_id
    WHERE sg.group_id = r_group.id
      AND p.user_id IS NOT NULL
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Part C: триггеры для будущего автосоздания/поддержания родительских
-- group-тредов.
-- ---------------------------------------------------------------------

-- C1: при добавлении parent_students-связи — добавить родителя в
-- родительский тред каждой группы ребёнка (создать тред, если его ещё нет).
CREATE OR REPLACE FUNCTION public.tg_add_parent_to_group_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r_group RECORD;
  v_thread_id uuid;
  v_curator_user_id uuid;
  v_parent_user_id uuid;
BEGIN
  SELECT user_id INTO v_parent_user_id FROM public.parents WHERE id = NEW.parent_id;
  IF v_parent_user_id IS NULL THEN RETURN NEW; END IF;

  FOR r_group IN
    SELECT g.id, g.name, g.school_id, g.teacher_id
    FROM public.student_groups sg
    JOIN public.groups g ON g.id = sg.group_id
    WHERE sg.student_id = NEW.student_id
  LOOP
    SELECT t.user_id INTO v_curator_user_id
    FROM public.teachers t WHERE t.id = r_group.teacher_id;

    SELECT id INTO v_thread_id FROM public.chat_threads
    WHERE kind = 'group'
      AND group_id = r_group.id
      AND title = r_group.name || ' — Родители';

    IF v_thread_id IS NULL THEN
      INSERT INTO public.chat_threads (kind, school_id, group_id, title, created_at, updated_at)
      VALUES ('group', r_group.school_id, r_group.id,
              r_group.name || ' — Родители', now(), now())
      RETURNING id INTO v_thread_id;

      IF v_curator_user_id IS NOT NULL THEN
        INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
        VALUES (v_thread_id, v_curator_user_id, 'curator')
        ON CONFLICT (thread_id, user_id) DO NOTHING;
      END IF;
    END IF;

    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_thread_id, v_parent_user_id, 'parent')
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_parent_add_to_group_thread ON public.parent_students;
CREATE TRIGGER trg_parent_add_to_group_thread
AFTER INSERT ON public.parent_students
FOR EACH ROW EXECUTE FUNCTION public.tg_add_parent_to_group_thread();

-- C2: при смене куратора группы (groups.teacher_id) — обновить куратора
-- и в ученическом, и в родительском group-треде этой группы.
CREATE OR REPLACE FUNCTION public.tg_group_curator_changed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old_user_id uuid;
  v_new_user_id uuid;
  v_thread_id uuid;
BEGIN
  IF NEW.teacher_id IS NOT DISTINCT FROM OLD.teacher_id THEN
    RETURN NEW;
  END IF;

  IF OLD.teacher_id IS NOT NULL THEN
    SELECT user_id INTO v_old_user_id FROM public.teachers WHERE id = OLD.teacher_id;
  END IF;
  IF NEW.teacher_id IS NOT NULL THEN
    SELECT user_id INTO v_new_user_id FROM public.teachers WHERE id = NEW.teacher_id;
  END IF;

  FOR v_thread_id IN
    SELECT id FROM public.chat_threads WHERE group_id = NEW.id AND kind = 'group'
  LOOP
    IF v_old_user_id IS NOT NULL THEN
      DELETE FROM public.chat_participants
      WHERE thread_id = v_thread_id AND user_id = v_old_user_id AND role_in_thread = 'curator';
    END IF;
    IF v_new_user_id IS NOT NULL THEN
      INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
      VALUES (v_thread_id, v_new_user_id, 'curator')
      ON CONFLICT (thread_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_group_curator_changed ON public.groups;
CREATE TRIGGER trg_group_curator_changed
AFTER UPDATE OF teacher_id ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.tg_group_curator_changed();

-- C3: при создании новой группы — создать ОБА group-треда (ученический +
-- родительский) сразу, с куратором (если teacher_id уже проставлен).
-- Ранее в системе НЕ было триггера на INSERT groups вообще (миграция 78
-- создавала ученические треды только одноразовым backfill-ом) — это
-- обнаруженный пробел, закрываемый здесь заодно с родительским тредом.
CREATE OR REPLACE FUNCTION public.tg_group_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_curator_user_id uuid;
  v_student_thread_id uuid;
  v_parent_thread_id uuid;
BEGIN
  IF NEW.teacher_id IS NOT NULL THEN
    SELECT user_id INTO v_curator_user_id FROM public.teachers WHERE id = NEW.teacher_id;
  END IF;

  INSERT INTO public.chat_threads (kind, school_id, group_id, title)
  VALUES ('group', NEW.school_id, NEW.id, NEW.name)
  RETURNING id INTO v_student_thread_id;

  INSERT INTO public.chat_threads (kind, school_id, group_id, title)
  VALUES ('group', NEW.school_id, NEW.id, NEW.name || ' — Родители')
  RETURNING id INTO v_parent_thread_id;

  IF v_curator_user_id IS NOT NULL THEN
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_student_thread_id, v_curator_user_id, 'curator')
    ON CONFLICT (thread_id, user_id) DO NOTHING;
    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    VALUES (v_parent_thread_id, v_curator_user_id, 'curator')
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_group_created ON public.groups;
CREATE TRIGGER trg_group_created
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.tg_group_created();

COMMIT;

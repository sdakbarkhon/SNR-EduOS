-- =====================================================================
-- Migration 78 — Chat infrastructure: schema + RLS + auto group threads
-- + migration of legacy public.messages into the new schema.
--
-- И6-П8 (Фаза 4, chat). Adds 4 new tables (chat_threads, chat_participants,
-- chat_messages, chat_read_state), auto-creates one kind='group' thread per
-- existing group that has 1+ students (curator + students as participants),
-- migrates all rows out of the legacy public.messages table (teacher→student
-- direct messages, teacher→group broadcasts — added in migration 8) into the
-- new schema, verifies the migrated row count matches the original count,
-- and only then drops public.messages.
--
-- Investigation before writing this migration (hosted, via Management API):
--   - public.messages: 0 rows total (0 direct, 0 group-broadcast) — the
--     table exists with columns id/sender_id/recipient_student_id/group_id/
--     body/created_at/read_at/school_id, but nothing has ever been written
--     to it in this environment. The migration-of-old-data logic below is
--     still implemented generically (not skipped) so it is correct if this
--     is ever re-run against an environment that does have legacy rows —
--     but in THIS run it will process 0 rows.
--   - chat_threads/chat_participants/chat_messages/chat_read_state: none of
--     the 4 tables exist yet (to_regclass all NULL) — clear to create.
--   - groups: 10 groups, every one already has exactly 1 student (student
--     seed data) and a non-null teacher_id — all 10 will get an
--     auto-created group thread.
--   - schema for teachers/students: teachers.user_id / students.user_id are
--     the auth.users ids used as chat_participants.user_id; groups.teacher_id
--     references teachers.id (not auth.users directly).
--
-- Reused RLS helpers (no new ones beyond is_my_thread, needed to avoid
-- self-referential RLS recursion on chat_participants — same reasoning as
-- is_my_child_group()/is_my_teacher_group() in migrations 74/75):
--   current_school_id(), is_super_admin(), fn_is_admin(uuid default auth.uid()),
--   current_teacher_id(), current_student_id().
--
-- Safety: the legacy-message migration (Part 4) is wrapped in a DO block
-- that RAISEs an EXCEPTION if the migrated chat_messages row count doesn't
-- match the original public.messages row count. Because this whole file is
-- submitted as a single multi-statement query, a RAISE EXCEPTION anywhere
-- rolls back the ENTIRE migration (new tables included) — matching the
-- explicit requirement that a count mismatch must fail the whole migration,
-- not just the data-copy step, and leave public.messages untouched.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Part 1: Schema
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('group', 'direct', 'admin_ai')),
  school_id uuid NOT NULL REFERENCES public.schools(id) DEFAULT current_school_id(),
  group_id uuid NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_group_unique_idx
  ON public.chat_threads (group_id) WHERE kind = 'group';
CREATE INDEX IF NOT EXISTS chat_threads_school_id_idx ON public.chat_threads (school_id);
CREATE INDEX IF NOT EXISTS chat_threads_group_id_idx ON public.chat_threads (group_id);
CREATE INDEX IF NOT EXISTS chat_threads_kind_school_idx ON public.chat_threads (kind, school_id);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_thread text NOT NULL CHECK (role_in_thread IN ('curator', 'student', 'teacher', 'parent', 'admin', 'bot')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_participants_user_id_idx ON public.chat_participants (user_id);
CREATE INDEX IF NOT EXISTS chat_participants_thread_id_idx ON public.chat_participants (thread_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  attachments jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz NULL,
  deleted_at timestamptz NULL,
  school_id uuid NOT NULL DEFAULT current_school_id()
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx ON public.chat_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_sender_id_idx ON public.chat_messages (sender_id);

CREATE TABLE IF NOT EXISTS public.chat_read_state (
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_message_id uuid NULL REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

-- Keeps chat_threads.updated_at current so the thread list can sort by
-- last activity without a join+aggregate on every list render.
CREATE OR REPLACE FUNCTION public.update_thread_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE public.chat_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_update_thread_updated_at ON public.chat_messages;
CREATE TRIGGER trg_update_thread_updated_at
  AFTER INSERT OR UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_updated_at();

-- SECURITY DEFINER so chat_participants' own RLS policy can check "am I a
-- participant of this thread" without recursively re-evaluating RLS on
-- chat_participants itself (same reasoning as is_my_child_group() in
-- migration 75 — avoids RLS self-recursion).
CREATE OR REPLACE FUNCTION public.is_my_thread(p_thread_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE thread_id = p_thread_id AND user_id = auth.uid()
  );
$fn$;

-- ---------------------------------------------------------------------
-- Part 2: RLS
-- ---------------------------------------------------------------------

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_read_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_threads' AND policyname = 'participants read their threads'
  ) THEN
    CREATE POLICY "participants read their threads" ON public.chat_threads
      FOR SELECT
      USING (
        is_my_thread(id)
        OR is_super_admin()
        OR (school_id = current_school_id() AND fn_is_admin())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_threads' AND policyname = 'admin/teacher create threads'
  ) THEN
    CREATE POLICY "admin/teacher create threads" ON public.chat_threads
      FOR INSERT
      WITH CHECK (
        is_super_admin()
        OR (school_id = current_school_id() AND fn_is_admin())
        OR (school_id = current_school_id() AND current_teacher_id() IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_threads' AND policyname = 'admin update threads'
  ) THEN
    CREATE POLICY "admin update threads" ON public.chat_threads
      FOR UPDATE
      USING (is_super_admin() OR (school_id = current_school_id() AND fn_is_admin()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_threads' AND policyname = 'admin delete threads'
  ) THEN
    CREATE POLICY "admin delete threads" ON public.chat_threads
      FOR DELETE
      USING (is_super_admin() OR (school_id = current_school_id() AND fn_is_admin()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_participants' AND policyname = 'read own or co-participant rows'
  ) THEN
    CREATE POLICY "read own or co-participant rows" ON public.chat_participants
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR is_my_thread(thread_id)
        OR is_super_admin()
        OR (fn_is_admin() AND EXISTS (
              SELECT 1 FROM public.chat_threads t
              WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id()
            ))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_participants' AND policyname = 'admin/teacher add participants'
  ) THEN
    CREATE POLICY "admin/teacher add participants" ON public.chat_participants
      FOR INSERT
      WITH CHECK (
        is_super_admin()
        OR (fn_is_admin() AND EXISTS (
              SELECT 1 FROM public.chat_threads t
              WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id()
            ))
        OR (current_teacher_id() IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.chat_threads t
              JOIN public.groups g ON g.id = t.group_id
              WHERE t.id = chat_participants.thread_id
                AND t.kind = 'group'
                AND g.teacher_id = current_teacher_id()
            ))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_participants' AND policyname = 'admin/teacher update participants'
  ) THEN
    CREATE POLICY "admin/teacher update participants" ON public.chat_participants
      FOR UPDATE
      USING (
        is_super_admin()
        OR (fn_is_admin() AND EXISTS (
              SELECT 1 FROM public.chat_threads t
              WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id()
            ))
        OR (current_teacher_id() IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.chat_threads t
              JOIN public.groups g ON g.id = t.group_id
              WHERE t.id = chat_participants.thread_id
                AND t.kind = 'group'
                AND g.teacher_id = current_teacher_id()
            ))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_participants' AND policyname = 'admin/teacher remove participants'
  ) THEN
    CREATE POLICY "admin/teacher remove participants" ON public.chat_participants
      FOR DELETE
      USING (
        is_super_admin()
        OR (fn_is_admin() AND EXISTS (
              SELECT 1 FROM public.chat_threads t
              WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id()
            ))
        OR (current_teacher_id() IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.chat_threads t
              JOIN public.groups g ON g.id = t.group_id
              WHERE t.id = chat_participants.thread_id
                AND t.kind = 'group'
                AND g.teacher_id = current_teacher_id()
            ))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'participants read messages'
  ) THEN
    CREATE POLICY "participants read messages" ON public.chat_messages
      FOR SELECT
      USING (
        is_my_thread(thread_id)
        OR is_super_admin()
        OR (fn_is_admin() AND school_id = current_school_id())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'participants send messages'
  ) THEN
    CREATE POLICY "participants send messages" ON public.chat_messages
      FOR INSERT
      WITH CHECK (
        is_my_thread(thread_id) AND sender_id = auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_messages' AND policyname = 'sender edits within 15min or admin'
  ) THEN
    CREATE POLICY "sender edits within 15min or admin" ON public.chat_messages
      FOR UPDATE
      USING (
        (sender_id = auth.uid() AND created_at > now() - interval '15 minutes')
        OR is_super_admin()
        OR (fn_is_admin() AND school_id = current_school_id())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_read_state' AND policyname = 'read own read state'
  ) THEN
    CREATE POLICY "read own read state" ON public.chat_read_state
      FOR SELECT
      USING (user_id = auth.uid() OR is_super_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_read_state' AND policyname = 'insert own read state'
  ) THEN
    CREATE POLICY "insert own read state" ON public.chat_read_state
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'chat_read_state' AND policyname = 'update own read state'
  ) THEN
    CREATE POLICY "update own read state" ON public.chat_read_state
      FOR UPDATE
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Part 3: Auto-create one group thread per existing group with 1+ students
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_group RECORD;
  v_thread_id uuid;
BEGIN
  FOR v_group IN
    SELECT g.id, g.name, g.teacher_id, g.school_id
    FROM public.groups g
    WHERE EXISTS (SELECT 1 FROM public.student_groups sg WHERE sg.group_id = g.id)
  LOOP
    SELECT id INTO v_thread_id FROM public.chat_threads WHERE group_id = v_group.id AND kind = 'group';

    IF v_thread_id IS NULL THEN
      INSERT INTO public.chat_threads (kind, school_id, group_id, title)
      VALUES ('group', v_group.school_id, v_group.id, v_group.name)
      RETURNING id INTO v_thread_id;
    END IF;

    IF v_group.teacher_id IS NOT NULL THEN
      INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
      SELECT v_thread_id, t.user_id, 'curator'
      FROM public.teachers t
      WHERE t.id = v_group.teacher_id AND t.user_id IS NOT NULL
      ON CONFLICT (thread_id, user_id) DO NOTHING;
    END IF;

    INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
    SELECT v_thread_id, s.user_id, 'student'
    FROM public.student_groups sg
    JOIN public.students s ON s.id = sg.student_id
    WHERE sg.group_id = v_group.id AND s.user_id IS NOT NULL
    ON CONFLICT (thread_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- Part 4: Migrate legacy public.messages into chat_threads/chat_messages,
-- verify row counts, then drop the legacy table. Any count mismatch raises
-- an exception, rolling back this entire migration (new tables included)
-- and leaving public.messages in place, per explicit requirement.
-- ---------------------------------------------------------------------

DO $$
DECLARE
  v_before_count integer;
  v_after_count integer;
  v_pair RECORD;
  v_group_msg RECORD;
  v_thread_id uuid;
  v_student_user_id uuid;
BEGIN
  SELECT COUNT(*) INTO v_before_count FROM public.messages;

  -- Direct: one thread per unique (sender, recipient student) pair.
  FOR v_pair IN
    SELECT DISTINCT sender_id, recipient_student_id
    FROM public.messages
    WHERE recipient_student_id IS NOT NULL
  LOOP
    SELECT user_id INTO v_student_user_id FROM public.students WHERE id = v_pair.recipient_student_id;

    IF v_student_user_id IS NOT NULL THEN
      SELECT ct.id INTO v_thread_id
      FROM public.chat_threads ct
      WHERE ct.kind = 'direct'
        AND EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.thread_id = ct.id AND cp.user_id = v_pair.sender_id)
        AND EXISTS (SELECT 1 FROM public.chat_participants cp WHERE cp.thread_id = ct.id AND cp.user_id = v_student_user_id)
      LIMIT 1;

      IF v_thread_id IS NULL THEN
        INSERT INTO public.chat_threads (kind, school_id, group_id, title)
        SELECT 'direct', m.school_id, NULL, NULL
        FROM public.messages m
        WHERE m.sender_id = v_pair.sender_id AND m.recipient_student_id = v_pair.recipient_student_id
        LIMIT 1
        RETURNING id INTO v_thread_id;

        INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
        VALUES (v_thread_id, v_pair.sender_id, 'teacher')
        ON CONFLICT (thread_id, user_id) DO NOTHING;

        INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
        VALUES (v_thread_id, v_student_user_id, 'student')
        ON CONFLICT (thread_id, user_id) DO NOTHING;
      END IF;

      INSERT INTO public.chat_messages (thread_id, sender_id, body, created_at, school_id)
      SELECT v_thread_id, m.sender_id, m.body, m.created_at, m.school_id
      FROM public.messages m
      WHERE m.sender_id = v_pair.sender_id AND m.recipient_student_id = v_pair.recipient_student_id;
    END IF;
  END LOOP;

  -- Group broadcasts: reuse the group thread auto-created in Part 3.
  FOR v_group_msg IN
    SELECT DISTINCT group_id FROM public.messages
    WHERE group_id IS NOT NULL AND recipient_student_id IS NULL
  LOOP
    SELECT id INTO v_thread_id FROM public.chat_threads WHERE group_id = v_group_msg.group_id AND kind = 'group';

    IF v_thread_id IS NOT NULL THEN
      INSERT INTO public.chat_messages (thread_id, sender_id, body, created_at, school_id)
      SELECT v_thread_id, m.sender_id, m.body, m.created_at, m.school_id
      FROM public.messages m
      WHERE m.group_id = v_group_msg.group_id AND m.recipient_student_id IS NULL;
    END IF;
  END LOOP;

  -- chat_messages was created empty earlier in this same migration, so its
  -- total row count at this point equals exactly what we just migrated.
  SELECT COUNT(*) INTO v_after_count FROM public.chat_messages;

  IF v_after_count != v_before_count THEN
    RAISE EXCEPTION 'chat_messages migration count mismatch: before=% after=%', v_before_count, v_after_count;
  END IF;

  RAISE NOTICE 'Legacy messages migration verified: % rows migrated', v_after_count;
END $$;

DROP TABLE public.messages CASCADE;

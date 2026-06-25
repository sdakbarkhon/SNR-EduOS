-- Migration 50: teacher settings columns + teacher avatar storage policies

-- 1. Add phone, bio, notification_preferences to teachers
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb
    DEFAULT '{"on_submission":true,"on_lesson_soon":true,"on_announcement":true,"on_leave_request":true}'::jsonb;

-- 2. Teacher RLS: allow update own profile (phone/bio/notification_preferences/avatar_url)
CREATE POLICY "teacher updates own profile"
  ON public.teachers FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Storage policies for teacher avatars (bucket 'avatars' already exists from migration 16)
--    Convention: avatars/teachers/<teacher_id>/filename
CREATE POLICY "teacher reads own avatar"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'teachers'
    AND (storage.foldername(name))[2] = (SELECT id FROM public.teachers WHERE user_id = auth.uid())::text
  );

CREATE POLICY "teacher uploads own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'teachers'
    AND (storage.foldername(name))[2] = (SELECT id FROM public.teachers WHERE user_id = auth.uid())::text
  );

CREATE POLICY "teacher updates own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'teachers'
    AND (storage.foldername(name))[2] = (SELECT id FROM public.teachers WHERE user_id = auth.uid())::text
  );

CREATE POLICY "teacher deletes own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'teachers'
    AND (storage.foldername(name))[2] = (SELECT id FROM public.teachers WHERE user_id = auth.uid())::text
  );

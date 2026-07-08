-- УЧ.9 часть 3: таблица h5p_content + RLS + storage bucket для self-host H5P (apps/h5p).

CREATE TABLE public.h5p_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content_type text NOT NULL DEFAULT 'H5P.MemoryGame',
  storage_path text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_h5p_content_school_id ON public.h5p_content(school_id);
CREATE INDEX idx_h5p_content_created_by ON public.h5p_content(created_by);

-- created_by/school_id are set server-side from the session, never trusted
-- from the client payload (EditorForm's insert omits both).
CREATE OR REPLACE FUNCTION public.fn_h5p_content_set_defaults()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  NEW.school_id := COALESCE(NEW.school_id, public.current_school_id());
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_h5p_content_set_defaults
  BEFORE INSERT ON public.h5p_content
  FOR EACH ROW EXECUTE FUNCTION public.fn_h5p_content_set_defaults();

CREATE OR REPLACE FUNCTION public.fn_h5p_content_touch_updated_at()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_h5p_content_touch_updated_at
  BEFORE UPDATE ON public.h5p_content
  FOR EACH ROW EXECUTE FUNCTION public.fn_h5p_content_touch_updated_at();

ALTER TABLE public.h5p_content ENABLE ROW LEVEL SECURITY;

-- Teacher: own content in their school, or anything public. Also covers
-- super_admin implicitly is NOT needed here since is_super_admin() gets its
-- own OR clause below for every action.
CREATE POLICY "h5p_content select" ON public.h5p_content
  FOR SELECT
  USING (
    is_public = true
    OR public.is_super_admin()
    OR school_id = public.current_school_id()
  );

CREATE POLICY "h5p_content insert by teacher" ON public.h5p_content
  FOR INSERT
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid())
  );

CREATE POLICY "h5p_content update by owner" ON public.h5p_content
  FOR UPDATE
  USING (
    public.is_super_admin()
    OR (created_by = auth.uid() AND school_id = public.current_school_id())
  )
  WITH CHECK (
    public.is_super_admin()
    OR (created_by = auth.uid() AND school_id = public.current_school_id())
  );

CREATE POLICY "h5p_content delete by owner" ON public.h5p_content
  FOR DELETE
  USING (
    public.is_super_admin()
    OR (created_by = auth.uid() AND school_id = public.current_school_id())
  );

-- Storage bucket: public read (self-host player fetches by public URL through
-- the apps/h5p proxy route), authenticated-teacher write.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'h5p-content', 'h5p-content', true, 10485760,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','application/json']
)
ON CONFLICT (id) DO UPDATE
  SET public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "public reads h5p-content" ON storage.objects;
DROP POLICY IF EXISTS "teacher uploads h5p-content" ON storage.objects;

CREATE POLICY "public reads h5p-content"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'h5p-content');

CREATE POLICY "teacher uploads h5p-content"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'h5p-content'
    AND (
      public.is_super_admin()
      OR EXISTS (SELECT 1 FROM public.teachers WHERE user_id = auth.uid())
    )
  );

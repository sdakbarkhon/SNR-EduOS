-- =====================================================================
-- Migration 20: Storage bucket "materials" + extend course_materials
-- =====================================================================

-- ── 1. Storage bucket ─────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials', 'materials', false, 52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'video/mp4'
  ]
)
on conflict (id) do update set
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. Extend course_materials ────────────────────────────────────────

alter table public.course_materials
  add column if not exists description     text,
  add column if not exists subject         text,
  add column if not exists file_type       text,
  add column if not exists storage_path    text,
  add column if not exists file_size_bytes bigint,
  add column if not exists uploaded_by     uuid references public.teachers(id) on delete set null;

-- ── 3. RLS on course_materials: teacher policies ─────────────────────
-- (student SELECT already exists from migration 11)

drop policy if exists "teacher reads group materials"  on public.course_materials;
drop policy if exists "teacher inserts materials"       on public.course_materials;
drop policy if exists "teacher updates own materials"   on public.course_materials;
drop policy if exists "teacher deletes own materials"   on public.course_materials;

create policy "teacher reads group materials"
  on public.course_materials for select to authenticated
  using (public.is_my_teacher_group(group_id));

create policy "teacher inserts materials"
  on public.course_materials for insert to authenticated
  with check (
    public.is_my_teacher_group(group_id)
    and uploaded_by = public.current_teacher_id()
  );

create policy "teacher updates own materials"
  on public.course_materials for update to authenticated
  using (uploaded_by = public.current_teacher_id());

create policy "teacher deletes own materials"
  on public.course_materials for delete to authenticated
  using (uploaded_by = public.current_teacher_id());

-- ── 4. Storage RLS for "materials" bucket ────────────────────────────
-- Path convention: materials/<teacher_id>/<group_id>/<material_id>/<filename>
-- SELECT: all authenticated (security gate is course_materials RLS)
-- INSERT: only the teacher whose id matches segment 1
-- DELETE: only the teacher whose id matches segment 1
-- UPDATE: nobody (materials are immutable; delete + re-upload instead)

drop policy if exists "authenticated reads materials bucket"   on storage.objects;
drop policy if exists "teacher uploads to materials bucket"    on storage.objects;
drop policy if exists "teacher deletes from materials bucket"  on storage.objects;

create policy "authenticated reads materials bucket"
  on storage.objects for select to authenticated
  using (bucket_id = 'materials');

create policy "teacher uploads to materials bucket"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

create policy "teacher deletes from materials bucket"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

-- ── 5. Grants ─────────────────────────────────────────────────────────

grant select                        on public.course_materials to authenticated, anon;
grant insert, update, delete        on public.course_materials to authenticated;

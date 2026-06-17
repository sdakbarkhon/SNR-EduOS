-- =====================================================================
-- Migration 21: books library (school-wide) + book_favorites + Storage
-- =====================================================================

-- Public books table — visible to all authenticated users
create table if not exists public.books (
  id                 uuid        primary key default gen_random_uuid(),
  title              text        not null,
  author             text,
  subject            text        not null,
  book_type          text        not null default 'Учебник'
                                 check (book_type in ('Учебник','Конспект','Сборник','Справочник')),
  description        text,
  cover_storage_path text,
  file_storage_path  text        not null,
  file_size_bytes    bigint,
  uploaded_by        uuid        references public.teachers(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- Per-student favorites
create table if not exists public.book_favorites (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students(id) on delete cascade,
  book_id    uuid        not null references public.books(id)   on delete cascade,
  created_at timestamptz not null default now(),
  unique (student_id, book_id)
);

create index if not exists book_favorites_student_idx on public.book_favorites (student_id);
create index if not exists book_favorites_book_idx    on public.book_favorites (book_id);

-- RLS
alter table public.books          enable row level security;
alter table public.book_favorites enable row level security;

-- books: all authenticated read (school-wide library)
drop policy if exists "authenticated reads books"  on public.books;
drop policy if exists "teacher inserts books"      on public.books;
drop policy if exists "teacher updates own books"  on public.books;
drop policy if exists "teacher deletes own books"  on public.books;

create policy "authenticated reads books"
  on public.books for select to authenticated using (true);

create policy "teacher inserts books"
  on public.books for insert to authenticated
  with check (uploaded_by = public.current_teacher_id());

create policy "teacher updates own books"
  on public.books for update to authenticated
  using (uploaded_by = public.current_teacher_id());

create policy "teacher deletes own books"
  on public.books for delete to authenticated
  using (uploaded_by = public.current_teacher_id());

-- book_favorites: student manages own rows only
drop policy if exists "student reads own favorites"   on public.book_favorites;
drop policy if exists "student inserts own favorites" on public.book_favorites;
drop policy if exists "student deletes own favorites" on public.book_favorites;

create policy "student reads own favorites"
  on public.book_favorites for select to authenticated
  using (student_id = public.current_student_id());

create policy "student inserts own favorites"
  on public.book_favorites for insert to authenticated
  with check (student_id = public.current_student_id());

create policy "student deletes own favorites"
  on public.book_favorites for delete to authenticated
  using (student_id = public.current_student_id());

-- Storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'books', 'books', false, 52428800,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS
drop policy if exists "authenticated reads books bucket"  on storage.objects;
drop policy if exists "teacher uploads to books bucket"   on storage.objects;
drop policy if exists "teacher deletes from books bucket" on storage.objects;

create policy "authenticated reads books bucket"
  on storage.objects for select to authenticated
  using (bucket_id = 'books');

create policy "teacher uploads to books bucket"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'books'
    and (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

create policy "teacher deletes from books bucket"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'books'
    and (storage.foldername(name))[1] = (public.current_teacher_id())::text
  );

-- GRANTs
grant select                    on public.books          to authenticated, anon;
grant insert, update, delete    on public.books          to authenticated;
grant select                    on public.book_favorites to authenticated;
grant insert, delete            on public.book_favorites to authenticated;

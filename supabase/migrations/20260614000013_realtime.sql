-- Realtime: подписки на изменения. RLS действует и на Realtime — ученик
-- получает события только по тем строкам, что ему разрешено видеть.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'lessons','homework','homework_submissions','grades',
    'attendance','payments','messages','announcements'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Полная «старая» строка в событиях update/delete (для фильтрации по RLS на клиенте).
alter table public.homework_submissions replica identity full;
alter table public.attendance           replica identity full;
alter table public.payments             replica identity full;
alter table public.grades               replica identity full;

-- Хотфикс УЧ.1 (Bug 3): sidebar unread-counter never cleared via realtime.
-- Root cause: migration 78 (chat infrastructure) created chat_threads/
-- chat_participants/chat_messages/chat_read_state but never added them to
-- the supabase_realtime publication — so postgres_changes subscriptions on
-- these tables (both the pre-existing chat_messages one and the new
-- chat_read_state one added in this same hotfix) silently never fire.
-- Same idempotent pattern as 20260614000013_realtime.sql.

do $$
declare t text;
begin
  foreach t in array array[
    'chat_threads','chat_participants','chat_messages','chat_read_state'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

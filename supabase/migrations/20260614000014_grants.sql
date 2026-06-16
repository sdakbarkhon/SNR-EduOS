-- Привилегии ролей API. RLS остаётся единственным фильтром СТРОК
-- (tz.md «Безопасность через RLS»); GRANT лишь даёт роли доступ к таблице,
-- а политики решают, какие строки видны/меняемы. Без GRANT политики RLS
-- даже не вычисляются (ошибка "permission denied for table").

grant usage on schema public to anon, authenticated;

-- Чтение: SELECT-грант у anon и authenticated; строки фильтрует RLS.
-- Для anon политик нет -> запрос возвращает 0 строк (а не ошибку).
grant select on all tables in schema public to anon, authenticated;

-- Запись ученику разрешена только в три таблицы; RLS WITH CHECK ограничивает
-- их его собственными строками. Остальные таблицы остаются read-only.
grant insert, update on public.homework_submissions to authenticated;
grant insert, update on public.messages to authenticated;
grant insert, update on public.notification_settings to authenticated;

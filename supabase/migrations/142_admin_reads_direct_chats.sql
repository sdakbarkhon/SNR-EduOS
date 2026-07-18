-- Пачка 7.20 — школьный админ read-only видит все чаты включая direct —
-- осознанно отменяет приватность из 122 по требованию заказчика.
--
-- Контекст: миграция 122 ("Промт 7.2 Часть 1: личные чаты ученик↔учитель")
-- намеренно исключила kind='direct' из школьно-админской (fn_is_admin())
-- ветки SELECT-политик chat_threads/chat_participants/chat_messages, чтобы
-- личная переписка ученик↔учитель была не видна школьному админу (только
-- is_super_admin() мог её читать). Итерация 7.20 строит для админа
-- read-only просмотр ВСЕХ чатов платформы для надзора — заказчик явно
-- решил, что это требование перевешивает приватность из 122.
--
-- Эта миграция открывает ТОЛЬКО SELECT-политики трёх таблиц для fn_is_admin()
-- на kind='direct' — убирает условие "kind <> 'direct'" /
-- "NOT EXISTS(... kind='direct')" из read-веток. Плюс (см. находку ревью
-- ниже) точечно УЖЕСТОЧАЕТ 3 write-политики chat_participants, чтобы
-- сохранить read-only-гарантию, которую открытие SELECT иначе бы пробило:
--   - is_super_admin() ветка не тронута (как была сквозной, так и осталась);
--   - is_my_thread()/participant-ветки не тронуты;
--   - admin/teacher create/update/delete threads (chat_threads) и sender
--     edits within 15min or admin (chat_messages) — НЕ тронуты, у них
--     kind<>'direct' уже был в fn_is_admin()-ветке с миграции 122;
--   - admin/teacher add/update/remove participants (chat_participants) —
--     ТРОНУТЫ ниже (добавлено t.kind='group' в fn_is_admin()-ветку) — без
--     этого открытие SELECT выше создавало бы дыру на запись, см. находку
--     ревью.
-- Итог: школьный админ по-прежнему не может писать/редактировать/удалять
-- чужие direct-чаты ни в одной из четырёх таблиц — доступ только на чтение.
--
-- Побочная находка предыдущей диагностики: живая политика "participants
-- read messages" на chat_messages на момент проверки НЕ давала того же
-- kind='direct'-исключения, что написано в файле 122 (под admin JWT были
-- видны все 152 сообщения, включая 100 из direct-тредов, хотя chat_threads
-- корректно прятал сами треды). DROP POLICY IF EXISTS + CREATE POLICY ниже
-- идемпотентны и приводят живое состояние к ровно этому файлу независимо
-- от того, что было раньше — так что заодно устраняет и это расхождение.
--
-- Находка адверсариального ревью ПЕРЕД коммитом (критично, зафиксировано
-- здесь чтобы не потерять контекст): открывая SELECT на chat_threads/
-- chat_participants/chat_messages для kind='direct', эта миграция ВПЕРВЫЕ
-- делает direct-thread.id enumerable для школьного админа (список
-- /api/admin/chats?type=teacher_student буквально отдаёт их). А политики
-- INSERT/UPDATE/DELETE на chat_participants ("admin/teacher add/remove/
-- update participants", последний раз переопределены в миграции 97,
-- строки 145-185) НИКОГДА не имели kind-ограничения в fn_is_admin()-ветке
-- (только teacher-ветка проверяет t.kind='group' — комментарий миграции
-- 122 про "chat_participants... already require t.kind='group'" был
-- неточен, описывал только teacher-ветку). До этой миграции дыра была
-- недостижима (admin физически не мог узнать id direct-треда через
-- легитимный UI), теперь — достижима: admin может вставить себя в
-- chat_participants direct-треда (INSERT проходит, kind не проверяется),
-- стать is_my_thread()=true и писать сообщения / выгонять реальных
-- участников. Ниже эта миграция ДОПОЛНИТЕЛЬНО ужесточает три write-
-- политики chat_participants, добавляя kind='group' в fn_is_admin()-ветку
-- (по аналогии с уже существующей teacher-веткой) — админ остаётся
-- read-only для direct, как и требовалось.

BEGIN;

-- ── chat_threads: admin читает и group, и direct ────────────────────────
DROP POLICY IF EXISTS "participants read their threads" ON public.chat_threads;
CREATE POLICY "participants read their threads" ON public.chat_threads
  FOR SELECT
  USING (
    is_my_thread(id)
    OR is_super_admin()
    OR (school_id = current_school_id() AND fn_is_admin())
  );

-- ── chat_participants: admin читает участников и group, и direct тредов ─
DROP POLICY IF EXISTS "read own or co-participant rows" ON public.chat_participants;
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

-- ── chat_messages: admin читает сообщения и group, и direct тредов ──────
DROP POLICY IF EXISTS "participants read messages" ON public.chat_messages;
CREATE POLICY "participants read messages" ON public.chat_messages
  FOR SELECT
  USING (
    is_my_thread(thread_id)
    OR is_super_admin()
    OR (fn_is_admin() AND school_id = current_school_id())
  );

-- ── chat_participants write policies: закрываем дыру найденную ревью ────
-- fn_is_admin()-ветка INSERT/UPDATE/DELETE раньше не проверяла kind вообще
-- (только teacher-ветка проверяла t.kind='group') — теперь читать direct
-- можно, а писать по-прежнему нельзя: добавляем t.kind = 'group' в
-- fn_is_admin()-ветку всех трёх политик, ровно как уже сделано для
-- teacher-ветки. is_super_admin() остаётся сквозным бэкдором без изменений.
DROP POLICY IF EXISTS "admin/teacher add participants" ON public.chat_participants;
CREATE POLICY "admin/teacher add participants" ON public.chat_participants FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (fn_is_admin() AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id() AND t.kind = 'group'))
    OR (
      current_teacher_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.chat_threads t
        WHERE t.id = chat_participants.thread_id AND t.kind = 'group' AND is_my_teacher_group(t.group_id)
      )
    )
  );

DROP POLICY IF EXISTS "admin/teacher remove participants" ON public.chat_participants;
CREATE POLICY "admin/teacher remove participants" ON public.chat_participants FOR DELETE
  USING (
    is_super_admin()
    OR (fn_is_admin() AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id() AND t.kind = 'group'))
    OR (
      current_teacher_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.chat_threads t
        WHERE t.id = chat_participants.thread_id AND t.kind = 'group' AND is_my_teacher_group(t.group_id)
      )
    )
  );

DROP POLICY IF EXISTS "admin/teacher update participants" ON public.chat_participants;
CREATE POLICY "admin/teacher update participants" ON public.chat_participants FOR UPDATE
  USING (
    is_super_admin()
    OR (fn_is_admin() AND EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = chat_participants.thread_id AND t.school_id = current_school_id() AND t.kind = 'group'))
    OR (
      current_teacher_id() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.chat_threads t
        WHERE t.id = chat_participants.thread_id AND t.kind = 'group' AND is_my_teacher_group(t.group_id)
      )
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('142')
ON CONFLICT (version) DO NOTHING;

COMMIT;

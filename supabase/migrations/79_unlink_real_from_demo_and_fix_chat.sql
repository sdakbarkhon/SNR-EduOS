-- Хотфикс П8.1 (Итерация 6): разлинковка реальных пользователей от демо-групп
-- + чистка названий групповых чатов + фикс счётчика в Topbar.
--
-- КОНТЕКСТ: расследование (см. отчёт) показало, что реальный учитель
-- teacher_demo (Карим Алишер Botirovich) и три реальных ученика
-- (Sherzod_10, Aziz_03, Nodira_07) остались привязаны к трём демо-группам
-- "Программирование N-А (демо)" — это исторический хвост ещё до миграции 66
-- (когда эти аккаунты сами были демо-аккаунтами; миграция 66 их
-- "разфлаговала", но не отвязала от демо-групп/чатов). Все UUID ниже
-- перепроверены отдельными SELECT-запросами перед написанием этой миграции
-- (не через username/Cyrillic LIKE — оба подхода ненадёжны в этой базе:
-- demo_teacher.username = NULL, реальные username хранятся с иным
-- регистром, чем ожидалось: Sherzod_10/Aziz_03/Nodira_07).
--
-- Известные ID:
--   teacher_demo (реальный, "Карим Алишер Botirovich"):
--     teachers.id = e6fc7339-0f8e-401c-adde-4577b28a41db
--     user_id     = 46b5c585-4fb9-4778-8896-b20166549777
--   demo_teacher ("Демо Учитель", username=NULL в teachers):
--     teachers.id = ca1fbee0-5899-4dda-88fa-1dd0df9d4320
--     user_id     = ae9dcfce-4bde-48c7-a669-728d0748033c
--   Sherzod_10:  students.id b0a067b1-1559-4238-bde1-b21be1dbc61c / user_id 1c6753a9-ce0c-427e-aee5-b8240350b1e2
--   Aziz_03:     students.id dba28430-b891-4215-96f2-385ee5c793b4 / user_id 5c55c1a8-ae57-486a-a24d-97c13c4ce5e6
--   Nodira_07:   students.id c3fdb958-30eb-45bf-a6ca-326b23e79348 / user_id 54214a0d-52b2-4168-bf16-3afc187b310b
--   demo_student_10: students.id d0d0d0d0-3333-1111-0000-000000000003 / user_id d0d0d0d0-3333-0000-0000-000000000003
--   demo_student_3:  students.id d0d0d0d0-3333-1111-0000-000000000001 / user_id d0d0d0d0-3333-0000-0000-000000000001
--   demo_student_7:  students.id d0d0d0d0-3333-1111-0000-000000000002 / user_id d0d0d0d0-3333-0000-0000-000000000002
--
--   Демо-группы (7 из 10, все прочие — реальные классы, не трогаются):
--     Демо 10-А                     d0d0d0d0-4444-0000-0000-000000000003
--     Демо 3-А                      d0d0d0d0-4444-0000-0000-000000000001
--     Демо 7-А                      d0d0d0d0-4444-0000-0000-000000000002
--     Демо-класс                    010e78cf-fa9b-4673-b051-03a0dcd77093
--     Программирование 10-А (демо)  d0d0d0d0-2222-0000-0000-000000000003
--     Программирование 3-А (демо)   d0d0d0d0-2222-0000-0000-000000000001
--     Программирование 7-А (демо)   d0d0d0d0-2222-0000-0000-000000000002
--
-- Полный снимок затрагиваемых строк ДО этой миграции сохранён в
-- backup_before_migration_79.sql (untracked, в корне репозитория).

BEGIN;

-- ---------------------------------------------------------------------
-- Part 1: удалить реальных учеников из демо-групп (student_groups)
-- ---------------------------------------------------------------------
DELETE FROM public.student_groups
WHERE student_id IN (
  'b0a067b1-1559-4238-bde1-b21be1dbc61c',
  'dba28430-b891-4215-96f2-385ee5c793b4',
  'c3fdb958-30eb-45bf-a6ca-326b23e79348'
)
AND group_id IN (
  'd0d0d0d0-4444-0000-0000-000000000003',
  'd0d0d0d0-4444-0000-0000-000000000001',
  'd0d0d0d0-4444-0000-0000-000000000002',
  '010e78cf-fa9b-4673-b051-03a0dcd77093',
  'd0d0d0d0-2222-0000-0000-000000000003',
  'd0d0d0d0-2222-0000-0000-000000000001',
  'd0d0d0d0-2222-0000-0000-000000000002'
);

-- ---------------------------------------------------------------------
-- Part 2: переназначить teacher_id демо-групп с teacher_demo на demo_teacher
-- (сейчас так только у трёх "Программирование N-А (демо)"; остальные 4
-- уже правильно указывают на demo_teacher)
-- ---------------------------------------------------------------------
UPDATE public.groups
SET teacher_id = 'ca1fbee0-5899-4dda-88fa-1dd0df9d4320'
WHERE id IN (
  'd0d0d0d0-2222-0000-0000-000000000003',
  'd0d0d0d0-2222-0000-0000-000000000001',
  'd0d0d0d0-2222-0000-0000-000000000002'
)
AND teacher_id = 'e6fc7339-0f8e-401c-adde-4577b28a41db';

-- ---------------------------------------------------------------------
-- Part 3: синхронизировать chat_participants
-- ---------------------------------------------------------------------

-- (3a) удалить реальных пользователей (3 ученика + teacher_demo) из
-- участников любых демо-тредов
DELETE FROM public.chat_participants
WHERE thread_id IN (
  SELECT id FROM public.chat_threads
  WHERE group_id IN (
    'd0d0d0d0-4444-0000-0000-000000000003',
    'd0d0d0d0-4444-0000-0000-000000000001',
    'd0d0d0d0-4444-0000-0000-000000000002',
    '010e78cf-fa9b-4673-b051-03a0dcd77093',
    'd0d0d0d0-2222-0000-0000-000000000003',
    'd0d0d0d0-2222-0000-0000-000000000001',
    'd0d0d0d0-2222-0000-0000-000000000002'
  )
)
AND user_id IN (
  '1c6753a9-ce0c-427e-aee5-b8240350b1e2', -- Sherzod_10
  '5c55c1a8-ae57-486a-a24d-97c13c4ce5e6', -- Aziz_03
  '54214a0d-52b2-4168-bf16-3afc187b310b', -- Nodira_07
  '46b5c585-4fb9-4778-8896-b20166549777'  -- teacher_demo
);

-- (3b) добавить demo_teacher как куратора всех 7 демо-тредов (для 4
-- "Демо ..." он уже там — ON CONFLICT DO NOTHING делает это идемпотентным)
INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
SELECT ct.id, 'ae9dcfce-4bde-48c7-a669-728d0748033c', 'curator'
FROM public.chat_threads ct
WHERE ct.group_id IN (
  'd0d0d0d0-4444-0000-0000-000000000003',
  'd0d0d0d0-4444-0000-0000-000000000001',
  'd0d0d0d0-4444-0000-0000-000000000002',
  '010e78cf-fa9b-4673-b051-03a0dcd77093',
  'd0d0d0d0-2222-0000-0000-000000000003',
  'd0d0d0d0-2222-0000-0000-000000000001',
  'd0d0d0d0-2222-0000-0000-000000000002'
)
ON CONFLICT (thread_id, user_id) DO NOTHING;

-- (3c) взамен удалённых реальных учеников — добавить demo_student_10/7/3
-- в соответствующую "Программирование N-А (демо)" группу, чтобы демо-режим
-- не остался с пустым ростером
INSERT INTO public.student_groups (student_id, group_id, school_id)
SELECT s.id, g.id, g.school_id
FROM public.students s
JOIN public.groups g ON (
  (s.id = 'd0d0d0d0-3333-1111-0000-000000000003' AND g.id = 'd0d0d0d0-2222-0000-0000-000000000003') OR -- demo_student_10 -> Программирование 10-А (демо)
  (s.id = 'd0d0d0d0-3333-1111-0000-000000000001' AND g.id = 'd0d0d0d0-2222-0000-0000-000000000001') OR -- demo_student_3  -> Программирование 3-А (демо)
  (s.id = 'd0d0d0d0-3333-1111-0000-000000000002' AND g.id = 'd0d0d0d0-2222-0000-0000-000000000002')    -- demo_student_7  -> Программирование 7-А (демо)
)
ON CONFLICT (student_id, group_id) DO NOTHING;

-- ...and the matching chat_participants rows for those same 3 threads
INSERT INTO public.chat_participants (thread_id, user_id, role_in_thread)
SELECT ct.id, s.user_id, 'student'
FROM public.chat_threads ct
JOIN public.students s ON (
  (s.id = 'd0d0d0d0-3333-1111-0000-000000000003' AND ct.group_id = 'd0d0d0d0-2222-0000-0000-000000000003') OR
  (s.id = 'd0d0d0d0-3333-1111-0000-000000000001' AND ct.group_id = 'd0d0d0d0-2222-0000-0000-000000000001') OR
  (s.id = 'd0d0d0d0-3333-1111-0000-000000000002' AND ct.group_id = 'd0d0d0d0-2222-0000-0000-000000000002')
)
ON CONFLICT (thread_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Part 4: чистка названий групповых тредов = groups.name (идемпотентно;
-- на момент написания миграции уже точное совпадение для всех 10 тредов,
-- оставлено как защитная мера на будущее / при повторном запуске)
-- ---------------------------------------------------------------------
UPDATE public.chat_threads ct
SET title = g.name
FROM public.groups g
WHERE g.id = ct.group_id
  AND ct.kind = 'group'
  AND ct.title IS DISTINCT FROM g.name;

-- ---------------------------------------------------------------------
-- Part 5: фикс счётчика в Topbar (NotificationsBell)
-- ---------------------------------------------------------------------

-- (5a) удалить осиротевший дублирующий триггер — migration 49 заменила
-- fn_announcement_notify()/trg_announcement_notify на
-- fn_announce_notify()/trg_announce_notify, но забыла удалить старый.
-- Оба триггера AFTER INSERT ON announcements существовали одновременно,
-- поэтому каждое новое объявление создавало по 2 одинаковых notification
-- на получателя. Новый триггер уже покрывает всю логику старого (плюс
-- уведомления учителям при admin-объявлениях), так что это чистое удаление.
DROP TRIGGER IF EXISTS trg_announcement_notify ON public.announcements;
DROP FUNCTION IF EXISTS public.fn_announcement_notify();

-- (5b) удалить осиротевшие тестовые notification-строки. Расследование
-- показало: все 32 "дублирующиеся" строки (16 групп) — это не путаница
-- от бага (5a), а буквально забытые тестовые уведомления с заголовками
-- "[MIGRATION 71/72 SANITY CHECK - DELETE ME]" и
-- "[I6P2 SANITY CHECK - DELETE ME]", вставленные при проверке миграций
-- 71/72/74 в этой же сессии. Их source_id уже не существует в
-- announcements (сам тестовый announcement был удалён), но notification
-- (с денормализованной копией title) остался и висел unread — это и был
-- тот самый "непонятный 5" в Topbar.
DELETE FROM public.notifications
WHERE title IN (
  '[MIGRATION 71/72 SANITY CHECK - DELETE ME]',
  '[I6P2 SANITY CHECK - DELETE ME]'
);

COMMIT;

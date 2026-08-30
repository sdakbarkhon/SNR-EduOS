-- Миграция 240: у уведомлений остаются три вида.
--
-- РЕШЕНИЕ ЗАКАЗЧИКА, окончательное. Остаются:
--   1. new_homework   — задали домашнее задание (ученику и родителям);
--   2. new_grade      — проверили домашнюю работу, выставлена оценка;
--   3. announcement   — объявление (+ announcement_new куратору от админа).
--
-- ЗАЧЕМ. Расчёт наполнения боевой школы (четыре группы, четверть) дал от 31 до
-- 93 тысяч строк, из которых 96% — «Новый материал»: 745 материалов на группу
-- за четверть, каждый умноженный на число учеников и родителей. Лента при этом
-- берётся с пределом 50, то есть человек увидел бы последние пятьдесят строк
-- «Новый материал» и ничего больше. Предела роста у таблицы нет: ни срока
-- жизни, ни чистки — крон-заданий пять, и ни одно не чистит уведомления.
--
-- КАК СНИМАЕМ. Тем же способом, что миграция 224 сняла рассылку про создание
-- урока: удаляем ТРИГГЕР И ЕГО ФУНКЦИЮ, а не глушим условием внутри. Условие
-- внутри — это выключатель, который однажды включат обратно не подумав;
-- отсутствующий триггер такого не позволяет.
--
-- ЗНАЧЕНИЯ ВИДОВ ИЗ ОГРАНИЧЕНИЯ НЕ УБИРАЕМ. В базе лежит 261 строка снимаемых
-- видов (lesson_material 126, grade_received 94, student_submitted 40,
-- student_excused 1). Сузить CHECK при живых данных — значит получить отказ на
-- существующих строках. Ограничение трогаем отдельным шагом и только после
-- того, как решится судьба этих строк.
--
-- ЧТО ОСТАЁТСЯ НЕТРОНУТЫМ И ПОЧЕМУ:
--   * fn_notify_student_grade   — её зовёт оставшаяся проверка ДЗ;
--   * notify_user_and_parents   — общий разлёт, им пользуются все оставшиеся;
--   * сам чат, сами заявки, сами объяснительные, сами материалы — снимается
--     только рассылка о них, данные и экраны не задеты;
--   * рассылка про создание урока — её нет с миграции 224, не возвращаем.

BEGIN;

-- ── 1. Материалы к уроку ────────────────────────────────────────────────────
-- 96% будущего объёма. Материал виден в самом уроке.
DROP TRIGGER IF EXISTS trg_lesson_material_notify ON public.lesson_materials;
DROP FUNCTION IF EXISTS public.fn_lesson_material_notify();

-- ── 2. Оценки за урок в журнале ─────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_lesson_grade_notify ON public.lesson_grades;
DROP FUNCTION IF EXISTS public.fn_lesson_grade_notify();

-- ── 3. Оценки за этапы урока ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_stage_grade_notify ON public.lesson_stage_progress;
DROP FUNCTION IF EXISTS public.fn_stage_grade_notify();

-- ── 4. Сообщения в чате (заведены миграцией 236) ────────────────────────────
-- Снимается только уведомление. Сам чат, его правила и экраны не тронуты.
DROP TRIGGER IF EXISTS trg_chat_message_notify ON public.chat_messages;
DROP FUNCTION IF EXISTS public.fn_chat_message_notify();

-- ── 5. Сдача работы учителю ─────────────────────────────────────────────────
-- Уведомление шло УЧИТЕЛЮ. Сданные работы он видит списком на своём экране.
DROP TRIGGER IF EXISTS trg_homework_submission_notify ON public.homework_submissions;
DROP FUNCTION IF EXISTS public.fn_homework_submission_notify();

-- ── 6. Заявки на отпуск и решения по ним ────────────────────────────────────
DROP TRIGGER IF EXISTS trg_leave_request_notify ON public.leave_requests;
DROP FUNCTION IF EXISTS public.fn_leave_request_notify();
DROP TRIGGER IF EXISTS trg_leave_decision_notify ON public.leave_requests;
DROP FUNCTION IF EXISTS public.fn_leave_decision_notify();

-- ── 7. Объяснительные ───────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_excuse_notify ON public.lesson_excuse_requests;
DROP FUNCTION IF EXISTS public.fn_excuse_notify();

-- ── 8. Оценка за классную работу ────────────────────────────────────────────
-- Классная работа удалена из продукта 21.08.2026 — рассылка о ней осталась.
DROP TRIGGER IF EXISTS trg_classwork_grade_notify ON public.classwork_submissions;
DROP FUNCTION IF EXISTS public.fn_classwork_grade_notify();

-- ── 9. Оценка за проект ─────────────────────────────────────────────────────
-- Проект — не домашняя работа.
DROP TRIGGER IF EXISTS trg_project_grade_notify ON public.project_submissions;
DROP FUNCTION IF EXISTS public.fn_project_grade_notify();

COMMIT;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ. Из четырнадцати триггеров должны остаться
-- ЧЕТЫРЕ: объявление, новое задание, проверка ДЗ, проверка теста.
-- Снятых десять — ни одного из них в выборке быть не должно:
--
--   SELECT cl.relname, t.tgname, p.proname
--     FROM pg_trigger t
--     JOIN pg_class cl ON cl.oid = t.tgrelid
--     JOIN pg_proc  p  ON p.oid  = t.tgfoid
--    WHERE NOT t.tgisinternal
--      AND (p.prosrc ~* 'insert\s+into\s+public\.notifications'
--           OR p.prosrc LIKE '%notify_user_and_parents%'
--           OR p.prosrc LIKE '%fn_notify_student_grade%')
--    ORDER BY cl.relname;
--
--
-- ═══ ОЦЕНКА ЗА ТЕСТ ОСТАЁТСЯ ═══
--
-- Вид `new_grade` пишут теперь два триггера: проверка домашней работы
-- (`trg_homework_grade_notify`) и проверка теста (`trg_test_grade_notify`).
--
-- Тест оставлен по решению заказчика: в этой системе он заводится ТОЙ ЖЕ
-- формой, что и задание (`homework.content_type = 'test'`), и для родителя это
-- то же самое — работу задали, работу проверили.
--
-- Оценка за классную работу снята выше: сама классная работа удалена из
-- продукта 21.08.2026, рассылка о ней пережила её на девять дней. Оценка за
-- проект снята потому, что проект — не домашняя работа.
--
-- `fn_notify_student_grade` остаётся: её зовут обе оставшиеся проверки.


-- ═══ УБОРКА СТАРЫХ СТРОК — ВЫПОЛНЯЕТСЯ ОТДЕЛЬНО, ПОСЛЕ ПРИМЕНЕНИЯ ═══
--
-- Блок закомментирован намеренно, как это делалось с 121 мёртвой строкой
-- `lesson_created` в миграции 236: сначала смотрим на числа, потом выполняем.
--
-- ЧТО В БАЗЕ НА 30.08.2026 (всего 446 строк):
--
--   SNR Demo School  lesson_material     126 строк, непрочитанных 126
--   SNR Demo School  grade_received       93 строк, непрочитанных  62
--   SNR Demo School  student_submitted    40 строк, непрочитанных   0
--   SNR Demo School  student_excused       1 строк, непрочитанных   0
--   SNR School       grade_received        1 строк, непрочитанных   1
--   ──────────────────────────────────────────────────────────────────
--   К УДАЛЕНИЮ                            261 строк, непрочитанных 189
--
-- ОСТАНЕТСЯ 185:
--
--   announcement       92 строк, непрочитанных  0
--   new_homework       63 строк, непрочитанных  0
--   announcement_new   30 строк, непрочитанных 24
--
-- Из 189 непрочитанных 126 — «Новый материал»: колокольчик показывает число,
-- за которым стоит ровно то, что решено больше не показывать.
--
-- Видов в списке больше, чем строк: `chat_message`, `leave_request`,
-- `leave_decision`, `lesson_starting_soon` в базе не встречаются ни разу, но
-- источников у них теперь тоже нет — включены, чтобы не возвращаться.
--
--   DELETE FROM public.notifications
--    WHERE kind IN ('lesson_material', 'grade_received', 'student_submitted',
--                   'student_excused', 'chat_message', 'leave_request',
--                   'leave_decision', 'lesson_created', 'lesson_starting_soon');
--
--   -- Настройки с исчезнувшей категорией «сообщения». На 30.08.2026 таблица
--   -- ПУСТА (0 строк), то есть удалять нечего — команда оставлена на случай,
--   -- если между сегодня и применением кто-то успеет выключить тумблер.
--   DELETE FROM public.notification_prefs WHERE category = 'messages';
--
-- ПОСЛЕ УБОРКИ СПИСОК ВИДОВ МОЖНО СУЗИТЬ — но ОТДЕЛЬНЫМ ФАЙЛОМ и только
-- после того, как строки удалены: сужение CHECK на живых данных откажет, это
-- мы уже проходили. Живыми после уборки остаются ТРИ вида:
--
--     announcement, announcement_new, new_homework, new_grade
--
-- — четыре значения на три вида в понимании заказчика: `announcement_new` это
-- то же объявление, только его копия куратору. То же касается
-- `notification_prefs.category`: там останутся три из четырёх.

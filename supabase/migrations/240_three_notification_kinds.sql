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

COMMIT;

-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ. Должно остаться шесть триггеров, ведущих к
-- уведомлениям, и ни одного из снятых восьми:
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
-- ═══ ТРИ ИСТОЧНИКА, КОТОРЫХ НЕ БЫЛО В СПИСКЕ — ОСТАВЛЕНЫ, НУЖНО РЕШЕНИЕ ═══
--
-- Кроме проверки домашней работы, вид `new_grade` пишут ещё три триггера. В
-- списке на снятие их не было, и снимать их молча я не стал:
--
--   test_submissions.trg_test_grade_notify           — оценка за тест
--   classwork_submissions.trg_classwork_grade_notify — оценка за классную работу
--   project_submissions.trg_project_grade_notify     — оценка за проект
--
-- Все три зовут ту же `fn_notify_student_grade` и пишут ТОТ ЖЕ вид `new_grade`,
-- что и проверка ДЗ. Поэтому «остаются три вида» соблюдается буквально: видов
-- после этой миграции ровно три. Но по смыслу это оценки НЕ за домашнюю
-- работу, а тест в этой системе заводится той же формой, что и задание
-- (`homework.content_type = 'test'`), — так что «оценка за тест» это, скорее
-- всего, как раз то, что заказчик и называет проверкой работы.
--
-- Если решение — снять и их, добавляется шесть строк того же вида:
--
--   DROP TRIGGER IF EXISTS trg_test_grade_notify ON public.test_submissions;
--   DROP FUNCTION IF EXISTS public.fn_test_grade_notify();
--   DROP TRIGGER IF EXISTS trg_classwork_grade_notify ON public.classwork_submissions;
--   DROP FUNCTION IF EXISTS public.fn_classwork_grade_notify();
--   DROP TRIGGER IF EXISTS trg_project_grade_notify ON public.project_submissions;
--   DROP FUNCTION IF EXISTS public.fn_project_grade_notify();
--
-- `fn_notify_student_grade` в любом случае остаётся: её зовёт проверка ДЗ.

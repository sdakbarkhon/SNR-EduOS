-- =====================================================================
-- Migration 152 — один активный урок на группу одновременно.
--
-- Проблема (разведка "Сейчас/Далее"): переход в in_progress закрывал
-- предыдущий урок группы ПО ВРЕМЕННОЙ близости (start-with-close-previous
-- искал "предыдущий урок того же дня" по starts_at), а не по факту, что
-- тот реально in_progress. Если учитель пропускал уроки (стартовал
-- урок 5, пока урок 2 всё ещё in_progress), закрывался урок 4
-- (не идущий, просто хронологически ближайший) вместо реально активного
-- урока 2 — тот оставался in_progress бессрочно (до полуночного крона),
-- и одновременно "активными" оказывались два урока группы, а урок 4
-- получал фабрикованную посещаемость как будто прошёл.
--
-- Фикс: атомарный триггер на UPDATE lessons.status — при переходе строки
-- в in_progress закрывает ВСЕ ДРУГИЕ in_progress уроки той же группы,
-- симметрично для любой точки записи (веб-роут start-with-close-previous,
-- cron fn_auto_start_lessons/runMorningLessonCycle, прямой UPDATE),
-- атомарно в той же транзакции — единая точка правды вместо N разных
-- реализаций "закрыть предыдущий".
--
-- SECURITY DEFINER: по факту сегодня любой живой путь, ставящий
-- status='in_progress', уже выполняется под service_role
-- (createAdminClient() в start-with-close-previous и
-- runMorningLessonCycle) или под SECURITY DEFINER-функцией
-- (fn_auto_start_lessons) — оба обходят RLS, так что обычная
-- (SECURITY INVOKER) функция сработала бы сегодня одинаково. Тем не
-- менее функция объявлена SECURITY DEFINER — по тому же паттерну, что
-- fn_auto_start_lessons/fn_auto_end_lessons/is_subject_owner (миграция
-- 151 и раньше) — чтобы поведение триггера не зависело молча от того,
-- какой клиент вызвал внешний UPDATE: если в будущем появится путь
-- через user-scoped (RLS-bound) клиент, триггер всё равно закроет
-- соседние in_progress уроки, а не будет молча блокирован RLS-политикой
-- текущего пользователя (0 затронутых строк без ошибки).
--
-- Same-batch guard (started_at IS DISTINCT FROM NEW.started_at):
-- адверсариальная проверка нашла race — один bulk UPDATE
-- (fn_auto_start_lessons может завести НЕСКОЛЬКО уроков одной группы за
-- один проход, если расписание перекрывается/крон догоняет пропуск) в
-- неопределённом построчном порядке мог закрыть урок сразу после его же
-- старта в ТОЙ ЖЕ транзакции. now() внутри одной транзакции Postgres —
-- константа (снимок начала транзакции), поэтому все строки, задетые
-- ОДНИМ UPDATE-ом с started_at=now(), получают идентичный started_at —
-- сравнение исключает "братьев по тому же проходу" и трогает только
-- уроки, реально стартовавшие РАНЬШЕ (другая транзакция/другой now()).
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_close_other_in_progress_lessons()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Только при переходе в in_progress (scheduled -> in_progress).
  IF NEW.status = 'in_progress' AND OLD.status <> 'in_progress' THEN
    UPDATE public.lessons
    SET status = 'completed',
        ended_at = COALESCE(ended_at, now())
    WHERE group_id = NEW.group_id
      AND id <> NEW.id
      AND status = 'in_progress'
      AND started_at IS DISTINCT FROM NEW.started_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_other_in_progress_lessons ON public.lessons;
CREATE TRIGGER trg_close_other_in_progress_lessons
  AFTER UPDATE OF status ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_close_other_in_progress_lessons();

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('152')
ON CONFLICT (version) DO NOTHING;

COMMIT;

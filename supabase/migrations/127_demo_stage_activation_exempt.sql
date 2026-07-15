-- Промт «демо: активация этапа» — fn_stamp_is_demo() (миграция 110) блокирует
-- ЛЮБОЙ UPDATE от демо-сессии на реальной (is_demo=false) строке lessons/
-- lesson_stages с 'editing_real_data_in_demo'. Демо-учитель теперь — реальный
-- предметный аккаунт (teacher_prog/teacher_math/...) с user_sessions.is_demo=
-- true (P2-архитектура из промта "3"), а не отдельный synthetic-пул — то есть
-- ВСЕ его уроки реальные (is_demo=false, подтверждено: 0 демо-уроков в БД).
-- Итог: активация этапа (lessons.active_stage_id) и переключение слайда
-- (lesson_stages.current_slide_index) от демо-сессии падают на этом триггере
-- на 100% уроков — демо учителя полностью сломано.
--
-- Эти два поля — эфемерное UI-состояние "что сейчас показывается", не
-- персистентный академический контент (в отличие от title/description/
-- attachments и т.п., которые триггер по-прежнему обязан блокировать).
-- Минимальный, не создающий долга фикс: точечное исключение прямо в теле
-- существующей функции (CREATE OR REPLACE, тот же триггер, без новых
-- триггеров/политик) — тривиально убрать целиком в P2, когда отдельный
-- демо-пул уйдёт совсем.
--
-- to_jsonb(NEW) - 'col' = to_jsonb(OLD) - 'col' — "изменилась только col,
-- всё остальное в строке идентично". Безопасно к будущим колонкам (если
-- какой-то другой код когда-нибудь обновит active_stage_id ВМЕСТЕ с чем-то
-- ещё реальным — исключение не сработает, блок останется).

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_stamp_is_demo()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.is_demo := public.is_demo_session();
    END IF;
    RETURN NEW;
  END IF;

  -- Точечное исключение: активация этапа / переключение слайда — эфемерное
  -- состояние живого показа урока, не редактирование академического
  -- содержимого. Демо-сессии должны иметь возможность им управлять даже на
  -- реальном (is_demo=false) уроке.
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'lessons'
     AND to_jsonb(NEW) - 'active_stage_id' = to_jsonb(OLD) - 'active_stage_id' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'lesson_stages'
     AND to_jsonb(NEW) - 'current_slide_index' = to_jsonb(OLD) - 'current_slide_index' THEN
    RETURN NEW;
  END IF;

  IF pg_trigger_depth() <= 1
     AND OLD.is_demo = false
     AND public.is_demo_session() THEN
    RAISE EXCEPTION 'editing_real_data_in_demo' USING ERRCODE = 'P0002';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.is_demo := OLD.is_demo;
    RETURN NEW;
  END IF;

  RETURN OLD; -- DELETE
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version)
VALUES ('127')
ON CONFLICT (version) DO NOTHING;

COMMIT;

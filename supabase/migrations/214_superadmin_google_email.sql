-- Миграция 214: почта Google у суперадминистратора.
--
-- ЧЕГО НЕ ХВАТАЛО. Миграция 213 завела google_email ученикам, учителям и
-- администраторам, а таблицу super_admins не тронула — у неё всего четыре
-- колонки (id, user_id, full_name, created_at). Поэтому суперадминистратор был
-- единственным, кто не мог войти через Google: вписывать почту было некуда.
--
-- ПОЧЕМУ ЭТО НЕ ЗАБЫЛИ ТОГДА, А ОСТАВИЛИ. Суперадминистратор выпадает из общей
-- схемы дважды: у него нет ни школы, ни колонки username. В 213 речь шла про
-- уникальность логинов, и его там просто нет. Здесь закрывается ровно один
-- случай — почта.
--
-- ОДНА ПОЧТА — ОДИН ЧЕЛОВЕК, И ТЕПЕРЬ ВКЛЮЧАЯ ЕГО. fn_email_is_taken из 213
-- пересобирается с пятой ролью: иначе суперадминистратор мог бы забрать себе
-- почту, уже привязанную к учителю, и вход через Google стал бы неоднозначным.

ALTER TABLE public.super_admins ADD COLUMN IF NOT EXISTS google_email text;

COMMENT ON COLUMN public.super_admins.google_email IS
  'Почта Google для входа. Вписывает себе сам суперадминистратор — других '
  'ролей выше него нет. Нормализация та же, что у остальных (миграция 213).';

ALTER TABLE public.super_admins DROP CONSTRAINT IF EXISTS super_admins_google_email_norm_chk;
ALTER TABLE public.super_admins ADD CONSTRAINT super_admins_google_email_norm_chk
  CHECK (google_email IS NULL OR google_email = lower(btrim(google_email)));

CREATE UNIQUE INDEX IF NOT EXISTS super_admins_google_email_uniq
  ON public.super_admins (lower(btrim(google_email)))
  WHERE google_email IS NOT NULL AND btrim(google_email) <> '';

-- Проверка занятости почты — теперь по пяти ролям.
CREATE OR REPLACE FUNCTION public.fn_email_is_taken(
  p_email text, p_table text, p_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_found boolean;
BEGIN
  IF v_email = '' THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.students s
     WHERE lower(btrim(s.google_email)) = v_email AND NOT (p_table = 'students' AND s.id = p_id)
    UNION ALL
    SELECT 1 FROM public.teachers t
     WHERE lower(btrim(t.google_email)) = v_email AND NOT (p_table = 'teachers' AND t.id = p_id)
    UNION ALL
    SELECT 1 FROM public.admins a
     WHERE lower(btrim(a.google_email)) = v_email AND NOT (p_table = 'admins' AND a.id = p_id)
    UNION ALL
    SELECT 1 FROM public.parents p
     WHERE lower(btrim(p.google_email)) = v_email AND NOT (p_table = 'parents' AND p.id = p_id)
    UNION ALL
    SELECT 1 FROM public.super_admins sa
     WHERE lower(btrim(sa.google_email)) = v_email AND NOT (p_table = 'super_admins' AND sa.id = p_id)
  ) INTO v_found;

  RETURN v_found;
END $$;

COMMENT ON FUNCTION public.fn_email_is_taken(text, text, uuid) IS
  'Привязана ли почта к кому-то ещё — по всем ПЯТИ ролям, включая '
  'суперадминистратора (миграция 214). Одна почта на двоих сделала бы вход '
  'через Google неоднозначным.';

-- Логина у суперадминистратора нет, поэтому у него свой триггер — только почта.
CREATE OR REPLACE FUNCTION public.tg_check_superadmin_email_unique()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.google_email IS NOT NULL AND btrim(NEW.google_email) <> ''
     AND (TG_OP = 'INSERT' OR NEW.google_email IS DISTINCT FROM OLD.google_email)
     AND public.fn_email_is_taken(NEW.google_email, 'super_admins', NEW.id)
  THEN
    RAISE EXCEPTION 'EMAIL_TAKEN' USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_unique_superadmin_email ON public.super_admins;
CREATE TRIGGER trg_unique_superadmin_email BEFORE INSERT OR UPDATE ON public.super_admins
  FOR EACH ROW EXECUTE FUNCTION public.tg_check_superadmin_email_unique();

-- ── Самопроверка ───────────────────────────────────────────────────────────
DO $$
DECLARE v_sa uuid; v_st uuid;
BEGIN
  SELECT id INTO v_sa FROM public.super_admins LIMIT 1;
  SELECT id INTO v_st FROM public.students LIMIT 1;
  IF v_sa IS NULL OR v_st IS NULL THEN
    RAISE NOTICE 'некого проверять — самопроверка пропущена';
    RETURN;
  END IF;

  UPDATE public.students SET google_email = 'proverka214@example.com' WHERE id = v_st;
  BEGIN
    UPDATE public.super_admins SET google_email = 'Proverka214@Example.com' WHERE id = v_sa;
    RAISE EXCEPTION 'почта ученика досталась суперадминистратору';
  EXCEPTION
    WHEN check_violation THEN NULL;   -- поймал CHECK на нормализацию
    WHEN unique_violation THEN NULL;  -- поймал триггер занятости
  END;
  UPDATE public.students SET google_email = NULL WHERE id = v_st;

  RAISE NOTICE 'Миграция 214: почта суперадминистратора заведена, занятость по пяти ролям';
END $$;

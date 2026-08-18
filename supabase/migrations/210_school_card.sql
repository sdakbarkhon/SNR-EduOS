-- Миграция 210: карточка школы — логотип и данные организации.
--
-- ЧТО БЫЛО. У школы ровно два содержательных поля: name и code. Всё остальное
-- (autostart_enabled, nightly_close_enabled, is_demo, frozen_date, is_active) —
-- служебные переключатели, а не данные организации. Показать админу, в какой он
-- школе, кроме названия было нечем; в документах реквизиты брать неоткуда.
--
-- ЧТО ДОБАВЛЯЕТСЯ. Семь необязательных полей. Необязательных все до одного:
-- школы уже заведены и заполнены не будут, а NOT NULL сделал бы невозможным
-- сохранение любой существующей строки. Пустое значение всюду означает «не
-- заполнено» и на экранах показывается прочерком, а не пустотой.
--
-- ── ГДЕ ЛЕЖИТ ЛОГОТИП И ПОЧЕМУ ИМЕННО ТАК ──────────────────────────────────
--
-- Хранится в новом закрытом бакете school-logos, путь `<school_id>/logo.<ext>`.
-- В таблице лежит ПУТЬ, а не ссылка: ссылка на закрытый файл живёт минуты, и
-- сохранённая в базе она протухла бы сразу.
--
-- Второй схемы изоляции здесь НЕ появляется. Правило принадлежности файла школе
-- задано один раз в fn_storage_path_visible (миграция 188), а четыре
-- ограничительные политики на storage.objects написаны БЕЗ условия на бакет:
--
--     CREATE POLICY "school isolation: read" ON storage.objects
--       AS RESTRICTIVE FOR SELECT TO public
--       USING (public.fn_storage_path_visible(name));
--
-- То есть любой новый бакет попадает под изоляцию сам, по факту создания, и
-- дописывать ради логотипов нечего. Именно поэтому новый бакет — не отступление
-- от общей схемы, а её обычное применение.
--
-- ПОЧЕМУ БАКЕТ ЗАКРЫТЫЙ, А НЕ ПУБЛИЧНЫЙ. Логотип не секрет, но «не секрет» и
-- «пусть лежит открытым навсегда» — разные вещи. Публичный бакет означал бы
-- ровно одно исключение из изоляции, которое дальше пришлось бы помнить всем.
-- Закрытый не требует помнить ничего: правило одно на все файлы. Ссылку на
-- логотип выдаёт сервер и на срок, а не хранилище и навсегда.
--
-- ЧТО БУДЕТ ПРИ ВЫБОРЕ ШКОЛЫ ДО ВХОДА (следующий заход). Там сессии нет, и
-- current_school_id() пуст — значит логотип отдаст серверный маршрут служебным
-- ключом. Это одно осознанное место, которое видно в коде и которое можно
-- проверить, а не бакет, открытый на всякий случай заранее.

-- ── 1. Поля организации ─────────────────────────────────────────────────────
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS logo_path     text,
  ADD COLUMN IF NOT EXISTS address       text,
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS director_name text,
  ADD COLUMN IF NOT EXISTS website       text,
  ADD COLUMN IF NOT EXISTS legal_details text;

COMMENT ON COLUMN public.schools.logo_path IS
  'Путь в бакете school-logos вида <school_id>/logo.<ext>. Именно путь, не '
  'ссылка: бакет закрытый, ссылка подписывается на время при показе.';
COMMENT ON COLUMN public.schools.legal_details IS
  'Реквизиты для документов одним текстом: ИНН, банк, счёт и прочее. Разбивать '
  'по колонкам не стали — набор реквизитов у организаций разный.';

-- ── 2. Бакет для логотипов ──────────────────────────────────────────────────
-- public = false: под изоляцию из миграции 188 (см. шапку).
-- 2 МБ: логотип — это картинка в шапку, а не исходник из типографии.
-- SVG намеренно НЕ разрешён: он может нести скрипт, а отдаётся файл с домена
-- хранилища. Растровые форматы такого не умеют.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'school-logos', 'school-logos', false, 2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Чтение: разрешено вошедшим. Поверх этого разрешения лежит ограничительная
-- политика изоляции — она сузит его до СВОЕЙ школы. Разрешения на запись для
-- authenticated нет намеренно: карточку правит только суперадмин, а он ходит
-- служебным ключом, который защиту строк обходит.
DROP POLICY IF EXISTS "authenticated reads school-logos" ON storage.objects;
CREATE POLICY "authenticated reads school-logos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'school-logos');

-- ── 3. Самопроверка ─────────────────────────────────────────────────────────
-- Проверяется главное: изоляция накрыла новый бакет САМА, без правок правил.
DO $$
DECLARE
  v_admin_user  uuid;
  v_real_school uuid;
  v_demo_school uuid;
  v_answer      boolean;
  v_cols        integer;
BEGIN
  SELECT count(*) INTO v_cols FROM information_schema.columns
   WHERE table_name = 'schools'
     AND column_name IN ('logo_path','address','phone','email','director_name','website','legal_details');
  IF v_cols <> 7 THEN
    RAISE EXCEPTION 'полей карточки % вместо 7', v_cols;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'school-logos' AND NOT public) THEN
    RAISE EXCEPTION 'бакет school-logos не создан или оказался публичным';
  END IF;

  SELECT id INTO v_real_school FROM public.schools WHERE NOT is_demo LIMIT 1;
  SELECT id INTO v_demo_school FROM public.schools WHERE is_demo LIMIT 1;
  SELECT user_id INTO v_admin_user FROM public.admins
   WHERE school_id = v_real_school AND user_id IS NOT NULL LIMIT 1;

  IF v_admin_user IS NULL THEN
    RAISE NOTICE 'нет админа настоящей школы — проверка видимости пропущена';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin_user, 'role', 'authenticated')::text, true);

  SELECT public.fn_storage_path_visible(v_real_school::text || '/logo.png') INTO v_answer;
  IF NOT v_answer THEN RAISE EXCEPTION 'админ не видит логотип СВОЕЙ школы'; END IF;

  SELECT public.fn_storage_path_visible(v_demo_school::text || '/logo.png') INTO v_answer;
  IF v_answer THEN RAISE EXCEPTION 'админ видит логотип ЧУЖОЙ школы'; END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'Миграция 210: карточка школы заведена, логотипы изолированы';
END $$;

-- Z.2.8, 09.08.2026 — вход родителя по номеру телефона с настоящим кодом
-- подтверждения.
--
-- ЧТО БЫЛО. Родительский поток не работал ни на одном звене: createParent
-- заводил строку с user_id = NULL и код в parent_invites, страницы погашения
-- кода не существовало (verifyParentInvite/completeParentJoin — ноль
-- вызовов), а реальный вход шёл через захардкоженную карту трёх телефонов с
-- общим паролем и НЕПРОВЕРЯЕМЫМ кодом: любые четыре цифры проходили.
--
-- ЧТО СТАНОВИТСЯ. Телефон — ключ входа: parents.phone NOT NULL + UNIQUE.
-- Код подтверждения генерируется и проверяется по-настоящему с первого дня
-- (срок жизни, лимит попыток, одноразовость), а доставка изолирована в одну
-- функцию sendSms() — подключение Eskiz.uz будет заменой её тела.
--
-- ПОЧЕМУ НАСТОЯЩИЙ КОД, А НЕ «ПРИНИМАТЬ ЛЮБОЙ». При «любом» путь проверки
-- никогда не исполняется, и в день подключения провайдера он оказался бы
-- непротестированным — а до тех пор это открытая дверь, про которую все
-- забудут.
--
-- ФОРМАТ ТЕЛЕФОНА. Канонический вид +998XXXXXXXXX. Единственному живому
-- родителю (демо, Ismailov Bakhtiyor) телефон проставляется тот, которым он
-- входит сегодня по захардкоженной карте, — вход у него не меняется.

-- ── 1. Телефон как ключ входа ───────────────────────────────────────────────

-- Бэкфилл до NOT NULL. Демо-родитель входит номером 912345678 (карта из
-- packages/core/src/auth/phone.ts, которая этим заходом удаляется).
UPDATE public.parents
   SET phone = '+998912345678'
 WHERE phone IS NULL
   AND user_id IS NOT NULL
   AND school_id = 'a0a0a0a0-0000-0000-0000-000000000001';

-- Родителям без телефона и без учётной записи (таких сейчас нет) даём
-- заведомо нерабочую заглушку: NOT NULL важнее, войти по ней всё равно
-- нельзя — кода на несуществующий номер не придёт.
UPDATE public.parents
   SET phone = '+000000000' || substr(replace(id::text, '-', ''), 1, 6)
 WHERE phone IS NULL;

-- Приводим уже сохранённые номера к каноническому виду: только цифры, и если
-- их девять — это национальный узбекский номер, дописываем код страны.
UPDATE public.parents
   SET phone = CASE
         WHEN regexp_replace(phone, '\D', '', 'g') ~ '^998\d{9}$'
           THEN '+' || regexp_replace(phone, '\D', '', 'g')
         WHEN regexp_replace(phone, '\D', '', 'g') ~ '^\d{9}$'
           THEN '+998' || regexp_replace(phone, '\D', '', 'g')
         ELSE phone
       END
 WHERE phone IS NOT NULL;

ALTER TABLE public.parents ALTER COLUMN phone SET NOT NULL;

-- Имя ограничения важно: humanizeAdminError (apps/web/lib/
-- admin-error-messages.ts) уже ловит parents_phone_key и показывает
-- «Такой номер уже зарегистрирован» вместо сырого текста Postgres.
ALTER TABLE public.parents
  ADD CONSTRAINT parents_phone_key UNIQUE (phone);

-- ── 2. Коды подтверждения ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.parent_phone_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  -- Хеш, а не сам код: строка живёт в базе до истечения срока, и утечка
  -- дампа не должна давать вход. Соль общая не нужна — код одноразовый и
  -- живёт минуты; хешируем sha256(code || phone).
  code_hash   text NOT NULL,
  -- Открытый код — временный компромисс на период без SMS-провайдера:
  -- админ диктует его родителю из карточки. Снимается вместе с заглушкой
  -- доставки, поэтому вынесен отдельной колонкой, а не подмешан в хеш.
  code_plain  text,
  expires_at  timestamptz NOT NULL,
  attempts    smallint NOT NULL DEFAULT 0,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Поиск всегда идёт «последний живой код для телефона».
CREATE INDEX IF NOT EXISTS idx_parent_phone_codes_lookup
  ON public.parent_phone_codes (phone, created_at DESC);

-- RLS включён БЕЗ политик: таблицей владеет только service-role (серверные
-- действия). Ни родитель, ни админ не читают её напрямую из браузера — код
-- админу отдаёт серверное действие, проверяющее его школу.
ALTER TABLE public.parent_phone_codes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.parent_phone_codes IS
  'Z.2.8: одноразовые коды входа родителя по телефону. Доставка заглушена до подключения провайдера, code_plain — временное поле для ручной выдачи админом.';

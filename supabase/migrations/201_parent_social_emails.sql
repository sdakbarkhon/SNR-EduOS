-- Миграция 201: почта Google и Apple ID у родителя — под будущий вход.
--
-- ЗАЧЕМ. Родители сами не регистрируются, их заводит администратор школы.
-- Чтобы родитель мог войти через Google вместо кода из SMS, система должна
-- заранее знать, какая почта чья: админ вписывает её в карточку родителя, а
-- вход потом сверяет почту вошедшего с этой записью.
--
-- ВХОДА ПОКА НЕТ. Провайдер Google в проекте выключен (проверено:
-- /auth/v1/authorize?provider=google отвечает «provider is not enabled»),
-- ключи из панели Google заводит заказчик. Эта миграция готовит только место
-- для данных — ни входа, ни сверки она не включает.
--
-- ПОЧЕМУ ДВЕ КОЛОНКИ, А НЕ ОДНА. У Apple своя особенность: пользователь может
-- скрыть настоящую почту, и Apple вернёт случайный адрес вида
-- xxx@privaterelay.appleid.com. Складывать это в одно поле с Google значило бы
-- потом гадать, чей адрес записан. Поле Apple заводится сейчас, чтобы админ мог
-- заполнять его заранее; вход через Apple — отдельная задача.
--
-- ЧТО ЗАЩИЩАЕТ БАЗА, А НЕ ФОРМА.
--
--  1. Одну почту нельзя вписать двум родителям — уникальный индекс. Он стоит
--     на lower(btrim(...)), а не на самом значении: иначе «Ivan@GMAIL.com» и
--     «ivan@gmail.com» прошли бы как разные, и вход достался бы тому, кто
--     записался первым. Индексы частичные (WHERE ... IS NOT NULL): пустые поля
--     не мешают друг другу, у большинства родителей почты не будет вовсе.
--
--  2. Значение хранится уже приведённым: CHECK требует, чтобы оно совпадало с
--     lower(btrim(значение)) и содержало «@». Пробел на конце или заглавная
--     буква — частая опечатка при ручном вводе, и без этого правила она
--     означала бы «вход не работает, а почему — непонятно».
--
-- ЧЕГО НЕ ДЕЛАЕТ. Не трогает phone (он остаётся обязательным и основным
-- ключом входа), не трогает политики доступа: обе колонки читаются и пишутся
-- ровно там же, где остальная карточка родителя.

ALTER TABLE public.parents
  ADD COLUMN IF NOT EXISTS google_email text,
  ADD COLUMN IF NOT EXISTS apple_email  text;

COMMENT ON COLUMN public.parents.google_email IS
  'Почта аккаунта Google для входа вместо кода из SMS. Вписывает администратор; '
  'хранится в нижнем регистре без пробелов. Миграция 201.';
COMMENT ON COLUMN public.parents.apple_email IS
  'Apple ID родителя. Заводится заранее — вход через Apple пока не сделан: Apple '
  'умеет подставлять скрытый адрес @privaterelay.appleid.com. Миграция 201.';

-- Приведённый вид и похожесть на почту — проверяет база, а не только форма.
ALTER TABLE public.parents
  DROP CONSTRAINT IF EXISTS parents_google_email_shape;
ALTER TABLE public.parents
  ADD CONSTRAINT parents_google_email_shape CHECK (
    google_email IS NULL
    OR (google_email = lower(btrim(google_email)) AND position('@' IN google_email) > 1)
  );

ALTER TABLE public.parents
  DROP CONSTRAINT IF EXISTS parents_apple_email_shape;
ALTER TABLE public.parents
  ADD CONSTRAINT parents_apple_email_shape CHECK (
    apple_email IS NULL
    OR (apple_email = lower(btrim(apple_email)) AND position('@' IN apple_email) > 1)
  );

-- Одна почта — один родитель. Имена индексов важны: humanizeAdminError
-- (apps/web/lib/admin-error-messages.ts) ловит их и показывает человеку
-- «Эта почта уже привязана к другому родителю» вместо текста Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS parents_google_email_key
  ON public.parents (lower(btrim(google_email)))
  WHERE google_email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS parents_apple_email_key
  ON public.parents (lower(btrim(apple_email)))
  WHERE apple_email IS NOT NULL;

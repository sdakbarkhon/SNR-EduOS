-- Миграция 219: счётчик обращений с одного адреса.
--
-- ЗАЧЕМ. Три маршрута зовут ДО входа, то есть их может дёргать кто угодно:
--   /api/parent/request-code   — выдаёт код и (после Eskiz) шлёт платную SMS
--   /api/parent/verify-code    — принимает код
--   /api/demo/claim-parent     — берёт демо-слот
-- Ограничения по частоте у них не было вовсе. Кулдаун в 60 секунд считается
-- ПО НОМЕРУ и от перебора чужих номеров не спасает: у несуществующего номера
-- строк в parent_phone_codes нет никогда.
--
-- ПОЧЕМУ В БАЗЕ, А НЕ В ПАМЯТИ. Веб живёт на Vercel: каждый вызов — отдельный
-- экземпляр функции, счётчик в переменной процесса обнуляется между
-- запросами. Считать можно только там, где состояние общее, то есть здесь.
--
-- ЧТО ЗАВОДИТСЯ:
--   таблица public.rate_limit_counters — по одной строке на пару
--     (кого считаем, что считаем);
--   функция public.rate_limit_hit(...)  — «засчитать обращение и сказать,
--     пускать ли»;
--   функция public.rate_limit_sweep(...) — выбросить просроченные строки.
--
-- НИ ОДНА СУЩЕСТВУЮЩАЯ ТАБЛИЦА НЕ ТРОГАЕТСЯ. В parent_phone_codes ничего не
-- пишется: считать обращения в таблице кодов значило бы смешивать журнал
-- попыток с одноразовыми секретами, у которых своя жизнь и своё погашение.
--
-- ОКНО ПРИВЯЗАНО К ПЕРВОМУ ОБРАЩЕНИЮ, А НЕ К ЧАСАМ. Если считать по
-- календарному часу, 20 обращений в 10:59 и ещё 20 в 11:00 дают 40 подряд —
-- вдвое больше порога. Здесь window_start ставится в момент первого
-- обращения и держится ровно окно; сдвигается только когда окно истекло.
--
-- ПЕРЕБОР ОБРАЩЕНИЙ НЕ ПРОДЛЕВАЕТ БЛОКИРОВКУ. Счётчик упирается в потолок
-- (limit + 1) и дальше не растёт, а окно кончается по времени первого
-- обращения независимо от того, сколько раз стучали. Это осознанно: в
-- Ташкенте за одним адресом сидит целая школа или целый оператор, и
-- «стучавшийся продлевает себе бан» означало бы, что один человек с ботом
-- держит взаперти всех остальных.

-- ── 1. Таблица ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  -- Кого считаем. Строка с приставкой, чтобы разные виды не сталкивались:
  --   'ip:81.95.x.y'      — адрес обратившегося
  --   'ip6:2001:db8:a:b'  — сеть /64 для IPv6 (у одного человека их тысячи)
  --   'phone:+998…'       — номер, по которому стучались
  subject      text        NOT NULL,
  -- Что считаем: parent_request_code, parent_verify_code, demo_claim_parent,
  -- parent_unknown_probe.
  action       text        NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits         integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, action)
);

-- Единственный индекс — под уборку просроченного. Поиск идёт по первичному
-- ключу, ему индекс уже есть.
CREATE INDEX IF NOT EXISTS rate_limit_counters_window_idx
  ON public.rate_limit_counters (window_start);

COMMENT ON TABLE public.rate_limit_counters IS
  'Обращения с одного адреса к незакрытым маршрутам. Живёт не дольше двух '
  'часов: уборка идёт попутно, см. rate_limit_sweep. Миграция 219.';

-- Наружу таблица не видна вообще. Правил доступа нет ни одного, значит ни
-- анониму, ни вошедшему не достанется ни строки; ходит в неё только
-- служебный ключ через функции ниже.
ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limit_counters FROM PUBLIC;
REVOKE ALL ON TABLE public.rate_limit_counters FROM anon, authenticated;

-- ── 2. Уборка ───────────────────────────────────────────────────────────────
-- Крон занят и трогать его нельзя, поэтому уборка идёт ПОПУТНО: её зовёт сама
-- rate_limit_hit, но только когда завела новую строку или начала новое окно
-- (hits = 1). У честного посетителя это раз в час; у того, кто стучится
-- часто, — тоже раз в час, потому что окно ему уже открыто. Зато при наплыве
-- с тысячи разных адресов уборка зовётся тысячу раз, то есть ровно настолько
-- часто, насколько таблица растёт.
--
-- Порог 2 часа, а не 1: он должен быть заведомо больше самого длинного окна
-- (час), иначе уборка снесла бы живой счётчик.
--
-- SKIP LOCKED — чтобы два одновременных запроса не ждали друг друга: строки,
-- занятые соседом, второй просто пропустит.
CREATE OR REPLACE FUNCTION public.rate_limit_sweep(p_max integer DEFAULT 200)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  WITH протухшие AS (
    SELECT subject, action
      FROM public.rate_limit_counters
     WHERE window_start < now() - interval '2 hours'
     ORDER BY window_start
     LIMIT GREATEST(1, COALESCE(p_max, 200))
     FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.rate_limit_counters c
   USING протухшие p
   WHERE c.subject = p.subject AND c.action = p.action;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.rate_limit_sweep(integer) IS
  'Выбрасывает счётчики старше двух часов, не больше p_max за раз. Зовётся '
  'попутно из rate_limit_hit, отдельного расписания не заводит. Миграция 219.';

-- ── 3. Засчитать обращение ──────────────────────────────────────────────────
-- Возвращает jsonb:
--   allowed     — пускать ли (true/false)
--   hits        — сколько обращений в текущем окне
--   limit       — с чем сравнивали
--   retry_after — через сколько секунд окно кончится
--
-- Пустой subject НЕ отвергается, а пропускается: адрес мог не определиться
-- (локальная разработка, редкая конфигурация прокси). Считать нечего, и
-- запирать живого человека из-за отсутствующего заголовка нельзя. Случай
-- виден в ответе полем reason и пишется в лог на стороне приложения.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_subject        text,
  p_action         text,
  p_limit          integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window interval;
  v_hits   integer;
  v_start  timestamptz;
BEGIN
  IF p_subject IS NULL OR btrim(p_subject) = '' THEN
    RETURN jsonb_build_object('allowed', true, 'hits', 0, 'limit', p_limit,
                              'retry_after', 0, 'reason', 'no_subject');
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'rate_limit_bad_args';
  END IF;

  v_window := make_interval(secs => p_window_seconds);

  INSERT INTO public.rate_limit_counters AS r (subject, action, window_start, hits)
  VALUES (btrim(p_subject), p_action, now(), 1)
  ON CONFLICT (subject, action) DO UPDATE
     SET window_start = CASE WHEN r.window_start <= now() - v_window
                             THEN now() ELSE r.window_start END,
         -- Потолок limit + 1: «сколько именно раз стучались сверх порога» нам
         -- не нужно, а без потолка число росло бы без границы.
         hits         = CASE WHEN r.window_start <= now() - v_window
                             THEN 1 ELSE LEAST(r.hits + 1, p_limit + 1) END
  RETURNING r.hits, r.window_start INTO v_hits, v_start;

  -- Новая строка или новое окно — подходящий момент прибрать старое.
  IF v_hits = 1 THEN
    PERFORM public.rate_limit_sweep(200);
  END IF;

  RETURN jsonb_build_object(
    'allowed',     v_hits <= p_limit,
    'hits',        v_hits,
    'limit',       p_limit,
    'retry_after', GREATEST(0, ceil(extract(epoch FROM (v_start + v_window) - now()))::integer)
  );
END;
$$;

COMMENT ON FUNCTION public.rate_limit_hit(text, text, integer, integer) IS
  'Засчитывает обращение и говорит, пускать ли. Окно привязано к первому '
  'обращению; перебор обращений окно не продлевает. Миграция 219.';

-- Зовёт только служебный ключ с сервера. Анониму и вошедшему — ничего:
-- иначе счётчик можно было бы накрутить чужому адресу и запереть человека.
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.rate_limit_sweep(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_limit_sweep(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_sweep(integer) TO service_role;

NOTIFY pgrst, 'reload schema';

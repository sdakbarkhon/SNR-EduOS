import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ограничение по частоте обращений — одно место на все незакрытые маршруты.
 *
 * ЗАЧЕМ. /api/parent/request-code, /api/parent/verify-code и
 * /api/demo/claim-parent зовут ДО входа, то есть дёргать их может кто угодно.
 * После подключения Eskiz каждый лишний вызов первого из них станет платным.
 *
 * ПОЧЕМУ СЧЁТ ИДЁТ В БАЗЕ. Веб живёт на Vercel: каждый вызов — отдельный
 * экземпляр функции, и счётчик в переменной модуля обнулялся бы между
 * запросами. Общее состояние есть только в Postgres — там и считаем
 * (rate_limit_hit, миграция 219).
 *
 * ОТКАТ, ПОКА МИГРАЦИЯ НЕ ПРИМЕНЕНА. Код уезжает на прод раньше миграции. В
 * этом промежутке функции в базе ещё нет, и тогда мы ПУСКАЕМ и пишем
 * предупреждение в лог. Вход родителя не должен ломаться ни на секунду —
 * ограничение по частоте это защита, а не условие работы.
 */

/** Сколько ждать, если ответ базы не пришёл. Больше — и мы сами станем
 *  причиной, по которой вход тормозит. */
const RPC_TIMEOUT_MS = 2500;

export type RateVerdict = {
  /** true — пускать. */
  allowed: boolean;
  /** Через сколько секунд окно кончится. 0, если считать не удалось. */
  retryAfter: number;
  /** Сколько обращений насчитано в текущем окне. */
  hits: number;
  /** Считать не удалось (нет функции, нет адреса, база молчит) — пустили. */
  degraded: boolean;
};

const ПУСТИТЬ: RateVerdict = { allowed: true, retryAfter: 0, hits: 0, degraded: true };

/** PostgREST не нашёл функцию (PGRST202) или Postgres не нашёл (42883).
 *  Тот же приём, что в packages/core/src/queries/index.ts. */
function функцииНет(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code ?? "";
  const msg = (e as { message?: string } | null)?.message ?? "";
  return code === "PGRST202" || code === "42883" || /Could not find the function/i.test(msg);
}

/**
 * Адрес обратившегося.
 *
 * ПОЧЕМУ НЕ ПРОСТО x-forwarded-for. Этот заголовок клиент может прислать сам,
 * и если верить его первому значению, ограничение обходится одной строкой в
 * запросе. На Vercel есть заголовки, которые ставит сама площадка и которые
 * клиентские значения затирают, — берём сперва их. x-forwarded-for оставлен
 * последним запасным вариантом, и берётся из него ПОСЛЕДНЕЕ значение: его
 * дописал ближайший к нам прокси, а не тот, кто стучится.
 *
 * IPv6 РЕЖЕТСЯ ДО /64. Одному человеку провайдер выдаёт целую сеть /64, и
 * считать по полному адресу значило бы считать каждый запрос за новый.
 *
 * Вернуть null — нормально: адрес мог не определиться (локальная разработка).
 * Тогда считать нечего, и запирать живого человека из-за отсутствующего
 * заголовка мы не будем.
 */
export function clientIp(headers: Headers): string | null {
  const первый = (v: string | null) => (v ? v.split(",")[0]?.trim() || null : null);
  const последний = (v: string | null) => {
    if (!v) return null;
    const части = v.split(",").map((s) => s.trim()).filter(Boolean);
    return части.length ? части[части.length - 1]! : null;
  };

  const сырой =
    первый(headers.get("x-vercel-forwarded-for")) ??
    первый(headers.get("x-real-ip")) ??
    последний(headers.get("x-forwarded-for"));

  if (!сырой) return null;
  return нормализовать(сырой);
}

function нормализовать(сырой: string): string | null {
  let s = сырой.trim().toLowerCase();
  if (!s) return null;

  // «[2001:db8::1]:443» — скобки и порт от прокси.
  if (s.startsWith("[")) s = s.slice(1, s.indexOf("]") > 0 ? s.indexOf("]") : undefined);
  // Зона у link-local: fe80::1%eth0
  const зона = s.indexOf("%");
  if (зона > 0) s = s.slice(0, зона);

  if (s.includes(":")) {
    // IPv6. Хвост вида «::ffff:1.2.3.4» — это на самом деле IPv4.
    const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s);
    if (v4) return `ip:${v4[1]}`;
    // Двоеточий несколько — значит настоящий IPv6, режем до /64.
    if ((s.match(/:/g) ?? []).length > 1) {
      const группы = s.split(":");
      // Сжатую запись (::) не разворачиваем: как строка она устойчива, а нам
      // нужна не арифметика адресов, а один и тот же ключ для одного и того
      // же человека.
      return `ip6:${группы.slice(0, 4).join(":")}`;
    }
    // Одно двоеточие — это «1.2.3.4:5678».
    return `ip:${s.split(":")[0]}`;
  }
  return `ip:${s}`;
}

/**
 * Засчитать обращение и сказать, пускать ли.
 *
 * @param subject кого считаем — результат clientIp или 'phone:+998…'
 * @param action  что считаем: parent_request_code и т. п.
 * @param limit   сколько разрешено за окно
 * @param windowSeconds длина окна в секундах
 */
export async function rateLimit(
  subject: string | null,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<RateVerdict> {
  if (!subject) {
    console.warn(`[rate] ${action}: адрес не определился — пускаем, не считая`);
    return ПУСТИТЬ;
  }

  try {
    const db = createAdminClient();
    const вызов = db.rpc("rate_limit_hit" as never, {
      p_subject: subject,
      p_action: action,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    } as never);

    const ответ = (await Promise.race([
      вызов,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("rate_limit_timeout")), RPC_TIMEOUT_MS),
      ),
    ])) as { data: unknown; error: unknown };

    if (ответ.error) {
      if (функцииНет(ответ.error)) {
        console.warn(`[rate] ${action}: миграция 219 ещё не применена — пускаем без счёта`);
      } else {
        console.error(`[rate] ${action}: база отказала —`,
          (ответ.error as { message?: string })?.message ?? ответ.error);
      }
      return ПУСТИТЬ;
    }

    const d = ответ.data as { allowed?: boolean; hits?: number; retry_after?: number } | null;
    if (!d || typeof d.allowed !== "boolean") return ПУСТИТЬ;

    if (!d.allowed) {
      // Отказ по частоте — это работающая защита, а не поломка: warn, не error.
      console.warn(`[rate] ${action}: порог ${limit} исчерпан для ${subject} ` +
        `(обращений ${d.hits ?? "?"}), ещё ${d.retry_after ?? 0} с`);
    }
    return {
      allowed: d.allowed,
      retryAfter: Math.max(0, Number(d.retry_after ?? 0)),
      hits: Number(d.hits ?? 0),
      degraded: false,
    };
  } catch (e) {
    // Таймаут, сеть, что угодно. Молча пускаем: своей защитой ломать вход нельзя.
    console.error(`[rate] ${action}: посчитать не вышло — пускаем.`, (e as Error)?.message ?? e);
    return ПУСТИТЬ;
  }
}

/** Заголовки отказа: Retry-After понимают и браузеры, и промежуточные узлы. */
export function retryHeaders(v: RateVerdict): Record<string, string> {
  return v.retryAfter > 0 ? { "Retry-After": String(v.retryAfter) } : {};
}

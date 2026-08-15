/**
 * Свои входы в аккаунт — общее для веба и мобильного приложения.
 *
 * ОТКУДА ДАННЫЕ. Из auth.sessions — родной таблицы Supabase Auth, где на
 * каждый вход своя строка: когда вошли, когда последний раз обновляли токен,
 * с какого устройства и адреса. Схема auth наружу не отдаётся, поэтому обе
 * функции ходят через RPC миграции 199 (`my_sessions`, `end_session`), которые
 * работают только от лица вошедшего: чужую строку не показать и не закрыть.
 *
 * ЧЕМ ЭТО НЕ ЯВЛЯЕТСЯ. public.user_sessions — не список устройств, а реестр
 * правила «одна активная сессия» (одна строка на аккаунт, миграция 110). Экран
 * сессий её не читает и не пишет, правило работает как работало.
 */
import type { Db } from "../supabase/factory";

export type OwnSession = {
  id: string;
  /** Когда с этого устройства вошли в аккаунт. */
  createdAt: string;
  /** Когда устройство последний раз обновляло токен (не «последний экран»). */
  lastSeenAt: string;
  /** Сырой User-Agent — как его записал Supabase Auth. Может быть пустым. */
  userAgent: string | null;
  /** Адрес, с которого выполнен вход. */
  ip: string | null;
  /** Это устройство, с которого читают список. */
  isCurrent: boolean;
};

/** Все входы в свой аккаунт, свежие сверху. Чужих строк прийти не может. */
export async function getMySessions(db: Db): Promise<OwnSession[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("my_sessions");
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id as string,
    createdAt: r.created_at as string,
    lastSeenAt: (r.last_seen_at ?? r.created_at) as string,
    userAgent: (r.user_agent as string | null) ?? null,
    ip: (r.ip as string | null) ?? null,
    isCurrent: r.is_current === true,
  }));
}

/**
 * Ответ на попытку закрыть сеанс:
 *   ok        — закрыт, устройство больше не обновит токен;
 *   current   — это текущее устройство, для него есть «Выйти»;
 *   not_found — сеанса нет (в том числе если он чужой).
 */
export type EndSessionResult = "ok" | "current" | "not_found";

/** Закрывает ОДИН свой вход. Текущий не закрывается никогда. */
export async function endSession(db: Db, sessionId: string): Promise<EndSessionResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc("end_session", { p_session_id: sessionId });
  if (error) throw error;
  const r = data as string | null;
  return r === "ok" || r === "current" ? r : "not_found";
}

/**
 * Понятное название устройства из User-Agent.
 *
 * `user_agent` — сырая строка на две сотни знаков («Mozilla/5.0 (Linux;
 * Android 14; Pixel 8) AppleWebKit/537.36 …»), из которой человек не поймёт,
 * его это телефон или чужой. Вытаскиваем браузер и систему — «Chrome ·
 * Android 14». Разбор нарочно грубый: порядок проверок важен (Edge и Opera
 * представляются ещё и Chrome, Chrome — ещё и Safari), а незнакомая строка
 * отдаётся как есть, обрезанной, — лучше кусок правды, чем выдуманное имя.
 *
 * Отдельно узнаём два своих случая: вход из мобильного приложения (Expo
 * присылает «Expo/… CFNetwork/… Darwin/…») и служебный вход из скрипта
 * («node») — иначе оба выглядели бы как «неизвестное устройство».
 */
export function deviceLabel(
  raw: string | null,
  words: { unknown: string; app: string; script: string; web: string },
): string {
  if (!raw) return words.unknown;
  const ua = raw.trim();
  if (!ua) return words.unknown;

  if (/^node(\.js)?/i.test(ua)) return words.script;
  if (/Next\.js|Vercel/i.test(ua)) return words.web;
  if (/\bExpo\//.test(ua)) {
    const ios = /CFNetwork|Darwin/i.test(ua);
    return `${words.app}${ios ? " · iOS" : /okhttp|Android/i.test(ua) ? " · Android" : ""}`;
  }

  const browser =
    /\bEdg[A-Za-z]*\//.test(ua) ? "Edge"
    : /\bOPR\/|\bOpera\//.test(ua) ? "Opera"
    : /\bYaBrowser\//.test(ua) ? "Yandex"
    : /\bFirefox\//.test(ua) ? "Firefox"
    : /\bChrome\//.test(ua) ? "Chrome"
    : /\bSafari\//.test(ua) ? "Safari"
    : null;

  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  const iosVer = ua.match(/OS (\d+)[._](\d+)/);
  const macVer = ua.match(/Mac OS X (\d+)[._](\d+)/);
  const os =
    android ? `Android ${android[1]}`
    : /iPhone|iPad|iPod/.test(ua) ? `iOS${iosVer ? ` ${iosVer[1]}.${iosVer[2]}` : ""}`
    : /Windows NT/.test(ua) ? "Windows"
    : macVer ? `macOS ${macVer[1]}.${macVer[2]}`
    : /Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : null;

  const parts = [browser, os].filter(Boolean);
  if (parts.length === 0) return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua;
  return parts.join(" · ");
}

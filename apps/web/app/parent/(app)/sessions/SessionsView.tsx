"use client";

/** Разметка «Активных сессий». Клиентский компонент ради словаря (см. TestsView). */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ParentSessionItem } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import {
  EmptyState,
  ICON,
  IconTile,
  InnerHeader,
  ScreenScroll,
  SectionCap,
  StatusChip,
} from "../_ui/screen-kit";
import { DIVIDER } from "../_ui/screen-tokens";
import { previousDay, relativeStamp } from "../_ui/format";
import { ink1, ink2, ink3 } from "../v2/tokens";

/** Градиент плитки — не по устройству, а по «текущая / прежняя». */
const CURRENT: readonly [string, string] = ["#7C3AED", "#22D3EE"];
const PAST: readonly [string, string] = ["#94A3B8", "#64748B"];

/**
 * `user_sessions.device_info` — сырой User-Agent целиком («Mozilla/5.0 (Linux;
 * Android 14; Pixel 8) AppleWebKit/537.36 …»). Показывать его как есть нельзя:
 * это строка на две сотни знаков, из которой родитель не поймёт, его это
 * телефон или чужой. Вытаскиваем браузер и систему — «Chrome · Android 14».
 * Разбор нарочно грубый: порядок проверок важен (Edge и Opera представляются
 * ещё и Chrome, Chrome — ещё и Safari), а незнакомый UA просто отдаётся как
 * есть, обрезанным, — лучше кусок правды, чем выдуманное имя устройства.
 */
function deviceLabel(raw: string | null, unknown: string): string {
  if (!raw) return unknown;
  const ua = raw.trim();
  if (!ua) return unknown;

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
    : /Windows NT 10|Windows NT 11/.test(ua) ? "Windows"
    : /Windows/.test(ua) ? "Windows"
    : macVer ? `macOS ${macVer[1]}.${macVer[2]}`
    : /Macintosh/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : null;

  const parts = [browser, os].filter(Boolean);
  if (parts.length === 0) return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua;
  return parts.join(" · ");
}

export function SessionsView({
  sessions,
  today,
}: {
  sessions: ParentSessionItem[];
  today: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more;
  const yesterday = previousDay(today);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.sessions} backHref="/parent/profile" />

      <ScreenScroll>
        {sessions.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState title={m.sessionsEmptyTitle} text={m.sessionsEmptyText} paths={ICON.shield} />
          </GlassCard>
        ) : (
          <>
            <SectionCap label={m.sessionsCount.replace("{n}", String(sessions.length))} />

            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {sessions.map((s, idx) => (
                <div
                  key={s.id}
                  className="flex"
                  style={{
                    gap: 11,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                  }}
                >
                  <IconTile gradient={s.isCurrent ? CURRENT : PAST} paths={ICON.shield} />

                  <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 3 }}>
                    <div className="flex items-start" style={{ gap: 8 }}>
                      <span className="min-w-0 flex-1" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                        {deviceLabel(s.deviceInfo, m.sessionsUnknownDevice)}
                      </span>
                      {s.isCurrent ? <StatusChip label={m.sessionsCurrent} family="green" dot /> : null}
                    </div>

                    <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                      {m.sessionsEntered.replace("{when}", relativeStamp(s.createdAt, today, yesterday))}
                    </span>
                    {s.lastActivity ? (
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                        {m.sessionsActivity.replace("{when}", relativeStamp(s.lastActivity, today, yesterday))}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </GlassCard>

            <span style={{ fontSize: 9, fontWeight: 600, lineHeight: "14px", color: ink3, textAlign: "center" }}>
              {m.sessionsNote}
            </span>
          </>
        )}
      </ScreenScroll>
    </div>
  );
}

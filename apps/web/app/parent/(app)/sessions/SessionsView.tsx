"use client";

/**
 * Разметка «Активных сессий». Клиентский компонент ради словаря (см. TestsView).
 *
 * 15.08.2026. Данные переехали с public.user_sessions (реестр правила «одна
 * сессия», всегда одна строка) на auth.sessions — настоящие входы, по строке
 * на устройство. Вместе с ними появилась кнопка «Завершить»: раньше её здесь
 * не было именно потому, что закрывать было нечего. Текущий вход не
 * закрывается — для него есть «Выйти» в профиле.
 *
 * Разбор User-Agent и вызовы RPC — общие с приложением (`@snr/core`), второй
 * копии нет.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@snr/core";
import { deviceLabel, getDictionary, type OwnSession } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
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
import { useDates } from "../_ui/dates";
import { ink1, ink2, ink3 } from "../v2/tokens";
import { endParentSession } from "./actions";

/** Градиент плитки — не по устройству, а по «текущая / прежняя». */
const CURRENT: readonly [string, string] = ["#7C3AED", "#22D3EE"];
const PAST: readonly [string, string] = ["#94A3B8", "#64748B"];

export function SessionsView({
  sessions,
  today,
}: {
  sessions: OwnSession[];
  today: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more;
  const s = d.sess;
  const dt = useDates();
  const router = useRouter();

  const [confirm, setConfirm] = useState<OwnSession | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const words = {
    unknown: m.sessionsUnknownDevice,
    app: s.deviceApp,
    script: s.deviceScript,
    web: s.deviceWeb,
  };

  const runEnd = (row: OwnSession) => {
    setConfirm(null);
    setNote(null);
    startTransition(async () => {
      const res = await endParentSession(row.id);
      if (!res.ok) setNote({ ok: false, text: s.endError });
      else if (res.result === "ok") setNote({ ok: true, text: s.endedOne });
      else if (res.result === "current") setNote({ ok: false, text: s.endCurrent });
      else setNote({ ok: false, text: s.endedNone });
      router.refresh();
    });
  };

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
              {sessions.map((row, idx) => (
                <div
                  key={row.id}
                  className="flex"
                  style={{
                    gap: 11,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                  }}
                >
                  <IconTile gradient={row.isCurrent ? CURRENT : PAST} paths={ICON.shield} />

                  <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 3 }}>
                    <div className="flex items-start" style={{ gap: 8 }}>
                      <span className="min-w-0 flex-1" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                        {deviceLabel(row.userAgent, words)}
                      </span>
                      {row.isCurrent ? <StatusChip label={m.sessionsCurrent} family="green" dot /> : null}
                    </div>

                    <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                      {s.entered.replace("{when}", dt.stamp(row.createdAt, today))}
                    </span>
                    <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                      {s.seen.replace("{when}", dt.stamp(row.lastSeenAt, today))}
                      {row.ip ? ` · ${row.ip}` : ""}
                    </span>
                  </div>

                  {/* Текущий вход не закрываем — для него есть «Выйти». */}
                  {row.isCurrent ? null : (
                    <button
                      type="button"
                      onClick={() => setConfirm(row)}
                      disabled={pending}
                      aria-label={s.end}
                      className="shrink-0 self-center rounded-full disabled:opacity-60"
                      style={{
                        width: 30,
                        height: 30,
                        display: "grid",
                        placeItems: "center",
                        background: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.32)",
                      }}
                    >
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <path d="M18 6 6 18" stroke="#b91c1c" strokeWidth={2.4} strokeLinecap="round" />
                        <path d="m6 6 12 12" stroke="#b91c1c" strokeWidth={2.4} strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </GlassCard>

            {/* Подтверждение — закрытие входа не отменить. */}
            {confirm ? (
              <GlassCard radius={18} style={{ padding: 14 }}>
                <div className="flex flex-col" style={{ gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>{s.confirmTitle}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, lineHeight: "15px", color: ink2 }}>
                    {s.confirmText.replace("{device}", deviceLabel(confirm.userAgent, words))}
                  </span>
                  <div className="flex" style={{ gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setConfirm(null)}
                      className="flex-1 rounded-2xl"
                      style={{ padding: "11px 0", fontSize: 11.5, fontWeight: 800, color: ink1, background: "rgba(23,18,67,0.06)" }}
                    >
                      {d.common.cancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => runEnd(confirm)}
                      className="flex-1 rounded-2xl"
                      style={{
                        padding: "11px 0",
                        fontSize: 11.5,
                        fontWeight: 800,
                        color: "#b91c1c",
                        border: "1.5px solid rgba(239,68,68,0.55)",
                      }}
                    >
                      {s.end}
                    </button>
                  </div>
                </div>
              </GlassCard>
            ) : null}

            {pending ? (
              <span style={{ fontSize: 10, fontWeight: 700, color: ink2, textAlign: "center" }}>{s.ending}</span>
            ) : null}
            {!pending && note ? (
              <GlassCard radius={18} style={{ padding: 12 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: "15px",
                    color: note.ok ? "#047857" : ink2,
                  }}
                >
                  {note.text}
                </span>
              </GlassCard>
            ) : null}

            {[m.sessionsNote, s.noteSeen, s.noteSingle, s.noteData].map((text, i) => (
              <span
                key={i}
                style={{ fontSize: 9, fontWeight: 600, lineHeight: "14px", color: ink3, textAlign: "center" }}
              >
                {text}
              </span>
            ))}
          </>
        )}
      </ScreenScroll>
    </div>
  );
}

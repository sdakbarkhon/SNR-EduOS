"use client";

/**
 * Разметка «Поддержки».
 *
 * Блоки: карточка службы, список обращений (раскрываются в переписку), форма
 * нового обращения. Форма выглядит рабочей — поля, темы-чипы, кнопка — но
 * ничего не отправляет: по нажатию показывается пояснение, почему. Написанное
 * при этом не стирается.
 */

import { useState } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { SupportStatus, SupportTicket } from "../_demo/demo-data";
import { SOON_SUPPORT } from "../_demo/demo-data";
import { GlassCard } from "../v2/GlassCard";
import { Glyph, ICON, InnerHeader, PrimaryButton, ScreenScroll, SectionCap, StatusChip } from "../_ui/screen-kit";
import { SoonNote } from "../payments/parts";
import { DIVIDER, PILL_INACTIVE_BG } from "../_ui/screen-tokens";
import { useDates } from "../_ui/dates";
import { addDaysKey } from "../_ui/format";
import { accent, accentGrad, chip, glassBorder, ink1, ink2, ink3, status, type StatusKey } from "../v2/tokens";

const STATUS_FAMILY: Record<SupportStatus, StatusKey> = {
  answered: "green",
  closed: "gray",
  waiting: "orange",
};

export function SupportView({
  tickets,
  topics,
  today,
}: {
  tickets: SupportTicket[];
  topics: readonly string[];
  today: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more3;
  const dt = useDates();

  const [openId, setOpenId] = useState<string | null>(tickets[0]?.id ?? null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [soon, setSoon] = useState(false);

  const statusLabel: Record<SupportStatus, string> = {
    answered: m.supportStatusAnswered,
    closed: m.supportStatusClosed,
    waiting: m.supportStatusWaiting,
  };

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.support} backHref="/parent/profile" />

      <ScreenScroll>
        {/* Карточка службы. */}
        <GlassCard radius={22} style={{ padding: 14 }}>
          <div className="flex items-center" style={{ gap: 11 }}>
            <span
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{ width: 40, height: 40, background: accentGrad }}
            >
              <Glyph paths={ICON.help} size={18} color="#FFFFFF" strokeWidth={1.9} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>SNR EduOS</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: ink2 }}>{m.supportOnline}</span>
            </div>
          </div>
        </GlassCard>

        {/* Честная пометка: обращения ниже — пример. */}
        <SoonNote text={m.supportDemoNote} />

        <SectionCap label={m.supportTicketsCap} />

        <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
          {tickets.map((t, idx) => {
            const open = openId === t.id;
            const last = t.messages[t.messages.length - 1]!;
            return (
              <div
                key={t.id}
                style={{
                  paddingTop: 12,
                  paddingBottom: 12,
                  borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : t.id)}
                  className="flex w-full items-start text-left"
                  style={{ gap: 8 }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                      {t.subject}
                    </span>
                    <span
                      className="block"
                      style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 3 }}
                    >
                      {`${dt.dayMonth(addDaysKey(today, -last.daysAgo))} · ${last.time}`}
                    </span>
                  </span>
                  <StatusChip label={statusLabel[t.status]} family={STATUS_FAMILY[t.status]} fontSize={8.5} />
                </button>

                {open ? (
                  <div className="flex flex-col" style={{ gap: 7, marginTop: 10 }}>
                    {t.messages.map((msg, i) => {
                      const mine = msg.from === "me";
                      const c = chip(status.violet.rgb);
                      return (
                        <div
                          key={i}
                          className={mine ? "self-end" : "self-start"}
                          style={{
                            maxWidth: "88%",
                            padding: "9px 11px",
                            borderRadius: mine ? "14px 14px 5px 14px" : "14px 14px 14px 5px",
                            background: mine ? c.background : "rgba(255,255,255,0.55)",
                            border: `1px solid ${mine ? c.borderColor : glassBorder}`,
                          }}
                        >
                          <p style={{ fontSize: 11, fontWeight: 600, lineHeight: "16px", color: ink1 }}>
                            {msg.text}
                          </p>
                          <span
                            className="block text-right"
                            style={{ fontSize: 8.5, fontWeight: 700, color: ink3, marginTop: 4 }}
                          >
                            {msg.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </GlassCard>

        {/* Новое обращение. */}
        <SectionCap label={m.supportNewCap} />

        <GlassCard radius={22} style={{ padding: 14 }}>
          <div className="flex flex-col" style={{ gap: 10 }}>
            <div className="flex flex-wrap" style={{ gap: 6 }}>
              {topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSubject(t)}
                  className="rounded-full"
                  style={{
                    padding: "6px 11px",
                    fontSize: 10,
                    fontWeight: 700,
                    color: subject === t ? "#FFFFFF" : ink2,
                    background: subject === t ? accent : PILL_INACTIVE_BG,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="flex flex-col" style={{ gap: 5 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: ink3, textTransform: "uppercase" }}>
                {m.supportSubject}
              </span>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={m.supportSubjectPlaceholder}
                className="w-full"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${glassBorder}`,
                  background: "rgba(255,255,255,0.55)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: ink1,
                }}
              />
            </label>

            <label className="flex flex-col" style={{ gap: 5 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: ink3, textTransform: "uppercase" }}>
                {m.supportText}
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={m.supportTextPlaceholder}
                rows={4}
                className="w-full resize-none"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: `1px solid ${glassBorder}`,
                  background: "rgba(255,255,255,0.55)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  lineHeight: "17px",
                  color: ink1,
                }}
              />
            </label>

            <PrimaryButton label={m.supportSend} onClick={() => setSoon(true)} />

            {/* Написанное намеренно НЕ стирается: экран не делает вид, что
                обращение ушло. */}
            {soon ? <SoonNote text={SOON_SUPPORT} /> : null}
          </div>
        </GlassCard>
      </ScreenScroll>
    </div>
  );
}

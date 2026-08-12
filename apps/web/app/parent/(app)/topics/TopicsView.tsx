"use client";

/**
 * Разметка «Освоения тем». Клиентский компонент: словарь + фильтр по предмету.
 *
 * Порядок блоков — как в мобильном экране: чипы-фильтры по предметам,
 * карточка итога с кольцом, дальше список тем с полосой прогресса.
 */

import { useMemo, useState } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { TopicMasteryItem } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, ICON, InnerHeader, ScreenScroll, SectionCap, StatusChip } from "../_ui/screen-kit";
import { DIVIDER, PILL_INACTIVE_BG } from "../_ui/screen-tokens";
import { accent, ink1, ink2, ink3 } from "../v2/tokens";

/** Порог «освоено», как в мобильном экране: 70 %. */
const MASTERED_AT = 70;

const RING_SIZE = 76;
const RING_STROKE = 9;

/** Кольцо общего освоения: чистый SVG, без библиотеки — одна дуга. */
function Ring({ pct }: { pct: number }) {
  const r = (RING_SIZE - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} aria-hidden>
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={r}
        fill="none"
        stroke="rgba(124,58,237,0.16)"
        strokeWidth={RING_STROKE}
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
    </svg>
  );
}

export function TopicsView({
  topics,
  childName,
}: {
  topics: TopicMasteryItem[];
  childName: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more2;
  const [subject, setSubject] = useState<string | null>(null);

  const subjects = useMemo(
    () => [...new Set(topics.map((t) => t.subjectName))].sort((a, b) => a.localeCompare(b)),
    [topics],
  );
  const shown = useMemo(
    () => (subject ? topics.filter((t) => t.subjectName === subject) : topics),
    [subject, topics],
  );

  const mastered = topics.filter((t) => t.pct >= MASTERED_AT).length;
  const attention = topics.length - mastered;
  const overall = topics.length > 0 ? Math.round(topics.reduce((s, t) => s + t.pct, 0) / topics.length) : 0;

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.topics} backHref="/parent/progress" />

      <ScreenScroll>
        {topics.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState
              title={m.topicsEmptyTitle}
              text={m.topicsEmptyText.replace("{name}", childName ?? "")}
              paths={ICON.checkSquare}
            />
          </GlassCard>
        ) : (
          <>
            {/* Итог: кольцо + три числа. */}
            <GlassCard radius={22} style={{ padding: 16 }}>
              <div className="flex items-center" style={{ gap: 16 }}>
                <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
                  <Ring pct={overall} />
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ fontSize: 17, fontWeight: 800, color: ink1 }}
                  >
                    {`${overall}%`}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 7 }}>
                  {[
                    { label: m.topicsCount, value: topics.length, color: ink1 },
                    { label: m.topicsMastered, value: mastered, color: "var(--p-status-green-text, #047857)" },
                    { label: m.topicsAttention, value: attention, color: "var(--p-status-orange-text, #C2410C)" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-baseline" style={{ gap: 8 }}>
                      <span className="flex-1" style={{ fontSize: 11, fontWeight: 600, color: ink2 }}>
                        {row.label}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <span
                className="block"
                style={{ fontSize: 9, fontWeight: 700, color: ink3, marginTop: 10, textAlign: "center" }}
              >
                {m.topicsOverall}
              </span>
            </GlassCard>

            {/* Фильтр по предмету. */}
            {subjects.length > 1 ? (
              <div className="flex overflow-x-auto" style={{ gap: 7, paddingBottom: 2 }}>
                {[null, ...subjects].map((s) => {
                  const active = s === subject;
                  return (
                    <button
                      key={s ?? "all"}
                      type="button"
                      onClick={() => setSubject(s)}
                      className="shrink-0 rounded-full"
                      style={{
                        padding: "8px 13px",
                        fontSize: 11,
                        fontWeight: active ? 800 : 700,
                        color: active ? "#FFFFFF" : ink2,
                        background: active ? accent : PILL_INACTIVE_BG,
                      }}
                    >
                      {s ?? m.topicsAllSubjects}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <SectionCap label={m.topicsCount} />

            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {shown.map((t, idx) => (
                <div
                  key={`${t.subjectName}-${t.topic}`}
                  className="flex flex-col"
                  style={{
                    gap: 6,
                    paddingTop: 12,
                    paddingBottom: 12,
                    borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                  }}
                >
                  <div className="flex items-start" style={{ gap: 8 }}>
                    <span className="min-w-0 flex-1" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                      {t.topic}
                    </span>
                    {t.pct < MASTERED_AT ? (
                      <StatusChip label={m.topicsAttentionChip} family="orange" fontSize={8.5} />
                    ) : null}
                    <span
                      className="shrink-0"
                      style={{ fontSize: 12, fontWeight: 800, color: t.subjectColor ?? accent }}
                    >
                      {`${t.pct}%`}
                    </span>
                  </div>

                  {/* Полоса прогресса — цветом предмета. */}
                  <span
                    aria-hidden
                    className="block w-full overflow-hidden"
                    style={{ height: 5.5, borderRadius: 3, background: "rgba(23,18,67,0.08)" }}
                  >
                    <span
                      className="block h-full"
                      style={{
                        width: `${Math.max(3, t.pct)}%`,
                        borderRadius: 3,
                        background: t.subjectColor ?? accent,
                      }}
                    />
                  </span>

                  <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                    {`${t.subjectName} · ${m.topicsMeta
                      .replace("{n}", String(t.count))
                      .replace("{avg}", t.average.toFixed(1))}`}
                  </span>
                </div>
              ))}
            </GlassCard>

            <span style={{ fontSize: 9, fontWeight: 600, lineHeight: "14px", color: ink3, textAlign: "center" }}>
              {m.topicsNote}
            </span>
          </>
        )}
      </ScreenScroll>
    </div>
  );
}

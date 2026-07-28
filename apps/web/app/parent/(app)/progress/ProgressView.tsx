"use client";

import { useState } from "react";
import { getDictionary, formatDate, LOCALE_TAG, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { ink1, ink2, ink3, glassBorder } from "@/lib/parent/glass-tokens";

export type SubjectStat = { subject: string; label: string; color: string; avg: number; count: number };
export type TeacherReview = { teacherName: string | null; subjectName: string | null; comment: string; gradedAtIso: string };

type Props = {
  childName: string | null;
  average: number | null;
  subjectStats: SubjectStat[];
  review: TeacherReview | null;
};

// Мок-значения для вкладок «Навыки»/«Динамика» — те же вкладки в
// мобильном ProgressScreen.tsx остаются фикстурой (см. комментарий там:
// «нет естественного способа посчитать без выдумывания метрики»), здесь
// перенесены как статичный, явно иллюстративный мок — не подключены к БД.
const SKILL_AXES = ["axisLogic", "axisCommunication", "axisDiscipline", "axisCreativity", "axisIndependence", "axisTeamwork"] as const;
const SKILL_VALUES = [72, 85, 68, 90, 76, 82];
const WEEK_SPARK_VALUES = [2, 3, 2.5, 4, 3.5, 5, 4.5];
const DYN_SPARK_VALUES = [3.8, 4.0, 4.1, 3.9, 4.3, 4.5];
const MOCK_ATTENDANCE_PCT = 92;

function initialsFromName(name: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "—";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

function polarPoint(center: number, radius: number, index: number, total: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
}

function RadarChart({ values, labels, size = 220 }: { values: number[]; labels: string[]; size?: number }) {
  const n = values.length;
  const center = size / 2;
  const maxR = size / 2 - 30;
  const valuePoints = values.map((v, i) => polarPoint(center, (Math.max(0, Math.min(100, v)) / 100) * maxR, i, n));
  const polygonPath = valuePoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.33, 0.66, 1].map((r, i) => (
        <polygon
          key={i}
          points={Array.from({ length: n }, (_, idx) => polarPoint(center, r * maxR, idx, n))
            .map((p) => `${p.x},${p.y}`)
            .join(" ")}
          fill="none"
          stroke="rgba(23,18,67,0.10)"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const p = polarPoint(center, maxR, i, n);
        return <line key={i} x1={center} y1={center} x2={p.x} y2={p.y} stroke="rgba(23,18,67,0.10)" strokeWidth={1} />;
      })}
      <polygon points={polygonPath} fill="rgba(139,92,246,0.28)" stroke="#7C3AED" strokeWidth={2} />
      {valuePoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#7C3AED" />
      ))}
      {labels.map((label, i) => {
        const p = polarPoint(center, maxR + 16, i, n);
        return (
          <text key={i} x={p.x} y={p.y} fontSize={8} fontWeight={700} fill={ink1} textAnchor="middle" dominantBaseline="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

function Sparkline({
  values,
  width = 100,
  height = 30,
  color = "#7C3AED",
  strokeWidth = 2,
  endDot,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  endDot?: boolean;
}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1 || 1);
  const points = values.map((v, i) => ({ x: i * stepX, y: height - 3 - ((v - min) / range) * (height - 6) }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {endDot && last && <circle cx={last.x} cy={last.y} r={4.5} fill={color} />}
    </svg>
  );
}

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width={13} height={13} viewBox="0 0 24 24" fill={i < count ? "#F59E0B" : "rgba(255,255,255,0.35)"}>
          <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export function ProgressView({ childName, average, subjectStats, review }: Props) {
  const { locale } = useLocale();
  const loc = locale as Locale;
  const d = getDictionary(loc).parentApp;
  const [tab, setTab] = useState<0 | 1 | 2>(0);

  if (!childName) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <GlassCard className="px-6 py-8 text-center">
          <p className="text-sm" style={{ color: ink2 }}>
            {d.auth.chooseChild}
          </p>
        </GlassCard>
      </div>
    );
  }

  const averageLabel = average != null ? average.toFixed(1) : "—";
  const averageStars = average != null ? Math.max(0, Math.min(5, Math.round(average))) : 0;
  const averageChip =
    average == null ? null : average >= 4.5 ? d.grades.gradeChipExcellent : average >= 3.5 ? d.grades.gradeChipGood : d.grades.gradeChipNeedsWork;

  const months = Array.from({ length: DYN_SPARK_VALUES.length }, (_, i) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (DYN_SPARK_VALUES.length - 1 - i));
    return new Intl.DateTimeFormat(LOCALE_TAG[loc], { month: "short" }).format(date);
  });

  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      {/* AccentCard «Средний балл» — реальные значения */}
      <div className="rounded-[22px] p-4" style={{ background: "linear-gradient(135deg, #f97316, #ec4899)", boxShadow: "0 14px 30px rgba(249,115,22,0.28)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-white/85">{d.grades.average}</span>
            <div className="flex items-end gap-1.5">
              <span className="text-[32px] font-bold leading-none text-white">{averageLabel}</span>
              <span className="mb-1 text-[13px] font-bold text-white/85">/5.0</span>
            </div>
            <StarRow count={averageStars} />
          </div>
          {averageChip && (
            <span className="rounded-full border border-white/35 bg-white/20 px-2.5 py-1 text-[10.5px] font-extrabold text-white">
              {averageChip}
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-2.5">
          <div className="flex-1 rounded-[14px] border border-white/25 bg-white/10 p-3">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-white/85">{d.progressWeb.weekProgressLabel}</span>
            <div className="mt-1.5">
              <Sparkline values={WEEK_SPARK_VALUES} width={56} height={20} color="#FFFFFF" strokeWidth={2.2} />
            </div>
            <span className="mt-1 block text-[10px] font-bold text-white/85">{d.progressWeb.weekProgressNote}</span>
          </div>
          <div className="flex-1 rounded-[14px] border border-white/25 bg-white/10 p-3">
            <span className="text-[9px] font-extrabold uppercase tracking-wide text-white/85">{d.scr.attendance}</span>
            <div className="mt-1.5 text-[14px] font-extrabold text-white">{MOCK_ATTENDANCE_PCT}%</div>
            <div className="mt-1 h-1 rounded-full bg-white/25">
              <div className="h-1 rounded-full bg-white" style={{ width: `${MOCK_ATTENDANCE_PCT}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* SegmentPills */}
      <div className="flex gap-1.5 rounded-full p-1" style={{ background: "rgba(255,255,255,0.5)", border: `1px solid ${glassBorder}` }}>
        {[d.grades.tabGrades, d.grades.tabSkills, d.grades.tabDyn].map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(i as 0 | 1 | 2)}
            className="flex-1 rounded-full py-2 text-[12px] font-extrabold"
            style={tab === i ? { background: "linear-gradient(135deg, #7C3AED, #4F6DF5)", color: "#fff" } : { color: ink2 }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Вкладка «Оценки» — реальные данные */}
      {tab === 0 && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-extrabold" style={{ color: ink1 }}>
              {d.grades.subjects}
            </span>
          </div>

          {subjectStats.length === 0 ? (
            <GlassCard className="px-4 py-6 text-center">
              <span className="text-[12px] font-semibold" style={{ color: ink2 }}>
                {d.grades.empty}
              </span>
            </GlassCard>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {subjectStats.map((s) => (
                  <div
                    key={s.subject}
                    className="flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3"
                    style={{ flexBasis: "31%", flexGrow: 1, border: `1px solid ${glassBorder}`, background: "rgba(255,255,255,0.4)" }}
                  >
                    <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] text-[12px] font-extrabold text-white" style={{ background: s.color }}>
                      {s.label.slice(0, 2)}
                    </div>
                    <span className="text-[13px] font-extrabold" style={{ color: ink1 }}>
                      {s.avg.toFixed(1)}
                    </span>
                    <span className="truncate text-[8.5px] font-bold" style={{ color: ink2 }}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>

              <GlassCard className="flex flex-col gap-3 p-3.5">
                {subjectStats.map((s) => (
                  <div key={s.subject} className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[10px] font-extrabold text-white" style={{ background: s.color }}>
                      {s.label.slice(0, 2)}
                    </div>
                    <span className="w-24 shrink-0 truncate text-[11px] font-extrabold" style={{ color: ink1 }}>
                      {s.label}
                    </span>
                    <div className="h-[5.5px] flex-1 rounded-full" style={{ background: "rgba(23,18,67,0.08)" }}>
                      <div className="h-[5.5px] rounded-full" style={{ width: `${(s.avg / 5) * 100}%`, background: s.color }} />
                    </div>
                    <span className="text-[11px] font-extrabold" style={{ color: ink1 }}>
                      {s.avg.toFixed(1)}
                    </span>
                  </div>
                ))}
              </GlassCard>
            </>
          )}

          <div className="mt-1 flex items-center justify-between">
            <span className="text-[13px] font-extrabold" style={{ color: ink1 }}>
              {d.grades.lastReviews}
            </span>
          </div>
          {!review ? (
            <GlassCard className="px-4 py-6 text-center">
              <span className="text-[12px] font-semibold" style={{ color: ink2 }}>
                {d.grades.noReviews}
              </span>
            </GlassCard>
          ) : (
            <GlassCard className="flex gap-2.5 p-3.5">
              <div
                className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }}
              >
                {initialsFromName(review.teacherName)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-extrabold" style={{ color: ink1 }}>
                    {(review.teacherName ?? "—") + " · " + (review.subjectName ?? d.hw.subjectFallback)}
                  </span>
                  <span className="shrink-0 text-[10.5px] font-bold" style={{ color: ink2 }}>
                    {formatDate(review.gradedAtIso, LOCALE_TAG[loc])}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold leading-[1.5]" style={{ color: ink2 }}>
                  {review.comment}
                </p>
              </div>
            </GlassCard>
          )}

          <div className="rounded-[20px] p-3.5" style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 12px 26px rgba(139,92,246,0.30)" }}>
            <div className="flex items-center gap-2.5">
              <span className="text-[12px] font-extrabold text-white">EduOS Assistant</span>
            </div>
            <p className="mt-1.5 text-[11px] font-semibold leading-[1.5] text-white/95">{d.progressWeb.assistantGradesNote}</p>
          </div>
        </>
      )}

      {/* Вкладка «Навыки» — мок */}
      {tab === 1 && (
        <>
          <div className="flex gap-1.5">
            {SKILL_AXES.slice(0, 4).map((axis, i) => (
              <div key={axis} className="flex-1 rounded-[14px] p-2.5" style={{ border: `1px solid ${glassBorder}`, background: "rgba(255,255,255,0.4)" }}>
                <span className="text-[12px] font-extrabold" style={{ color: ink1 }}>
                  {SKILL_VALUES[i]}%
                </span>
                <div className="mt-1 truncate text-[9.5px] font-bold" style={{ color: ink2 }}>
                  {d.skills[axis]}
                </div>
                <div className="mt-1.5 h-[3.5px] rounded-full" style={{ background: "rgba(23,18,67,0.08)" }}>
                  <div className="h-[3.5px] rounded-full" style={{ width: `${SKILL_VALUES[i]}%`, background: "linear-gradient(135deg, #7C3AED, #4F6DF5)" }} />
                </div>
              </div>
            ))}
          </div>

          <GlassCard className="flex flex-col items-center gap-2.5 p-3.5">
            <span className="self-start text-[10px] font-extrabold uppercase tracking-wide" style={{ color: ink3 }}>
              {d.skills.profile}
            </span>
            <RadarChart values={SKILL_VALUES} labels={SKILL_AXES.map((axis, i) => `${d.skills[axis]} ${SKILL_VALUES[i]}%`)} />
          </GlassCard>

          <div className="rounded-[20px] p-3.5" style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 12px 26px rgba(139,92,246,0.30)" }}>
            <span className="text-[12px] font-extrabold text-white">EduOS Assistant</span>
            <p className="mt-1.5 text-[11px] font-semibold leading-[1.5] text-white/95">{d.progressWeb.assistantSkillsNote}</p>
          </div>
        </>
      )}

      {/* Вкладка «Динамика» — мок */}
      {tab === 2 && (
        <>
          <GlassCard className="flex flex-col gap-2.5 p-3.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: ink3 }}>
              {d.grades.dynAvg}
            </span>
            <Sparkline values={DYN_SPARK_VALUES} width={320} height={90} color="#7C3AED" strokeWidth={3} endDot />
            <div className="flex justify-between">
              {months.map((m, i) => (
                <span key={i} className="text-[10px] font-bold" style={{ color: ink3 }}>
                  {m}
                </span>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="flex flex-col p-3.5">
            {DYN_SPARK_VALUES.map((v, i) => {
              const prev = i > 0 ? DYN_SPARK_VALUES[i - 1] : undefined;
              const delta = prev != null ? v - prev : null;
              return (
                <div key={i} className="flex items-center py-2.5" style={i > 0 ? { borderTop: "1px solid rgba(23,18,67,0.07)" } : undefined}>
                  <span className="flex-1 text-[12px] font-bold" style={{ color: ink1 }}>
                    {months[i]}
                  </span>
                  <span className="mr-3 text-[12px] font-extrabold" style={{ color: ink1 }}>
                    {v.toFixed(1)}
                  </span>
                  {delta != null && (
                    <span className="text-[11px] font-extrabold" style={{ color: delta >= 0 ? "#047857" : "#B91C1C" }}>
                      {delta >= 0 ? "+" : ""}
                      {delta.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </GlassCard>

          <p className="px-3 text-center text-[11px] font-semibold" style={{ color: ink2 }}>
            {d.progressWeb.dynamicsNote}
          </p>
        </>
      )}
    </div>
  );
}

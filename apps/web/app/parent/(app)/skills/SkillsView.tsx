"use client";

/**
 * Разметка «Навыков». Клиентский компонент ради словаря.
 *
 * Порядок блоков — как в мобильной вкладке: общий уровень, плитки навыков со
 * шкалами, список предметов, внизу — из чего всё посчитано. Последнее не
 * украшение: экран показывает выведенные числа, и родитель должен видеть, что
 * за ними стоит (тот же приём, что на «Освоении тем»).
 */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ChildSkills } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, ICON, InnerHeader, ScreenScroll, SectionCap, StatusChip } from "../_ui/screen-kit";
import { DIVIDER } from "../_ui/screen-tokens";
import { accent, ink1, ink2, ink3, type StatusKey } from "../v2/tokens";

/** Градиент шкалы навыка — свой на каждый, как четыре плитки в макете. */
const SKILL_GRADIENT: Record<string, readonly [string, string]> = {
  knowledge: ["#a78bfa", "#7c3aed"],
  thinking: ["#60a5fa", "#2563eb"],
  communication: ["#34d399", "#059669"],
  independence: ["#f472b6", "#db2777"],
  discipline: ["#fbbf24", "#f97316"],
};

function levelOf(pct: number): { key: "High" | "Good" | "Growing" | "Low"; family: StatusKey } {
  if (pct >= 85) return { key: "High", family: "green" };
  if (pct >= 70) return { key: "Good", family: "blue" };
  if (pct >= 50) return { key: "Growing", family: "orange" };
  return { key: "Low", family: "red" };
}

export function SkillsView({ data, childName }: { data: ChildSkills; childName: string | null }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more3;

  const NAME: Record<string, string> = {
    knowledge: m.skillKnowledge,
    thinking: m.skillThinking,
    communication: m.skillCommunication,
    independence: m.skillIndependence,
    discipline: m.skillDiscipline,
  };
  const WHY: Record<string, string> = {
    knowledge: m.skillKnowledgeWhy,
    thinking: m.skillThinkingWhy,
    communication: m.skillCommunicationWhy,
    independence: m.skillIndependenceWhy,
    discipline: m.skillDisciplineWhy,
  };
  const LEVEL: Record<string, string> = {
    High: m.skillLevelHigh,
    Good: m.skillLevelGood,
    Growing: m.skillLevelGrowing,
    Low: m.skillLevelLow,
  };

  const empty = data.source.gradeCount === 0;
  const overallLevel = levelOf(data.overall);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.skills} backHref="/parent/progress" />

      <ScreenScroll>
        {empty ? (
          <GlassCard radius={22}>
            <EmptyState
              title={m.skillEmptyTitle}
              text={m.skillEmptyText.replace("{name}", childName ?? "")}
              paths={ICON.checkSquare}
            />
          </GlassCard>
        ) : (
          <>
            {/* Общий уровень. */}
            <GlassCard radius={22} style={{ padding: 16 }}>
              <div className="flex items-center" style={{ gap: 12 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: ink1, lineHeight: 1 }}>
                  {`${data.overall}%`}
                </span>
                <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: ink2 }}>{m.skillOverall}</span>
                  <span>
                    <StatusChip label={LEVEL[overallLevel.key]!} family={overallLevel.family} />
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Четыре навыка со шкалами. */}
            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {data.skills.map((s, idx) => {
                const g = SKILL_GRADIENT[s.key] ?? SKILL_GRADIENT.knowledge!;
                const lvl = levelOf(s.pct);
                return (
                  <div
                    key={s.key}
                    className="flex flex-col"
                    style={{
                      gap: 6,
                      paddingTop: 13,
                      paddingBottom: 13,
                      borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                    }}
                  >
                    <div className="flex items-baseline" style={{ gap: 8 }}>
                      <span className="min-w-0 flex-1" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                        {NAME[s.key]}
                      </span>
                      <StatusChip label={LEVEL[lvl.key]!} family={lvl.family} fontSize={8.5} />
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: g[1] }}>{`${s.pct}%`}</span>
                    </div>

                    <span
                      aria-hidden
                      className="block w-full overflow-hidden"
                      style={{ height: 6, borderRadius: 3, background: "rgba(23,18,67,0.08)" }}
                    >
                      <span
                        className="block h-full"
                        style={{
                          width: `${Math.max(3, s.pct)}%`,
                          borderRadius: 3,
                          background: `linear-gradient(135deg, ${g[0]}, ${g[1]})`,
                        }}
                      />
                    </span>

                    <span style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
                      {/* Под каждой шкалой — что именно в неё сложилось. */}
                      {s.basis.subjects && s.basis.subjects.length > 0
                        ? `${WHY[s.key]}: ${s.basis.subjects.join(", ")}`
                        : WHY[s.key]}
                    </span>
                  </div>
                );
              })}
            </GlassCard>

            {/* Предметы с их средним баллом. */}
            <SectionCap label={m.skillSubjectsCap} />
            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {data.subjects.map((s, idx) => (
                <div
                  key={s.name}
                  className="flex items-center"
                  style={{
                    gap: 10,
                    paddingTop: 11,
                    paddingBottom: 11,
                    borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                  }}
                >
                  <span
                    aria-hidden
                    className="shrink-0"
                    style={{ width: 3, height: 22, borderRadius: 2, background: s.color ?? accent }}
                  />
                  <span className="min-w-0 flex-1" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: ink3 }}>
                    {m.skillSubjectMeta.replace("{n}", String(s.count))}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>{s.average.toFixed(1)}</span>
                </div>
              ))}
            </GlassCard>

            <span style={{ fontSize: 9, fontWeight: 600, lineHeight: "14px", color: ink3, textAlign: "center" }}>
              {m.skillNote
                .replace("{grades}", String(data.source.gradeCount))
                .replace("{present}", String(data.source.attendancePresent))
                .replace("{total}", String(data.source.attendanceTotal))
                .replace("{done}", String(data.source.homeworkSubmitted))
                .replace("{hw}", String(data.source.homeworkTotal))}
            </span>
          </>
        )}
      </ScreenScroll>
    </div>
  );
}

"use client";

/**
 * Разметка экрана «Тесты». Клиентский компонент — только ради словаря:
 * строки берутся из `parentApp.more`, а локаль живёт в LocaleProvider
 * (см. LangSecurityView.tsx — тот же приём). Данные приходят пропом, никаких
 * запросов отсюда не уходит.
 */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ChildTestItem } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, ICON, InnerHeader, ScreenScroll, SectionCap, StatusChip } from "../_ui/screen-kit";
import { DIVIDER } from "../_ui/screen-tokens";
import { previousDay, relativeStamp } from "../_ui/format";
import { ink1, ink2, ink3 } from "../v2/tokens";

export function TestsView({
  tests,
  childName,
  today,
}: {
  tests: ChildTestItem[];
  childName: string | null;
  today: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more;
  const yesterday = previousDay(today);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.tests} backHref="/parent/progress" />

      <ScreenScroll>
        {tests.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState
              title={m.testsEmptyTitle}
              text={m.testsEmptyText.replace("{name}", childName ?? "")}
              paths={ICON.checkSquare}
            />
          </GlassCard>
        ) : (
          <>
            <SectionCap label={m.testsCount.replace("{n}", String(tests.length))} />

            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {tests.map((t, idx) => {
                const graded = t.score != null && t.maxScore != null;
                const pct = graded ? Math.round((t.score! / Math.max(1, t.maxScore!)) * 100) : null;
                const family = pct == null ? "gray" : pct >= 85 ? "green" : pct >= 60 ? "orange" : "red";
                return (
                  <div
                    key={t.id}
                    style={{
                      paddingTop: 13,
                      paddingBottom: 13,
                      borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                    }}
                  >
                    <div className="flex items-start" style={{ gap: 10 }}>
                      <span className="min-w-0 flex-1">
                        <span className="block" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                          {t.title}
                        </span>
                        <span className="block" style={{ fontSize: 10, fontWeight: 600, color: ink2, marginTop: 3 }}>
                          {[t.subjectName, t.submittedAt ? relativeStamp(t.submittedAt, today, yesterday) : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <StatusChip
                        label={
                          graded
                            ? m.testsScore.replace("{score}", String(t.score)).replace("{max}", String(t.maxScore))
                            : m.testsNotGraded
                        }
                        family={family}
                      />
                    </div>

                    {t.grade != null ? (
                      <span
                        className="block"
                        style={{ fontSize: 10, fontWeight: 700, color: ink3, marginTop: 6 }}
                      >
                        {m.testsGrade.replace("{grade}", String(t.grade))}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </GlassCard>
          </>
        )}
      </ScreenScroll>
    </div>
  );
}

"use client";

/**
 * Разметка «Дневника». Клиентский компонент ради словаря и дат.
 *
 * Порядок блоков — как в мобильном экране: лента-переключатель недели,
 * непрозрачная карточка итогов недели (оценок / средний балл / сдано работ),
 * дальше дни, а внутри дня — уроки с темой и оценкой.
 */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { DiaryWeek } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import {
  EmptyState,
  Glyph,
  GlassCircleButton,
  ICON,
  InnerHeader,
  ScreenScroll,
  SectionCap,
  StatusChip,
  grad135,
} from "../_ui/screen-kit";
import { DIVIDER } from "../_ui/screen-tokens";
import { useDates } from "../_ui/dates";
import { addDaysKey, weekdayIndexOfKey } from "../_ui/format";
import { ink1, ink2, ink3, radius, shCard } from "../v2/tokens";

/** Карточка итогов недели — единственное непрозрачное пятно экрана, как в
 *  макете: accent-градиент 135° и три колонки через тонкие разделители. */
const WEEK_CARD: readonly [string, string] = ["#7C3AED", "#4F6DF5"];

/** Цвет чипа оценки: 5 — зелёный, 4 — синий, 3 — оранжевый, ниже — красный. */
function gradeFamily(grade: number): "green" | "blue" | "orange" | "red" {
  if (grade >= 5) return "green";
  if (grade >= 4) return "blue";
  if (grade >= 3) return "orange";
  return "red";
}

export function DiaryView({
  week,
  today,
  prevHref,
  nextHref,
}: {
  week: DiaryWeek;
  today: string;
  prevHref: string;
  nextHref: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more2;
  const dt = useDates();

  // Подпись недели — всегда понедельник–воскресенье, а не «первый и
  // последний день с уроками»: иначе на пустой неделе выходило «20 июля —
  // 20 июля», будто там один день.
  const weekEnd = addDaysKey(week.weekStart, 6);
  const avgLabel = week.average != null ? week.average.toFixed(1) : "—";

  return (
    <div className="mx-auto w-full max-w-[430px]">
      {/* Название экрана уже есть в словаре — parentApp.svc.diary. */}
      <InnerHeader title={d.svc.diary} backHref="/parent/progress" />

      <ScreenScroll>
        {/* Переключатель недели. */}
        <div className="flex items-center" style={{ gap: 10 }}>
          <GlassCircleButton href={prevHref} ariaLabel={m.diaryPrevWeek}>
            <Glyph paths={ICON.back} size={16} color={ink1} strokeWidth={2.2} />
          </GlassCircleButton>
          <span
            className="min-w-0 flex-1 text-center"
            style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}
          >
            {`${dt.dayMonth(week.weekStart)} — ${dt.dayMonth(weekEnd)}`}
          </span>
          <GlassCircleButton href={nextHref} ariaLabel={m.diaryNextWeek}>
            <Glyph paths={ICON.chevron} size={16} color={ink1} strokeWidth={2.2} />
          </GlassCircleButton>
        </div>

        {/* Итоги недели. */}
        <div
          className="flex"
          style={{
            borderRadius: radius.card,
            background: grad135(WEEK_CARD),
            boxShadow: shCard,
            padding: "14px 4px",
          }}
        >
          {[
            { cap: m.diaryWeekGrades, value: String(week.gradeCount) },
            { cap: m.diaryWeekAvg, value: avgLabel },
            { cap: m.diaryWeekHw, value: String(week.homeworkSubmitted) },
          ].map((c, i) => (
            <div
              key={c.cap}
              className="flex flex-1 flex-col items-center"
              style={{
                gap: 4,
                paddingInline: 6,
                borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.22)" : undefined,
              }}
            >
              <span style={{ fontSize: 19, fontWeight: 800, color: "#FFFFFF", lineHeight: 1 }}>
                {c.value}
              </span>
              <span
                className="text-center"
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.82)",
                  lineHeight: 1.25,
                }}
              >
                {c.cap}
              </span>
            </div>
          ))}
        </div>

        {week.days.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState title={m.diaryEmptyTitle} text={m.diaryEmptyText} paths={ICON.doc} />
          </GlassCard>
        ) : (
          week.days.map((day) => (
            <div key={day.dateKey} className="flex flex-col" style={{ gap: 8 }}>
              <div className="flex items-baseline" style={{ gap: 8 }}>
                <SectionCap
                  label={`${dt.weekdayFull(weekdayIndexOfKey(day.dateKey))} · ${dt.dayMonth(day.dateKey)}`}
                />
                <span className="flex-1" />
                {day.average != null ? (
                  <span style={{ fontSize: 10, fontWeight: 800, color: ink2 }}>
                    {m.diaryDayAvg.replace("{avg}", day.average.toFixed(1))}
                  </span>
                ) : null}
              </div>

              <GlassCard
                radius={22}
                style={{
                  paddingLeft: 14,
                  paddingRight: 14,
                  /* Сегодняшний день подсвечен рамкой — как «Сегодня» в ленте
                     расписания: родитель открывает дневник чаще всего ради него. */
                  outline: day.dateKey === today ? "1.5px solid rgba(124,58,237,0.45)" : undefined,
                  outlineOffset: day.dateKey === today ? -1 : undefined,
                }}
              >
                {day.lessons.length === 0 ? (
                  <p
                    style={{ fontSize: 11, fontWeight: 600, color: ink3, paddingBlock: 14, textAlign: "center" }}
                  >
                    {m.diaryNoLessonsDay}
                  </p>
                ) : (
                  day.lessons.map((l, idx) => (
                    <div
                      key={l.id}
                      className="flex"
                      style={{
                        gap: 11,
                        paddingTop: 11,
                        paddingBottom: 11,
                        borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                      }}
                    >
                      {/* Полоска цвета предмета вместо плитки-иконки: цвет у
                          предмета в базе есть, а глифа нет — рисовать буквы
                          поверх цвета было бы шумно на списке из шести строк. */}
                      <span
                        aria-hidden
                        className="shrink-0"
                        style={{
                          width: 3,
                          borderRadius: 2,
                          background: l.subjectColor ?? "#6366F1",
                          alignSelf: "stretch",
                        }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                          {l.subjectName}
                        </span>
                        {l.topic ? (
                          <span style={{ fontSize: 10, fontWeight: 600, lineHeight: "14px", color: ink2 }}>
                            {l.topic}
                          </span>
                        ) : null}
                        {l.comment ? (
                          <span style={{ fontSize: 9.5, fontWeight: 600, lineHeight: "13px", color: ink3 }}>
                            {l.comment}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-col items-end" style={{ gap: 4 }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
                          {dt.time(l.startsAt)}
                        </span>
                        {l.grade != null ? (
                          <StatusChip label={String(l.grade)} family={gradeFamily(l.grade)} fontSize={10} />
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: ink3 }}>{m.diaryNoGrade}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </GlassCard>
            </div>
          ))
        )}

      </ScreenScroll>
    </div>
  );
}

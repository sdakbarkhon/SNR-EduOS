"use client";

/**
 * Экран #14 «Посещаемость», вёрстка — перенос RN-экрана
 * study/AttendanceScreen.tsx (feat/mobile-parent-redesign) → макет
 * «SNR EduOS v2 Light.dc.html» строки 584–622:
 *   585–589  InnerHeader с info-иконкой справа;
 *   591      компактная карточка ребёнка;
 *   592–596  StatsRow: три плитки (зелёная % / оранжевая уважительные /
 *            красная неуважительные). Плитки «Опоздания» НЕТ — правило заказчика;
 *   597–613  MonthCalendarCard: prev/next + сетка 7×N + легенда из 4 маркеров;
 *   614      caps-заголовок «Последние дни»;
 *   615–620  список последних отметок в одной стеклянной карточке с
 *            border-top разделителями и круглыми бэйджами справа.
 *
 * Число рядов сетки динамическое (не жёсткие 5×7): месяц из 31 дня,
 * начинающийся в воскресенье, занимает 6 рядов — при фиксированных 35
 * ячейках последние дни пропадали бы (баг, уже чинившийся в мобилке).
 *
 * Клиентский компонент нужен только для листания месяцев по УЖЕ загруженной
 * истории. «Сегодня» приходит с сервера строкой (todayKey) — часы браузера
 * не участвуют, поэтому серверный и клиентский рендер совпадают.
 */

import { useState } from "react";
import type { AttendanceStatus } from "@snr/core";
import { InnerHeader, GlassCircle } from "../_study/InnerHeader";
import {
  ChildCard,
  EmptyCard,
  GlassPanel,
  IconChevronLeft,
  IconChevronRight,
  IconInfo,
  ROW_DIVIDER,
  ScreenBody,
  SectionCaps,
  StatTile,
  ToneBadge,
} from "../_study/parts";
import { accentGrad, ink1, ink2, ink3, status } from "../v2/tokens";
import { WEEKDAY_SHORT, ruMonthYear } from "../_study/util";

export type AttendanceLastDay = {
  id: string;
  dateLabel: string;
  subject: string;
  statusLabel: string;
  status: AttendanceStatus;
  arrivedLabel: string | null;
};

type Stats = { total: number; present: number; excused: number; unexcused: number; percentage: number };

/** Код ячейки календаря: пусто / сегодня / присутствовал / уважительная /
 *  неуважительная / прошедший день без урока / будущий день. */
type CellCode = "e" | "t" | "p" | "u" | "n" | "w" | "f";
type Cell = { code: CellCode; day: number | null };

const STATUS_TO_CODE: Record<AttendanceStatus, CellCode> = {
  present: "p",
  absent_excused: "u",
  absent_unexcused: "n",
};

const BADGE: Record<AttendanceStatus, { tone: "green" | "orange" | "red"; kind: "check" | "doc" | "x" }> = {
  present: { tone: "green", kind: "check" },
  absent_excused: { tone: "orange", kind: "doc" },
  absent_unexcused: { tone: "red", kind: "x" },
};

const CELL_STYLE: Record<Exclude<CellCode, "e" | "t">, { bg: string; color: string }> = {
  p: { bg: "rgba(16,185,129,0.72)", color: "#FFFFFF" },
  u: { bg: "rgba(249,115,22,0.78)", color: "#FFFFFF" },
  n: { bg: "rgba(239,68,68,0.78)", color: "#FFFFFF" },
  w: { bg: "rgba(23,18,67,0.05)", color: ink3 },
  f: { bg: "rgba(23,18,67,0.08)", color: ink3 },
};

function buildCells(
  year: number,
  month: number,
  statusByDate: Record<string, AttendanceStatus>,
  todayKey: string,
): Cell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 = Вс
  const leadingPad = (firstWeekday + 6) % 7; // Пн = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: Cell[] = [];
  for (let i = 0; i < leadingPad; i += 1) cells.push({ code: "e", day: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const st = statusByDate[key];
    let code: CellCode;
    if (key === todayKey) code = "t";
    else if (st) code = STATUS_TO_CODE[st];
    else if (key > todayKey) code = "f";
    else code = "w";
    cells.push({ code, day });
  }
  while (cells.length % 7 !== 0) cells.push({ code: "e", day: null });
  return cells;
}

function CalendarCell({ cell }: { cell: Cell }) {
  if (cell.code === "e") return <span className="flex-1" style={{ height: 26 }} aria-hidden />;

  if (cell.code === "t") {
    return (
      <span
        className="flex flex-1 items-center justify-center text-white"
        style={{
          height: 26,
          borderRadius: 8,
          background: accentGrad,
          border: "2px solid #fff",
          boxShadow: "0 0 0 1.5px rgba(124,58,237,0.9)",
          fontSize: 10,
          fontWeight: 800,
        }}
      >
        {cell.day}
      </span>
    );
  }

  const s = CELL_STYLE[cell.code];
  return (
    <span
      className="flex flex-1 items-center justify-center"
      style={{ height: 26, borderRadius: 8, background: s.bg, fontSize: 10, fontWeight: 800, color: s.color }}
    >
      {cell.day}
    </span>
  );
}

function LegendMarker({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center" style={{ gap: 4 }}>
      <span style={{ width: 8, height: 8, borderRadius: 3, background: color }} aria-hidden />
      <span style={{ fontSize: 9, fontWeight: 700, color: ink2 }}>{label}</span>
    </span>
  );
}

export function AttendanceView({
  childName,
  childClass,
  stats,
  statusByDate,
  lastDays,
  todayKey,
}: {
  childName: string;
  childClass: string | null;
  stats: Stats;
  statusByDate: Record<string, AttendanceStatus>;
  lastDays: AttendanceLastDay[];
  todayKey: string;
}) {
  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth = Number(todayKey.slice(5, 7));
  const [visible, setVisible] = useState({ year: todayYear, month: todayMonth });

  const cells = buildCells(visible.year, visible.month, statusByDate, todayKey);
  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const atCurrentMonth = visible.year === todayYear && visible.month === todayMonth;

  const goPrev = () =>
    setVisible(({ year, month }) => (month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }));
  const goNext = () =>
    setVisible(({ year, month }) => {
      if (year === todayYear && month === todayMonth) return { year, month };
      return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    });

  return (
    <>
      <InnerHeader
        title="Посещаемость"
        backHref="/parent/home"
        right={
          <GlassCircle label="Расписание" href="/parent/schedule">
            <IconInfo size={17} color={ink1} strokeWidth={1.9} />
          </GlassCircle>
        }
      />

      <ScreenBody>
        <ChildCard name={childName} className={childClass} />

        {/* StatsRow — три плитки, без «опозданий» (макет 592–596). */}
        <div className="flex" style={{ gap: 8 }}>
          <StatTile value={`${stats.percentage}%`} label="Посещаемость" tone="green" />
          <StatTile value={String(stats.excused)} label="Уважительные" tone="orange" />
          <StatTile value={String(stats.unexcused)} label="Без причины" tone="red" />
        </div>

        {/* MonthCalendarCard (макет 597–613). */}
        <GlassPanel radius={20}>
          <div className="flex flex-col" style={{ padding: 13, gap: 10 }}>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goPrev}
                aria-label="Предыдущий месяц"
                className="flex items-center justify-center"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.8)",
                }}
              >
                <IconChevronLeft size={13} color={ink1} strokeWidth={2.2} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>
                {ruMonthYear(visible.year, visible.month)}
              </span>
              <button
                type="button"
                onClick={goNext}
                disabled={atCurrentMonth}
                aria-label="Следующий месяц"
                className="flex items-center justify-center disabled:opacity-40"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(255,255,255,0.8)",
                }}
              >
                <IconChevronRight size={13} color={ink1} strokeWidth={2.2} />
              </button>
            </div>

            <div className="flex flex-col" style={{ gap: 4 }}>
              <div className="flex" style={{ gap: 4 }}>
                {WEEKDAY_SHORT.map((w) => (
                  <span
                    key={w}
                    className="flex-1 text-center"
                    style={{ fontSize: 8.5, fontWeight: 800, color: ink3 }}
                  >
                    {w}
                  </span>
                ))}
              </div>
              {rows.map((row, i) => (
                <div key={`w-${visible.year}-${visible.month}-${i}`} className="flex" style={{ gap: 4 }}>
                  {row.map((cell, j) => (
                    <CalendarCell key={`c-${i}-${j}`} cell={cell} />
                  ))}
                </div>
              ))}
            </div>

            <div
              className="flex flex-wrap"
              style={{ gap: 9, paddingTop: 8, borderTop: `1px solid ${ROW_DIVIDER}` }}
            >
              <LegendMarker color="rgba(16,185,129,0.75)" label="Присутствовал" />
              <LegendMarker color="rgba(249,115,22,0.8)" label="Уважительная" />
              <LegendMarker color="rgba(239,68,68,0.8)" label="Без причины" />
              <LegendMarker color="rgba(23,18,67,0.08)" label="Нет занятий" />
            </div>
          </div>
        </GlassPanel>

        <SectionCaps>Последние дни</SectionCaps>

        {lastDays.length === 0 ? (
          <EmptyCard>Отметок посещаемости пока нет</EmptyCard>
        ) : (
          <GlassPanel radius={20}>
            <div style={{ paddingBlock: 5, paddingInline: 14 }}>
              {lastDays.map((row, i) => {
                const meta = BADGE[row.status];
                const st = status[meta.tone];
                return (
                  <div
                    key={row.id}
                    className="flex items-center"
                    style={{
                      gap: 11,
                      paddingBlock: 10,
                      borderTop: i === 0 ? undefined : `1px solid ${ROW_DIVIDER}`,
                    }}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                        {row.dateLabel}
                      </span>
                      <span className="truncate" style={{ fontSize: 10, fontWeight: 700, color: st.text }}>
                        {row.statusLabel}
                      </span>
                      <span className="truncate" style={{ fontSize: 9.5, fontWeight: 600, color: ink3 }}>
                        {row.subject}
                      </span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span style={{ fontSize: 10, fontWeight: 700, color: row.arrivedLabel ? ink2 : ink3 }}>
                        Отмечен: {row.arrivedLabel ?? "—"}
                      </span>
                    </span>
                    <ToneBadge tone={meta.tone} kind={meta.kind} />
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        )}

        <p className="text-center" style={{ fontSize: 9.5, fontWeight: 600, color: ink3 }}>
          Всего отметок за всю историю: {stats.total} · присутствовал {stats.present}
        </p>
      </ScreenBody>
    </>
  );
}

"use client";

/**
 * Экран #15 «Расписание», вёрстка — перенос RN-экрана study/ScheduleScreen.tsx
 * (ветка feat/mobile-parent-redesign) → макет «SNR EduOS v2 Light.dc.html»
 * строки 624–647:
 *   625–630  Header: back + «Расписание» + два стеклянных круга справа;
 *   631      Scroll: padding 4/18/118, gap 12;
 *   632      компактная карточка ребёнка;
 *   633–638  лента из 7 пилюль Пн–Вс + квадратная кнопка календаря 44×44;
 *   639      стеклянная пилюля-баннер с датой выбранного дня;
 *   640–645  таймлайн уроков + приглушённые строки «Перемена».
 *
 * Правила заказчика соблюдены: лента 7-дневная (не только будни), «Идёт
 * сейчас» — только у урока со статусом in_progress, перемены — отдельными
 * приглушёнными строками между уроками, опозданий нет.
 *
 * Клиентский компонент нужен ровно для одного: переключения дня внутри уже
 * загруженной недели. Никаких вычислений «сейчас» здесь нет — статус урока
 * приходит из БД, поэтому серверный и клиентский рендер совпадают.
 */

import { useState } from "react";
import Link from "next/link";
import { InnerHeader, GlassCircle } from "../_study/InnerHeader";
import {
  ChildCard,
  EmptyCard,
  GlassPanel,
  IconCalendar,
  IconCalendarCheck,
  MiniChip,
  ScreenBody,
} from "../_study/parts";
import {
  accent,
  accentGrad,
  glassBorder,
  glassInset,
  ink1,
  ink2,
  ink3,
  shCard,
  shColor,
  status,
} from "../v2/tokens";
import { hexToRgbCsv } from "../_study/util";

export type ScheduleDay = {
  dateKey: string;
  weekdayShort: string;
  dayNumber: number;
  /** Готовая подпись баннера: «Сегодня, 30 июля» / «Пятница, 31 июля». */
  bannerTitle: string;
};

export type ScheduleLessonVM = {
  id: string;
  subjectId: string | null;
  timeStart: string;
  timeEnd: string | null;
  title: string;
  room: string | null;
  topic: string | null;
  color: string;
  teacherName: string | null;
  live: boolean;
  done: boolean;
};

type Row =
  | { kind: "lesson"; key: string; lesson: ScheduleLessonVM }
  | { kind: "break"; key: string; start: string; end: string };

/** Между двумя соседними уроками — приглушённая строка «Перемена»
 *  (starts_at = конец предыдущего, ends_at = начало следующего). */
function buildRows(lessons: ScheduleLessonVM[]): Row[] {
  const out: Row[] = [];
  lessons.forEach((lesson, i) => {
    out.push({ kind: "lesson", key: `l-${lesson.id}`, lesson });
    const next = lessons[i + 1];
    if (next && lesson.timeEnd) {
      out.push({ kind: "break", key: `br-${lesson.id}`, start: lesson.timeEnd, end: next.timeStart });
    }
  });
  return out;
}

/** Ячейка ленты дней (макет 635). */
function DayPill({
  day,
  active,
  onSelect,
}: {
  day: ScheduleDay;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="flex shrink-0 flex-col items-center justify-center transition-transform active:scale-95"
      style={{
        width: 44,
        paddingBlock: 8,
        borderRadius: 14,
        gap: 2,
        border: `1px solid ${active ? "rgba(255,255,255,0.35)" : glassBorder}`,
        background: active
          ? accentGrad
          : "linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,255,255,0.46))",
        backdropFilter: active ? undefined : "blur(22px)",
        WebkitBackdropFilter: active ? undefined : "blur(22px)",
        boxShadow: active ? shColor(status.violet.rgb) : undefined,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: active ? 800 : 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: active ? "rgba(255,255,255,0.85)" : ink3,
        }}
      >
        {day.weekdayShort}
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color: active ? "#fff" : ink1 }}>
        {day.dayNumber}
      </span>
    </button>
  );
}

/** Строка урока / перемены (ui/LessonRow: колонка времени 44 + glass r18). */
function LessonRow({ row }: { row: Row }) {
  if (row.kind === "break") {
    return (
      <div className="flex items-stretch" style={{ gap: 8, opacity: 0.82 }}>
        <div className="flex flex-col items-center" style={{ width: 44, gap: 4, paddingTop: 11 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "rgba(26,19,74,0.65)" }}>
            {row.start}
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(26,19,74,0.5)" }}>
            {row.end}
          </span>
        </div>
        <GlassPanel radius={18} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ paddingBlock: 11, paddingInline: 13 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>Перемена</span>
          </div>
        </GlassPanel>
      </div>
    );
  }

  const l = row.lesson;
  const rgb = hexToRgbCsv(l.color);
  const subtitle = [l.room ? `Кабинет ${l.room}` : null, l.teacherName]
    .filter(Boolean)
    .join(" · ");

  const body = (
    <div className="flex items-center" style={{ gap: 10, paddingBlock: 11, paddingInline: 13 }}>
      <span
        className="shrink-0"
        style={{
          width: 3.5,
          height: 34,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${l.color}CC, ${l.color})`,
        }}
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
        <span className="truncate" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
          {l.title}
        </span>
        {subtitle && (
          <span className="truncate" style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(26,19,74,0.6)" }}>
            {subtitle}
          </span>
        )}
        {l.topic && (
          <span className="truncate" style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(26,19,74,0.48)" }}>
            Тема: {l.topic}
          </span>
        )}
      </span>
      {l.live && <MiniChip label="Идёт сейчас" family="orange" dot />}
    </div>
  );

  return (
    <div className="flex items-stretch" style={{ gap: 8, opacity: l.done && !l.live ? 0.82 : 1 }}>
      <div className="flex flex-col items-center" style={{ width: 44, gap: 4, paddingTop: 11 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: l.live ? ink1 : "rgba(26,19,74,0.65)",
          }}
        >
          {l.timeStart}
        </span>
        {l.timeEnd && (
          <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(26,19,74,0.5)" }}>
            {l.timeEnd}
          </span>
        )}
        {/* Точка 9px с ореолом 3px в цвете предмета (макет 3541). */}
        <span
          className="flex items-center justify-center"
          style={{ width: 15, height: 15, borderRadius: 8, background: `rgba(${rgb},0.13)` }}
          aria-hidden
        >
          <span style={{ width: 9, height: 9, borderRadius: 5, background: l.color }} />
        </span>
      </div>
      <GlassPanel
        radius={18}
        style={{ flex: 1, minWidth: 0, boxShadow: `0 12px 28px rgba(99,86,214,0.13), ${glassInset}` }}
      >
        {l.subjectId ? (
          <Link href={`/parent/subject/${l.subjectId}`} className="block transition-transform active:scale-[0.99]">
            {body}
          </Link>
        ) : (
          body
        )}
      </GlassPanel>
    </div>
  );
}

export function ScheduleView({
  childName,
  childClass,
  days,
  lessonsByDate,
  initialIndex,
}: {
  childName: string;
  childClass: string | null;
  days: ScheduleDay[];
  lessonsByDate: Record<string, ScheduleLessonVM[]>;
  initialIndex: number;
}) {
  const [index, setIndex] = useState(initialIndex);
  const day = days[index] ?? days[0];
  const rows = day ? buildRows(lessonsByDate[day.dateKey] ?? []) : [];

  return (
    <>
      <InnerHeader
        title="Расписание"
        backHref="/parent/home"
        right={
          <GlassCircle label="День ребёнка" href="/parent/day">
            <IconCalendar size={16} color={ink1} strokeWidth={1.8} />
          </GlassCircle>
        }
      />

      <ScreenBody>
        <ChildCard name={childName} className={childClass} />

        {/* Лента дней Пн–Вс + квадратная кнопка «Посещаемость» (макет 633–638). */}
        <div className="flex items-stretch" style={{ gap: 8 }}>
          <div className="flex flex-1 overflow-x-auto" style={{ gap: 7, paddingBottom: 2 }}>
            {days.map((d, i) => (
              <DayPill key={d.dateKey} day={d} active={i === index} onSelect={() => setIndex(i)} />
            ))}
          </div>
          <Link
            href="/parent/attendance"
            aria-label="Посещаемость"
            className="flex shrink-0 items-center justify-center"
            style={{
              width: 44,
              borderRadius: 15,
              border: `1px solid ${glassBorder}`,
              background: "rgba(255,255,255,0.5)",
              boxShadow: shCard,
            }}
          >
            <IconCalendar size={17} color={accent} strokeWidth={1.9} />
          </Link>
        </div>

        {/* Пилюля-баннер с датой выбранного дня (макет 639). */}
        {day && (
          <GlassPanel radius={999} style={{ alignSelf: "flex-start" }}>
            <div className="flex items-center" style={{ gap: 9, paddingBlock: 10, paddingInline: 14 }}>
              <IconCalendarCheck size={15} color={accent} strokeWidth={1.9} />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>{day.bannerTitle}</span>
            </div>
          </GlassPanel>
        )}

        {/* Таймлайн уроков (макет 640–645). */}
        {rows.length === 0 ? (
          <EmptyCard>В этот день уроков нет</EmptyCard>
        ) : (
          rows.map((row) => <LessonRow key={row.key} row={row} />)
        )}

        {/* Итог дня — короткая стеклянная строка под таймлайном. */}
        {rows.length > 0 && day && (
          <GlassPanel radius={18}>
            <div
              className="flex items-center justify-between"
              style={{ paddingBlock: 11, paddingInline: 14 }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: ink2 }}>
                Уроков в этот день
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                {(lessonsByDate[day.dateKey] ?? []).length}
              </span>
            </div>
          </GlassPanel>
        )}
      </ScreenBody>
    </>
  );
}

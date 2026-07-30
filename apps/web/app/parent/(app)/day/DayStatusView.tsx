/**
 * Экран d6 «Статус дня», вёрстка — перенос RN-экрана study/DayStatusScreen.tsx
 * (feat/mobile-parent-redesign) → макет «SNR EduOS v2 Light.dc.html»
 * строки 413–454:
 *   414–419 HeaderBar: back + «Статус дня» + стеклянные действия справа;
 *   421     компактная карточка ребёнка;
 *   422–425 InSchoolBanner — акцентная карточка green→cyan со щитом 42;
 *   426     caps «ПОСЕЩАЕМОСТЬ» + «Смотреть все ›»;
 *   427–433 AttendanceDonutCard: кольцо 86 + три легенды + подпись;
 *   434     caps «РАСПИСАНИЕ СЕГОДНЯ»;
 *   435–442 TodayScheduleCard: строки урок/время/полоска/маркер статуса
 *           (галочка / «Идёт сейчас» / серая точка).
 * Блок «Питание» (443–448) заменён реальными итогами дня — см. page.tsx.
 *
 * Серверный компонент: интерактива нет, только ссылки. Всё, что зависит от
 * времени, посчитано на сервере в Asia/Tashkent.
 */

import Link from "next/link";
import type { AttendanceStatus } from "@snr/core";
import { InnerHeader, GlassCircle } from "../_study/InnerHeader";
import {
  ACCENT_INSET,
  ChildCard,
  GlassPanel,
  IconCalendar,
  IconCheck,
  IconClock,
  IconCross,
  IconDoc,
  MiniChip,
  ROW_DIVIDER,
  ScreenBody,
  SectionCaps,
  SectionLink,
} from "../_study/parts";
import { chip, fontDisplay, ink1, ink2, ink3, status } from "../v2/tokens";

/** Незакрашенный трек кольца и точка «урок ещё не отмечен»: в светлой теме —
 *  ink-налёт, в тёмной — белый той же плотности (см. parent-theme.css). */
const TRACK = "var(--p-track, rgba(23,18,67,0.08))";
const DOT_IDLE = "var(--p-dot-idle, rgba(23,18,67,0.18))";

export type DayLessonVM = {
  id: string;
  timeStart: string;
  timeEnd: string | null;
  title: string;
  room: string | null;
  teacherName: string | null;
  attendance: AttendanceStatus | null;
};

/** Кольцо посещаемости дня (макет 427–433): 86px, толщина 9, r=32. */
function AttendanceDonut({
  total,
  present,
  excused,
  unexcused,
}: {
  total: number;
  present: number;
  excused: number;
  unexcused: number;
}) {
  const R = 32;
  const C = 2 * Math.PI * R;
  const seg = (n: number) => (total > 0 ? (n / total) * C : 0);
  const presentLen = seg(present);
  const excusedLen = seg(excused);
  const unexcusedLen = seg(unexcused);

  return (
    <span className="relative flex shrink-0 items-center justify-center" style={{ width: 86, height: 86 }}>
      <svg width={86} height={86} viewBox="0 0 86 86" aria-hidden>
        <g transform="rotate(-90 43 43)">
          {/* Цвет трека идёт стилем, а не атрибутом stroke: var() в
              presentation-атрибутах SVG браузеры не разрешают. */}
          <circle cx={43} cy={43} r={R} fill="none" strokeWidth={9} style={{ stroke: TRACK }} />
          {presentLen > 0 && (
            <circle
              cx={43}
              cy={43}
              r={R}
              fill="none"
              stroke="#10b981"
              strokeWidth={9}
              strokeDasharray={`${presentLen} ${C}`}
            />
          )}
          {excusedLen > 0 && (
            <circle
              cx={43}
              cy={43}
              r={R}
              fill="none"
              stroke="#f97316"
              strokeWidth={9}
              strokeDasharray={`${excusedLen} ${C}`}
              strokeDashoffset={-presentLen}
            />
          )}
          {unexcusedLen > 0 && (
            <circle
              cx={43}
              cy={43}
              r={R}
              fill="none"
              stroke="#ef4444"
              strokeWidth={9}
              strokeDasharray={`${unexcusedLen} ${C}`}
              strokeDashoffset={-(presentLen + excusedLen)}
            />
          )}
        </g>
      </svg>
      <span className="absolute flex flex-col items-center">
        <span style={{ fontFamily: fontDisplay, fontSize: 17, fontWeight: 600, color: ink1 }}>
          {present}/{total}
        </span>
        <span style={{ fontSize: 8.5, fontWeight: 700, color: ink2 }}>уроков</span>
      </span>
    </span>
  );
}

function DonutLegend({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="flex items-center" style={{ gap: 7 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} aria-hidden />
      <span className="flex-1" style={{ fontSize: 10.5, fontWeight: 600, color: ink2 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>{count}</span>
    </span>
  );
}

function AttendanceMark({ attendance }: { attendance: AttendanceStatus | null }) {
  if (attendance === "present") {
    return (
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: 20, height: 20, borderRadius: 10, background: `rgba(${status.green.rgb},0.16)` }}
      >
        <IconCheck size={11} color={status.green.text} strokeWidth={3} />
      </span>
    );
  }
  if (attendance === "absent_excused") {
    return (
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: 20, height: 20, borderRadius: 10, background: `rgba(${status.orange.rgb},0.16)` }}
      >
        <IconDoc size={11} color={status.orange.text} strokeWidth={2} />
      </span>
    );
  }
  if (attendance === "absent_unexcused") {
    return (
      <span
        className="flex shrink-0 items-center justify-center"
        style={{ width: 20, height: 20, borderRadius: 10, background: `rgba(${status.red.rgb},0.16)` }}
      >
        <IconCross size={11} color={status.red.text} strokeWidth={2.8} />
      </span>
    );
  }
  // Не отмечен — нейтральная серая точка (макет: маркер «впереди»).
  return (
    <span
      className="shrink-0"
      style={{ width: 8, height: 8, borderRadius: 4, background: DOT_IDLE }}
      aria-hidden
    />
  );
}

export function DayStatusView({
  childName,
  childClass,
  dateLabel,
  isDayOff,
  lessons,
  totalLessons,
  present,
  excused,
  unexcused,
  arrivalLabel,
  nextLesson,
  gradesToday,
  homeworkAssignedToday,
}: {
  childName: string;
  childClass: string | null;
  dateLabel: string;
  isDayOff: boolean;
  lessons: DayLessonVM[];
  totalLessons: number;
  present: number;
  excused: number;
  unexcused: number;
  arrivalLabel: string | null;
  nextLesson: { subjectName: string; timeLabel: string } | null;
  gradesToday: { subjectName: string; grade: number }[];
  homeworkAssignedToday: number;
}) {
  const firstName = childName.split(/\s+/)[1] ?? childName.split(/\s+/)[0] ?? childName;
  const inSchool = arrivalLabel != null;

  return (
    <>
      <InnerHeader
        title="Статус дня"
        backHref="/parent/home"
        right={
          <GlassCircle label="Расписание недели" href="/parent/schedule">
            <IconCalendar size={16} color={ink1} strokeWidth={1.8} />
          </GlassCircle>
        }
      />

      <ScreenBody>
        <ChildCard name={childName} className={childClass} />

        {/* Баннер «в школе» / «ещё не отмечен» (макет 422–425). Цвет и текст
            зависят от РЕАЛЬНОЙ отметки посещаемости, а не от времени суток. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 13,
            borderRadius: 20,
            background: inSchool
              ? "linear-gradient(135deg, #34d399, #0ea5e9)"
              : "linear-gradient(135deg, #a5b4fc, #818cf8)",
            boxShadow: inSchool
              ? `0 16px 36px rgba(14,165,233,0.35), ${ACCENT_INSET}`
              : `0 16px 36px rgba(99,102,241,0.30), ${ACCENT_INSET}`,
            color: "#fff",
          }}
        >
          <span
            className="flex shrink-0 items-center justify-center"
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.4)",
            }}
          >
            <IconClock size={19} color="#fff" strokeWidth={1.9} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 1 }}>
            <span className="truncate" style={{ fontSize: 14.5, fontWeight: 800 }}>
              {inSchool ? `${firstName} в школе` : isDayOff ? "Сегодня занятий нет" : `${firstName} ещё не отмечен`}
            </span>
            <span className="truncate" style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
              {inSchool
                ? `Отмечен в ${arrivalLabel} · ${dateLabel}`
                : nextLesson
                  ? `Следующий урок: ${nextLesson.subjectName} в ${nextLesson.timeLabel}`
                  : dateLabel}
            </span>
          </span>
        </div>

        {/* Посещаемость дня (макет 426–433). */}
        <SectionCaps
          right={
            <Link href="/parent/attendance">
              <SectionLink>Смотреть все ›</SectionLink>
            </Link>
          }
        >
          Посещаемость
        </SectionCaps>

        <GlassPanel radius={20}>
          <div className="flex items-center" style={{ gap: 16, padding: 13 }}>
            <AttendanceDonut
              total={totalLessons}
              present={present}
              excused={excused}
              unexcused={unexcused}
            />
            <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 7 }}>
              <DonutLegend color="#10b981" label="Присутствовал" count={present} />
              <DonutLegend color="#f97316" label="Уважительная причина" count={excused} />
              <DonutLegend color="#ef4444" label="Без уважительной" count={unexcused} />
              <span style={{ fontSize: 10, fontWeight: 600, color: ink3 }}>
                {totalLessons - present - excused - unexcused > 0
                  ? `Ещё не отмечено уроков: ${totalLessons - present - excused - unexcused}`
                  : "Все уроки дня отмечены"}
              </span>
            </span>
          </div>
        </GlassPanel>

        {/* Расписание на день (макет 434–442). */}
        <SectionCaps
          right={
            <Link href="/parent/schedule">
              <SectionLink>Вся неделя ›</SectionLink>
            </Link>
          }
        >
          Расписание сегодня
        </SectionCaps>

        {lessons.length === 0 ? (
          <GlassPanel radius={20}>
            <p className="text-center" style={{ padding: 18, fontSize: 12, fontWeight: 700, color: ink2 }}>
              {dateLabel} — учебных занятий нет
            </p>
          </GlassPanel>
        ) : (
          <GlassPanel radius={20}>
            <div style={{ paddingInline: 14, paddingBlock: 5 }}>
              {lessons.map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-center"
                  style={{
                    gap: 10,
                    paddingBlock: 9,
                    borderTop: i === 0 ? undefined : `1px solid ${ROW_DIVIDER}`,
                  }}
                >
                  <span
                    className="shrink-0"
                    style={{ width: 40, fontSize: 11, fontWeight: 800, color: ink2 }}
                  >
                    {l.timeStart}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                      {l.title}
                    </span>
                    <span className="truncate" style={{ fontSize: 9.5, fontWeight: 600, color: ink3 }}>
                      {[l.room ? `Кабинет ${l.room}` : null, l.teacherName].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  <AttendanceMark attendance={l.attendance} />
                </div>
              ))}
            </div>
          </GlassPanel>
        )}

        {/* Итоги дня — реальные данные вместо фикстурного блока «Питание». */}
        <SectionCaps>Итоги дня</SectionCaps>

        <GlassPanel radius={20}>
          <div className="flex flex-col" style={{ padding: 14, gap: 10 }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 11.5, fontWeight: 700, color: ink2 }}>Оценок за день</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>{gradesToday.length}</span>
            </div>

            {gradesToday.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {gradesToday.map((g, i) => (
                  <MiniChip
                    key={`${g.subjectName}-${i}`}
                    label={`${g.subjectName}: ${g.grade}`}
                    family={g.grade >= 4 ? "green" : g.grade === 3 ? "orange" : "red"}
                  />
                ))}
              </div>
            )}

            <span style={{ height: 1, background: ROW_DIVIDER }} aria-hidden />

            <Link href="/parent/homework" className="flex items-center justify-between">
              <span style={{ fontSize: 11.5, fontWeight: 700, color: ink2 }}>Задано сегодня</span>
              <span
                style={{
                  paddingBlock: 3,
                  paddingInline: 9,
                  borderRadius: 999,
                  background: chip(status.violet.rgb).background,
                  border: `1px solid ${chip(status.violet.rgb).borderColor}`,
                  fontSize: 11,
                  fontWeight: 800,
                  color: status.violet.text,
                }}
              >
                {homeworkAssignedToday} заданий ›
              </span>
            </Link>
          </div>
        </GlassPanel>
      </ScreenBody>
    </>
  );
}

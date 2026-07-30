import { formatTime } from "@snr/core";
import { childScheduleWeek, getSelectedChild, parentToday, parentWeekMonday } from "@/lib/parent-queries";
import { ScheduleView, type ScheduleDay, type ScheduleLessonVM } from "./ScheduleView";
import {
  RU,
  WEEKDAY_FULL,
  WEEKDAY_SHORT,
  addDaysKey,
  dayOfKey,
  ruDayMonth,
  subjectColor,
  tashkentDateKey,
} from "../_study/util";

/**
 * Экран #15 «Расписание» — веб-порт apps/mobile-parent/src/screens/study/
 * ScheduleScreen.tsx (ветка feat/mobile-parent-redesign, только читалась).
 *
 * В отличие от переноса Блока 7.1 (home/progress питаются фикстурами v2/data),
 * здесь данные РЕАЛЬНЫЕ: childScheduleWeek() → core getStudentLessonsForWeek
 * с явным studentId выбранного ребёнка. studentId обязателен даже при одном
 * ребёнке: родительский RLS пропускает строки ВСЕХ детей, и запрос без него
 * на втором ребёнке молча склеил бы два расписания.
 *
 * Один запрос на всю неделю (Пн–Вс), переключение дня — локальное в клиенте,
 * без рефетча (тот же приём, что в RN). Все даты считаются на СЕРВЕРЕ в
 * Asia/Tashkent и приезжают в клиент готовыми строками — иначе UTC-сервер и
 * локальный браузер разошлись бы в форматировании (React #418).
 */
export default async function ParentSchedulePage() {
  const [child, lessons] = await Promise.all([getSelectedChild(), childScheduleWeek()]);

  const weekStart = parentWeekMonday();
  const today = parentToday();

  const days: ScheduleDay[] = WEEKDAY_SHORT.map((label, i) => {
    const dateKey = addDaysKey(weekStart, i);
    const dayMonth = ruDayMonth(dateKey);
    return {
      dateKey,
      weekdayShort: label,
      dayNumber: dayOfKey(dateKey),
      bannerTitle:
        dateKey === today ? `Сегодня, ${dayMonth}` : `${WEEKDAY_FULL[i] ?? label}, ${dayMonth}`,
    };
  });

  const lessonsByDate: Record<string, ScheduleLessonVM[]> = {};
  for (const day of days) lessonsByDate[day.dateKey] = [];
  for (const l of lessons) {
    const bucket = lessonsByDate[tashkentDateKey(l.starts_at)];
    if (!bucket) continue; // урок вне видимой недели — в неделю не попадает
    bucket.push({
      id: l.id,
      subjectId: l.subject?.id ?? null,
      timeStart: formatTime(l.starts_at, RU),
      timeEnd: l.ends_at ? formatTime(l.ends_at, RU) : null,
      title: l.subject?.name ?? l.title ?? "Урок",
      room: l.room,
      topic: l.topic,
      color: subjectColor(l.subject?.color),
      teacherName: l.subject?.teacher?.full_name ?? l.group.teacher?.full_name ?? null,
      live: l.status === "in_progress",
      done: l.status === "completed",
    });
  }

  const todayIndex = days.findIndex((d) => d.dateKey === today);

  return (
    <ScheduleView
      childName={child?.full_name ?? "Ребёнок"}
      childClass={child?.className ?? null}
      days={days}
      lessonsByDate={lessonsByDate}
      initialIndex={todayIndex < 0 ? 0 : todayIndex}
    />
  );
}

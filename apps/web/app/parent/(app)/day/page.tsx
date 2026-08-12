import { childDailyStats, childDailyStatus, getSelectedChild, parentToday } from "@/lib/parent-queries";
import { DayStatusView, type DayLessonVM } from "./DayStatusView";

/**
 * Экран d6 «Статус дня» — веб-порт apps/mobile-parent/src/screens/study/
 * DayStatusScreen.tsx (ветка feat/mobile-parent-redesign).
 *
 * Данные РЕАЛЬНЫЕ: childDailyStatus() + childDailyStats() → core
 * getChildDailyStatus / getChildDailyStats со studentId выбранного ребёнка.
 * «Сегодня» — демо-дата проекта (lib/demo-date), а не часы браузера.
 *
 * Блок «Питание» из макета (строки 443–448) НЕ переносится: он целиком
 * фикстурный (меню, время обеда, баланс питания) и в БД источника не имеет.
 * На его месте — реальные итоги дня: оценки, выданные сегодня, и число
 * заданных сегодня домашних работ.
 */
export default async function ParentDayPage() {
  const [child, dayStatus, stats] = await Promise.all([
    getSelectedChild(),
    childDailyStatus(),
    childDailyStats(),
  ]);

  const today = await parentToday();

  const lessons: DayLessonVM[] = dayStatus.lessons.map((l) => ({
    id: l.id,
    startsAt: l.startsAt,
    endsAt: l.endsAt,
    title: l.subjectName ?? l.title ?? "Урок",
    room: l.room,
    teacherName: l.teacherName,
    attendance: l.attendanceStatus,
  }));

  const present = dayStatus.lessons.filter((l) => l.attendanceStatus === "present").length;
  const excused = dayStatus.lessons.filter((l) => l.attendanceStatus === "absent_excused").length;
  const unexcused = dayStatus.lessons.filter((l) => l.attendanceStatus === "absent_unexcused").length;

  return (
    <DayStatusView
      childName={child?.full_name ?? "Ребёнок"}
      childClass={child?.className ?? null}
      todayKey={today}
      isDayOff={dayStatus.isDayOff}
      lessons={lessons}
      totalLessons={dayStatus.totalLessons}
      present={present}
      excused={excused}
      unexcused={unexcused}
      arrivalAt={stats.arrivalTime}
      nextLesson={
        stats.nextLesson
          ? {
              subjectName: stats.nextLesson.subjectName,
              startsAt: stats.nextLesson.startsAt,
            }
          : null
      }
      gradesToday={dayStatus.gradesToday}
      homeworkAssignedToday={dayStatus.homeworkAssignedToday}
    />
  );
}

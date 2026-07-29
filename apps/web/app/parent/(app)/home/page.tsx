import { cookies } from "next/headers";
import { findNextLesson, getStudentAttendance, getStudentLessonsForWeek, getHomeworkWithSubmissions } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getParentContext, SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-context";
import { tashkentDateKey, tashkentToday } from "./tashkent";
import { HomeView, type NextLessonData } from "./HomeView";

/**
 * «Главная» — реальные данные, 1:1 по составу с apps/mobile-parent
 * HomeScreen.tsx (Заход 2, шаги 4–5): getStudentLessonsForWeek +
 * getStudentAttendance (один комбинированный fetch — те же 3 метрики +
 * карточка «Следующий урок») и отдельно getHomeworkWithSubmissions
 * («ДЗ»). Throw-on-error — сбой любого запроса уходит в error.tsx
 * (Next.js error boundary), не проглатывается .catch(()=>[]).
 *
 * Активный ребёнок — из cookie parent_selected_child, та же, что уже
 * читает (app)/layout.tsx для шапки/переключателя; переключение ребёнка
 * (ParentAppShell → router.refresh()) заново прогоняет этот серверный
 * компонент с новым cookie-значением.
 *
 * НЕ перенесено 1:1 с мобилки в этом заходе: сетка «Быстрые действия» и
 * лента «Сегодня» — обе ведут на внутренние экраны (ДЗ-детали, Все
 * сервисы, Питание, Расписание, ...), которых на вебе ещё нет ни одного
 * (кроме Оплат/Профиля/Сообщений/Успехов — уже учтено в CTA ниже, где
 * есть честная цель). Рисовать 6 плиток и 3 строки ленты, из которых
 * почти все вели бы в никуда, хуже, чем не рисовать их вовсе — оставлено
 * на следующий заход, когда появятся сами экраны.
 */
export default async function ParentHomePage() {
  const ctx = await getParentContext();
  if (!ctx) return null; // (app)/layout.tsx уже гарантирует сессию; страхуемся по типам

  const cookieStore = await cookies();
  const cookieChildId = cookieStore.get(SELECTED_CHILD_COOKIE)?.value ?? null;
  const child = resolveSelectedChild(ctx.children, cookieChildId);

  if (!child) {
    return <HomeView parentName={ctx.parentName} childName={null} className={null} atSchoolSinceIso={null} lessonsToday={0} presentToday={0} pendingHomeworkCount={0} nextLesson={null} />;
  }

  const db = await createClient();
  const todayKey = tashkentToday();

  const [weekLessons, attendanceResult, homeworkList] = await Promise.all([
    getStudentLessonsForWeek(db, todayKey, child.id),
    getStudentAttendance(db, undefined, child.id),
    getHomeworkWithSubmissions(db, child.id),
  ]);

  const todayLessons = weekLessons.filter((l) => tashkentDateKey(l.starts_at) === todayKey);
  // "Следующий урок": единственный источник истины — status='in_progress'
  // → первый после него, иначе первый scheduled в будущем
  // (findNextLesson из @snr/core) — не сырое сравнение starts_at с "сейчас",
  // которое могло пропустить реально идущий урок, если его старт уже в
  // прошлом.
  const nextLessonRaw = findNextLesson(weekLessons);

  const attendanceToday = attendanceResult.records.filter((r) => tashkentDateKey(r.lesson_date) === todayKey);
  const presentToday = attendanceToday.filter((r) => r.status === "present");
  const arrivalTime = presentToday.reduce<string | null>((min, r) => {
    if (!r.marked_at) return min;
    return !min || r.marked_at < min ? r.marked_at : min;
  }, null);

  const pendingHomeworkCount = homeworkList.filter(
    (hw) => !hw.submission && !hw.test_submission && (!hw.due_date || tashkentDateKey(hw.due_date) >= todayKey),
  ).length;

  const nextLesson: NextLessonData | null = nextLessonRaw
    ? {
        subjectName: nextLessonRaw.subject?.name ?? nextLessonRaw.title ?? null,
        startsAtIso: nextLessonRaw.starts_at,
        endsAtIso: nextLessonRaw.ends_at,
        room: nextLessonRaw.room,
        teacherName: nextLessonRaw.subject?.teacher?.full_name ?? nextLessonRaw.group?.teacher?.full_name ?? null,
      }
    : null;

  return (
    <HomeView
      parentName={ctx.parentName}
      childName={child.full_name}
      className={child.className}
      atSchoolSinceIso={arrivalTime}
      lessonsToday={todayLessons.length}
      presentToday={presentToday.length}
      pendingHomeworkCount={pendingHomeworkCount}
      nextLesson={nextLesson}
    />
  );
}

import { cookies } from "next/headers";
import { getStudentGrades, getChildTeacherReviews, getSubjectConfig } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getParentContext, SELECTED_CHILD_COOKIE, resolveSelectedChild } from "@/lib/parent-context";
import { ProgressView, type SubjectStat, type TeacherReview } from "./ProgressView";

/**
 * «Успехи» — вкладка «Оценки» на реальных данных, 1:1 по составу с
 * apps/mobile-parent HomeScreen.tsx-соседом ProgressScreen.tsx (Заход 2,
 * шаг 6): getStudentGrades сгруппированные по уже резолвленному
 * subject-ключу (НЕ groups.subject — тот самый веб-баг «всё
 * Программирование») + getChildTeacherReviews для последнего отзыва.
 * Throw-on-error — сбой любого запроса уходит в error.tsx.
 *
 * Вкладки «Навыки» и «Динамика» остаются фикстурой в самой мобилке
 * (комментарий ProgressScreen.tsx: «вне скоупа», «нет естественного
 * способа посчитать без выдумывания метрики») — ProgressView.tsx рисует
 * их как статичный мок, не подключает к БД, ровно как и мобилка.
 */
export default async function ParentProgressPage() {
  const ctx = await getParentContext();
  if (!ctx) return null;

  const cookieStore = await cookies();
  const child = resolveSelectedChild(ctx.children, cookieStore.get(SELECTED_CHILD_COOKIE)?.value ?? null);

  if (!child) {
    return <ProgressView childName={null} average={null} subjectStats={[]} review={null} />;
  }

  const db = await createClient();
  const [gradeItems, reviews] = await Promise.all([
    getStudentGrades(db, child.id),
    getChildTeacherReviews(db, child.id, { sinceDays: 14, limit: 1 }),
  ]);

  const gradedItems = gradeItems.filter((g): g is typeof g & { grade5: number } => g.grade5 != null);
  const average = gradedItems.length > 0 ? gradedItems.reduce((sum, g) => sum + g.grade5, 0) / gradedItems.length : null;

  const bySubject = new Map<string, { sum: number; count: number }>();
  for (const g of gradedItems) {
    if (!g.subject) continue;
    const cur = bySubject.get(g.subject) ?? { sum: 0, count: 0 };
    cur.sum += g.grade5;
    cur.count += 1;
    bySubject.set(g.subject, cur);
  }
  const subjectStats: SubjectStat[] = Array.from(bySubject.entries())
    .map(([subject, { sum, count }]) => {
      const cfg = getSubjectConfig(subject);
      const avg = sum / count;
      return { subject, label: cfg.label, color: cfg.color, avg, count };
    })
    .sort((a, b) => b.avg - a.avg);

  const r = reviews[0] ?? null;
  const review: TeacherReview | null = r
    ? {
        teacherName: r.teacherName,
        subjectName: r.subjectName,
        comment: r.comment,
        gradedAtIso: r.gradedAt,
      }
    : null;

  return (
    <ProgressView
      childName={child.full_name}
      average={average}
      subjectStats={subjectStats}
      review={review}
    />
  );
}

import { childTeacherReviews, getSelectedChild, parentToday } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import { Avatar, EmptyState, InnerHeader, ScreenScroll, SectionCap } from "../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { DIVIDER } from "../_ui/screen-tokens";
import { avatarGradient, initialsOf, previousDay, relativeStamp } from "../_ui/format";
import { ink1, ink2, ink3 } from "../v2/tokens";
import { SERVICE_ICON } from "../services/_service-kit";

/**
 * «Отзывы учителей» — экран, на который ведёт ссылка «Все ›» из блока
 * «Последние отзывы» на /parent/progress (ProgressView.tsx, R.reviews). До
 * этого маршрута не существовало и переход давал 404.
 *
 * Данные РЕАЛЬНЫЕ, а не заглушка: источник — `getChildTeacherReviews`
 * (`lesson_grades.comment`), тот же, что питает блок на «Успехах». Там он
 * вызывается с limit 5 — здесь без ограничения, ровно как задумано в самом
 * запросе («без него — полный список для экрана "Все отзывы"»). Рисовать
 * «Функция появится скоро» поверх существующих отзывов было бы враньём:
 * родитель уже видит один из них на предыдущем экране.
 *
 * Оценка (`grade`) намеренно не показывается: в `lesson_grades` она хранится
 * в разных шкалах и нормируется отдельно (getStudentGrades → grade5), а
 * сырое число рядом с текстом отзыва читалось бы как балл за отзыв.
 *
 * Только светлая тема.
 */
export default async function ParentReviewsPage() {
  const [reviews, child] = await Promise.all([childTeacherReviews(), getSelectedChild()]);

  const today = await parentToday();
  const yesterday = previousDay(today);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title="Отзывы учителей" backHref="/parent/progress" />

      <ScreenScroll>
        {reviews.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState
              title="Отзывов пока нет"
              text={
                child
                  ? `Здесь появятся комментарии учителей к урокам ${child.full_name}: что получилось, над чем поработать.`
                  : "Здесь появятся комментарии учителей к урокам: что получилось, над чем поработать."
              }
              paths={SERVICE_ICON.reviews}
            />
          </GlassCard>
        ) : (
          <>
            <SectionCap label={`Все отзывы · ${reviews.length}`} />

            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {reviews.map((r, idx) => {
                const teacherName = r.teacherName ?? "Учитель";
                const heading = [teacherName, r.subjectName].filter(Boolean).join(" · ");
                return (
                  <div
                    key={r.id}
                    className="flex"
                    style={{
                      gap: 10,
                      paddingTop: 13,
                      paddingBottom: 13,
                      borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                    }}
                  >
                    <Avatar
                      size={38}
                      initials={initialsOf(teacherName)}
                      gradient={avatarGradient(teacherName)}
                    />
                    <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 4 }}>
                      <div className="flex items-center" style={{ gap: 8 }}>
                        <span
                          className="min-w-0 flex-1 truncate"
                          style={{ fontSize: 12, fontWeight: 800, color: ink1 }}
                        >
                          {heading}
                        </span>
                        <span className="shrink-0" style={{ fontSize: 10.5, fontWeight: 700, color: ink2 }}>
                          {relativeStamp(r.gradedAt, today, yesterday)}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, lineHeight: "17px", color: ink2 }}>
                        {r.comment}
                      </p>
                    </div>
                  </div>
                );
              })}
            </GlassCard>

            <span style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center" }}>
              Отзывы оставляют учителя при выставлении оценок за урок.
            </span>
          </>
        )}
      </ScreenScroll>
    </div>
  );
}

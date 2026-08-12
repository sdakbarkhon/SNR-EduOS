import { notFound } from "next/navigation";
import { childTeacherProfile, childTeacherReviews, parentToday } from "@/lib/parent-queries";
import { TeacherProfileView } from "./TeacherProfileView";

/**
 * «Профиль учителя» — веб-порт
 * apps/mobile-parent/src/screens/study/TeacherProfileScreen.tsx.
 *
 * Данные НАСТОЯЩИЕ: имя учителя, его предметы у класса ребёнка, классы и
 * число уроков в расписании; ниже — его отзывы об этом ребёнке
 * (`lesson_grades.comment`, тот же источник, что экран «Отзывы учителей»).
 * Отбор отзывов идёт по `graded_by`, а не по совпадению ФИО.
 *
 * Чего нет по сравнению с мобильным макетом: рейтинга, стажа, образования,
 * «часов онлайн» и кнопки «Написать». Первых четырёх нет в базе ни в каком
 * виде, а рисовать их из воздуха — ровно то, от чего уходим.
 */
export default async function ParentTeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [profile, reviews, today] = await Promise.all([
    childTeacherProfile(id),
    childTeacherReviews(),
    parentToday(),
  ]);
  if (!profile) notFound();

  return (
    <TeacherProfileView
      profile={profile}
      reviews={reviews.filter((r) => r.teacherId === id)}
      today={today}
    />
  );
}

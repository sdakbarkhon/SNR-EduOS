import { BookOpen } from "lucide-react";
import { LUCIDE_ICONS } from "@/lib/subject-icons";

export const FALLBACK_SUBJECT_COLOR = "#64748b";

/** Иконка предмета урока — icon/color приходят напрямую из subjects (lessons join).
 *  Отдельная система от SubjectIcon/getSubjectStyle (slug-based, homework/grades/group.subject). */
export function LessonSubjectIcon({
  icon,
  color,
  size = 36,
}: {
  icon: string | null | undefined;
  // 26.08.2026: цвет стал необязательным. Уроков без предмета в базе сегодня
  // нет, но колонка nullable, и запасной цвет должен быть записан здесь один
  // раз, а не по строке на каждом экране.
  color?: string | null;
  size?: number;
}) {
  const Icon = (icon && LUCIDE_ICONS[icon]) || BookOpen;
  const tone = color || FALLBACK_SUBJECT_COLOR;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: `${tone}1A`, color: tone }}
    >
      <Icon style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.2} />
    </span>
  );
}

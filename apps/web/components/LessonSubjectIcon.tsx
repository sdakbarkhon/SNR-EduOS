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
  icon: string | undefined;
  color: string;
  size?: number;
}) {
  const Icon = (icon && LUCIDE_ICONS[icon]) || BookOpen;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, backgroundColor: `${color}1A`, color }}
    >
      <Icon style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.2} />
    </span>
  );
}

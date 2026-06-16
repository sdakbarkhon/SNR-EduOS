import { colors } from "@snr/ui-tokens";

/**
 * Конфиг «цвет + иконка на предмет» (design_spec §1.1, §5). Один источник правды —
 * не хардкодить по экранам. `icon` — ключ для lucide (web: lucide-react,
 * mobile: lucide-react-native). `subject` совпадает с `groups.subject`.
 */
export interface SubjectStyle {
  label: string;
  color: string;
  icon: string;
}

export const subjects: Record<string, SubjectStyle> = {
  robotics: { label: "Робототехника", color: "#2D5BFF", icon: "bot" },
  informatics: { label: "Информатика", color: "#7A4DFF", icon: "monitor" },
  math: { label: "Математика", color: "#F5A623", icon: "calculator" },
  physics: { label: "Физика", color: "#39B6F5", icon: "atom" },
  english: { label: "Английский", color: "#F0556B", icon: "languages" },
  history: { label: "История", color: "#B5793A", icon: "scroll" },
  biology: { label: "Биология", color: "#2DBE7E", icon: "leaf" },
  chemistry: { label: "Химия", color: "#9B5DE5", icon: "flask-conical" },
};

export const defaultSubjectStyle: SubjectStyle = {
  label: "Предмет",
  color: colors.primary,
  icon: "book-open",
};

export function getSubjectStyle(subject: string | null | undefined): SubjectStyle {
  if (!subject) return defaultSubjectStyle;
  return subjects[subject] ?? defaultSubjectStyle;
}

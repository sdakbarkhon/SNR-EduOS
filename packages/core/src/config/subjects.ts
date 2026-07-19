import { colors } from "@snr/ui-tokens";

export interface SubjectStyle {
  label: string;
  color: string;
  icon: string;
}

export const subjects: Record<string, SubjectStyle> = {
  robotics:    { label: "Робототехника",    color: "#2D5BFF", icon: "bot" },
  informatics: { label: "Информатика",      color: "#7A4DFF", icon: "monitor" },
  programming: { label: "Программирование", color: "#0EA5E9", icon: "code-2" },
  math:        { label: "Математика",       color: "#F5A623", icon: "calculator" },
  physics:     { label: "Физика",           color: "#39B6F5", icon: "atom" },
  english:     { label: "Английский язык",  color: "#F0556B", icon: "languages" },
  russian:     { label: "Русский язык",     color: "#DC2626", icon: "book-open" },
  history:     { label: "История",          color: "#B5793A", icon: "scroll" },
  biology:     { label: "Биология",         color: "#2DBE7E", icon: "leaf" },
  chemistry:   { label: "Химия",            color: "#9B5DE5", icon: "flask-conical" },
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

export function getSubjectConfig(subject: string | null | undefined): SubjectStyle {
  return getSubjectStyle(subject);
}

// Обратный поиск: RU-название предмета урока (lessons.subject_id ->
// subjects.name, напр. "Английский язык") -> canonical-ключ этого же
// конфига (напр. "english") — тот же ключ, что books.subject. Один
// источник правды (сам subjects выше), а не отдельный параллельный словарь.
export function getSubjectKeyByLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  for (const [key, cfg] of Object.entries(subjects)) {
    if (cfg.label === label) return key;
  }
  return null;
}

import { colors } from "@snr/ui-tokens";

export interface SubjectStyle {
  label: string;
  color: string;
  icon: string;
  emoji: string;
}

export const subjects: Record<string, SubjectStyle> = {
  robotics:    { label: "Робототехника",    color: "#2D5BFF", icon: "bot",           emoji: "🤖" },
  informatics: { label: "Информатика",      color: "#7A4DFF", icon: "monitor",       emoji: "💻" },
  programming: { label: "Программирование", color: "#0EA5E9", icon: "code-2",        emoji: "🧑‍💻" },
  math:        { label: "Математика",       color: "#F5A623", icon: "calculator",    emoji: "📐" },
  physics:     { label: "Физика",           color: "#39B6F5", icon: "atom",          emoji: "⚛️" },
  english:     { label: "Английский язык",  color: "#F0556B", icon: "languages",     emoji: "🇬🇧" },
  history:     { label: "История",          color: "#B5793A", icon: "scroll",        emoji: "📜" },
  biology:     { label: "Биология",         color: "#2DBE7E", icon: "leaf",          emoji: "🌿" },
  chemistry:   { label: "Химия",            color: "#9B5DE5", icon: "flask-conical", emoji: "🧪" },
};

export const defaultSubjectStyle: SubjectStyle = {
  label: "Предмет",
  color: colors.primary,
  icon: "book-open",
  emoji: "📚",
};

export function getSubjectStyle(subject: string | null | undefined): SubjectStyle {
  if (!subject) return defaultSubjectStyle;
  return subjects[subject] ?? defaultSubjectStyle;
}

export function getSubjectConfig(subject: string | null | undefined): SubjectStyle {
  return getSubjectStyle(subject);
}

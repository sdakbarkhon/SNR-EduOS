import { colors } from "@snr/ui-tokens";

export interface SubjectStyle {
  label: string;
  color: string;
  icon: string;
  emoji: string;
}

export const subjects: Record<string, SubjectStyle> = {
  robotics:    { label: "Robotics",    color: "#2D5BFF", icon: "bot",           emoji: "🤖" },
  informatics: { label: "Informatics", color: "#7A4DFF", icon: "monitor",       emoji: "💻" },
  programming: { label: "Programming", color: "#0EA5E9", icon: "code-2",        emoji: "🧑‍💻" },
  math:        { label: "Math",        color: "#F5A623", icon: "calculator",    emoji: "📐" },
  physics:     { label: "Physics",     color: "#39B6F5", icon: "atom",          emoji: "⚛️" },
  english:     { label: "English",     color: "#F0556B", icon: "languages",     emoji: "🇬🇧" },
  history:     { label: "History",     color: "#B5793A", icon: "scroll",        emoji: "📜" },
  biology:     { label: "Biology",     color: "#2DBE7E", icon: "leaf",          emoji: "🌿" },
  chemistry:   { label: "Chemistry",   color: "#9B5DE5", icon: "flask-conical", emoji: "🧪" },
};

export const defaultSubjectStyle: SubjectStyle = {
  label: "Subject",
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

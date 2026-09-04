import { colors } from "@snr/ui-tokens";

/**
 * СЛОВАРЬ НАЗВАНИЙ ПРЕДМЕТОВ — ЗАМОРОЖЕННАЯ КОПИЯ. 06.09.2026.
 *
 * ═══ ПОЧЕМУ ОН ЗДЕСЬ ═══════════════════════════════════════════════════════
 *
 * Он жил в общем ядре (`packages/core/src/config/subjects.ts`) и отвечал на
 * вопрос «как выглядит предмет» по слагу. За десять заходов весь продукт
 * перешёл на справочник предметов школы: подпись, значок и цвет берутся из
 * `school_subjects`, а не из списка в коде. Список снесён — школа заводит свои
 * предметы, и решать за неё, как они называются, код больше не должен.
 *
 * Кроме одного места: ЭТОГО приложения. Ученическое приложение заморожено
 * (см. CLAUDE.md §3), проверкой типов монорепо не покрыто и переписке не
 * подлежит — а на словаре сидят девять его экранов. Снести список и не
 * тронуть их значило бы сломать замороженное молча.
 *
 * Поэтому список переехал СЮДА как есть, слово в слово. Он никем больше не
 * читается, ни на что за пределами этого приложения не влияет и разморозится
 * вместе с ним.
 *
 * ═══ ЧТО ЭТО ЗНАЧИТ ════════════════════════════════════════════════════════
 *
 * Ничего не менять здесь при заведении новых предметов в школе: этот файл
 * заморожен вместе с приложением. Когда приложение оживёт, его экраны
 * переводятся на resolveSubject и справочник — как весь остальной продукт, —
 * а файл удаляется.
 */

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
  science:     { label: "Science",          color: "#14B8A6", icon: "microscope" },
  circuitry:   { label: "Схемотехника",     color: "#64748B", icon: "circuit-board" },
  nature:      { label: "Природоведение",   color: "#16A34A", icon: "tree-pine" },
  art:         { label: "ИЗО",              color: "#EC4899", icon: "palette" },
  music:       { label: "Музыка",           color: "#8B5CF6", icon: "music" },
  geography:   { label: "География",        color: "#F97316", icon: "globe" },
  social:      { label: "Обществознание",   color: "#71717A", icon: "users" },
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

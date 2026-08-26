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

/**
 * ПОДПИСЬ ПРЕДМЕТА, КОТОРАЯ НЕ ВРЁТ И НЕ ТЕРЯЕТ. 26.08.2026.
 *
 * Прочерк, а не «Предмет» и не пустое место. `getSubjectStyle` для неизвестного
 * ключа отдаёт defaultSubjectStyle с подписью «Предмет» — это годится для цвета
 * и иконки, но на месте названия читается как утверждение. Если предмета нет,
 * человек должен видеть прочерк и понимать, что здесь пусто.
 *
 * Колонки lessons.subject_id и homework.subject_id обе nullable. Сегодня пустых
 * нет ни одной (128 уроков и 59 заданий, все с предметом), но код обязан уметь
 * пустоту, иначе первая же строка без предмета подпишется чужим словом.
 */
export function subjectDisplay(name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  return clean || "—";
}

/**
 * Ключ предмета для группировки и фильтров.
 *
 * ЗАЧЕМ. `getSubjectKeyByLabel` знает только канонические предметы и на всё
 * остальное отдаёт null. Вызывающие писали `?? ""`, и предмет вне списка молча
 * исчезал: «Схемотехника» из боевой школы пропадала из фильтров аналитики
 * вместе со всеми своими оценками — не «прочие», а вообще нигде.
 *
 * КАНОНИЧЕСКИЙ СПИСОК НЕ РАСШИРЯЕТСЯ. «Схемотехника» не становится шестым
 * предметом конфига, у неё по-прежнему нет ни цвета, ни иконки отсюда. Она
 * просто проходит через фильтр под собственным именем вместо пустой строки.
 *
 * Для пяти канонических предметов поведение прежнее до буквы: «Английский
 * язык» → "english", как и раньше.
 */
export function subjectFilterKey(label: string | null | undefined): string {
  const clean = (label ?? "").trim();
  if (!clean) return "";
  return getSubjectKeyByLabel(clean) ?? clean;
}

/**
 * Обратная сторона `subjectFilterKey`: подпись по ключу. Канонический слаг
 * разворачивается в русское название, всё остальное показывается как есть —
 * а не подменяется словом «Предмет», как это делает getSubjectStyle().label.
 */
export function subjectLabelOf(key: string | null | undefined): string {
  const clean = (key ?? "").trim();
  if (!clean) return "—";
  return subjects[clean]?.label ?? clean;
}

/**
 * Несколько предметов одной строкой: «Английский язык, Математика, Русский
 * язык + ещё 2». Группу ведут несколько учителей, и один предмет в колонке
 * «Предмет» был бы такой же неправдой, как заглушка.
 *
 * moreTemplate приходит из словаря — «+ ещё {n}» / «+ yana {n}» / «+{n} more».
 */
export function joinSubjectNames(
  names: ReadonlyArray<string | null | undefined>,
  moreTemplate: string,
  max = 3,
): string {
  const clean = names.map((n) => (n ?? "").trim()).filter(Boolean);
  if (clean.length === 0) return "—";
  if (clean.length <= max) return clean.join(", ");
  return `${clean.slice(0, max).join(", ")} ${moreTemplate.replace("{n}", String(clean.length - max))}`;
}

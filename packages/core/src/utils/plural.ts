/** Морфология чисел: склонение слова «ученик» по числу и языку. */

type PluralLocale = "ru" | "uz" | "en";

/** Выбор русской формы: one (1), few (2–4), many (5–20, 0). Учитывает 11–14. */
function ruForm(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * «N учеников» с правильным склонением.
 * ru: 1 ученик / 2 ученика / 5 учеников.
 * en: 1 student / 2 students.
 * uz: всегда «N o'quvchi» (узбекский не склоняет по числу).
 */
export function pluralizeStudents(n: number, locale: PluralLocale | string = "ru"): string {
  switch (locale) {
    case "en":
      return `${n} ${n === 1 ? "student" : "students"}`;
    case "uz":
      return `${n} o'quvchi`;
    case "ru":
    default:
      return `${n} ${ruForm(n, "ученик", "ученика", "учеников")}`;
  }
}

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

/**
 * Возраст словами: «7 лет» / «21 год» / «22 года».
 *
 * Нужен профилю ребёнка в родительском приложении: возраст там не колонка,
 * а арифметика от students.birth_date, и без склонения он читался бы как
 * «7 год». uz: «7 yosh» (узбекский не склоняет по числу). en: year/years.
 */
export function pluralizeYears(n: number, locale: PluralLocale | string = "ru"): string {
  switch (locale) {
    case "en":
      return `${n} ${n === 1 ? "year" : "years"}`;
    case "uz":
      return `${n} yosh`;
    case "ru":
    default:
      return `${n} ${ruForm(n, "год", "года", "лет")}`;
  }
}

/**
 * Склонение по ГОТОВЫМ ФОРМАМ ИЗ СЛОВАРЯ — для слов, которые живут не здесь.
 *
 * Функции выше знают свои слова наизусть («ученик», «год»). Но «счёт» лежит в
 * словаре тремя ключами (`dueOne`/`dueFew`/`dueMany`, три языка), и тащить
 * русские строки в код было бы вторым словарём. Здесь только ПРАВИЛО ВЫБОРА,
 * а сами формы приходят снаружи.
 *
 * Формы содержат `{n}` — он подставляется. ru: 1 счёт / 2 счёта / 5 счетов;
 * en: одна форма на 1 и другая на всё остальное; uz по числу не склоняет, и
 * там все три ключа заполнены одинаково — правило это не ломает.
 *
 * Заход 5 по оплатам: до него правило было списано вручную в веб-экране
 * оплат. Второй копии заводить не стали — мобильный берёт отсюда; веб надо
 * перевести сюда же при первом заходе, которому разрешено его править.
 */
export function pluralByForms(
  n: number,
  locale: PluralLocale | string,
  forms: { one: string; few: string; many: string },
): string {
  const template =
    locale === "ru"
      ? ruForm(n, forms.one, forms.few, forms.many)
      : n === 1
        ? forms.one
        : forms.many;
  return template.replace("{n}", String(n));
}

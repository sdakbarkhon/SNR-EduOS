/**
 * Время школы: одно правило на всех.
 *
 * ПРАВИЛО. У школы есть колонка `frozen_date` (тип `date`). Пусто — время
 * настоящее. Заполнено — время замерло на этой дате в час, заданный ниже.
 *
 * ПОЧЕМУ ЧАС ЖИВЁТ В КОДЕ, А ДЕНЬ В БАЗЕ. В колонке типа `date` есть день и
 * нет часа. День — источник правды, он у каждой школы свой. Час внутри дня —
 * общее оформительское решение: 10:15 Ташкента это середина второго урока
 * (09:55–10:40), при таком якоре сам собой встаёт вид «первый урок прошёл,
 * второй идёт, остальные впереди».
 *
 * ЗАЧЕМ ЗДЕСЬ, А НЕ В ПРИЛОЖЕНИИ. Правило нужно и вебу, и мобильному
 * приложению. У веба своя копия в apps/web/lib/school-time.ts, написанная
 * раньше; она остаётся как есть до отдельного разрешения её трогать. Этот
 * модуль — общее место, куда её предстоит свести.
 *
 * ТРЕТЬЕ ИЗЛОЖЕНИЕ ПОЯВИЛОСЬ 27.08.2026 — И ЭТО ОСОЗНАННО. Функция
 * `school_now(uuid)` из миграции 229 повторяет то же правило на SQL: она
 * нужна ежемесячному заданию по счетам, а задание живёт внутри Postgres и до
 * TypeScript не дотянется. Вынести его на Vercel нельзя — оба места под
 * расписание там заняты, и бесплатный тариф даёт запуск не чаще раза в сутки.
 *
 * Значит мест теперь ТРИ, и менять правило нужно во всех разом:
 *   * этот файл;
 *   * apps/web/lib/school-time.ts;
 *   * supabase/migrations/229_tuition_invoices_and_settlement.sql.
 * Четвёртой копии заводить нельзя: в этом проекте копии расходились семь раз.
 */

/** Час замороженного дня — середина второго урока по Ташкенту. */
export const FROZEN_TIME_OF_DAY_TASHKENT = "10:15";

/** Ташкент — фиксированный UTC+5, перехода на летнее время нет. */
export const TASHKENT_UTC_OFFSET = "+05:00";

/** Заморожена ли школа. Значение — как приходит из базы: «2026-07-29» или null. */
export function isSchoolFrozen(frozenDate: string | null | undefined): boolean {
  return !!frozenDate;
}

/**
 * «Сейчас» глазами школы.
 * Нет даты заморозки — настоящее время; есть — якорь на этой дате.
 */
export function schoolNowFrom(frozenDate: string | null | undefined): Date {
  if (!frozenDate) return new Date();
  return new Date(`${frozenDate}T${FROZEN_TIME_OF_DAY_TASHKENT}:00${TASHKENT_UTC_OFFSET}`);
}

/** То же числом — там, где сравнивают миллисекунды. */
export function schoolNowMsFrom(frozenDate: string | null | undefined): number {
  return schoolNowFrom(frozenDate).getTime();
}

/**
 * Дата заморозки школы вошедшего пользователя.
 *
 * Школу не выбираем и не угадываем: RLS уже сузила `schools` до своей
 * (миграция 190), поэтому берём единственную видимую строку. Если строк нет
 * или запрос отказал — возвращаем null, то есть «время настоящее»: для школы
 * без заморозки это и есть верный ответ, а для замороженной лучше показать
 * настоящее время, чем не показать ничего.
 */
export async function fetchSchoolFrozenDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
): Promise<string | null> {
  try {
    const { data, error } = await db.from("schools").select("frozen_date").limit(1).maybeSingle();
    if (error || !data) return null;
    return (data as { frozen_date: string | null }).frozen_date ?? null;
  } catch {
    return null;
  }
}

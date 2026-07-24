/**
 * Форматирование сумм (макет: «185 000 сум», «4 950 000 сум», «1 250 000»).
 * Разделитель — неразрывный пробел U+00A0 (в макете отображаются группы по 3 разряда).
 */

const NBSP = " ";

export function formatMoney(n: number, opts: { withCurrency?: boolean; currency?: string } = {}): string {
  const abs = Math.abs(Math.round(n));
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const signed = n < 0 ? "-" + grouped : grouped;
  return opts.withCurrency ? signed + NBSP + (opts.currency ?? "сум") : signed;
}

/**
 * format.ts — общие форматтеры UI для родительского приложения v2.
 *
 * formatMoney(n) → «1 250 000» (разряды разделены неразрывным пробелом
 * U+00A0, как в макете «SNR EduOS v2 Light.dc.html»: строки 383, 388, 391,
 * 404 — «1 250 000», «4 500 000», «450 000», «185 000»).
 *
 * Валюта («сум») не приклеивается здесь — она берётся из словаря
 * `parentApp.pay.sum` (RU/UZ/EN) и соединяется на месте вызова.
 */

const NBSP = " ";

/** Разбивает целую часть числа на разряды по 3 цифры и склеивает NBSP-ом. */
export function formatMoney(value: number): string {
  const n = Math.round(Math.abs(value));
  const s = String(n);
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    groups.unshift(s.slice(Math.max(0, i - 3), i));
  }
  const joined = groups.join(NBSP);
  return value < 0 ? `-${joined}` : joined;
}

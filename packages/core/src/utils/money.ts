/** Денежный формат. По умолчанию UZS без копеек. */
export function formatMoney(
  amount: number,
  currency = "UZS",
  locale = "ru-RU",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

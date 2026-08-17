"use client";

import { normalizeUzPhone } from "@snr/core";

/**
 * Поле номера телефона для форм админки.
 *
 * ЗАЧЕМ. Раньше это был обычный текстовый ввод с подсказкой «+998 90 123 45 67»
 * в placeholder. Было непонятно, писать ли плюс, ставить ли пробелы, вводить ли
 * код страны — администратор гадал, и в базу уходило что придётся. Сделано так
 * же, как на экране входа в приложении, где это уже решено: код страны стоит
 * отдельно и не стирается, человек вводит только девять цифр.
 *
 * ЧТО ВВОДИТСЯ. Ровно девять цифр. Буквы, плюсы, скобки и любые другие символы
 * не попадают в поле вовсе — не «подсвечиваются красным потом», а просто не
 * вводятся. Пробелы расставляются сами по мере набора: `90 123 45 67`.
 *
 * ЧТО УХОДИТ В БАЗУ. Тот же формат, что там уже лежит: `+998912345678`, без
 * пробелов (проверено — в parents.phone ровно такой вид, 13 символов).
 * Приведением занимается normalizeUzPhone из ядра — та же функция, которой
 * пользуется вход по телефону, так что второй трактовки номера не появляется.
 *
 * СТАРЫЕ ЗАПИСИ. `digitsFromStored` вытаскивает девять цифр из любого вида,
 * который мог накопиться: с `+998`, с `998`, с пробелами и скобками. Поэтому
 * карточка уже заведённого родителя открывается с заполненным полем.
 */

/** Девять цифр номера из того, что лежит в базе (или из пустоты). */
export function digitsFromStored(stored: string | null | undefined): string {
  const digits = (stored ?? "").replace(/\D/g, "");
  // +998 90 123 45 67 → 998901234567 → берём последние девять.
  return digits.slice(-9);
}

/** `901234567` → `90 123 45 67`. Ровно как на экране входа в приложении. */
export function formatUzDigits(digits: string): string {
  const d = digits.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
}

/** Девять цифр → то, что уходит в базу. Пусто, если цифр не девять. */
export function storedFromDigits(digits: string): string {
  if (digits.length !== 9) return "";
  return normalizeUzPhone(`+998${digits}`) ?? `+998${digits}`;
}

export function AdminPhoneInput({
  digits,
  onChange,
  required,
  id,
}: {
  /** Девять цифр без кода страны — состояние держит форма. */
  digits: string;
  onChange: (digits: string) => void;
  required?: boolean;
  id?: string;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-gray-50 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-200">
      <span className="flex select-none items-center border-r border-gray-200 bg-gray-100 px-3 text-sm font-semibold text-gray-500">
        +998
      </span>
      <input
        id={id}
        value={formatUzDigits(digits)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
        required={required}
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        aria-describedby={id ? `${id}-hint` : undefined}
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
      />
    </div>
  );
}

"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Таблица только на чтение — одна на все десять экранов просмотра.
 *
 * ПОЧЕМУ СВОЯ, А НЕ ТАБЛИЦЫ ИЗ АДМИНКИ. Решение заказчика: экраны админа школы
 * не переиспользуются и не трогаются вовсе. Там в каждой строке живут кнопки
 * правки, сброса пароля и удаления, и приделывать к ним признак «только
 * просмотр» значило бы менять экраны, на которых каждый день работают
 * настоящие администраторы. Здесь кнопок нет вовсе — не погашенных, а
 * отсутствующих: погашенная кнопка обещает то, чего экран выполнить не может.
 *
 * Заголовки колонок приходят готовыми строками из словаря: таблица про
 * раскладку, а не про переводы.
 */

export type Колонка = {
  key: string;
  label: string;
  /** Числа и даты прижимаем вправо — так столбец читается сверху вниз. */
  right?: boolean;
  /** Узкая колонка: не растягивать. */
  narrow?: boolean;
};

export function ViewTable({
  title,
  columns,
  rows,
  note,
}: {
  title: string;
  columns: Колонка[];
  rows: Array<Record<string, string | number | null>>;
  note?: string;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).superadmin;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>
        <span className="text-[12px] text-gray-500">{t.svRows.replace("{n}", String(rows.length))}</span>
      </div>
      {note && <p className="mt-1 text-[12px] text-gray-500">{note}</p>}

      <div className="mt-3 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 ${c.right ? "text-right" : ""} ${c.narrow ? "w-px whitespace-nowrap" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                  {t.svEmpty}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={String(r.id ?? i)}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 text-gray-700 ${c.right ? "text-right tabular-nums" : ""} ${c.narrow ? "whitespace-nowrap" : ""}`}
                  >
                    {r[c.key] === null || r[c.key] === undefined || r[c.key] === "" ? "—" : String(r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Плитка со числом для экрана обзора. */
export function ViewStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-[22px] font-bold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

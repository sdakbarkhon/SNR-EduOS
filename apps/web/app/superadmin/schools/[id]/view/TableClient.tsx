"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ViewTable, type Колонка } from "@/components/superadmin/ViewTable";

/**
 * Мостик между серверной страницей и таблицей.
 *
 * Страница считает данные и знает, КАКИЕ колонки показать, но не знает, как
 * они называются на языке смотрящего: словарь живёт в браузере. Поэтому
 * страница передаёт КЛЮЧИ подписей, а здесь они превращаются в слова.
 */
export function TableClient({
  titleKey,
  noteKey,
  columns,
  rows,
}: {
  titleKey: string;
  noteKey?: string;
  columns: Array<{ key: string; labelKey: string; right?: boolean; narrow?: boolean }>;
  rows: Array<Record<string, string | number | null>>;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).superadmin as unknown as Record<string, string>;
  const cols: Колонка[] = columns.map((c) => ({
    key: c.key, label: t[c.labelKey] ?? c.labelKey, right: c.right, narrow: c.narrow,
  }));
  return (
    <ViewTable
      title={t[titleKey] ?? titleKey}
      note={noteKey ? t[noteKey] : undefined}
      columns={cols}
      rows={rows}
    />
  );
}

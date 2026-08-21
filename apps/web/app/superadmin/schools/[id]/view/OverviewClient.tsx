"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ViewStat } from "@/components/superadmin/ViewTable";

export function OverviewClient({
  stats,
  card,
}: {
  stats: Array<{ labelKey: string; value: number }>;
  card: Array<{ labelKey: string; value: string | null }>;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).superadmin as unknown as Record<string, string>;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-[17px] font-bold text-gray-900">{t.svOverviewCounts}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((s) => (
            <ViewStat key={s.labelKey} label={t[s.labelKey] ?? s.labelKey} value={s.value} />
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-[17px] font-bold text-gray-900">{t.svOverviewCard}</h2>
        <dl className="mt-3 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {card.map((f) => (
            <div key={f.labelKey} className="flex flex-wrap gap-2 px-4 py-3">
              <dt className="w-48 shrink-0 text-[12px] font-bold uppercase tracking-wide text-gray-500">
                {t[f.labelKey] ?? f.labelKey}
              </dt>
              <dd className="min-w-0 flex-1 break-words text-sm text-gray-800">{f.value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

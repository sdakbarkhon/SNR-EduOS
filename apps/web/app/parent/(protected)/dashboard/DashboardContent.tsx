"use client";

import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

type Kid = { id: string; full_name: string; className: string | null };

export function DashboardContent({ fullName, kids }: { fullName: string; kids: Kid[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentDashboard;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.greeting.replace("{name}", fullName)}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.comingSoon}</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{t.childrenTitle}</h2>
        {kids.length === 0 ? (
          <p className="text-sm text-gray-400">{t.noChildren}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {kids.map((k) => (
              <li key={k.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{k.full_name}</p>
                  {k.className && <p className="text-xs text-gray-400">{k.className}</p>}
                </div>
                <span className="cursor-not-allowed text-sm font-medium text-pink-300">
                  {t.childProfileLink}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

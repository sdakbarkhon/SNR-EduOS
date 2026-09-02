"use client";

// Список школ менеджера. Заход 2 — только чтение.
//
// ПОИСК ЕСТЬ, ФИЛЬТРА РОЛЕЙ НЕТ. Заказчик просил, «чтобы всё фильтровалось и
// чётко было различно»: школ единицы, и единственное, что тут стоит
// фильтровать, — это сами школы по названию и коду. Городить фильтры по
// признакам, которых у школы три, значило бы сделать экран тяжелее без
// пользы.

import { useState } from "react";
import Link from "next/link";
import { School, Search, ArrowRight } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SchoolMark } from "@/components/SchoolMark";
import { useLogout, LogoutOverlay } from "@/components/LogoutOverlay";

type Школа = {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  logoUrl: string | null;
};

export function ManagerSchoolsView({
  schools, viewerName,
}: {
  schools: Школа[];
  viewerName: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).superadmin;
  const [search, setSearch] = useState("");
  const { loggingOut, logout } = useLogout();

  const запрос = search.trim().toLowerCase();
  const видимые = запрос
    ? schools.filter((s) =>
      s.name.toLowerCase().includes(запрос) || (s.code ?? "").toLowerCase().includes(запрос))
    : schools;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <School className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{d.mgrSchoolsTitle}</h1>
            <p className="text-sm text-zinc-500">{viewerName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          {d.mgrHomeLogout}
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={d.mgrSchoolsSearch}
          className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-violet-400"
        />
      </div>

      {видимые.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-10 text-center text-sm text-zinc-400">
          {schools.length === 0 ? d.mgrSchoolsEmpty : d.mgrSchoolsNoResults}
        </p>
      ) : (
        <ul className="space-y-2">
          {видимые.map((s) => (
            <li key={s.id}>
              <Link
                href={`/manager/schools/${s.id}/view`}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/40"
              >
                <SchoolMark name={s.name} logoUrl={s.logoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-800">
                    {s.name}
                    {/* Архивная школа показывается с меткой — ровно как у
                        суперадмина. Прятать значило бы заставить думать, что
                        школы никогда не было. */}
                    {!s.isActive && (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                        {d.schoolArchivedBadge}
                      </span>
                    )}
                  </p>
                  {s.code && <p className="truncate text-xs text-zinc-400">{s.code}</p>}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-zinc-400">{d.mgrSchoolsReadOnly}</p>
      {loggingOut && <LogoutOverlay />}
    </div>
  );
}

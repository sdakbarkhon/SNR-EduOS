"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Eye, LogOut } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Оболочка экранов «суперадмин смотрит школу».
 *
 * ЯНТАРНАЯ ПОЛОСА СВЕРХУ — не украшение. Каркас админки синий, каркас
 * суперадмина серый, и человек, попавший сюда, обязан понимать боковым
 * зрением, что он не у себя и не в роли администратора школы, а в гостях и
 * только смотрит. Поэтому третий цвет, название школы прямо в полосе и выход
 * рядом.
 *
 * ВЫХОД — ЭТО ПРОСТО УХОД С АДРЕСА. Ни куки, ни срока, ни состояния на
 * сервере: «где я сейчас» написано в самом адресе. Отсюда два следствия,
 * которые нам нужны: закрытая вкладка не оставляет ничего, а две вкладки с
 * разными школами не путаются между собой.
 */

const ВКЛАДКИ = [
  { seg: "", key: "svTabOverview" },
  { seg: "groups", key: "svTabGroups" },
  { seg: "students", key: "svTabStudents" },
  { seg: "teachers", key: "svTabTeachers" },
  { seg: "parents", key: "svTabParents" },
  { seg: "subjects", key: "svTabSubjects" },
  { seg: "assignments", key: "svTabAssignments" },
  { seg: "marks", key: "svTabMarks" },
  { seg: "announcements", key: "svTabAnnouncements" },
  { seg: "analytics", key: "svTabAnalytics" },
] as const;

export function SchoolViewShell({
  schoolId,
  schoolName,
  isDemo,
  children,
}: {
  schoolId: string;
  schoolName: string;
  isDemo: boolean;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).superadmin;
  const pathname = usePathname();

  const база = `/superadmin/schools/${schoolId}/view`;
  const хвост = pathname.startsWith(база) ? pathname.slice(база.length).replace(/^\//, "") : "";

  return (
    <div className="mx-auto max-w-6xl">
      {/* Полоса гостя. Стоит выше всего и не уезжает при прокрутке содержимого. */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3">
        <Eye className="h-5 w-5 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-amber-900">
            {schoolName}
            {isDemo && <span className="ml-2 text-[11px] font-medium text-amber-700">{t.svDemoMark}</span>}
          </p>
          <p className="text-[12px] text-amber-800">{t.svReadOnly}</p>
        </div>
        <Link
          href="/superadmin/schools"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-[13px] font-medium text-amber-900 hover:bg-amber-100"
        >
          <LogOut className="h-4 w-4" />
          {t.svExit}
        </Link>
      </div>

      <nav className="mt-4 flex flex-wrap gap-1.5">
        {ВКЛАДКИ.map((v) => {
          const href = v.seg ? `${база}/${v.seg}` : база;
          const active = хвост === v.seg;
          return (
            <Link
              key={v.seg || "overview"}
              href={href}
              className={
                "rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors " +
                (active
                  ? "bg-slate-800 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50")
              }
            >
              {t[v.key]}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">{children}</div>
    </div>
  );
}

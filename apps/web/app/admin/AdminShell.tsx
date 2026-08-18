"use client";

import type { ReactNode } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminSectionHint } from "@/components/AdminSectionHint";
import { SchoolMark } from "@/components/SchoolMark";
import { useLocale } from "@/components/LocaleProvider";
import { firstName } from "@/lib/person-name";

export function AdminShell({
  adminName,
  schoolName,
  schoolLogoUrl,
  children,
}: {
  adminName: string;
  /** Может не быть: у админа без школы шапка показывает только продукт. */
  schoolName: string | null;
  schoolLogoUrl: string | null;
  children: ReactNode;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)" }}
    >
      <AdminSidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Subtle top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-violet-100/60 bg-white/60 px-6 backdrop-blur-md">
          {/* Слева — в какой школе админ. Название продукта осталось, но ушло
              на второй план: админ работает в школе, а не в продукте, и
              перепутать школу опаснее, чем не увидеть слово Admin. */}
          <div className="flex min-w-0 items-center gap-2.5">
            {schoolName ? (
              <>
                <SchoolMark name={schoolName} logoUrl={schoolLogoUrl} size="sm" />
                <span className="truncate text-[14px] font-semibold text-gray-700">{schoolName}</span>
                <span className="hidden shrink-0 text-[13px] text-gray-400 sm:inline">· SNR EduOS</span>
              </>
            ) : (
              <span className="text-[14px] font-semibold text-gray-700">SNR EduOS — Admin</span>
            )}
          </div>

          {/* Справа — приветствие по имени, а не голая строка из базы. */}
          <span className="shrink-0 text-[13px] text-gray-500">
            {d.admin.greeting.replace("{name}", firstName(adminName))}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-8 pt-6 md:px-8">
          {children}
          {/* Подсказка раздела — одна на весь каркас, выбирается по адресу.
              Внизу страницы, мелко и приглушённо: не баннер и не окно. */}
          <AdminSectionHint />
        </main>
      </div>
    </div>
  );
}

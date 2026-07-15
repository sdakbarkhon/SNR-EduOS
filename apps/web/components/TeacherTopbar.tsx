"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { teacherNavItems } from "./TeacherSidebar";
import { NotificationsBell } from "./NotificationsBell";
import { AnnouncementTicker } from "./AnnouncementTicker";

export function TeacherTopbar({
  headerInfo,
}: {
  headerInfo: ReactNode;
}) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  // Same {href, label} list and same startsWith matching TeacherSidebar uses
  // for its own active-item highlight — every /teacher/* route is nested
  // under one of these 12 prefixes, so this covers dynamic routes like
  // /teacher/lessons/[id] or /teacher/homework/new too.
  const navItem = teacherNavItems.find((item) => pathname.startsWith(item.href));
  const pageTitle = navItem?.label(d) ?? "";

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full shrink-0 items-center justify-between gap-4 bg-white/20 px-4 backdrop-blur-sm md:px-8">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[20px] font-black tracking-tight text-gray-800 md:text-[24px]">
          {pageTitle}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-5">
        <AnnouncementTicker onlyFromAdmins />
        <NotificationsBell />

        {headerInfo}
      </div>
    </header>
  );
}

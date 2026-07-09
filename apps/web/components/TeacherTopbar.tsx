"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { NotificationsBell } from "./NotificationsBell";
import { AnnouncementTicker } from "./AnnouncementTicker";

export function TeacherTopbar({
  headerInfo,
}: {
  headerInfo: ReactNode;
}) {
  const pathname = usePathname();
  const showSearch = pathname !== "/teacher/lessons";

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full shrink-0 items-center justify-between bg-white/20 px-4 backdrop-blur-sm md:px-8">
      {/* Search (hidden on /teacher/lessons) */}
      <div className={`group relative max-w-sm flex-1 ${showSearch ? "" : "invisible pointer-events-none"}`}>
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <Search className="h-5 w-5 text-gray-400 transition-colors group-focus-within:text-blue-600" />
        </div>
        <input
          type="text"
          placeholder="Поиск по ученикам, заданиям..."
          className="w-full rounded-[16px] border border-white/40 bg-white/60 py-3 pl-12 pr-4 text-sm font-medium text-gray-700 shadow-sm backdrop-blur-xl outline-none transition-all placeholder:text-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      <div className="flex items-center gap-3 md:gap-5">
        <AnnouncementTicker onlyFromAdmins />
        <NotificationsBell />

        {headerInfo}
      </div>
    </header>
  );
}

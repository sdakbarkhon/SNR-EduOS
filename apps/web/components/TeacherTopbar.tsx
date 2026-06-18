"use client";

import { Bell, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";

export function TeacherTopbar({
  name,
  subtitle,
  avatarUrl,
}: {
  name: string;
  subtitle?: string;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname();
  const showSearch = pathname !== "/teacher/lessons";

  return (
    <header className="relative z-10 flex h-20 w-full shrink-0 items-center justify-between px-4 md:px-8">
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
        <button
          type="button"
          aria-label="Уведомления"
          className="group relative flex h-11 w-11 items-center justify-center rounded-[12px] border border-white/40 bg-white/60 text-gray-600 shadow-[0_4px_16px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-colors hover:bg-white/80 hover:text-blue-600"
        >
          <Bell className="h-5 w-5 transition-transform group-hover:scale-110" />
          <span className="absolute right-3 top-3 h-2 w-2 rounded-full border border-white bg-blue-600" />
        </button>

        <div className="flex items-center gap-3 rounded-[16px] border border-white/40 bg-white/60 py-2 pl-2 pr-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] backdrop-blur-xl">
          <Avatar name={name || "?"} src={avatarUrl ?? undefined} size={36} />
          <div className="hidden max-w-[200px] flex-col sm:flex">
            <span className="truncate text-sm font-semibold leading-tight text-gray-800">{name}</span>
            {subtitle && (
              <span className="mt-0.5 truncate whitespace-nowrap text-[10px] font-medium leading-tight text-gray-500">{subtitle}</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { ChevronDown, Star } from "lucide-react";
import { Avatar } from "./Avatar";
import { LogoutButton } from "./LogoutButton";
import { NotificationsBell } from "./NotificationsBell";
import { AnnouncementTicker } from "./AnnouncementTicker";

export function Topbar({
  title,
  studentName,
  avatarUrl,
  classLabel,
}: {
  title: string;
  studentName?: string;
  avatarUrl?: string | null;
  classLabel?: string;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 rounded-[20px] bg-white py-3 pl-6 pr-4 shadow-[0_8px_22px_rgba(93,80,150,0.05)]">
      {/* Промт 6.2.1: длинные заголовки ("Посещаемость", "База знаний")
          толкали правую часть шапки за край на планшете — обёртка теперь
          min-w-0 flex-1 (может сжиматься), h1 truncate + title-tooltip. */}
      <div className="min-w-0 flex-1">
        <h1 title={title} className="truncate text-[20px] font-black tracking-tight text-[#2A2A45] md:text-[24px]">
          {title}
        </h1>
      </div>

      <div className="flex min-w-0 flex-1 items-center">
        <AnnouncementTicker stretch />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* Баллы — заглушка без БД */}
        <div className="hidden items-center gap-1.5 rounded-2xl border border-[#EFEEF3] bg-white px-3.5 py-2 sm:flex">
          <Star className="h-4 w-4 fill-[#FFB020] text-[#FFB020]" />
          <span className="text-sm font-extrabold text-[#2A2A45]">1050</span>
        </div>

        <NotificationsBell />

        {studentName && (
          <Link
            href="/profile"
            className="flex items-center gap-2.5 rounded-2xl px-2.5 py-1.5 transition hover:bg-[#F4F2FC]"
          >
            <Avatar name={studentName} src={avatarUrl ?? undefined} size={40} />
            <div className="hidden flex-col items-start leading-tight lg:flex">
              <span className="text-[14px] font-extrabold text-[#2A2A45]">{studentName}</span>
              {classLabel && <span className="text-[12px] font-semibold text-[#9A9AB5]">{classLabel}</span>}
            </div>
            <ChevronDown className="hidden h-[18px] w-[18px] text-[#B7B7CE] lg:block" />
          </Link>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}

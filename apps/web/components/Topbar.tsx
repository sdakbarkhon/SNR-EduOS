"use client";

import Link from "next/link";
import { ChevronDown, MessageCircle, Star } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { Avatar } from "./Avatar";
import { LogoutButton } from "./LogoutButton";
import { NotificationsBell } from "./NotificationsBell";
import { AnnouncementTicker } from "./AnnouncementTicker";
import { useLocale } from "./LocaleProvider";
import { useToast } from "./Toast";

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
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const showToast = useToast();

  return (
    <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-3 md:px-8">
      <h1 className="text-[18px] font-semibold text-gray-800 md:text-[20px]">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <AnnouncementTicker />

        {/* Баллы — заглушка без БД (Iter5 P5) */}
        <div className="hidden items-center gap-1.5 rounded-full border border-slate-100 bg-white px-3 py-2 shadow-sm sm:flex">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-bold text-slate-800">1050</span>
        </div>

        {/* Сообщения — заглушка (Iter5 P5) */}
        <button
          onClick={() => showToast(d.auth.comingSoon)}
          aria-label={d.nav.messages}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50"
        >
          <MessageCircle className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 text-[9px] font-bold text-white">
            5
          </span>
        </button>

        <NotificationsBell />
        {studentName && (
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-slate-50"
          >
            <Avatar name={studentName} src={avatarUrl ?? undefined} size={40} />
            <div className="hidden flex-col items-start lg:flex">
              <span className="text-sm font-semibold text-slate-900">
                {studentName}
              </span>
              {classLabel && <span className="text-xs text-slate-500">{classLabel}</span>}
            </div>
            <ChevronDown className="hidden h-4 w-4 text-slate-400 lg:block" />
          </Link>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}

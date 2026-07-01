import Link from "next/link";
import { ChevronDown } from "lucide-react";
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
    <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-3 md:px-8">
      <h1 className="text-[18px] font-semibold text-gray-800 md:text-[20px]">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <AnnouncementTicker />
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

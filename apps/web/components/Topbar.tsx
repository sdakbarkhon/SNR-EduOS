import Link from "next/link";
import { Avatar } from "./Avatar";
import { LogoutButton } from "./LogoutButton";
import { NotificationsBell } from "./NotificationsBell";
import { AnnouncementTicker } from "./AnnouncementTicker";

export function Topbar({
  title,
  studentName,
  avatarUrl,
}: {
  title: string;
  studentName?: string;
  avatarUrl?: string | null;
}) {
  return (
    <header className="flex items-center justify-between border-b px-5 py-3 backdrop-blur-md md:px-8" style={{ background: "var(--topbar-bg)", borderColor: "var(--topbar-border)" }}>
      <h1 className="text-[18px] font-semibold text-gray-800 dark:text-slate-100 md:text-[20px]">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <AnnouncementTicker />
        <NotificationsBell />
        {studentName && (
          <Link href="/profile" className="transition-transform hover:scale-105">
            <Avatar name={studentName} src={avatarUrl ?? undefined} />
          </Link>
        )}
        <LogoutButton />
      </div>
    </header>
  );
}

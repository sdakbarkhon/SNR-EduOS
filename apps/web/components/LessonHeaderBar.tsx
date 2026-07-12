import type { ReactNode } from "react";
import { LessonSubjectIcon } from "@/components/LessonSubjectIcon";

/** Consistent pill used in the header's metadata row (timer, status, group, room, etc.). */
export function LessonHeaderPill({
  icon,
  children,
  tone = "neutral",
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: "neutral" | "live" | "done";
}) {
  const toneCls =
    tone === "live" ? "border-green-100 bg-green-50 text-green-700"
    : tone === "done" ? "border-slate-200 bg-slate-50 text-slate-500"
    : "border-[#ECEDF4] bg-white text-[#5B6178]";
  return (
    <span className={`flex items-center gap-2 rounded-[12px] border px-3 py-2 text-sm font-bold ${toneCls}`}>
      {icon}
      {children}
    </span>
  );
}

/**
 * Shared header bar for all lesson surfaces (student workspace, teacher
 * detail, completed hero). Layout: icon + subject/title on the left (the
 * single most prominent element), role-specific action buttons grouped on
 * the right, metadata pills (timer/status/group/room/...) on their own row
 * below — kept separate from the buttons so actions never compete with
 * status info for space. Wraps to 2 lines under ~900px; both rows stay on
 * one line each down to tablet width since every item here is a compact pill.
 */
export function LessonHeaderBar({
  subjectIcon,
  subjectColor,
  subjectName,
  title,
  actions,
  pills,
}: {
  subjectIcon: string | null | undefined;
  subjectColor: string | null | undefined;
  subjectName: string;
  title: string;
  actions: ReactNode;
  pills: ReactNode;
}) {
  const accent = subjectColor || "#6A4FE6";
  return (
    <header className="rounded-2xl border border-[#ECEDF4] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <LessonSubjectIcon icon={subjectIcon ?? undefined} color={accent} size={44} />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-extrabold uppercase tracking-wide" style={{ color: accent }}>
              {subjectName}
            </p>
            {/* Промт 6.2: было truncate — на планшете длинная тема урока
                обрезалась ("Arduino: ...(bli..."). Переносится на 2-3
                строки вместо ellipsis. */}
            <h1 className="line-clamp-3 text-xl font-black leading-tight text-[#242A45] md:text-2xl">{title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">{pills}</div>
    </header>
  );
}

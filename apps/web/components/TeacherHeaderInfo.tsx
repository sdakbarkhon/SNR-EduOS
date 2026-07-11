import { getSubjectConfig } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { getMyTeacher } from "@/lib/cached-queries";
import { Avatar } from "./Avatar";

/**
 * Fetches teacher name/avatar/subject and renders the topbar identity block.
 * Split out from teacher/layout.tsx + rendered inside a <Suspense> boundary so
 * the sidebar/topbar shell (and {children}, the actual page) don't wait on
 * this Supabase round trip before painting.
 */
export async function TeacherHeaderInfo() {
  const supabase = await createClient();

  let teacherName = "";
  let avatarUrl: string | null = null;
  let teacherSubtitle = "";
  try {
    const teacher = await getMyTeacher(supabase);
    teacherName = teacher.full_name ?? "";
    avatarUrl = teacher.avatar_url ?? null;
    // subject_slug=NULL — куратор (teacher_karim), доступ ко всем предметам,
    // а не "Программирование" из legacy groups.subject (одинаковое во всех группах).
    teacherSubtitle = teacher.subject_slug ? getSubjectConfig(teacher.subject_slug).label : "Куратор";
  } catch (err) {
    console.error("[TeacherHeaderInfo] getMyTeacher failed:", err);
  }

  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-white/40 bg-white/60 py-2 pl-2 pr-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <Avatar name={teacherName || "?"} src={avatarUrl ?? undefined} size={36} />
      <div className="hidden max-w-[200px] flex-col sm:flex">
        <span className="truncate text-sm font-semibold leading-tight text-gray-800">{teacherName}</span>
        {teacherSubtitle && (
          <span className="mt-0.5 truncate whitespace-nowrap text-[10px] font-medium leading-tight text-gray-500">{teacherSubtitle}</span>
        )}
      </div>
    </div>
  );
}

/** Skeleton fallback matching TeacherHeaderInfo's dimensions — avoids layout shift while it streams in. */
export function TeacherHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-white/40 bg-white/60 py-2 pl-2 pr-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)] backdrop-blur-xl">
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-gray-300/60" />
      <div className="hidden max-w-[200px] flex-col gap-1 sm:flex">
        <div className="h-3.5 w-24 animate-pulse rounded bg-gray-300/60" />
        <div className="h-2.5 w-16 animate-pulse rounded bg-gray-300/50" />
      </div>
    </div>
  );
}

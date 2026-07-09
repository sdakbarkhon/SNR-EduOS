import { getMyTeacher, getTeacherGroups, getSubjectConfig } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "./Avatar";

/**
 * Fetches teacher name/avatar/subjects and renders the topbar identity block.
 * Split out from teacher/layout.tsx + rendered inside a <Suspense> boundary so
 * the sidebar/topbar shell (and {children}, the actual page) don't wait on
 * these two Supabase round trips before painting.
 */
export async function TeacherHeaderInfo() {
  const supabase = await createClient();

  const [teacherResult, groupsResult] = await Promise.allSettled([
    getMyTeacher(supabase),
    getTeacherGroups(supabase),
  ]);

  let teacherName = "";
  let avatarUrl: string | null = null;
  if (teacherResult.status === "fulfilled") {
    teacherName = teacherResult.value.full_name ?? "";
    avatarUrl = teacherResult.value.avatar_url ?? null;
  } else {
    console.error("[TeacherHeaderInfo] getMyTeacher failed:", teacherResult.reason);
  }

  let teacherSubtitle = "";
  if (groupsResult.status === "fulfilled") {
    const subjects = Array.from(new Set(groupsResult.value.map((g) => getSubjectConfig(g.subject).label)));
    teacherSubtitle = subjects.length <= 2
      ? subjects.join(" · ")
      : `${subjects.slice(0, 2).join(" · ")} · ещё ${subjects.length - 2}`;
  } else {
    console.error("[TeacherHeaderInfo] getTeacherGroups failed:", groupsResult.reason);
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

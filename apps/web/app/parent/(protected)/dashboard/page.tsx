import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStudentLessonsForDate, getStudentGrades, getHomeworkWithSubmissions } from "@snr/core";
import { getParentContext, resolveSelectedChild, SELECTED_CHILD_COOKIE } from "@/lib/parent-context";
import { safeQuery } from "@/lib/safe-query";
import { DashboardContent } from "./DashboardContent";

function getTashkentToday(): string {
  const tashkentMs = Date.now() + 5 * 60 * 60 * 1000;
  return new Date(tashkentMs).toISOString().slice(0, 10);
}

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const ctx = await getParentContext();
  if (!ctx) redirect("/login");

  const sp = await searchParams;
  const cookieStore = await cookies();
  const requestedId = sp.child ?? cookieStore.get(SELECTED_CHILD_COOKIE)?.value ?? null;
  const selected = resolveSelectedChild(ctx.children, requestedId);
  const today = getTashkentToday();

  if (!selected) {
    return (
      <DashboardContent
        parentName={ctx.parentName}
        child={null}
        today={today}
        lessons={[]}
        weekGrades={[]}
        pendingHomework={[]}
      />
    );
  }

  const db = await createClient();
  const todayStart = new Date(`${today}T00:00:00+05:00`).getTime();
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const [lessonsRes, gradesRes, homeworkRes] = await Promise.all([
    safeQuery(getStudentLessonsForDate(db, today, selected.id), [], "ParentDashboardPage.lessons"),
    safeQuery(getStudentGrades(db, selected.id), [], "ParentDashboardPage.grades"),
    safeQuery(getHomeworkWithSubmissions(db, selected.id), [], "ParentDashboardPage.homework"),
  ]);

  const weekGrades = gradesRes.data
    .filter((g) => g.date && new Date(g.date).getTime() >= weekAgoMs)
    .slice(0, 10);

  const pendingHomework = homeworkRes.data
    .filter((h) => !h.submission && !h.test_submission && (!h.due_date || new Date(h.due_date).getTime() >= todayStart))
    .slice(0, 5);

  return (
    <DashboardContent
      parentName={ctx.parentName}
      child={selected}
      today={today}
      lessons={lessonsRes.data}
      weekGrades={weekGrades}
      pendingHomework={pendingHomework}
      lessonsError={lessonsRes.failed}
      gradesError={gradesRes.failed}
      homeworkError={homeworkRes.failed}
    />
  );
}

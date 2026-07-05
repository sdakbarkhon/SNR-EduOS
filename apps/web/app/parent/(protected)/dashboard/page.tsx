import { createClient } from "@/lib/supabase/server";
import { DashboardContent } from "./DashboardContent";

export default async function ParentDashboardPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: parent } = await sb.from("parents").select("id, full_name").eq("user_id", user!.id).single();

  const { data: links } = await sb.from("parent_students").select("student_id").eq("parent_id", parent.id);
  const studentIds = ((links ?? []) as { student_id: string }[]).map((l) => l.student_id);

  let kids: { id: string; full_name: string; className: string | null }[] = [];
  if (studentIds.length > 0) {
    const { data: students } = await sb
      .from("students")
      .select("id, full_name, student_groups(groups(name))")
      .in("id", studentIds);

    kids = ((students ?? []) as any[]).map((s) => {
      const groupNames: string[] = (s.student_groups ?? [])
        .map((sg: any) => sg.groups?.name)
        .filter(Boolean);
      const className = groupNames.find((n) => n.includes("класс")) ?? groupNames[0] ?? null;
      return { id: s.id, full_name: s.full_name, className };
    });
  }

  return <DashboardContent fullName={parent.full_name} kids={kids} />;
}

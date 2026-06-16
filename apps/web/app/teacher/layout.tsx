import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMyTeacher } from "@snr/core";
import { TeacherShell } from "@/components/TeacherShell";
import { createClient } from "@/lib/supabase/server";
import { isTeacherEmail } from "@snr/core";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !isTeacherEmail(user.email)) redirect("/login");

  let teacherName = "";
  try {
    const teacher = await getMyTeacher(supabase);
    teacherName = teacher.full_name ?? "";
  } catch {
    // no teacher record yet
  }

  return <TeacherShell teacherName={teacherName}>{children}</TeacherShell>;
}

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMyStudent } from "@snr/core";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let studentName = "";
  try {
    const student = await getMyStudent(supabase);
    studentName = student.full_name;
  } catch {
    // профиль не найден — оставим пустым
  }

  return <AppShell studentName={studentName}>{children}</AppShell>;
}

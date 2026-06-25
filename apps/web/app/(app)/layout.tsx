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
  let avatarUrl: string | null = null;
  try {
    const student = await getMyStudent(supabase);
    studentName = student.full_name;
    avatarUrl = (student as { avatar_url?: string | null }).avatar_url ?? null;
  } catch {
    // профиль не найден — оставим пустым
  }

  return <AppShell studentName={studentName} avatarUrl={avatarUrl}>{children}</AppShell>;
}

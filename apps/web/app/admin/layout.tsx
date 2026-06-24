import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "./AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify admin role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (supabase as any)
    .from("admins")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();

  if (!admin) redirect("/login");

  return <AdminShell adminName={(admin as { full_name: string }).full_name}>{children}</AdminShell>;
}

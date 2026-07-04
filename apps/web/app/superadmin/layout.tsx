import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SuperAdminShell } from "./SuperAdminShell";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify super_admin role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: superAdmin } = await (supabase as any)
    .from("super_admins")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();

  if (!superAdmin) redirect("/login");

  return (
    <SuperAdminShell adminName={(superAdmin as { full_name: string }).full_name}>
      {children}
    </SuperAdminShell>
  );
}

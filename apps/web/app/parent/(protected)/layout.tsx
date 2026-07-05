import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentShell } from "./ParentShell";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: parent } = await (supabase as any)
    .from("parents")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();

  if (!parent) redirect("/login");

  return (
    <ParentShell parentName={(parent as { full_name: string }).full_name}>
      {children}
    </ParentShell>
  );
}

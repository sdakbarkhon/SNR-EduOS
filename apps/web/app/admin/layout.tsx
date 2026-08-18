import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signLogoUrl } from "@/lib/school-card";
import { AdminShell } from "./AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify admin role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (supabase as any)
    .from("admins")
    .select("id, full_name, school_id")
    .eq("user_id", user.id)
    .single();

  if (!admin) redirect("/login");

  // Школа читается ПОД СЕССИЕЙ АДМИНА, а не служебным ключом. Это не мелочь:
  // политика «authenticated reads own school» отдаёт ровно одну строку — свою.
  // Читай мы служебным ключом, чужую школу вернуло бы молча, и ошибка в
  // school_id обернулась бы чужим логотипом в шапке.
  let school: { name: string; logo_path: string | null } | null = null;
  if (admin.school_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("schools")
      .select("name, logo_path")
      .eq("id", admin.school_id)
      .maybeSingle();
    school = data as { name: string; logo_path: string | null } | null;
  }

  return (
    <AdminShell
      adminName={(admin as { full_name: string }).full_name}
      schoolName={school?.name ?? null}
      schoolLogoUrl={await signLogoUrl(school?.logo_path)}
    >
      {children}
    </AdminShell>
  );
}

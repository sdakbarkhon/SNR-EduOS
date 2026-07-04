import { createClient } from "@/lib/supabase/server";
import { getUserEmails } from "@/lib/admin-api";
import { AdminsView } from "./AdminsView";

export default async function SuperAdminAdminsPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const { action } = await searchParams;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const [{ data: admins }, { data: schools }] = await Promise.all([
    sb.from("admins").select("id, user_id, full_name, school_id, created_at").order("full_name"),
    sb.from("schools").select("id, name").order("name"),
  ]);

  const adminRows = (admins ?? []) as {
    id: string; user_id: string | null; full_name: string; school_id: string; created_at: string;
  }[];
  const schoolRows = (schools ?? []) as { id: string; name: string }[];
  const emails = await getUserEmails(adminRows.map((a) => a.user_id).filter((id): id is string => !!id));

  return (
    <AdminsView
      admins={adminRows}
      schools={schoolRows}
      emails={emails}
      defaultOpenAdd={action === "add"}
    />
  );
}

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

  // Z.1, 06.08.2026 — демо-школа невидима для суперадмина (schools.is_demo,
  // миграция 170). Раньше здесь было два НЕзависимых запроса — список админов
  // и список школ, — и оба тянули демо. Список школ питает сразу три вещи в
  // AdminsView: колонку «школа», <select> в модалке создания и <select> в
  // модалке редактирования, поэтому фильтровать надо оба запроса согласованно:
  // отфильтруешь один — либо «—» в колонке, либо демо-школа как цель переноса.
  // Сначала берём не-демо школы, затем ограничиваем админов по их school_id.
  const { data: schools, error: schoolsError } = await sb
    .from("schools").select("id, name").eq("is_demo", false).order("name");
  if (schoolsError) console.error("[SuperAdminAdminsPage] schools query failed:", schoolsError.message);

  const schoolRows = (schools ?? []) as { id: string; name: string }[];
  const schoolIds = schoolRows.map((s) => s.id);

  let adminRows: {
    id: string; user_id: string | null; full_name: string; school_id: string; created_at: string;
  }[] = [];

  if (schoolIds.length > 0) {
    const { data: admins, error: adminsError } = await sb
      .from("admins")
      .select("id, user_id, full_name, school_id, created_at")
      .in("school_id", schoolIds)
      .order("full_name");
    if (adminsError) console.error("[SuperAdminAdminsPage] admins query failed:", adminsError.message);
    adminRows = (admins ?? []) as typeof adminRows;
  }

  // getUserEmails — service-role вызов, RLS его не ограничивает; он безопасен
  // ровно настолько, насколько отфильтрован список выше.
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

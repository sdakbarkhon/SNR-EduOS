// 11.08.2026 — пункт «Профиль» в боковом меню админки вёл на /admin/profile,
// а такого маршрута не было: страница отдавала 404. Здесь ровно то, что у
// админа реально есть в базе: admins.full_name, школа по admins.school_id и
// e-mail учётной записи. Ни редактирования, ни смены пароля тут нет — админ
// заводится service-role'ом (см. миграцию 42: INSERT/UPDATE/DELETE на admins
// разрешены только service_role), поэтому форма сохранения была бы обманом.
// Выход из аккаунта уже есть в боковом меню, дублировать не стали.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminProfileView } from "./AdminProfileView";

export default async function AdminProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: admin } = await (supabase as any)
    .from("admins")
    .select("full_name, school_id, created_at")
    .eq("user_id", user.id)
    .single();

  // Проверку роли уже сделал app/admin/layout.tsx — сюда без записи в admins
  // не попасть. Но если строка исчезла между рендерами, показывать пустую
  // страницу неправильно.
  if (!admin) redirect("/login");

  let schoolName: string | null = null;
  if (admin.school_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: school } = await (supabase as any)
      .from("schools")
      .select("name")
      .eq("id", admin.school_id)
      .maybeSingle();
    schoolName = (school as { name: string } | null)?.name ?? null;
  }

  return (
    <AdminProfileView
      fullName={admin.full_name as string}
      email={user.email ?? null}
      schoolName={schoolName}
    />
  );
}

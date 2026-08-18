// 11.08.2026 — пункт «Профиль» в боковом меню админки вёл на /admin/profile,
// а такого маршрута не было: страница отдавала 404. Здесь ровно то, что у
// админа реально есть в базе: admins.full_name, школа по admins.school_id и
// e-mail учётной записи. Ни редактирования, ни смены пароля тут нет — админ
// заводится service-role'ом (см. миграцию 42: INSERT/UPDATE/DELETE на admins
// разрешены только service_role), поэтому форма сохранения была бы обманом.
// Выход из аккаунта уже есть в боковом меню, дублировать не стали.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signLogoUrl } from "@/lib/school-card";
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

  // Карточка школы читается под сессией админа: политика «authenticated reads
  // own school» отдаёт только свою школу, поэтому чужие данные сюда попасть не
  // могут даже при ошибке в school_id.
  let schoolName: string | null = null;
  let logoPath: string | null = null;
  let card: { address: string | null; phone: string | null; email: string | null;
    director_name: string | null; website: string | null } | null = null;
  if (admin.school_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: school } = await (supabase as any)
      .from("schools")
      .select("name, logo_path, address, phone, email, director_name, website")
      .eq("id", admin.school_id)
      .maybeSingle();
    const row = school as {
      name: string; logo_path: string | null; address: string | null; phone: string | null;
      email: string | null; director_name: string | null; website: string | null;
    } | null;
    schoolName = row?.name ?? null;
    logoPath = row?.logo_path ?? null;
    card = row
      ? { address: row.address, phone: row.phone, email: row.email,
          director_name: row.director_name, website: row.website }
      : null;
  }

  return (
    <AdminProfileView
      fullName={admin.full_name as string}
      email={user.email ?? null}
      schoolName={schoolName}
      schoolLogoUrl={await signLogoUrl(logoPath)}
      schoolCard={card}
    />
  );
}

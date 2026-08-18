import { createClient } from "@/lib/supabase/server";
import { signLogoUrl } from "@/lib/school-card";
import { SchoolsView } from "./SchoolsView";

export default async function SuperAdminSchoolsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Z.1: демо-школа не показывается суперадмину (schools.is_demo, миграция 170).
  // Без фильтра она шла ПЕРВОЙ строкой — создана 04.07 против 29.07 у реальной.
  const { data: schools } = await (supabase as any)
    .from("schools")
    .select(
      "id, name, code, autostart_enabled, created_at, is_active, "
      + "logo_path, address, phone, email, director_name, website, legal_details",
    )
    .eq("is_demo", false)
    .order("created_at");

  const rows = (schools ?? []) as {
    id: string; name: string; code: string | null; autostart_enabled: boolean; created_at: string;
    is_active: boolean; logo_path: string | null; address: string | null; phone: string | null;
    email: string | null; director_name: string | null; website: string | null;
    legal_details: string | null;
  }[];

  // Ссылка на логотип подписывается здесь, на сервере, и живёт час: бакет
  // закрытый, постоянной ссылки у файла нет вовсе. Суперадмин смотрит все
  // школы, поэтому подписываются все.
  const withLogos = await Promise.all(
    rows.map(async (s) => ({ ...s, logoUrl: await signLogoUrl(s.logo_path) })),
  );

  return <SchoolsView schools={withLogos} />;
}

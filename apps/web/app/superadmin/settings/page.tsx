import { createClient } from "@/lib/supabase/server";
import { SettingsView } from "./SettingsView";

export default async function SuperAdminSettingsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();

  // Своя строка суперадминистратора — за почтой для входа через Google
  // (миграция 214). Роль уже проверил layout, сюда без неё не попасть.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: me } = user
    ? await (db as any).from("super_admins").select("google_email").eq("user_id", user.id).maybeSingle()
    : { data: null };

  return <SettingsView googleEmail={(me as { google_email: string | null } | null)?.google_email ?? null} />;
}

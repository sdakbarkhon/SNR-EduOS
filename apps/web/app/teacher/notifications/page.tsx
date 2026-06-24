import { createClient } from "@/lib/supabase/server";
import { getMyNotifications } from "@snr/core";
import { TeacherNotificationsView } from "./TeacherNotificationsView";

export const metadata = { title: "Уведомления" };

export default async function TeacherNotificationsPage() {
  const db = await createClient();
  const notifications = await getMyNotifications(db, 30).catch(() => []);
  return <TeacherNotificationsView initialNotifications={notifications} />;
}

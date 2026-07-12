import { createClient } from "@/lib/supabase/server";
import { getMyNotifications } from "@snr/core";
import { safeQuery } from "@/lib/safe-query";
import { TeacherNotificationsView } from "./TeacherNotificationsView";

export const metadata = { title: "Уведомления" };

export default async function TeacherNotificationsPage() {
  const db = await createClient();
  const { data: notifications } = await safeQuery(getMyNotifications(db, 30), [], "TeacherNotificationsPage.notifications");
  return <TeacherNotificationsView initialNotifications={notifications} />;
}

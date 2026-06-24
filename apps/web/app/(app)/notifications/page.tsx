import { createClient } from "@/lib/supabase/server";
import { getMyNotifications } from "@snr/core";
import { NotificationsView } from "./NotificationsView";

export const metadata = { title: "Уведомления" };

export default async function NotificationsPage() {
  const db = await createClient();
  const notifications = await getMyNotifications(db, 30).catch(() => []);
  return <NotificationsView initialNotifications={notifications} />;
}

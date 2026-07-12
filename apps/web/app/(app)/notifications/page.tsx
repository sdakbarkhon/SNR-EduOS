import { createClient } from "@/lib/supabase/server";
import { getMyNotifications } from "@snr/core";
import { getMyStudent } from "@/lib/cached-queries";
import { safeQuery } from "@/lib/safe-query";
import { NotificationsView } from "./NotificationsView";

export const metadata = { title: "Уведомления" };

export default async function NotificationsPage() {
  const db = await createClient();
  const [notificationsRes, studentRes] = await Promise.all([
    safeQuery(getMyNotifications(db, 30), [], "NotificationsPage.notifications"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeQuery(Promise.resolve(getMyStudent(db as any)), null, "NotificationsPage.student"),
  ]);
  return (
    <NotificationsView
      initialNotifications={notificationsRes.data}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      studentId={(studentRes.data as any)?.id ?? null}
    />
  );
}

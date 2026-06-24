import { createClient } from "@/lib/supabase/server";
import { getMyNotifications, getMyStudent } from "@snr/core";
import { NotificationsView } from "./NotificationsView";

export const metadata = { title: "Уведомления" };

export default async function NotificationsPage() {
  const db = await createClient();
  const [notifications, student] = await Promise.all([
    getMyNotifications(db, 30).catch(() => []),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Promise.resolve(getMyStudent(db as any)).catch(() => null),
  ]);
  return (
    <NotificationsView
      initialNotifications={notifications}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      studentId={(student as any)?.id ?? null}
    />
  );
}

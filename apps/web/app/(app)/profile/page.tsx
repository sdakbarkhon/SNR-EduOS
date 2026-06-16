import { createClient } from "@/lib/supabase/server";
import {
  getMyStudent,
  getMyGroups,
  getNotificationSettings,
  getTeachers,
} from "@snr/core";
import { ProfileView } from "./ProfileView";

export default async function ProfilePage() {
  const db = await createClient();

  const [student, groups] = await Promise.all([
    getMyStudent(db),
    getMyGroups(db),
  ]);

  // notification_settings могут ещё не существовать для нового ученика
  let notifSettings = null;
  try {
    notifSettings = await getNotificationSettings(db);
  } catch {
    // оставляем null — ProfileView создаст запись при первом сохранении
  }

  // Куратор (по curator_id ученика)
  let curatorName = "";
  if (student.curator_id) {
    try {
      const teachers = await getTeachers(db);
      const c = teachers.find((t) => t.id === student.curator_id);
      curatorName = c?.full_name ?? "";
    } catch {
      // ignore
    }
  }

  return (
    <ProfileView
      student={student}
      groups={groups}
      notifSettings={notifSettings}
      curatorName={curatorName}
    />
  );
}

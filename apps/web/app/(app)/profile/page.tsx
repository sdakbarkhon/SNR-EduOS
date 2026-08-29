import { createClient } from "@/lib/supabase/server";
import {
  getNotificationSettings,
  getTeachers,
} from "@snr/core";
import { getMyStudent, getMyGroups } from "@/lib/cached-queries";
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

  // КЛАССНЫЙ РУКОВОДИТЕЛЬ — У ГРУППЫ, А НЕ У УЧЕНИКА (29.08.2026).
  //
  // Здесь стояло students.curator_id — колонка, которую не заполняет ни один
  // экран админки: поля под неё нет ни в окне ученика, ни где-либо ещё.
  // Значит строка «Классный руководитель» показывала прочерк ВСЕГДА, у всех
  // учеников обеих школ. Решение заказчика: куратор один на класс и задаётся
  // в форме группы — это groups.teacher_id.
  //
  // Второго запроса не понадобилось: getMyGroups уже вернул строки групп
  // целиком (select *), teacher_id в них есть.
  let curatorName = "";
  const curatorId = groups.find((g) => g.teacher_id)?.teacher_id ?? null;
  if (curatorId) {
    try {
      const teachers = await getTeachers(db);
      const c = teachers.find((t) => t.id === curatorId);
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

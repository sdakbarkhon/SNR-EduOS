import { createClient } from "@/lib/supabase/server";
import { getNotificationSettings } from "@snr/core";
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

  // КЛАССНОГО РУКОВОДИТЕЛЯ ЗДЕСЬ БОЛЬШЕ НЕТ (30.08.2026).
  //
  // Роль куратора убрана из продукта целиком. Миграция 242 удалила
  // единственного куратора и обнулила groups.teacher_id со
  // students.curator_id; 243 снимает правила доступа и триггеры. Читать
  // было бы нечего, а прочерк в карточке — это вопрос «а кто мой
  // классный?», на который у продукта больше нет ответа.

  return (
    <ProfileView
      student={student}
      groups={groups}
      notifSettings={notifSettings}
    />
  );
}

import { ProfileView } from "./ProfileView";

/**
 * «Профиль» — v2-редизайн: перенос 1:1 экрана dhub
 * apps/mobile-parent/src/screens/tabs/ProfileHubScreen.tsx.
 *
 * Данные экран берёт сам из фикстур v2/data (те же аксессоры, что зовёт
 * RN-экран: getParent / getChildren / getConfirmDialog) — БД на этом шаге
 * не подключаем, поэтому props из getParentContext() больше не передаются.
 * Гард авторизации остался в layout.tsx (redirect на /parent без сессии).
 */
export default function ParentProfilePage() {
  return <ProfileView />;
}

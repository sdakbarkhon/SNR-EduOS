import { HomeView } from "./HomeView";

/**
 * «Главная» (П5) — веб-порт экрана родительского приложения v2.
 *
 * Экран целиком перенесён 1:1 с apps/mobile-parent (ветка
 * feat/mobile-parent-redesign, HomeScreen.tsx) и питается фикстурами
 * data-слоя мобилки — apps/web/app/parent/(app)/v2/data. БД к этому экрану
 * СОЗНАТЕЛЬНО не подключена: прежняя серверная версия страницы (Supabase:
 * getStudentLessonsForWeek / getStudentAttendance / getHomeworkWithSubmissions)
 * закрывала только 4 значения из ~40 на экране, а вёрстка расходилась с
 * утверждённым макетом. Подключение реальных данных к новой вёрстке —
 * отдельный шаг, после того как перенос всех экранов v2 будет принят.
 */
export default function ParentHomePage() {
  return <HomeView />;
}

import { parentSessions, parentToday } from "@/lib/parent-queries";
import { SessionsView } from "./SessionsView";

/**
 * «Активные сессии» — веб-порт
 * apps/mobile-parent/src/screens/profile/ActiveSessionsScreen.tsx.
 *
 * Данные НАСТОЯЩИЕ: таблица `user_sessions`, строки этого пользователя.
 *
 * Экран read-only: кнопки «Завершить сеанс» нет намеренно. В проекте работает
 * single-session — вход на новом устройстве сам закрывает предыдущий, и
 * лишних сеансов, которые надо было бы гасить руками, просто не бывает.
 * Кнопка, которая всегда гасит единственный (текущий) вход, — это кнопка
 * «выйти», а она уже есть в профиле. Поэтому вместо неё внизу пояснение,
 * почему список короткий.
 */
export default async function ParentSessionsPage() {
  const [sessions, today] = await Promise.all([parentSessions(), parentToday()]);
  return <SessionsView sessions={sessions} today={today} />;
}

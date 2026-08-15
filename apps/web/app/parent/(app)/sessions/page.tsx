import { parentSessions, parentToday } from "@/lib/parent-queries";
import { SessionsView } from "./SessionsView";

/**
 * «Активные сессии» — веб-порт
 * apps/mobile-parent/src/screens/profile/ActiveSessionsScreen.tsx.
 *
 * Данные НАСТОЯЩИЕ: auth.sessions — родная таблица Supabase Auth, строка на
 * каждый вход в аккаунт (устройство, адрес, когда вошли, когда последний раз
 * продлевали вход). Читает их RPC миграции 199 обычным клиентом вошедшего.
 *
 * 15.08.2026. До этого страница читала public.user_sessions служебным ключом и
 * была read-only: в той таблице реестр правила «одна активная сессия», ровно
 * одна строка на аккаунт, и закрывать было буквально нечего. С настоящим
 * списком кнопка «Завершить» появилась — кроме текущего входа, для которого
 * есть «Выйти» в профиле.
 */
export default async function ParentSessionsPage() {
  const [sessions, today] = await Promise.all([parentSessions(), parentToday()]);
  return <SessionsView sessions={sessions} today={today} />;
}

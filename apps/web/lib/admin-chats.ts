// Пачка 7.20 — read-only admin chat viewer. Общие типы + helpers для
// /api/admin/chats и /api/admin/chats/[id]/messages.
//
// Таксономия (по факту живых данных, ресерч 2-й итерации Пачки 7.20):
//  - "teacher_student" (учитель↔ученик) — chat_threads kind='direct' WHERE
//    student_id IS NOT NULL. Сейчас 36/36 direct-тредов — все такие.
//  - "parent_teacher" (родитель↔учитель) — chat_threads kind='direct' WHERE
//    student_id IS NULL. Схема это допускает (fn_ensure_direct_chat создаёт
//    только teacher_student пары, но ничего не мешает появиться прямому
//    родитель↔учитель треду в будущем), сейчас таких 0 — предикат готов на
//    будущее, категория в UI скрывается динамически при 0 чатов.
//  - "class_group" (групповой чат класса) — chat_threads kind='group'.
//    ВАЖНО: под одним group_id всегда РОВНО два таких треда — "{Класс}"
//    (куратор+ученики) и "{Класс} — Родители" (куратор+родители,
//    участники НЕ пересекаются с учениками) — обе показываются в одной
//    категории "Групповой чат класса" (так просили), различить их можно
//    по chat_threads.title (уже содержит суффикс "— Родители").
//  - "lesson_ai_helper" (AI-помощник урока) — ai_chat_messages (миграция
//    20260623000041_ai_chat_limits). "Чат" = пара (student_id, lesson_id),
//    нет thread_id вообще — не часть системы chat_threads.
//
// RLS (после миграции 142, которая осознанно отменяет для fn_is_admin()
// исключение kind='direct', введённое миграцией 122): admin читает
// chat_threads/chat_participants/chat_messages обычным cookie-клиентом —
// ветка `fn_is_admin() AND school_id = current_school_id()` в SELECT-
// политиках всех трёх таблиц больше не различает kind, пускает и direct,
// и group. ai_chat_messages по-прежнему требует service-role (нет admin
// RLS-политики там вообще — не менялось).

export type AdminChatType = "parent_teacher" | "teacher_student" | "class_group" | "lesson_ai_helper";

export type ChatParticipant = { id: string; name: string; role: string };

export type AdminChatSummary = {
  id: string;
  type: AdminChatType;
  // Человекочитаемый заголовок строки списка — считается на сервере, чтобы
  // не тащить в клиент разную форму данных для 2-участникового direct-чата
  // и many-participant group-чата: "Иванов И. ↔ Петров П.", "10-А класс",
  // "10-А класс — Родители", "AI-помощник (Тема урока)".
  label: string;
  // Имя для аватарки в списке (инициалы) — участник_1 для direct/lesson,
  // название класса для group.
  avatar_name: string;
  lesson_id?: string;
  last_message_at: string;
  message_count: number;
};

export type AdminChatMessage = {
  id: string;
  sender: ChatParticipant;
  content: string;
  created_at: string;
  is_ai: boolean;
};

export type AdminChatInfo = {
  id: string;
  type: AdminChatType;
  label: string;
  lesson_id?: string;
  last_message_at: string;
  message_count: number;
};

// Синтетический id для lesson-чатов — ai_chat_messages не привязана к
// thread_id, "чат" здесь — это пара (student_id, lesson_id). "__" не
// встречается в uuid, поэтому разбор однозначный.
export const LESSON_CHAT_PREFIX = "lesson__";
export function encodeLessonChatId(studentId: string, lessonId: string): string {
  return `${LESSON_CHAT_PREFIX}${studentId}__${lessonId}`;
}
export function decodeLessonChatId(id: string): { studentId: string; lessonId: string } | null {
  if (!id.startsWith(LESSON_CHAT_PREFIX)) return null;
  const rest = id.slice(LESSON_CHAT_PREFIX.length);
  const parts = rest.split("__");
  if (parts.length !== 2) return null;
  return { studentId: parts[0]!, lessonId: parts[1]! };
}

export const AI_PARTICIPANT: ChatParticipant = { id: "ai", name: "AI-помощник", role: "assistant" };

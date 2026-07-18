// Пачка 7.20 — read-only admin chat viewer. Общие типы + helpers для
// /api/admin/chats и /api/admin/chats/[id]/messages.
//
// Два принципиально разных источника данных под одним списком:
//  - "direct" (учитель↔ученик) — chat_threads/chat_messages (миграция 78).
//    RLS уже даёт admin'у полный SELECT в рамках своей школы
//    ("participants read their threads" и т.д. — все три policy имеют
//    ветку `fn_is_admin() AND school_id = current_school_id()`) — service-
//    role здесь НЕ нужен, обычный cookie-клиент справляется сам.
//  - "lesson" (lesson-scoped AI-помощник) — ai_chat_messages (миграция
//    20260623000041_ai_chat_limits). У неё НЕТ admin-политики (только
//    "student reads own" / "teacher reads own groups") — тут service-role
//    обязателен, как и предполагало ТЗ (просто не для ОБОИХ источников
//    сразу, только для этого).
//
// Учитель↔родитель "прямых" чатов НЕ существует как понятия в схеме —
// проверено live: все 36 chat_threads с kind='direct' имеют РОВНО
// participants {student, teacher}, ни одного parent. Родители участвуют
// только в kind='group' (классовый чат), которые сюда не входят —
// задача просила именно "прямые" чаты, group-чаты вне скоупа.

export type AdminChatType = "direct_teacher_student" | "direct_teacher_parent" | "lesson_ai_helper";

export type ChatParticipant = { id: string; name: string; role: string };

export type AdminChatSummary = {
  id: string;
  type: AdminChatType;
  participant_1: ChatParticipant;
  participant_2: ChatParticipant;
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

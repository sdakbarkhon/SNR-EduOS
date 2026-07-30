import { cache } from "react";
import type { ChatThreadKind, ChatThreadSummary } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { parentThreads } from "@/lib/parent-queries";
import { avatarGradient, initialsOf, previewOf, previousDay, relativeStamp } from "./format";

/**
 * Приведение реальных чатов (`chat_threads`) к виду, который рисует экран
 * «Сообщения» мобилки: имя собеседника, роль-чип, превью и счётчик
 * непрочитанных.
 *
 * Раньше веб рисовал этот экран из фикстуры `v2/data` — с чужими учителями
 * и чужими детьми. Здесь всё считается из `getMyThreadSummaries`, который RLS
 * уже сузила до тредов, где текущий пользователь — участник.
 *
 * ТОЛЬКО ДЛЯ СЕРВЕРА: тянет серверный supabase-клиент (через
 * `lib/parent-queries`, который импортирует `next/headers`) — импорт из
 * "use client"-компонента сломает сборку.
 */

export type ParentThreadVM = {
  id: string;
  kind: ChatThreadKind;
  /** Имя в списке: собеседник для direct, title для group/admin_ai. */
  name: string;
  /** Мини-чип роли под именем («Учитель», «Куратор», «Класс», «Поддержка»). */
  roleLabel: string | null;
  /** Предмет direct-треда, если известен (используется в шапке чата). */
  subjectLabel: string | null;
  timeLabel: string;
  preview: string;
  unread: number;
  initials: string;
  gradient: readonly [string, string];
  /** Тред, который «Помощь и поддержка» открывает по /parent/chat/support. */
  isSupport: boolean;
};

/** ID текущего пользователя auth — им отличаются свои сообщения от чужих. */
export const getAuthUserId = cache(async (): Promise<string | null> => {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user?.id ?? null;
});

function isSupportThread(s: ChatThreadSummary): boolean {
  if (s.kind === "admin_ai") return true;
  const t = (s.title ?? "").toLowerCase();
  return t.includes("поддерж") || t.includes("администрац");
}

function counterpartName(s: ChatThreadSummary, myUserId: string | null): string | null {
  const others = s.participants.filter((p) => p.user_id !== myUserId && p.full_name);
  // Для direct-треда собеседник — учитель; на всякий случай fallback на любого.
  const teacher = others.find((p) => p.role_in_thread === "teacher");
  return (teacher ?? others[0])?.full_name ?? null;
}

function roleLabelOf(s: ChatThreadSummary): string | null {
  if (isSupportThread(s)) return "Поддержка";
  if (s.kind === "direct") return s.isCuratorThread ? "Куратор" : "Учитель";
  if (s.kind === "group") return "Класс";
  return null;
}

function toVM(s: ChatThreadSummary, myUserId: string | null, today: string, yesterday: string): ParentThreadVM {
  const support = isSupportThread(s);
  const name =
    s.kind === "direct"
      ? counterpartName(s, myUserId) ?? s.title ?? "Чат"
      : s.title ?? (support ? "Поддержка школы" : "Групповой чат");

  const stampSource = s.lastMessage?.created_at ?? s.updated_at;

  return {
    id: s.id,
    kind: s.kind,
    name,
    roleLabel: roleLabelOf(s),
    subjectLabel: s.directSubjectName ?? null,
    timeLabel: relativeStamp(stampSource, today, yesterday),
    preview: s.lastMessage ? previewOf(s.lastMessage.body) : "Сообщений пока нет",
    unread: s.unreadCount,
    initials: initialsOf(name),
    gradient: avatarGradient(s.id),
    isSupport: support,
  };
}

/** Все треды родителя в порядке свежести (как их отдаёт core: updated_at DESC). */
export const parentThreadVMs = cache(async (todayStr: string): Promise<ParentThreadVM[]> => {
  const [summaries, myUserId] = await Promise.all([parentThreads(), getAuthUserId()]);
  const yesterday = previousDay(todayStr);
  return summaries.map((s) => toVM(s, myUserId, todayStr, yesterday));
});

/**
 * ФИО участников треда по user_id — нужно групповым чатам, чтобы подписать
 * чужие пузыри. `chat_messages` отдаёт только sender_id, а имена уже собраны
 * в summary, так что второго запроса это не стоит.
 */
export const parentThreadParticipantNames = cache(
  async (threadId: string): Promise<Record<string, string>> => {
    const summaries = await parentThreads();
    const thread = summaries.find((s) => s.id === threadId);
    const names: Record<string, string> = {};
    for (const p of thread?.participants ?? []) {
      if (p.full_name) names[p.user_id] = p.full_name;
    }
    return names;
  },
);

/** Тред поддержки: admin_ai → по названию → первый групповой. null = такого нет. */
export function pickSupportThread(threads: ParentThreadVM[]): ParentThreadVM | null {
  return threads.find((t) => t.isSupport) ?? threads.find((t) => t.kind === "group") ?? null;
}

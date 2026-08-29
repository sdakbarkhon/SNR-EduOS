import { cache } from "react";
import { getDictionary, type ChatThreadKind, type ChatThreadSummary } from "@snr/core";
import { createClient } from "@/lib/supabase/server";
import { parentThreads } from "@/lib/parent-queries";
import { avatarGradient, initialsOf, previewOf } from "./format";

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
  /** Сырой ISO последнего сообщения. Готовой строкой время отсюда больше не
   *  уезжает: подпись зависит от языка, а язык знает только клиент. */
  stampIso: string;
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

/**
 * Подпись комнаты поддержки — из общего словаря, тем же ключом, которым
 * подписан экран поддержки в мобильном. Не литералом: два одинаковых
 * литерала в разных приложениях однажды разойдутся.
 *
 * ЯЗЫК ЗДЕСЬ ПРИБИТ К "ru" ОСОЗНАННО. Выбранный язык лежит в localStorage
 * (см. LocaleProvider), сервер его не видит вовсе, а этот модуль —
 * серверный: он собирает подписи до отправки на клиент. Весь экран
 * «Сообщения» сегодня русский — «Учитель», «Куратор», «Класс» рядом тоже
 * литералы. Перевести его целиком — отдельная работа, и делать её наполовину
 * (одну подпись из словаря, три соседние литералами) было бы хуже: разошлись
 * бы способы, а не только тексты.
 */
const SUPPORT_TITLE = getDictionary("ru").parentApp.msg.supportRealTitle;

/**
 * Комната поддержки — ПО ВИДУ ЧАТА, а не по тексту заголовка.
 *
 * ЧТО БЫЛО СЛОМАНО. Здесь стояла проверка на слова «поддерж»/«администрац»
 * в заголовке. У комнаты поддержки (миграция 234) заголовок — ИМЯ САМОГО
 * РОДИТЕЛЯ: админу в его разделе нужно видеть, кто написал. Проверка его не
 * узнавала, и в списке чатов родителя комната подписывалась его собственным
 * именем — то есть читалась как переписка с самим собой.
 *
 * ПОЧЕМУ ТЕКСТОМ НЕЛЬЗЯ ВООБЩЕ. Приложение живёт на трёх языках. Разбор
 * смысла по русскому слову ломается молча: узбекский заголовок просто не
 * совпадёт, и ветка тихо не сработает. Тот же класс, что сравнение статусов
 * домашних заданий по русской строке, которое чинили раньше.
 *
 * admin_ai оставлен: это объявленный вид чата, а не догадка по тексту.
 */
function isSupportThread(s: ChatThreadSummary): boolean {
  return s.kind === "support" || s.kind === "admin_ai";
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

function toVM(s: ChatThreadSummary, myUserId: string | null): ParentThreadVM {
  const support = isSupportThread(s);
  // У комнаты поддержки заголовок в базе — имя родителя, и брать его сюда
  // нельзя ни первым, ни запасным вариантом: родитель увидел бы собственное
  // имя как имя собеседника. Подпись у неё своя и всегда одна.
  const name =
    s.kind === "direct"
      ? counterpartName(s, myUserId) ?? s.title ?? "Чат"
      : support
        ? SUPPORT_TITLE
        : s.title ?? "Групповой чат";

  const stampSource = s.lastMessage?.created_at ?? s.updated_at;

  return {
    id: s.id,
    kind: s.kind,
    name,
    roleLabel: roleLabelOf(s),
    subjectLabel: s.directSubjectName ?? null,
    stampIso: stampSource,
    preview: s.lastMessage ? previewOf(s.lastMessage.body) : "Сообщений пока нет",
    unread: s.unreadCount,
    initials: initialsOf(name),
    gradient: avatarGradient(s.id),
    isSupport: support,
  };
}

/** Все треды родителя в порядке свежести (как их отдаёт core: updated_at DESC). */
export const parentThreadVMs = cache(async (): Promise<ParentThreadVM[]> => {
  const [summaries, myUserId] = await Promise.all([parentThreads(), getAuthUserId()]);
  return summaries.map((s) => toVM(s, myUserId));
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

/**
 * Тред поддержки: admin_ai/по названию → куратор класса (direct-тред с тем
 * же учителем, что ведёт группу) → null.
 *
 * РАНЬШЕ третьим шагом был `threads.find(t => t.kind === "group")` — ЛЮБОЙ
 * групповой чат класса. В системе нет ни одного admin_ai/«поддержка»-треда
 * (проверено на живой БД), поэтому этот fallback срабатывал ВСЕГДА: клик по
 * «Помощь и поддержка» неизменно открывал групповой чат класса — ровно то,
 * что явно запрещено («Никаких групповых чатов класса»). Куратор — direct-
 * тред, `isCuratorThread` уже вычисляется в @snr/core (packages/core/src/
 * queries/chat.ts) как совпадение teacher_id треда с groups.teacher_id.
 * Если и его нет, ../chat/[id]/page.tsx уже показывает честное пустое
 * состояние вместо переадресации — используем его, а не выдумываем чат.
 */
export function pickSupportThread(threads: ParentThreadVM[]): ParentThreadVM | null {
  return (
    threads.find((t) => t.isSupport) ??
    threads.find((t) => t.kind === "direct" && t.roleLabel === "Куратор") ??
    null
  );
}

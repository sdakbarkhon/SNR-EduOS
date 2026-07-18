"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Send, MessageCircle, ChevronLeft, ChevronDown, Users, Star } from "lucide-react";
import {
  getDictionary,
  getMyThreadSummaries,
  getThreadMessages,
  sendChatMessage,
  markThreadRead,
  type Locale,
  type ChatThreadSummary,
  type ChatMessageRow,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeChannel } from "@/lib/realtime";
import { useLocale } from "../LocaleProvider";
import { Avatar } from "../Avatar";
import { dayKey, dayLabel } from "./dateGroups";
import { EmojiPicker } from "./EmojiPicker";

const POLL_INTERVAL_MS = 5000;

function threadIcon(kind: string) {
  return kind === "group" ? Users : MessageCircle;
}

// Промт 7.2: for a kind="direct" thread, the display name is the OTHER
// participant (the two rows are always exactly {me, the other party}).
function otherParticipantName(t: ChatThreadSummary, myUserId: string | null): string {
  return t.participants.find((p) => p.user_id !== myUserId)?.full_name ?? "";
}

export function MessagesView({ role }: { role: "student" | "teacher" | "parent" }) {
  return (
    <Suspense fallback={null}>
      <MessagesBody role={role} />
    </Suspense>
  );
}

function MessagesBody({ role }: { role: "student" | "teacher" | "parent" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const db = useMemo(() => createClient(), []);
  const activeThreadId = searchParams.get("thread");

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [loadedThreads, setLoadedThreads] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function refreshThreads() {
    const rows = await getMyThreadSummaries(db).catch((e) => {
      console.error("[MessagesView] getMyThreadSummaries failed:", e?.message ?? e);
      return [];
    });
    setThreads(rows);
    setLoadedThreads(true);
  }

  async function refreshActiveMessages(threadId: string) {
    const rows = await getThreadMessages(db, threadId).catch((e) => {
      console.error("[MessagesView] getThreadMessages failed:", e?.message ?? e);
      return [];
    });
    setMessages(rows);
  }

  useEffect(() => {
    db.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    refreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }
    refreshActiveMessages(activeThreadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  // Отмечаем тред прочитанным при открытии/при появлении новых сообщений.
  useEffect(() => {
    if (!activeThreadId || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    markThreadRead(db, activeThreadId, last.id).then(() => refreshThreads()).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId, messages.length]);

  useRealtimeChannel(
    activeThreadId ? `chat-thread-${activeThreadId}` : null,
    "chat_messages",
    activeThreadId ? `thread_id=eq.${activeThreadId}` : undefined,
    (payload) => {
      if (payload.eventType !== "INSERT") return;
      const row = payload.new as unknown as ChatMessageRow;
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
    },
  );

  useRealtimeChannel(
    myUserId ? `chat-my-threads-${myUserId}` : null,
    "chat_messages",
    undefined,
    (payload) => {
      const row = payload.new as unknown as ChatMessageRow | undefined;
      if (!row || row.thread_id === activeThreadId) return;
      refreshThreads();
    },
  );

  useEffect(() => {
    const id = setInterval(() => {
      refreshThreads();
      if (activeThreadId) refreshActiveMessages(activeThreadId);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeThreadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeThreadId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 5 * 24)}px`;
  }, [composerText]);

  function openThread(threadId: string) {
    router.push(`${pathname}?thread=${threadId}`);
  }

  function backToList() {
    router.push(pathname);
  }

  async function handleSend() {
    const body = composerText.trim();
    if (!body || !activeThreadId || sending || !myUserId) return;
    setSending(true);
    setSendError(false);
    setComposerText("");
    const optimisticId = `optimistic-${Math.random().toString(36).slice(2)}`;
    const optimistic: ChatMessageRow = {
      id: optimisticId,
      thread_id: activeThreadId,
      sender_id: myUserId,
      body,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const saved = await sendChatMessage(db, activeThreadId, body);
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? saved : m)));
      refreshThreads();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  function onComposerKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Часть 3 — эмодзи в чатах: вставляет эмодзи в позицию курсора (не просто
  // в конец). Юникод-эмодзи — обычный текст в composerText, никаких
  // отдельных полей/вложений; sendChatMessage() отправляет body как есть.
  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setComposerText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? composerText.length;
    const end = el.selectionEnd ?? composerText.length;
    setComposerText(composerText.slice(0, start) + emoji + composerText.slice(end));
    const cursor = start + emoji.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  const emptyThreadsHint =
    role === "student" ? d.chat.noThreadsStudent
    : role === "teacher" ? d.chat.noThreadsTeacher
    : d.chat.noThreadsParent;

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  // Промт 7.2: студент видит куратора отдельной строкой сверху + групповой
  // чат класса + личные чаты с предметными учителями. Учитель видит все
  // групповые чаты своих классов + личные чаты, сгруппированные по классу.
  // Родитель — прежнее плоское поведение (без секций, не в скоупе Промта 7.2).
  const curatorThread = role === "student" ? threads.find((t) => t.kind === "direct" && t.isCuratorThread) ?? null : null;
  const studentGroupChats = role === "student" ? threads.filter((t) => t.kind === "group") : [];
  const studentTeacherChats = role === "student" ? threads.filter((t) => t.kind === "direct" && !t.isCuratorThread) : [];

  const teacherGroupChats = role === "teacher" ? threads.filter((t) => t.kind === "group") : [];
  const teacherDirectByClass = useMemo(() => {
    if (role !== "teacher") return [] as { groupId: string; groupName: string; items: ChatThreadSummary[] }[];
    const byGroup = new Map<string, { groupId: string; groupName: string; items: ChatThreadSummary[] }>();
    for (const t of threads) {
      if (t.kind !== "direct") continue;
      const gid = t.directGroupId ?? "unknown";
      const gname = t.directGroupName ?? d.chat.title;
      const entry = byGroup.get(gid) ?? { groupId: gid, groupName: gname, items: [] };
      entry.items.push(t);
      byGroup.set(gid, entry);
    }
    return Array.from(byGroup.values()).sort((a, b) => a.groupName.localeCompare(b.groupName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, threads]);

  const isSectioned = role === "student" || role === "teacher";

  function renderThreadRow(
    t: ChatThreadSummary,
    opts: { key: string; avatarSize?: number; subtitle?: string; highlight?: boolean },
  ) {
    const active = t.id === activeThreadId;
    const isDirect = t.kind === "direct";
    const displayName = isDirect ? (otherParticipantName(t, myUserId) || d.chat.title) : (t.title ?? d.chat.title);
    const Icon = threadIcon(t.kind);
    return (
      <button
        key={opts.key}
        onClick={() => openThread(t.id)}
        className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition ${
          active ? "bg-indigo-50" : opts.highlight ? "bg-amber-50/70 hover:bg-amber-50" : "hover:bg-gray-50"
        }`}
      >
        {isDirect ? (
          <Avatar name={displayName || "?"} size={opts.avatarSize ?? 36} />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 truncate text-sm font-semibold text-gray-800">
              {opts.highlight && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
              <span className="truncate">{displayName}</span>
            </span>
            {t.lastMessage && (
              <span className="shrink-0 text-[11px] text-gray-400">{dayLabel(t.lastMessage.created_at, d, locale, true)}</span>
            )}
          </div>
          {opts.subtitle && <p className="truncate text-[11px] text-gray-400">{opts.subtitle}</p>}
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="truncate text-xs text-gray-500">{t.lastMessage?.body ?? ""}</span>
            {t.unreadCount > 0 && (
              <span className="ml-2 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#F5455C] px-1.5 text-[11px] font-extrabold text-white">
                {t.unreadCount > 99 ? "99+" : t.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex h-full min-h-[520px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      {/* Промт 6.2: на md-lg (планшет, 768-1024) 320px фиксированной ширины
          списка чатов зажимало область сообщений — сужена до 230px, на lg+
          (десктоп) ширина как была. */}
      <div
        className={`w-full shrink-0 flex-col border-r border-gray-100 md:flex md:w-[230px] lg:w-[320px] ${activeThreadId ? "hidden md:flex" : "flex"}`}
      >
        <div className="shrink-0 border-b border-gray-100 px-4 py-4">
          <h1 className="text-lg font-bold text-gray-800">{d.chat.title}</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadedThreads && threads.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
                <MessageCircle className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold text-gray-700">{d.chat.noThreadsTitle}</p>
              <p className="text-xs text-gray-400">{emptyThreadsHint}</p>
            </div>
          )}

          {!isSectioned &&
            threads.map((t) => renderThreadRow(t, { key: t.id }))}

          {role === "student" && (
            <>
              {curatorThread && (
                <div className="border-b border-gray-100">
                  <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-amber-600">{d.chat.sectionCurator}</p>
                  {renderThreadRow(curatorThread, {
                    key: curatorThread.id,
                    avatarSize: 44,
                    subtitle: d.chat.curatorSubtitle,
                    highlight: true,
                  })}
                </div>
              )}
              {studentGroupChats.length > 0 && (
                <div className="border-b border-gray-100">
                  <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">{d.chat.sectionGroupChat}</p>
                  {studentGroupChats.map((t) => renderThreadRow(t, { key: t.id }))}
                </div>
              )}
              {studentTeacherChats.length > 0 && (
                <div>
                  <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">{d.chat.sectionTeachers}</p>
                  {studentTeacherChats.map((t) => renderThreadRow(t, { key: t.id, subtitle: t.directSubjectName ?? undefined }))}
                </div>
              )}
            </>
          )}

          {role === "teacher" && (
            <>
              {teacherGroupChats.length > 0 && (
                <div className="border-b border-gray-100">
                  <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">{d.chat.sectionGroupChats}</p>
                  {teacherGroupChats.map((t) => renderThreadRow(t, { key: t.id }))}
                </div>
              )}
              {teacherDirectByClass.length > 0 && (
                <div>
                  <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">{d.chat.sectionDirectChats}</p>
                  {teacherDirectByClass.map((g) => {
                    const collapsed = collapsedGroups.has(g.groupId);
                    return (
                      <div key={g.groupId}>
                        <button
                          onClick={() => toggleGroup(g.groupId)}
                          className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          <span className="truncate">{g.groupName}</span>
                          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                        </button>
                        {!collapsed && g.items.map((t) => renderThreadRow(t, { key: t.id }))}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`min-w-0 flex-1 flex-col ${activeThreadId ? "flex" : "hidden md:flex"}`}>
        {!activeThread ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">{d.chat.noThreadSelected}</div>
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-4 py-3">
              <button onClick={backToList} className="text-gray-400 hover:text-gray-600 md:hidden" aria-label={d.chat.backToList}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              {/* Промт 6.2: убран truncate/max-width — имя группы и список
                  участников занимают всю доступную ширину (не обрезаются в
                  одну строку с "лишним" пустым местом справа); переносится
                  на 2 строки при необходимости. */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-800">
                  {activeThread.kind === "direct"
                    ? (otherParticipantName(activeThread, myUserId) || d.chat.title)
                    : (activeThread.title ?? d.chat.title)}
                </p>
                {activeThread.kind === "direct" ? (
                  activeThread.isCuratorThread ? (
                    <p className="text-xs font-semibold text-amber-600">{d.chat.curatorSubtitle}</p>
                  ) : activeThread.directSubjectName ? (
                    <p className="text-xs text-gray-400">{activeThread.directSubjectName}</p>
                  ) : null
                ) : (
                  <p className="line-clamp-2 text-xs text-gray-400">
                    {d.chat.participantsLabel}: {activeThread.participants.map((p) => p.full_name).filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">{d.chat.noMessagesInThread}</div>
              )}
              {messages.map((m, i) => {
                const mine = m.sender_id === myUserId;
                const prev = messages[i - 1];
                const showDivider = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
                const senderName = activeThread.participants.find((p) => p.user_id === m.sender_id)?.full_name;
                return (
                  <div key={m.id}>
                    {showDivider && (
                      <div className="my-3 flex justify-center">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-500">
                          {dayLabel(m.created_at, d, locale, false)}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${mine ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                        {!mine && senderName && (
                          <p className="mb-0.5 text-[11px] font-semibold text-indigo-500">{senderName}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                        <p className={`mt-1 text-right text-[10px] ${mine ? "text-indigo-200" : "text-gray-400"}`}>
                          {new Date(m.created_at).toLocaleTimeString(locale === "ru" ? "ru-RU" : locale === "uz" ? "uz-UZ" : "en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Tashkent",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-gray-100 p-3">
              {sendError && <p className="mb-1.5 text-xs font-medium text-red-500">{d.chat.sendError}</p>}
              <div className="flex items-end gap-2">
                <EmojiPicker onSelect={insertEmoji} />
                <textarea
                  ref={textareaRef}
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder={d.chat.composerPlaceholder}
                  rows={1}
                  className="max-h-[120px] flex-1 resize-none overflow-y-auto rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-300"
                />
                <button
                  onClick={handleSend}
                  disabled={!composerText.trim() || sending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
                  title={d.chat.send}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

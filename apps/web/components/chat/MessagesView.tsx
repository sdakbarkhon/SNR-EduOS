"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Send, MessageCircle, ChevronLeft, Users } from "lucide-react";
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
import { dayKey, dayLabel } from "./dateGroups";

const POLL_INTERVAL_MS = 5000;

function threadIcon(kind: string) {
  return kind === "group" ? Users : MessageCircle;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function refreshThreads() {
    const rows = await getMyThreadSummaries(db).catch(() => []);
    setThreads(rows);
    setLoadedThreads(true);
  }

  async function refreshActiveMessages(threadId: string) {
    const rows = await getThreadMessages(db, threadId).catch(() => []);
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

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  const emptyThreadsHint =
    role === "student" ? d.chat.noThreadsStudent
    : role === "teacher" ? d.chat.noThreadsTeacher
    : d.chat.noThreadsParent;

  return (
    <div className="flex h-full min-h-[520px] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div
        className={`w-full shrink-0 flex-col border-r border-gray-100 md:flex md:w-[320px] ${activeThreadId ? "hidden md:flex" : "flex"}`}
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
          {threads.map((t) => {
            const Icon = threadIcon(t.kind);
            const active = t.id === activeThreadId;
            return (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-3 text-left transition ${
                  active ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-800">{t.title ?? d.chat.title}</span>
                    {t.lastMessage && (
                      <span className="shrink-0 text-[11px] text-gray-400">{dayLabel(t.lastMessage.created_at, d, locale, true)}</span>
                    )}
                  </div>
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
          })}
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
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-800">{activeThread.title ?? d.chat.title}</p>
                <p className="truncate text-xs text-gray-400">
                  {d.chat.participantsLabel}: {activeThread.participants.map((p) => p.full_name).filter(Boolean).join(", ")}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
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

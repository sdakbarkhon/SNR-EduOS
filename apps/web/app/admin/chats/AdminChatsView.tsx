"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { MessagesSquare, Eye, Loader2, Bot } from "lucide-react";
import { cn } from "@/lib/cn";

type ChatParticipant = { id: string; name: string; role: string };
type ChatSummary = {
  id: string;
  type: "direct_teacher_student" | "direct_teacher_parent" | "lesson_ai_helper";
  participant_1: ChatParticipant;
  participant_2: ChatParticipant;
  lesson_id?: string;
  last_message_at: string;
  message_count: number;
};
type ChatMessage = {
  id: string;
  sender: ChatParticipant;
  content: string;
  created_at: string;
  is_ai: boolean;
};

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("") || "?";
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[13px] font-bold text-violet-700">
      {initials}
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
}

export function AdminChatsView({
  teachers, groups,
}: {
  teachers: Array<{ id: string; full_name: string }>;
  groups: Array<{ id: string; name: string }>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dc = d.admin.chats;

  const [type, setType] = useState<"all" | "direct" | "lesson">("all");
  const [teacherId, setTeacherId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeInfo, setActiveInfo] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const requestSeq = useRef(0);

  const loadChats = useCallback(async (cursor?: string) => {
    setLoadingList(true);
    const seq = ++requestSeq.current;
    try {
      const params = new URLSearchParams();
      params.set("type", type);
      if (teacherId) params.set("teacher_id", teacherId);
      if (groupId) params.set("group_id", groupId);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/admin/chats?${params.toString()}`);
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      const newChats: ChatSummary[] = data.chats ?? [];
      setChats((prev) => (cursor ? [...prev, ...newChats] : newChats));
      setHasMore(newChats.length >= 50);
    } finally {
      if (seq === requestSeq.current) setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, teacherId, groupId, dateFrom, dateTo]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  async function openChat(chat: ChatSummary) {
    setActiveId(chat.id);
    setActiveInfo(chat);
    setMessages([]);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/admin/chats/${encodeURIComponent(chat.id)}/messages`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      if (data.chat_info) setActiveInfo(data.chat_info);
    } finally {
      setLoadingMessages(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] max-h-[900px] gap-4">
      {/* Left panel: filters + list */}
      <div className="flex w-[360px] shrink-0 flex-col rounded-[20px] bg-white/80 shadow-md backdrop-blur-xl">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <h1 className="flex items-center gap-2 text-[16px] font-bold text-slate-900">
            <MessagesSquare size={18} className="text-violet-600" /> {dc.title}
          </h1>

          <label className="flex flex-col gap-1 text-[12px] font-medium text-slate-500">
            {dc.filters.type}
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400">
              <option value="all">{dc.types.all}</option>
              <option value="direct">{dc.types.direct}</option>
              <option value="lesson">{dc.types.lesson}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[12px] font-medium text-slate-500">
            {dc.filters.teacher}
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400">
              <option value="">{dc.types.all}</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[12px] font-medium text-slate-500">
            {dc.filters.group}
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 outline-none focus:border-violet-400">
              <option value="">{dc.types.all}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-[12px] font-medium text-slate-500">
            {dc.filters.dateRange}
            <div className="flex gap-2">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-violet-400" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-800 outline-none focus:border-violet-400" />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loadingList && chats.length === 0 ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : chats.length === 0 ? (
            <p className="p-4 text-center text-[13px] text-slate-400">{dc.emptyList}</p>
          ) : (
            <div className="space-y-1">
              {chats.map((chat) => {
                const isLesson = chat.type === "lesson_ai_helper";
                return (
                  <button
                    key={chat.id}
                    onClick={() => openChat(chat)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[14px] p-2.5 text-left transition-colors",
                      activeId === chat.id ? "bg-violet-100" : "hover:bg-slate-50",
                    )}
                  >
                    <Avatar name={chat.participant_1.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-800">
                        {chat.participant_1.name} {isLesson ? <Bot size={12} className="ml-1 inline text-blue-500" /> : `↔ ${chat.participant_2.name}`}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{fmtDate(chat.last_message_at)}</span>
                        <span>{dc.messageCount.replace("{count}", String(chat.message_count))}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {hasMore && (
                <button
                  onClick={() => loadChats(chats[chats.length - 1]?.last_message_at)}
                  disabled={loadingList}
                  className="w-full rounded-lg py-2 text-center text-[12px] font-semibold text-violet-600 hover:bg-violet-50 disabled:opacity-50"
                >
                  {loadingList ? d.common.loading : "Загрузить ещё"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: transcript */}
      <div className="flex flex-1 flex-col rounded-[20px] bg-white/80 shadow-md backdrop-blur-xl">
        {!activeId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
            <MessagesSquare size={40} strokeWidth={1.5} />
            <p className="text-[14px]">{dc.selectPrompt}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-t-[20px] border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-[12px] font-semibold text-amber-700">
              <Eye size={14} /> {dc.readOnly}
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className={cn("flex gap-2.5", m.is_ai && "flex-row-reverse")}>
                      <Avatar name={m.sender.name} />
                      <div className={cn("max-w-[70%] rounded-[14px] px-3.5 py-2.5", m.is_ai ? "bg-sky-50" : "bg-slate-50")}>
                        <div className="mb-0.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                          <span>{m.sender.name}</span>
                          <span className="text-slate-400">{fmtDate(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-[13px] text-slate-800">{m.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

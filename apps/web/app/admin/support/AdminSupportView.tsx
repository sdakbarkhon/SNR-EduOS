"use client";

/**
 * Раздел «Поддержка»: слева список обращений, справа переписка и поле ответа.
 *
 * ОТВЕТСТВЕННОГО ЗА ОБРАЩЕНИЕ НЕТ — решение заказчика. Двое админов могут
 * отвечать одновременно, оба ответа лягут подряд, и оба увидят друг друга:
 * имя отправителя стоит у каждого сообщения. Блокировать нечего, потому что
 * на уровне данных конфликта нет — это комната с несколькими участниками.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Send, MessageSquare, Inbox } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { unwrap } from "@/lib/action-result";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { actionReplySupport, actionMarkSupportRead } from "./actions";

type ThreadRow = {
  id: string;
  parentName: string;
  updatedAt: string;
  unreadCount: number;
  lastBody: string | null;
  lastSenderName: string | null;
  lastAt: string | null;
};
type MessageRow = { id: string; senderId: string | null; body: string; createdAt: string };

/** Дата и время в языке администратора. Без своей арифметики: раздел не
 *  зависит от заморозки времени школы, он показывает, когда пришло письмо. */
function когда(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AdminSupportView({
  threads,
  activeId,
  activeParentName,
  messages,
  nameByUserId,
  roleByUserId,
}: {
  threads: ThreadRow[];
  activeId: string | null;
  activeParentName: string | null;
  messages: MessageRow[];
  nameByUserId: Record<string, string>;
  roleByUserId: Record<string, string>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;
  const тег = locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU";
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const конец = useRef<HTMLDivElement | null>(null);

  // Прокрутка к последнему сообщению при смене обращения.
  useEffect(() => { конец.current?.scrollIntoView({ block: "end" }); }, [activeId, messages.length]);

  // Открыли обращение — оно прочитано. Без этого счётчик непрочитанного
  // остался бы гореть навсегда: красный кружок, ведущий в никуда.
  const последнее = messages.length > 0 ? (messages[messages.length - 1]?.id ?? null) : null;
  useEffect(() => {
    if (!activeId || !последнее) return;
    unwrap(actionMarkSupportRead(activeId, последнее)).catch(() => { /* отметка не критична */ });
  }, [activeId, последнее]);

  const открыть = (id: string) => {
    const p = new URLSearchParams(params?.toString() ?? "");
    p.set("thread", id);
    router.push(`/admin/support?${p.toString()}`);
  };

  const отправить = () => {
    if (!activeId || !body.trim() || isPending) return;
    setError(null);
    const текст = body.trim();
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("thread_id", activeId);
        fd.append("body", текст);
        await unwrap(actionReplySupport(fd));
        setBody("");
        router.refresh();
      } catch (e) {
        setError(humanizeAdminError(e, locale as Locale));
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">{d.supportTitle}</h1>
        <p className="text-sm text-zinc-500">{d.supportSubtitle}</p>
      </div>

      {threads.length === 0 ? (
        <div data-support-empty className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
          <Inbox className="mx-auto h-10 w-10 text-zinc-300" />
          <p className="mt-3 text-sm font-semibold text-zinc-700">{d.supportEmptyTitle}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">{d.supportEmptyText}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Список обращений: самое свежее сверху. */}
          <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
            {threads.map((t) => {
              const активен = t.id === activeId;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-thread-id={t.id}
                  onClick={() => открыть(t.id)}
                  className={
                    "block w-full border-b border-zinc-100 px-4 py-3 text-left last:border-b-0 transition-colors "
                    + (активен ? "bg-violet-50" : "hover:bg-zinc-50")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-900">{t.parentName}</span>
                    {t.unreadCount > 0 ? (
                      <span
                        data-unread={t.unreadCount}
                        className="shrink-0 rounded-full bg-violet-600 px-2 py-0.5 text-[11px] font-bold text-white"
                      >
                        {t.unreadCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-zinc-500">
                    {t.lastBody
                      ? (t.lastSenderName ? `${t.lastSenderName}: ${t.lastBody}` : t.lastBody)
                      : d.supportNoMessages}
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-400">{когда(t.lastAt ?? t.updatedAt, тег)}</div>
                </button>
              );
            })}
          </div>

          {/* Переписка и ответ. */}
          <div className="flex min-h-[480px] flex-col rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-3">
              <MessageSquare className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-semibold text-zinc-900">{activeParentName ?? ""}</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" data-messages>
              {!activeId ? (
                <p data-support-pick className="text-sm text-zinc-500">{d.supportPickThread}</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-zinc-500">{d.supportNoMessages}</p>
              ) : (
                messages.map((m) => {
                  const имя = m.senderId ? nameByUserId[m.senderId] ?? "" : "";
                  const роль = m.senderId ? roleByUserId[m.senderId] ?? "" : "";
                  const отАдмина = роль === "admin";
                  return (
                    <div key={m.id} className={otherSide(отАдмина)}>
                      <div
                        className={
                          "max-w-[80%] rounded-2xl px-3.5 py-2 "
                          + (отАдмина ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-900")
                        }
                      >
                        <div className={"text-[11px] font-semibold " + (отАдмина ? "text-violet-100" : "text-zinc-500")}>
                          {имя}
                          {роль ? ` · ${роль === "admin" ? d.supportRoleAdmin : d.supportRoleParent}` : ""}
                        </div>
                        <div className="whitespace-pre-wrap text-sm">{m.body}</div>
                        <div className={"mt-0.5 text-[10px] " + (отАдмина ? "text-violet-200" : "text-zinc-400")}>
                          {когда(m.createdAt, тег)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={конец} />
            </div>

            {error ? (
              <p className="px-5 pb-2 text-sm text-rose-600">{error}</p>
            ) : null}

            <div className="flex items-end gap-2 border-t border-zinc-100 p-3">
              <textarea
                name="support_reply"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); отправить(); }
                }}
                rows={2}
                disabled={!activeId}
                placeholder={d.supportReplyPlaceholder}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={отправить}
                data-support-send
                disabled={isPending || !body.trim() || !activeId}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isPending ? d.supportSending : d.supportSendBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Свои сообщения справа, чужие слева. Вынесено, чтобы условие не тонуло
 *  внутри строки классов. */
function otherSide(мой: boolean): string {
  return "flex " + (мой ? "justify-end" : "justify-start");
}

"use client";

/**
 * Экран d25 «Чат» — веб-порт
 * apps/mobile-parent/src/screens/messages/ChatScreen.tsx (ветка
 * feat/mobile-parent-redesign), но с настоящей перепиской.
 *
 * Блоки — те же, что в RN (макет «SNR EduOS v2 Light.dc.html», 768–800):
 *  1) шапка: back(38) + identity собеседника (аватар 40 + имя + чип предмета)
 *     + kebab(38);
 *  2) лента сообщений с разделителями дней (стеклянная пилюля 9.5/800);
 *  3) пузыри: входящие слева (стекло), исходящие справа (accent-градиент);
 *  4) композер: стеклянная пилюля r24 + поле + круглая кнопка отправки 36.
 *
 * Отличия от мобилки, осознанные:
 *  • нет «+ вложение» и эмодзи-пикера — за ними в RN стояли заглушки
 *    (stub 'aphoto'/'afile'), а загрузки файлов в чат в БД нет вовсе;
 *  • отправка настоящая: server action → sendChatMessage → revalidatePath.
 *    Пока идёт запрос, сообщение показывается «призраком» (полупрозрачным),
 *    чтобы лента не выглядела зависшей на медленной сети.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  EmptyState,
  Glyph,
  GlassCircleButton,
  ICON,
  StatusChip,
  WHITE,
} from "../../_ui/screen-kit";
import {
  accentGrad,
  glass1,
  glass2,
  glassBorder,
  ink1,
  ink2,
  ink3,
  shCard,
  status,
} from "../../v2/tokens";
import { useDates } from "../../_ui/dates";
import { markParentThreadRead, sendParentMessage } from "./actions";

export type ChatBubbleItem = {
  id: string;
  /** true = сообщение родителя (справа, accent). */
  own: boolean;
  body: string;
  /** Сырой ISO: и время, и разделитель дня собираются на языке экрана. */
  createdAt: string;
  /** Нужен ли разделитель дня ПЕРЕД этим сообщением (первое за свой день). */
  showDayDivider: boolean;
  /** Автор — показывается только в групповых тредах у чужих сообщений. */
  authorName: string | null;
};

export type ChatHeaderInfo = {
  threadId: string;
  name: string;
  initials: string;
  gradient: readonly [string, string];
  roleLabel: string | null;
  subjectLabel: string | null;
};

/** Композер — стеклянная пилюля glass-1, разделитель дня — тонкое стекло
 *  glass-2; рамка у обоих общая, glass-border. В тёмной теме все три
 *  переворачиваются сами, поэтому набранный текст (ink1) остаётся читаемым. */
const COMPOSER_BG = glass1.background;
const COMPOSER_BORDER = glassBorder;
const DIVIDER_BG = glass2.background;
const DIVIDER_BORDER = glassBorder;

export function ChatView({
  header,
  messages,
  isGroup,
  lastMessageId,
  today,
}: {
  header: ChatHeaderInfo;
  messages: ChatBubbleItem[];
  isGroup: boolean;
  lastMessageId: string | null;
  today: string;
}) {
  const router = useRouter();
  const dt = useDates();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement | null>(null);

  // Тред открыт — гасим счётчик непрочитанных (как это делает MessagesView
  // ученика: markThreadRead по последнему сообщению + refresh списка).
  useEffect(() => {
    if (!lastMessageId) return;
    void markParentThreadRead(header.threadId, lastMessageId);
  }, [header.threadId, lastMessageId]);

  // Лента прокручивается к последнему сообщению, как в мессенджере.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  const submit = () => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    setPending(text);
    setError(null);
    startTransition(async () => {
      const res = await sendParentMessage(header.threadId, text);
      if (!res.ok) {
        setError(res.error);
        setDraft(text);
      }
      setPending(null);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-104px)] w-full max-w-[430px] flex-col">
      {/* 1) Шапка: back(38) + identity собеседника. Собрана здесь, а не через
          InnerHeader: в центре не заголовок, а аватар + имя + чипы. */}
      <header
        className="flex items-center"
        style={{
          gap: 10,
          paddingTop: "max(env(safe-area-inset-top), 46px)",
          paddingInline: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton href="/parent/messages" ariaLabel="Назад к сообщениям">
          <Glyph paths={ICON.back} size={18} color={ink1} strokeWidth={2} />
        </GlassCircleButton>
        <Avatar size={40} initials={header.initials} gradient={header.gradient} fontSize={12} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[13.5px]" style={{ fontWeight: 800, color: ink1 }}>
            {header.name}
          </span>
          {header.subjectLabel || header.roleLabel ? (
            <span className="flex items-center gap-1.5">
              {header.subjectLabel ? (
                <StatusChip label={header.subjectLabel} family="blue" fontSize={8.5} />
              ) : null}
              {header.roleLabel ? (
                <StatusChip label={header.roleLabel} family="violet" fontSize={8.5} />
              ) : null}
            </span>
          ) : null}
        </div>
      </header>

      {/* 2–3) Лента сообщений. */}
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 px-[18px] pb-3 pt-1.5">
        {messages.length === 0 && !pending ? (
          <EmptyState
            title="Сообщений пока нет"
            text="Напишите первым — учитель увидит сообщение в своём кабинете."
            paths={ICON.chat}
          />
        ) : null}

        {messages.map((m) => (
          <div key={m.id} className="flex flex-col gap-2">
            {m.showDayDivider ? <DayDivider label={dt.divider(m.createdAt, today)} /> : null}
            <Bubble
              own={m.own}
              body={m.body}
              timeLabel={dt.time(m.createdAt)}
              author={isGroup && !m.own ? m.authorName : null}
            />
          </div>
        ))}

        {pending ? <Bubble own body={pending} timeLabel="отправка…" author={null} ghost /> : null}

        {error ? (
          <span className="self-center text-[9.5px]" style={{ fontWeight: 700, color: status.red.text }}>
            {error}
          </span>
        ) : null}

        <div ref={endRef} />
      </div>

      {/* 4) Композер. */}
      <div className="px-[18px] pb-3 pt-1.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex items-center gap-2"
          style={{
            padding: "7px 8px",
            borderRadius: 24,
            background: COMPOSER_BG,
            border: `1px solid ${COMPOSER_BORDER}`,
            /* Радиус размытия композера в макете — 20px; это же значение у
               --p-glass2-blur в обеих темах, поэтому берём его, а не glass-1. */
            backdropFilter: "blur(var(--p-glass2-blur, 20px))",
            WebkitBackdropFilter: "blur(var(--p-glass2-blur, 20px))",
            boxShadow: shCard,
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Написать сообщение…"
            aria-label="Текст сообщения"
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{ paddingInline: 8, fontSize: 11.5, fontWeight: 600, color: ink1 }}
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending !== null}
            aria-label="Отправить"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
            style={{
              background: accentGrad,
              boxShadow: "0 8px 18px rgba(124,58,237,0.4)",
              opacity: !draft.trim() || pending !== null ? 0.5 : 1,
            }}
          >
            <Glyph paths={ICON.send} size={15} color={WHITE} strokeWidth={2} />
          </button>
        </form>
      </div>
    </div>
  );
}

/** Разделитель дня — стеклянная пилюля 9.5/800 ink3. */
function DayDivider({ label }: { label: string }) {
  return (
    <span
      className="self-center rounded-full"
      style={{
        padding: "5px 12px",
        background: DIVIDER_BG,
        border: `1px solid ${DIVIDER_BORDER}`,
        fontSize: 9.5,
        fontWeight: 800,
        color: ink3,
      }}
    >
      {label}
    </span>
  );
}

/** Пузырь: входящий — стекло glass1, исходящий — accent-градиент. */
function Bubble({
  own,
  body,
  timeLabel,
  author,
  ghost = false,
}: {
  own: boolean;
  body: string;
  timeLabel: string;
  author: string | null;
  ghost?: boolean;
}) {
  return (
    <div
      className="flex max-w-[80%] flex-col gap-1"
      style={{
        alignSelf: own ? "flex-end" : "flex-start",
        padding: "9px 12px",
        borderRadius: 18,
        borderBottomRightRadius: own ? 6 : 18,
        borderBottomLeftRadius: own ? 18 : 6,
        background: own ? accentGrad : glass1.background,
        border: own ? undefined : `1px solid ${glassBorder}`,
        backdropFilter: own ? undefined : "blur(var(--p-glass1-blur, 22px))",
        WebkitBackdropFilter: own ? undefined : "blur(var(--p-glass1-blur, 22px))",
        boxShadow: own ? "0 8px 18px rgba(124,58,237,0.28)" : shCard,
        opacity: ghost ? 0.65 : 1,
      }}
    >
      {author ? (
        <span style={{ fontSize: 9, fontWeight: 800, color: own ? "rgba(255,255,255,0.85)" : status.violet.text }}>
          {author}
        </span>
      ) : null}
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          lineHeight: "17px",
          color: own ? WHITE : ink1,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {body}
      </span>
      <span
        className="self-end"
        style={{ fontSize: 8.5, fontWeight: 700, color: own ? "rgba(255,255,255,0.8)" : ink2 }}
      >
        {timeLabel}
      </span>
    </div>
  );
}

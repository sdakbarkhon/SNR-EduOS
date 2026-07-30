"use client";

/**
 * Экран d24 «Сообщения» — состав 1:1 с
 * apps/mobile-parent/src/screens/tabs/MessagesScreen.tsx (ветка
 * feat/mobile-parent-redesign), но на РЕАЛЬНЫХ данных.
 *
 * Что изменилось против первой веб-версии (Блок 7.1):
 *  • треды приходят из `chat_threads`/`chat_messages` через
 *    parentThreads() → ParentThreadVM, а не из фикстуры v2/data —
 *    раньше экран показывал выдуманных учителей и чужих детей;
 *  • объявления школы — реальные (`getParentAnnouncements`), вкладка
 *    «Объявления» показывает их и ведёт на /parent/announcements;
 *  • вкладки «Сервисы» больше нет: за ней стояла чистая фикстура (столовая,
 *    транспорт, кружки) без единой таблицы в БД — показывать её на реальном
 *    экране значило бы врать. Осталось три: Все / Чаты / Объявления;
 *  • сториз строятся из тех же реальных тредов (первые пять собеседников)
 *    плюс «Важные» → объявления, вместо пяти захардкоженных кружков.
 *
 * Геометрия/цвета — прежние, дословно из макета «SNR EduOS v2 Light.dc.html»
 * (строки 747–766): шапка 46/18/8, лента сториз 54×54, SegmentPills, карточки
 * тредов r24 с аватаром 42.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "../v2/GlassCard";
import {
  Avatar,
  ChevronRight,
  EmptyState,
  Glyph,
  GlassCircleButton,
  ICON,
  IconTile,
  SegmentPills,
  StatusChip,
  grad135,
  WHITE,
} from "../_ui/screen-kit";
import { accentGrad, chip, fontDisplay, ink1, ink2, ink3, status } from "../v2/tokens";

/* ── Пропсы: всё считает сервер (см. page.tsx) ───────────────────────────── */

export type MessagesThreadItem = {
  id: string;
  name: string;
  roleLabel: string | null;
  timeLabel: string;
  preview: string;
  unread: number;
  initials: string;
  gradient: readonly [string, string];
};

export type MessagesAnnouncementItem = {
  id: string;
  title: string;
  preview: string;
  dateLabel: string;
  isPinned: boolean;
};

/** Тень accent-бейджа списка сообщений: 0 4 10 rgba(124,58,237,.4). */
const BADGE_ACCENT_SHADOW = "0 4px 10px rgba(124,58,237,0.4)";

type Tab = "all" | "chats" | "ann";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "chats", label: "Чаты" },
  { key: "ann", label: "Объявления" },
];

export function MessagesView({
  threads,
  announcements,
}: {
  threads: MessagesThreadItem[];
  announcements: MessagesAnnouncementItem[];
}) {
  const [tab, setTab] = useState<Tab>("all");

  const showThreads = tab === "all" || tab === "chats";
  const showAnnouncements = tab === "all" || tab === "ann";

  /** Сториз: «Важные» (объявления) + первые пять собеседников. */
  const stories = useMemo(
    () => threads.slice(0, 5),
    [threads],
  );

  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === tab));
  // На вкладке «Все» объявления — только превью из двух свежих: список чатов
  // не должен тонуть в новостной ленте, за полной есть /parent/announcements.
  const annPreview = tab === "ann" ? announcements : announcements.slice(0, 2);
  const isEmpty =
    (showThreads ? threads.length === 0 : true) && (showAnnouncements ? annPreview.length === 0 : true);

  return (
    <div className="mx-auto w-full max-w-[430px]">
      {/* ─── Шапка: заголовок + Написать (46/18/8) ─── */}
      <div className="flex items-center gap-3 px-[18px] pb-2 pt-[46px]">
        <h1
          className="flex-1 text-[17px]"
          style={{ fontFamily: fontDisplay, fontWeight: 600, color: ink1 }}
        >
          Сообщения
        </h1>
        <GlassCircleButton href="/parent/notifications" ariaLabel="Уведомления">
          <Glyph paths={ICON.bell} size={17} color={ink1} strokeWidth={1.8} />
        </GlassCircleButton>
      </div>

      <div className="flex flex-col gap-[11px] pb-2">
        {/* ─── Лента сториз: «Важные» + реальные собеседники ─── */}
        <div
          className="flex gap-3 overflow-x-auto px-[18px] py-1 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <Link href="/parent/announcements" className="flex w-[56px] shrink-0 flex-col items-center gap-1">
            <StoryRing gradient={["#f472b6", "#db2777"]} ringIsAccent={false}>
              <Glyph paths={ICON.mega} size={18} color={WHITE} strokeWidth={1.8} />
            </StoryRing>
            <span className="w-[56px] truncate text-center text-[8px]" style={{ fontWeight: 700, color: ink2 }}>
              Важные
            </span>
          </Link>

          {stories.map((t) => (
            <Link
              key={t.id}
              href={`/parent/chat/${t.id}`}
              className="flex w-[56px] shrink-0 flex-col items-center gap-1"
            >
              <StoryRing gradient={t.gradient} ringIsAccent>
                <span style={{ fontSize: 16, fontWeight: 800, color: WHITE }}>{t.initials}</span>
              </StoryRing>
              <span className="w-[56px] truncate text-center text-[8px]" style={{ fontWeight: 700, color: ink2 }}>
                {t.name}
              </span>
            </Link>
          ))}
        </div>

        {/* ─── SegmentPills ─── */}
        <div className="px-[18px]">
          <SegmentPills
            items={TABS.map((t) => t.label)}
            activeIndex={activeIndex}
            onChange={(i) => setTab(TABS[i]?.key ?? "all")}
          />
        </div>

        {/* ─── Список ─── */}
        <div className="flex flex-col gap-[11px] px-[18px]">
          {showThreads
            ? threads.map((t) => <ThreadCard key={t.id} row={t} />)
            : null}

          {showAnnouncements && annPreview.length > 0 ? (
            <>
              {tab === "all" ? (
                <div className="flex items-center justify-between pt-1">
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: 0.84,
                      textTransform: "uppercase",
                      color: "rgba(26,19,74,0.5)",
                    }}
                  >
                    Объявления школы
                  </span>
                  <Link href="/parent/announcements" className="flex items-center gap-1">
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: status.violet.text }}>Все</span>
                    <ChevronRight />
                  </Link>
                </div>
              ) : null}
              {annPreview.map((a) => (
                <AnnouncementRow key={a.id} row={a} />
              ))}
            </>
          ) : null}

          {isEmpty ? (
            <GlassCard>
              <EmptyState
                title={tab === "ann" ? "Объявлений пока нет" : "Чатов пока нет"}
                text={
                  tab === "ann"
                    ? "Здесь появятся новости школы и класса вашего ребёнка."
                    : "Здесь появятся переписки с учителями и администрацией школы."
                }
                paths={tab === "ann" ? ICON.mega : ICON.chat}
              />
            </GlassCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ═══ Story-круг 54×54: кольцо 2.5 + белый зазор 2 ═══ */

function StoryRing({
  gradient,
  ringIsAccent,
  children,
}: {
  gradient: readonly [string, string];
  ringIsAccent: boolean;
  children: React.ReactNode;
}) {
  const SIZE = 54;
  const face = grad135(gradient);
  return (
    <span className="relative block" style={{ width: SIZE, height: SIZE }}>
      <span
        className="block h-full w-full rounded-full"
        style={{ background: ringIsAccent ? accentGrad : face, padding: 2.5 }}
      >
        <span className="block h-full w-full rounded-full" style={{ background: WHITE, padding: 2 }}>
          <span
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ background: face }}
          >
            {children}
          </span>
        </span>
      </span>
    </span>
  );
}

/* ═══ Карточка треда ═══ */

function ThreadCard({ row }: { row: MessagesThreadItem }) {
  return (
    <Link href={`/parent/chat/${row.id}`} className="block">
      <GlassCard className="flex items-center gap-[11px]" style={{ padding: "11px 13px" }}>
        <Avatar size={42} initials={row.initials} gradient={row.gradient} fontSize={13} />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 shrink truncate text-[12.5px]" style={{ fontWeight: 800, color: ink1 }}>
              {row.name}
            </span>
            {row.roleLabel ? <RoleChip label={row.roleLabel} /> : null}
            <span className="flex-1" />
            <span className="shrink-0 text-[9px]" style={{ fontWeight: 700, color: ink3 }}>
              {row.timeLabel}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <p
              className="min-w-0 flex-1 text-[10.5px]"
              style={{
                fontWeight: 600,
                lineHeight: "15px",
                color: ink2,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {row.preview}
            </p>
            {row.unread > 0 ? <CountBadge value={row.unread} /> : null}
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}

/** Мини-чип роли (Учитель / Куратор / Класс) — 8.5/800, r999, статус violet. */
function RoleChip({ label }: { label: string }) {
  const c = status.violet;
  const cs = chip(c.rgb);
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-full"
      style={{
        padding: "2px 7px",
        background: cs.background,
        border: `1px solid ${cs.borderColor}`,
        color: c.text,
        fontSize: 8.5,
        fontWeight: 800,
      }}
    >
      {label}
    </span>
  );
}

/** CountBadge preset="accent" size={17}. */
function CountBadge({ value }: { value: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        minWidth: 17,
        height: 17,
        padding: "0 4px",
        background: accentGrad,
        boxShadow: BADGE_ACCENT_SHADOW,
        fontSize: 9.5,
        fontWeight: 800,
        color: WHITE,
      }}
    >
      {value}
    </span>
  );
}

/** Строка объявления в ленте сообщений — ведёт на полный экран объявлений. */
function AnnouncementRow({ row }: { row: MessagesAnnouncementItem }) {
  return (
    <Link href="/parent/announcements" className="block">
      <GlassCard className="flex items-center gap-[11px]" style={{ padding: "11px 13px" }}>
        <IconTile gradient={["#f472b6", "#db2777"]} paths={ICON.mega} size={42} glyphSize={20} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="min-w-0 shrink truncate text-[12.5px]" style={{ fontWeight: 800, color: ink1 }}>
              {row.title}
            </span>
            {row.isPinned ? <StatusChip label="Закреплено" family="orange" fontSize={8.5} /> : null}
            <span className="flex-1" />
            <span className="shrink-0 text-[9px]" style={{ fontWeight: 700, color: ink3 }}>
              {row.dateLabel}
            </span>
          </div>
          <p
            className="min-w-0 flex-1 text-[10.5px]"
            style={{
              fontWeight: 600,
              lineHeight: "15px",
              color: ink2,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {row.preview}
          </p>
        </div>
      </GlassCard>
    </Link>
  );
}

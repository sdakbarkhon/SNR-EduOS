"use client";

/**
 * Экран П8 «Уведомления» — веб-порт
 * apps/mobile-parent/src/screens/study/NotificationsScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 686–702), на реальной таблице
 * `notifications` (getMyNotifications → parentNotifications).
 *
 * Что от макета осталось: фильтр-пилюли, секции по дням, карточка r18 с
 * круглой градиентной иконкой 38, точка «непрочитано» и время справа.
 *
 * Отличия:
 *  • фильтров два, а не три: «Важные» в макете опирались на выдуманный флаг
 *    is_important, которого в `notifications` нет — вместо выдумки остались
 *    «Все» и «Непрочитанные»;
 *  • секции — «Сегодня / Вчера / Ранее»: у реального родителя уведомления
 *    старше вчерашнего дня существуют, а в фикстуре их не бывало;
 *  • иконка и переход выбираются по `kind` (реальная колонка), а не по
 *    фикстурному полю `go`.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useDates } from "../_ui/dates";
import { GlassCard } from "../v2/GlassCard";
import { EmptyState, ICON, IconTile, SectionCap, SegmentPills } from "../_ui/screen-kit";
import { accentGrad, ink1, ink2, ink3 } from "../v2/tokens";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  /** Сырой ISO: подпись времени собирается здесь, на языке пользователя. */
  createdAt: string;
  isRead: boolean;
  /** `notifications.kind` — определяет иконку и переход. */
  kind: string;
  /** Куда ведёт карточка; null — карточка не кликабельна. */
  href: string | null;
  bucket: "today" | "yesterday" | "earlier";
};

/** kind → градиент + глиф. Наборы путей — те же, что в RN-экране. */
const KIND_STYLE: Record<string, { gradient: [string, string]; paths: readonly string[] }> = {
  new_grade: { gradient: ["#34d399", "#059669"], paths: ICON.check },
  homework_graded: { gradient: ["#34d399", "#059669"], paths: ICON.check },
  new_homework: { gradient: ["#60a5fa", "#2563eb"], paths: ICON.checkSquare },
  student_submitted: { gradient: ["#60a5fa", "#2563eb"], paths: ICON.checkSquare },
  lesson_material: { gradient: ["#22d3ee", "#0891b2"], paths: ICON.doc },
  lesson_starting_soon: { gradient: ["#a78bfa", "#7c3aed"], paths: ICON.clock },
  student_excused: { gradient: ["#fbbf24", "#f97316"], paths: ICON.clock },
  leave_request: { gradient: ["#fbbf24", "#f97316"], paths: ICON.doc },
  leave_decision: { gradient: ["#fbbf24", "#f97316"], paths: ICON.doc },
  announcement: { gradient: ["#f472b6", "#db2777"], paths: ICON.mega },
};

const FALLBACK_STYLE = { gradient: ["#94a3b8", "#64748b"] as [string, string], paths: ICON.bell };

type Filter = "all" | "unread";

export function NotificationsView({ items, today }: { items: NotificationItem[]; today: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { locale } = useLocale();
  const dd = getDictionary(locale).parentApp.date;
  // 14.08.2026: подписи фильтров и пустых состояний переехали в словарь
  // (`parentApp.more4`) — те же строки понадобились мобильному экрану, а до
  // этого они лежали здесь русскими литералами и оставались русскими на
  // узбекском и английском.
  const m4 = getDictionary(locale).parentApp.more4;
  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: m4.notifFilterAll },
    { key: "unread", label: m4.notifFilterUnread },
  ];
  const bucketLabel: Record<NotificationItem["bucket"], string> = {
    today: dd.today,
    yesterday: dd.yesterday,
    earlier: dd.earlier,
  };

  const shown = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.isRead) : items),
    [filter, items],
  );

  const sections = useMemo(
    () =>
      (["today", "yesterday", "earlier"] as const)
        .map((bucket) => ({ bucket, rows: shown.filter((n) => n.bucket === bucket) }))
        .filter((s) => s.rows.length > 0),
    [shown],
  );

  const activeIndex = Math.max(0, FILTERS.findIndex((f) => f.key === filter));

  return (
    <div className="flex flex-col" style={{ gap: 11 }}>
      <SegmentPills
        items={FILTERS.map((f) => f.label)}
        activeIndex={activeIndex}
        onChange={(i) => setFilter(FILTERS[i]?.key ?? "all")}
      />

      {sections.length === 0 ? (
        <GlassCard>
          <EmptyState
            title={filter === "unread" ? m4.notifUnreadEmptyTitle : m4.notifEmptyTitle}
            text={filter === "unread" ? m4.notifUnreadEmptyText : m4.notifEmptyText}
            paths={ICON.bell}
          />
        </GlassCard>
      ) : null}

      {sections.map((s) => (
        <div key={s.bucket} className="flex flex-col" style={{ gap: 11 }}>
          <SectionCap label={bucketLabel[s.bucket]} tone="ink3" />
          {s.rows.map((n) => (
            <NotificationCard key={n.id} row={n} today={today} />
          ))}
        </div>
      ))}
    </div>
  );
}

function NotificationCard({ row, today }: { row: NotificationItem; today: string }) {
  const style = KIND_STYLE[row.kind] ?? FALLBACK_STYLE;
  const dt = useDates();

  const card = (
    <GlassCard
      radius={18}
      className="flex items-start gap-2.5"
      style={{ padding: "11px 13px" }}
    >
      <IconTile gradient={style.gradient} paths={style.paths} size={38} round glyphSize={16} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 flex-1 truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
            {row.title}
          </span>
          <span className="shrink-0" style={{ fontSize: 9, fontWeight: 700, color: ink3 }}>
            {dt.stamp(row.createdAt, today)}
          </span>
        </div>
        {row.body ? (
          <span style={{ fontSize: 10.5, fontWeight: 600, lineHeight: "15px", color: ink2 }}>
            {row.body}
          </span>
        ) : null}
      </div>
      <span
        aria-hidden
        className="shrink-0 rounded-full"
        style={{
          width: 8,
          height: 8,
          marginTop: 4,
          background: row.isRead ? "transparent" : accentGrad,
          boxShadow: row.isRead ? undefined : "0 0 6px rgba(124,58,237,0.5)",
        }}
      />
    </GlassCard>
  );

  return row.href ? (
    <Link href={row.href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

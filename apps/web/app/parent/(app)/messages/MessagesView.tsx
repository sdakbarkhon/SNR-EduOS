"use client";

/**
 * Экран d24 «Сообщения» — ВЕБ-порт 1:1 из
 * apps/mobile-parent/src/screens/tabs/MessagesScreen.tsx (ветка
 * feat/mobile-parent-redesign), который сам перенесён из макета
 * «SNR EduOS v2 Light.dc.html» (строки 747–766).
 *
 * Порядок блоков — как в RN-экране:
 *  1. Шапка: заголовок «Сообщения» (Unbounded 17/600) + две круглые
 *     стеклянные кнопки Поиск / Написать. padding 46/18/8, gap 12.
 *  2. Горизонтальная лента сториз (5 круглых 54×54): «Важные»,
 *     «Кл. руковод.» (СУ), «Математика» (ГЮ), «Английский» (НА),
 *     «Администрация». Инициалы — с зелёной точкой онлайн и кольцом
 *     accent-градиента; иконки — кольцо своего градиента, белый зазор 2.
 *  3. SegmentPills 4 таба «Все / Чаты / Объявления / Сервисы».
 *     На «Сервисы» — красная точка-бейдж 6×6 (dotIndexes={[3]}).
 *  4. Список тредов: стеклянные карточки r24, каждая — аватар 42 + row
 *     (name, role-чип, время справа) + row (preview 2 строки, badge справа).
 *     Фильтрация по выбранной вкладке через getMessageThreads(category).
 *
 * Данные — ТОЛЬКО из ../v2/data (точная копия data-слоя мобилки).
 * Тексты — ru-ветка словаря мобилки (packages/core/src/i18n/ru.ts,
 * parentApp.nav.messages + parentApp.msg.*), зашиты строками: вебу нужен
 * только русский.
 */

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Clock,
  CreditCard,
  LayoutGrid,
  Megaphone,
  MessageCircle,
  PenLine,
  Plus,
  Search,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { GlassCard } from "../v2/GlassCard";
import { getMessageThreads, getMessagesStories } from "../v2/data";
import type { MessagesStoryRow, MessageThreadRow } from "../v2/data";
import {
  accentGrad,
  chip,
  fontDisplay,
  glass1,
  glassBorder,
  ink1,
  ink2,
  ink3,
  status,
} from "../v2/tokens";

/* ═══ Иконки: ICONS макета (SVG-пути 24×24) → lucide-react ═══ */

const ICON_MAP: Record<string, LucideIcon> = {
  mega: Megaphone,
  grid: LayoutGrid,
  card: CreditCard,
  food: Utensils,
  clock: Clock,
  plus: Plus,
  chat: MessageCircle,
};

/* ═══ Табы (CATEGORIES + CAT_LABEL_KEY RN-экрана, ru-словарь) ═══ */

type Cat = "all" | MessageThreadRow["category"];

const CATEGORIES: { key: Cat; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "chats", label: "Чаты" },
  { key: "ann", label: "Объявления" },
  { key: "svc", label: "Сервисы" },
];

/** Красная точка-бейдж — только на «Сервисы» (dotIndexes={[3]}). */
const DOT_INDEXES = [3];

/** parentApp.msg.story* — лейблы сториз (label_key фикстуры → ru). */
const STORY_LABELS: Record<string, string> = {
  storyImportant: "Важные",
  storyCurator: "Кл. руковод.",
  storyMath: "Математика",
  storyEng: "Английский",
  storyAdmin: "Администрация",
};

/** Онлайн-точка макета (строки 2759/3581): #22C55E + border 2px #fff. */
const ONLINE_GREEN = "#22C55E";
const INNER_RING = "#FFFFFF";

/** Неактивная gt-пилюля SegmentPills: 160° W60→W40, текст .66 (строка 3835). */
const PILL_INACTIVE_BG =
  "linear-gradient(160deg, rgba(255,255,255,0.6), rgba(255,255,255,0.4))";
const PILL_INACTIVE_TEXT = "rgba(26,19,74,0.66)";
/** Тень активной пилюли gt: 0 8 18 rgba(124,58,237,.35). */
const PILL_ACTIVE_SHADOW = "0 8px 18px rgba(124,58,237,0.35)";
/** Тень accent-бейджа списка сообщений: 0 4 10 rgba(124,58,237,.4) (строка 3585). */
const BADGE_ACCENT_SHADOW = "0 4px 10px rgba(124,58,237,0.4)";

const gradient135 = (g: readonly [string, string]) =>
  `linear-gradient(135deg, ${g[0]}, ${g[1]})`;

export function MessagesView() {
  const [category, setCategory] = useState<Cat>("all");

  const stories = getMessagesStories();
  const threads = useMemo<MessageThreadRow[]>(
    () => (category === "all" ? getMessageThreads() : getMessageThreads(category)),
    [category],
  );

  return (
    <div className="mx-auto w-full max-w-[430px]">
      {/* ─── 1. Шапка: заголовок + Поиск + Написать (46/18/8) ─── */}
      <div className="flex items-center gap-3 px-[18px] pb-2 pt-[46px]">
        <h1
          className="flex-1 text-[17px]"
          style={{ fontFamily: fontDisplay, fontWeight: 600, color: ink1 }}
        >
          Сообщения
        </h1>
        <GlassCircleButton>
          {/* ICONS.search 16, stroke 2. */}
          <Search size={16} color={ink1} strokeWidth={2} />
        </GlassCircleButton>
        <GlassCircleButton>
          {/* Глиф «карандаш» 15, stroke 1.9 (M12 20h9 / M16.5 3.5…). */}
          <PenLine size={15} color={ink1} strokeWidth={1.9} />
        </GlassCircleButton>
      </div>

      {/* ─── Скролл-часть экрана (TabScreenScroll: gap 11, paddingBottom 8) ─── */}
      <div className="flex flex-col gap-[11px] pb-2">
        {/* ─── 2. Лента сториз (paddingH 18, paddingV 4, gap 12) ─── */}
        <div
          className="flex gap-3 overflow-x-auto px-[18px] py-1 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {stories.map((s) => (
            <button
              key={s.id}
              type="button"
              className="flex w-[56px] shrink-0 flex-col items-center gap-1"
            >
              <StoryCircle story={s} />
              <span
                className="w-[56px] truncate text-center text-[8px]"
                style={{ fontWeight: 700, color: ink2 }}
              >
                {STORY_LABELS[s.label_key] ?? s.label_key}
              </span>
            </button>
          ))}
        </div>

        {/* ─── 3. SegmentPills — 4 таба, красная точка на «Сервисы» ─── */}
        <div className="px-[18px]">
          <div className="flex gap-[7px]">
            {CATEGORIES.map((c, i) => {
              const active = c.key === category;
              const pillStyle: CSSProperties = active
                ? {
                    background: accentGrad,
                    color: "#FFFFFF",
                    fontWeight: 800,
                    boxShadow: PILL_ACTIVE_SHADOW,
                  }
                : {
                    background: PILL_INACTIVE_BG,
                    color: PILL_INACTIVE_TEXT,
                    fontWeight: 700,
                  };
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className="relative flex flex-1 items-center justify-center rounded-full py-[9px] text-[11.5px]"
                  style={pillStyle}
                >
                  {c.label}
                  {DOT_INDEXES.includes(i) ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute rounded-full"
                      style={{
                        top: 4,
                        right: 6,
                        width: 6,
                        height: 6,
                        background: "#ef4444",
                      }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── 4. Список тредов — стеклянные карточки (paddingH 18, gap 11) ─── */}
        <div className="flex flex-col gap-[11px] px-[18px]">
          {threads.map((m) => (
            <ThreadCard key={`${m.category}-${m.name}`} row={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ Круглая стеклянная кнопка 38 (RootHeader.GlassCircleButton) ═══ */

/** Строка 223 макета: 38×38 r19, glass-1 160° W72→W46, blur(18), border W80. */
function GlassCircleButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full"
      style={{
        background: glass1.background,
        border: `1px solid ${glassBorder}`,
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      {children}
    </button>
  );
}

/* ═══ Story-круг 54×54: наружное кольцо 2.5 + белый зазор 2 ═══ */

function StoryCircle({ story }: { story: MessagesStoryRow }) {
  const SIZE = 54;
  const isChat = story.kind === "chat" && Boolean(story.initials);
  const face = gradient135(story.gradient);
  /**
   * Чат-сториз рисуется через Avatar variant="story" БЕЗ storyGradient —
   * значит внешнее кольцо у него accent-градиентное, а градиент данных
   * уходит на лицо круга. У icon-сториз кольцо и лицо — один градиент.
   */
  const ring = isChat ? accentGrad : face;
  const Icon = story.icon_key ? ICON_MAP[story.icon_key] : undefined;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <div className="h-full w-full rounded-full" style={{ background: ring, padding: 2.5 }}>
        <div className="h-full w-full rounded-full" style={{ background: INNER_RING, padding: 2 }}>
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ background: face }}
          >
            {isChat ? (
              // av(): fontSize = round(54 × 0.3) = 16, вес 800, белый.
              <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>
                {story.initials}
              </span>
            ) : Icon ? (
              <Icon size={18} color="#FFFFFF" strokeWidth={1.8} />
            ) : null}
          </div>
        </div>
      </div>
      {isChat && story.is_online ? (
        <span
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: 12,
            height: 12,
            background: ONLINE_GREEN,
            border: `2px solid ${INNER_RING}`,
          }}
        />
      ) : null}
    </div>
  );
}

/* ═══ Карточка треда: аватар + name/role/time + preview/badge ═══ */

function ThreadCard({ row }: { row: MessageThreadRow }) {
  return (
    <GlassCard className="flex items-center gap-[11px]" style={{ padding: "11px 13px" }}>
      <ThreadAvatar row={row} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Верх: имя + role-чип + время. */}
        <div className="flex items-center gap-1.5">
          <span
            className="min-w-0 shrink truncate text-[12.5px]"
            style={{ fontWeight: 800, color: ink1 }}
          >
            {row.name}
          </span>
          {row.role_label ? <RoleChip label={row.role_label} /> : null}
          <span className="flex-1" />
          <span className="shrink-0 text-[9px]" style={{ fontWeight: 700, color: ink3 }}>
            {row.time_label}
          </span>
        </div>

        {/* Низ: preview (2 строки) + badge. */}
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
          {row.badge ? <CountBadge value={row.badge} /> : null}
        </div>
      </div>
    </GlassCard>
  );
}

/** Аватар треда: 42×42 круг с инициалами (+online) или квадрат-градиент r13 с иконкой. */
function ThreadAvatar({ row }: { row: MessageThreadRow }) {
  const SIZE = 42;
  const grad: [string, string] = row.avatar_gradient ?? ["#8b5cf6", "#6366f1"];
  const bg = gradient135(grad);

  if (row.avatar_initials) {
    return (
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <div
          className="flex h-full w-full items-center justify-center rounded-full"
          style={{
            background: bg,
            // Avatar variant="ring": box-shadow 0 0 0 2px #fff (строки 2759, 3580).
            boxShadow: `0 0 0 2px ${INNER_RING}`,
            // av(): fontSize = round(42 × 0.3) = 13.
            fontSize: 13,
            fontWeight: 800,
            color: "#FFFFFF",
          }}
        >
          {row.avatar_initials}
        </div>
        {row.is_online ? (
          <span
            className="absolute bottom-0 right-0 rounded-full"
            style={{
              width: 11,
              height: 11,
              background: ONLINE_GREEN,
              border: `2px solid ${INNER_RING}`,
            }}
          />
        ) : null}
      </div>
    );
  }

  const Icon = ICON_MAP[row.avatar_icon_key ?? "chat"] ?? MessageCircle;
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{ width: SIZE, height: SIZE, borderRadius: 13, background: bg }}
    >
      <Icon size={20} color="#FFFFFF" strokeWidth={1.9} />
    </div>
  );
}

/** Мини-чип роли (Учитель / Куратор 7-А) — 8.5/800, r999, статус violet. */
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

/** CountBadge preset="accent" size={17} — строка 3585 макета. */
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
        color: "#FFFFFF",
      }}
    >
      {value}
    </span>
  );
}

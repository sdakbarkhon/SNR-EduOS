"use client";

import { useState } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { GlassCircleButton } from "@/components/parent/glass/GlassCircleButton";
import { ink1, ink2, ink3 } from "@/lib/parent/glass-tokens";

type IconKey = "mega" | "grid" | "card" | "food" | "clock" | "plus";

function IconBase({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

const MegaIcon = () => (
  <IconBase>
    <path d="m3 11 18-7v16L3 13v-2Z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </IconBase>
);
const GridIcon = () => (
  <IconBase>
    <path d="M3 3h7v7H3z" />
    <path d="M14 3h7v7h-7z" />
    <path d="M3 14h7v7H3z" />
    <path d="M14 14h7v7h-7z" />
  </IconBase>
);
const CardIcon = () => (
  <IconBase>
    <path d="M2 8a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" />
    <path d="M2 10h20" />
  </IconBase>
);
const FoodIcon = () => (
  <IconBase>
    <path d="M4 2v7a3 3 0 0 0 6 0V2" />
    <path d="M7 12v10" />
    <path d="M20 2a4 4 0 0 0-4 4v7h4" />
    <path d="M20 13v9" />
  </IconBase>
);
const ClockIcon = () => (
  <IconBase>
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
    <path d="M12 7v5l3 2" />
  </IconBase>
);
const PlusIcon = () => (
  <IconBase>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </IconBase>
);

const AVATAR_ICONS: Record<IconKey, React.ReactNode> = {
  mega: <MegaIcon />,
  grid: <GridIcon />,
  card: <CardIcon />,
  food: <FoodIcon />,
  clock: <ClockIcon />,
  plus: <PlusIcon />,
};

function SearchIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={ink1} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={ink1} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

type ThreadCategory = "chats" | "ann" | "svc";

type ThreadRow = {
  category: ThreadCategory;
  name: string;
  roleLabel: string | null;
  preview: string;
  timeLabel: string;
  badge: number | null;
  avatarGradient: [string, string];
  avatarInitials?: string;
  avatarIconKey?: IconKey;
  isOnline?: boolean;
};

// Мок 1:1 с apps/mobile-parent/src/data/fixtures/messages.ts (MESSAGE_THREADS) —
// личных чатов родитель-учитель по факту 0 в БД (только один групповой тред
// «Родители»), поэтому экран остаётся на фикстуре, как и в самой мобилке.
const MESSAGE_THREADS: ThreadRow[] = [
  {
    category: "chats",
    name: "Гульнора Юсупова",
    roleLabel: "Учитель",
    preview: "И поздравляю Малику с пятёркой за контрольную 🎉",
    timeLabel: "09:00",
    badge: 2,
    avatarGradient: ["#8b5cf6", "#6366f1"],
    avatarInitials: "ГЮ",
    isOnline: true,
  },
  {
    category: "ann",
    name: "Объявления школы",
    roleLabel: null,
    preview: "24 июля состоится школьная ярмарка. Будем рады видеть вас!",
    timeLabel: "вчера",
    badge: 3,
    avatarGradient: ["#a78bfa", "#7c3aed"],
    avatarIconKey: "mega",
  },
  {
    category: "chats",
    name: "Севара Умарова",
    roleLabel: "Куратор 7-А",
    preview: "Уважаемые родители! Напоминаю о родительском собрании 30 июля",
    timeLabel: "вчера",
    badge: 1,
    avatarGradient: ["#f472b6", "#8b5cf6"],
    avatarInitials: "СУ",
    isOnline: true,
  },
  {
    category: "chats",
    name: "Администрация",
    roleLabel: null,
    preview: "Ваше заявление на справку принято. Готовность: 26 июля",
    timeLabel: "19 июля",
    badge: null,
    avatarGradient: ["#60a5fa", "#2563eb"],
    avatarIconKey: "grid",
  },
  {
    category: "svc",
    name: "Бухгалтерия",
    roleLabel: null,
    preview: "Поступил платёж на сумму 4 500 000 сум за июль. Спасибо!",
    timeLabel: "18 июля",
    badge: null,
    avatarGradient: ["#34d399", "#059669"],
    avatarIconKey: "card",
  },
  {
    category: "svc",
    name: "Питание",
    roleLabel: null,
    preview: "Меню на следующую неделю уже доступно в разделе «Питание»",
    timeLabel: "18 июля",
    badge: null,
    avatarGradient: ["#f472b6", "#db2777"],
    avatarIconKey: "food",
  },
  {
    category: "svc",
    name: "Транспорт",
    roleLabel: null,
    preview: "Изменение маршрута №3 с 28 июля. Проверьте расписание",
    timeLabel: "17 июля",
    badge: null,
    avatarGradient: ["#fbbf24", "#f97316"],
    avatarIconKey: "clock",
  },
  {
    category: "svc",
    name: "Медкабинет",
    roleLabel: null,
    preview: "Плановый медосмотр 30 июля. Подробнее в объявлении",
    timeLabel: "17 июля",
    badge: null,
    avatarGradient: ["#fb7185", "#e11d48"],
    avatarIconKey: "plus",
  },
];

type StoryRow = {
  id: string;
  labelKey: string;
  gradient: [string, string];
  kind: "chat" | "icon";
  initials?: string;
  isOnline?: boolean;
  iconKey?: IconKey;
};

// Мок 1:1 с MESSAGES_STORIES из той же фикстуры.
const MESSAGES_STORIES: StoryRow[] = [
  { id: "important", labelKey: "storyImportant", gradient: ["#a78bfa", "#7c3aed"], kind: "icon", iconKey: "mega" },
  { id: "curator", labelKey: "storyCurator", gradient: ["#f472b6", "#8b5cf6"], kind: "chat", initials: "СУ", isOnline: true },
  { id: "math", labelKey: "storyMath", gradient: ["#8b5cf6", "#6366f1"], kind: "chat", initials: "ГЮ", isOnline: true },
  { id: "eng", labelKey: "storyEng", gradient: ["#f472b6", "#db2777"], kind: "chat", initials: "НА", isOnline: true },
  { id: "admin", labelKey: "storyAdmin", gradient: ["#60a5fa", "#2563eb"], kind: "icon", iconKey: "grid" },
];

function StoryCircle({ story }: { story: StoryRow }) {
  const inner =
    story.kind === "chat" ? (
      <span className="text-[16px] font-extrabold text-white">{story.initials}</span>
    ) : (
      story.iconKey && AVATAR_ICONS[story.iconKey]
    );

  return (
    <div className="relative h-[54px] w-[54px] shrink-0">
      <div
        className="flex h-full w-full items-center justify-center rounded-full p-[2.5px]"
        style={{ background: `linear-gradient(135deg, ${story.gradient[0]}, ${story.gradient[1]})` }}
      >
        <div className="flex h-full w-full items-center justify-center rounded-full bg-white p-[2px]">
          <div
            className="flex h-full w-full items-center justify-center rounded-full"
            style={{ background: `linear-gradient(135deg, ${story.gradient[0]}, ${story.gradient[1]})` }}
          >
            {inner}
          </div>
        </div>
      </div>
      {story.isOnline && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white" style={{ background: "#22c55e" }} />
      )}
    </div>
  );
}

function ThreadAvatar({ row }: { row: ThreadRow }) {
  if (row.avatarInitials) {
    return (
      <div className="relative shrink-0">
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full border-2 border-white text-[13px] font-extrabold text-white"
          style={{ background: `linear-gradient(135deg, ${row.avatarGradient[0]}, ${row.avatarGradient[1]})` }}
        >
          {row.avatarInitials}
        </div>
        {row.isOnline && (
          <span className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-2 border-white" style={{ background: "#22c55e" }} />
        )}
      </div>
    );
  }
  return (
    <div
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px]"
      style={{ background: `linear-gradient(135deg, ${row.avatarGradient[0]}, ${row.avatarGradient[1]})` }}
    >
      {row.avatarIconKey && AVATAR_ICONS[row.avatarIconKey]}
    </div>
  );
}

type TabKey = "all" | "chats" | "ann" | "svc";

/**
 * «Сообщения» — 1:1 по составу с apps/mobile-parent/src/screens/tabs/
 * MessagesScreen.tsx: сторис + 4 таба (Все/Чаты/Объявления/Сервисы,
 * статичная красная точка на «Сервисы») + список тредов. Поиск/компоуз в
 * шапке и сами треды — заглушки (в мобилке ведут на экраны, которых на
 * вебе пока нет), без write-роутов.
 */
export function MessagesView() {
  const { locale } = useLocale();
  const dict = getDictionary(locale as Locale).parentApp;
  const t = dict.msg;
  const msgDict = t as unknown as Record<string, string>;

  const [tab, setTab] = useState<TabKey>("all");

  const threads = tab === "all" ? MESSAGE_THREADS : MESSAGE_THREADS.filter((m) => m.category === tab);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: t.tabAll },
    { key: "chats", label: t.tabChats },
    { key: "ann", label: t.tabAnn },
    { key: "svc", label: t.tabSvc },
  ];

  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      {/* Заголовок экрана (свой, отдельно от шапки ParentAppShell — как и в d24) */}
      <div className="flex items-center gap-2.5 px-0.5">
        <h1 className="flex-1 text-lg font-bold" style={{ color: ink1 }}>
          {dict.nav.messages}
        </h1>
        <GlassCircleButton>
          <SearchIcon />
        </GlassCircleButton>
        <GlassCircleButton>
          <ComposeIcon />
        </GlassCircleButton>
      </div>

      {/* Сторис */}
      <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        {MESSAGES_STORIES.map((s) => (
          <div key={s.id} className="flex w-14 shrink-0 flex-col items-center gap-1">
            <StoryCircle story={s} />
            <span className="w-14 truncate text-center text-[8px] font-bold" style={{ color: ink2 }}>
              {msgDict[s.labelKey] ?? s.labelKey}
            </span>
          </div>
        ))}
      </div>

      {/* Табы */}
      <div className="grid grid-cols-4 gap-2">
        {tabs.map((tb) => {
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              className="relative flex items-center justify-center rounded-full py-2 text-[11.5px] font-bold"
              style={
                active
                  ? { background: "linear-gradient(135deg, #7C3AED, #4F6DF5)", color: "#fff", boxShadow: "0 8px 18px rgba(124,58,237,0.35)" }
                  : { background: "rgba(255,255,255,0.5)", color: "rgba(26,19,74,0.66)" }
              }
            >
              {tb.label}
              {tb.key === "svc" && <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: "#ef4444" }} />}
            </button>
          );
        })}
      </div>

      {/* Список тредов */}
      <div className="flex flex-col gap-2.5">
        {threads.map((m) => (
          <GlassCard key={`${m.category}-${m.name}`} className="flex items-center gap-2.5 p-3">
            <ThreadAvatar row={m} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[12.5px] font-extrabold" style={{ color: ink1 }}>
                  {m.name}
                </span>
                {m.roleLabel && (
                  <span
                    className="shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold"
                    style={{ background: "rgba(139,92,246,0.13)", border: "1px solid rgba(139,92,246,0.33)", color: "#6D28D9" }}
                  >
                    {m.roleLabel}
                  </span>
                )}
                <span className="flex-1" />
                <span className="shrink-0 text-[9px] font-bold" style={{ color: ink3 }}>
                  {m.timeLabel}
                </span>
              </div>
              <div className="mt-0.5 flex items-start gap-2">
                <span
                  className="flex-1 text-[10.5px] font-semibold leading-[1.4]"
                  style={{ color: ink2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                >
                  {m.preview}
                </span>
                {m.badge != null && (
                  <span
                    className="flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-full px-1 text-[9.5px] font-extrabold text-white"
                    style={{ background: "linear-gradient(135deg, #7C3AED, #4F6DF5)", boxShadow: "0 4px 10px rgba(124,58,237,0.4)" }}
                  >
                    {m.badge}
                  </span>
                )}
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

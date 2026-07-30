"use client";

/**
 * Экран #12 «Домашние задания», вёрстка — перенос RN-экрана
 * study/HomeworksScreen.tsx (feat/mobile-parent-redesign) → макет
 * «SNR EduOS v2 Light.dc.html» строки 496–545:
 *   497–501  шапка: back + заголовок + правая круглая кнопка «три линии»;
 *   502      скролл: padding 4/18/118, gap 12;
 *   503–508  ряд из 4 фильтр-чипов «Все / Сегодня / Просрочено / Выполнено»
 *            с счётчиками;
 *   509–532  карточки ДЗ: 40×40 плитка предмета + центр (название предмета,
 *            мини-чип статуса, заголовок задания, мета-строка с часами) +
 *            42×42 правый индикатор (кольцо N% / песочные часы / прочерк);
 *   534–542  нижняя стеклянная строка-сводка из 4 колонок.
 *
 * Клиентским компонент делает только состояние активного фильтра — данные
 * приезжают готовыми с сервера (page.tsx), пересчётов «сейчас» здесь нет.
 */

import { useState } from "react";
import Link from "next/link";
import { InnerHeader, GlassCircle } from "../_study/InnerHeader";
import {
  COL_DIVIDER,
  ChildCard,
  EmptyCard,
  GlassPanel,
  IconClock,
  IconFilter,
  IconHourglass,
  MiniChip,
  ProgressRing,
  RoundBadge42,
  ScreenBody,
  SubjectSquare,
} from "../_study/parts";
import { ink1, ink2, ink3, status, type StatusKey } from "../v2/tokens";

export type HomeworkCardVM = {
  id: string;
  subjectName: string;
  subjectGlyph: string;
  color: string;
  title: string;
  dueLabel: string;
  statusLabel: string;
  family: StatusKey;
  progress: number | "hourglass" | null;
  overdue: boolean;
  dueToday: boolean;
  submitted: boolean;
  graded: boolean;
  pending: boolean;
};

type FilterKey = "all" | "today" | "late" | "done";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "today", label: "Сегодня" },
  { key: "late", label: "Просрочено" },
  { key: "done", label: "Выполнено" },
];

function FilterChip({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      style={{
        paddingBlock: 6,
        paddingInline: 10,
        borderRadius: 999,
        background: active ? "rgba(23,18,67,0.09)" : "rgba(255,255,255,0.55)",
        border: "1px solid rgba(23,18,67,0.06)",
        fontSize: 10.5,
        fontWeight: 800,
        color: active ? ink1 : ink2,
      }}
    >
      {`${label} · ${count}`}
    </button>
  );
}

function HomeworkCard({ card }: { card: HomeworkCardVM }) {
  const st = status[card.family];
  const emphasize = card.family === "orange" || card.family === "red";
  const metaColor = emphasize ? st.text : "rgba(26,19,74,0.5)";

  const right =
    card.progress === "hourglass" ? (
      <RoundBadge42 family="violet" glyph={<IconHourglass size={17} color={status.violet.text} />} />
    ) : card.progress === null ? (
      <RoundBadge42 family={card.overdue ? "red" : "gray"} glyph="—" />
    ) : (
      <ProgressRing pct={card.progress} family={card.family} />
    );

  return (
    <GlassPanel radius={20}>
      <Link
        href={`/parent/homework/${card.id}`}
        className="flex items-center transition-transform active:scale-[0.99]"
        style={{ gap: 11, paddingBlock: 12, paddingInline: 14 }}
      >
        <SubjectSquare color={card.color} glyph={card.subjectGlyph} />
        <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
          <span className="flex flex-wrap items-center" style={{ gap: 6 }}>
            <span className="truncate" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
              {card.subjectName}
            </span>
            <MiniChip label={card.statusLabel} family={card.family} />
          </span>
          <span
            className="line-clamp-2"
            style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(26,19,74,0.66)" }}
          >
            {card.title}
          </span>
          <span className="flex items-center" style={{ gap: 4 }}>
            <IconClock size={10} color={metaColor} strokeWidth={2} />
            <span
              className="truncate"
              style={{ fontSize: 9.5, fontWeight: emphasize ? 800 : 700, color: metaColor }}
            >
              {card.dueLabel}
            </span>
          </span>
        </span>
        {right}
      </Link>
    </GlassPanel>
  );
}

function SummaryCol({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span className="flex flex-1 flex-col items-center" style={{ gap: 1 }}>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: 8.5, fontWeight: 700, color: "rgba(26,19,74,0.55)" }}>{label}</span>
    </span>
  );
}

export function HomeworkListView({
  childName,
  childClass,
  cards,
}: {
  childName: string;
  childClass: string | null;
  cards: HomeworkCardVM[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts: Record<FilterKey, number> = {
    all: cards.length,
    today: cards.filter((c) => c.dueToday).length,
    late: cards.filter((c) => c.overdue).length,
    done: cards.filter((c) => c.submitted).length,
  };

  const visible = cards.filter((c) => {
    if (filter === "today") return c.dueToday;
    if (filter === "late") return c.overdue;
    if (filter === "done") return c.submitted;
    return true;
  });

  return (
    <>
      <InnerHeader
        title="Домашние задания"
        backHref="/parent/home"
        right={
          <GlassCircle label="Сбросить фильтр" onClick={() => setFilter("all")}>
            <IconFilter size={16} color={ink1} strokeWidth={1.8} />
          </GlassCircle>
        }
      />

      <ScreenBody>
        <ChildCard name={childName} className={childClass} />

        {/* Ряд фильтр-чипов (макет 503–508). */}
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {FILTERS.map((f) => (
            <FilterChip
              key={f.key}
              label={f.label}
              count={counts[f.key]}
              active={filter === f.key}
              onSelect={() => setFilter(f.key)}
            />
          ))}
        </div>

        {/* Список ДЗ (макет 509–532). Пусто «по фильтру» и пусто «вообще» —
            разные надписи: 0 заданий у класса подозрительнее, чем 0 в срезе. */}
        {visible.length === 0 ? (
          <EmptyCard>
            {cards.length === 0
              ? "Домашних заданий пока нет"
              : "По этому фильтру заданий нет"}
          </EmptyCard>
        ) : (
          visible.map((c) => <HomeworkCard key={c.id} card={c} />)
        )}

        {/* Стеклянная строка-сводка (макет 534–542). */}
        <GlassPanel radius={20}>
          <div className="flex items-stretch" style={{ gap: 8, paddingBlock: 12, paddingInline: 14 }}>
            <SummaryCol value={cards.length} label="Всего" color={ink1} />
            <span style={{ width: 1, background: COL_DIVIDER }} aria-hidden />
            <SummaryCol
              value={cards.filter((c) => c.graded).length}
              label="Оценено"
              color={status.green.text}
            />
            <span style={{ width: 1, background: COL_DIVIDER }} aria-hidden />
            <SummaryCol
              value={cards.filter((c) => c.pending).length}
              label="На проверке"
              color={status.violet.text}
            />
            <span style={{ width: 1, background: COL_DIVIDER }} aria-hidden />
            <SummaryCol
              value={counts.late}
              label="Просрочено"
              color={status.red.text}
            />
          </div>
        </GlassPanel>

        <p className="text-center" style={{ fontSize: 9.5, fontWeight: 600, color: ink3 }}>
          Родительский доступ — только просмотр: сдать работу может сам ученик.
        </p>
      </ScreenBody>
    </>
  );
}

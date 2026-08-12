"use client";

/**
 * Разметка «EduOS Assistant».
 *
 * Порядок блоков — как в мобильном экране: непрозрачная accent-карточка с
 * общей картиной, ниже — разбор по пунктам. Разница в том, что здесь текст
 * настоящий: его пишет модель по оценкам, посещаемости и домашним заданиям
 * ребёнка за месяц, а не фикстура.
 *
 * Кнопка «Собрать разбор» — единственное место экрана, которое обращается к
 * модели, и жмёт её родитель сам.
 */

import { useEffect, useState, useTransition } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ParentInsight } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import {
  EmptyState,
  ICON,
  InnerHeader,
  PrimaryButton,
  ScreenScroll,
  SectionCap,
  StatusChip,
  grad135,
} from "../_ui/screen-kit";
import { DIVIDER } from "../_ui/screen-tokens";
import { useDates } from "../_ui/dates";
import { ink1, ink2, ink3, radius, shCard, type StatusKey } from "../v2/tokens";
import { generateParentInsight, readParentInsight } from "./actions";

const HERO: readonly [string, string] = ["#8B5CF6", "#6366F1"];

/** Настроение пункта → семейство цветов чипа. Значения приходят от модели по
 *  схеме PARENT_INSIGHT_SCHEMA; незнакомое трактуем нейтрально. */
const SENTIMENT_FAMILY: Record<string, StatusKey> = {
  positive: "green",
  neutral: "blue",
  attention: "orange",
  negative: "red",
};

export function AssistantView({
  initial,
  childName,
}: {
  initial: ParentInsight | null;
  childName: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more2;
  const dt = useDates();

  const [insight, setInsight] = useState<ParentInsight | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Сервер прочитал разбор на русском. Если у родителя выбран другой язык —
  // перечитываем его разбор: у каждого языка своя запись в parent_insights.
  useEffect(() => {
    if (locale === "ru") return;
    let alive = true;
    readParentInsight(locale).then((r) => {
      if (alive) setInsight(r);
    });
    return () => {
      alive = false;
    };
  }, [locale]);

  function build() {
    setError(null);
    startTransition(async () => {
      const res = await generateParentInsight(locale, insight != null);
      if (res.ok) {
        setInsight({ ...res.payload, generatedAt: res.generatedAt });
      } else {
        setError(m.assistantError);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader
        title={d.scr.assistant}
        backHref="/parent/home"
        right={
          <span
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full"
            style={{ background: grad135(HERO), boxShadow: "0 8px 18px rgba(124,58,237,0.35)" }}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: "#FFFFFF" }}>AI</span>
          </span>
        }
      />

      <ScreenScroll>
        {insight ? (
          <>
            {/* Общая картина — непрозрачная карточка, как в макете. */}
            <div
              style={{
                borderRadius: radius.card,
                background: grad135(HERO),
                boxShadow: shCard,
                padding: 16,
              }}
            >
              <span
                className="block"
                style={{
                  fontSize: 8.5,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.8)",
                }}
              >
                {m.assistantSummaryCap}
              </span>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  lineHeight: "18px",
                  color: "#FFFFFF",
                  marginTop: 8,
                  whiteSpace: "pre-wrap",
                }}
              >
                {insight.summary}
              </p>
            </div>

            {insight.insights.length > 0 ? (
              <>
                <SectionCap label={m.assistantItemsCap} />
                <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
                  {insight.insights.map((it, idx) => (
                    <div
                      key={`${it.title}-${idx}`}
                      className="flex flex-col"
                      style={{
                        gap: 5,
                        paddingTop: 13,
                        paddingBottom: 13,
                        borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                      }}
                    >
                      <div className="flex items-start" style={{ gap: 8 }}>
                        <span
                          className="min-w-0 flex-1"
                          style={{ fontSize: 12, fontWeight: 800, color: ink1 }}
                        >
                          {it.title}
                        </span>
                        {it.category ? (
                          <StatusChip
                            label={it.category}
                            family={SENTIMENT_FAMILY[it.sentiment] ?? "gray"}
                            fontSize={8.5}
                          />
                        ) : null}
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 600, lineHeight: "16px", color: ink2 }}>
                        {it.body}
                      </p>
                    </div>
                  ))}
                </GlassCard>
              </>
            ) : null}

            <span style={{ fontSize: 9.5, fontWeight: 700, color: ink3, textAlign: "center" }}>
              {m.assistantGeneratedAt.replace("{date}", dt.long(insight.generatedAt))}
            </span>
          </>
        ) : (
          <GlassCard radius={22}>
            <EmptyState
              title={m.assistantEmptyTitle}
              text={m.assistantEmptyText.replace("{name}", childName ?? "")}
              paths={ICON.info}
            />
          </GlassCard>
        )}

        {error ? (
          <span
            style={{ fontSize: 10.5, fontWeight: 700, color: "var(--p-status-red-text, #B91C1C)", textAlign: "center" }}
          >
            {error}
          </span>
        ) : null}

        <PrimaryButton
          label={pending ? m.assistantWorking : insight ? m.assistantRegenerate : m.assistantGenerate}
          onClick={build}
          disabled={pending}
        />

        <span style={{ fontSize: 9, fontWeight: 600, lineHeight: "14px", color: ink3, textAlign: "center" }}>
          {m.assistantNote}
        </span>
      </ScreenScroll>
    </div>
  );
}

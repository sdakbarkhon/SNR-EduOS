/**
 * Экран #11 «Детали предмета», вёрстка — перенос RN-экрана
 * study/SubjectDetailScreen.tsx (feat/mobile-parent-redesign) → макет
 * «SNR EduOS v2 Light.dc.html» строки 455–495:
 *   456–460  Header: back + название предмета с градиентной плиткой;
 *   461      скролл: padding 4/18/118, gap 12;
 *   462–467  карточка учителя (аватар + «УЧИТЕЛЬ» + действия);
 *   468–471  hero-карточка «Текущая успеваемость»: балл /5.0 + полукруглый
 *            Gauge с процентом;
 *   472      caps-заголовок «Темы»;
 *   473–478  список тем с полосами прогресса;
 *   479–482  две колонки: «Последняя работа» + «Предстоящий тест»;
 *   483–487  карточка комментария учителя.
 *
 * Блок 11 макета (CTA «Рекомендации EduOS Assistant») НЕ переносится: там
 * фикстурный текст, а реального источника рекомендаций в БД нет. На его
 * место — честное действие «Написать учителю».
 *
 * Серверный компонент: состояния на экране нет.
 */

import type { ReactNode } from "react";
import Link from "next/link";
import { InnerHeader } from "../../_study/InnerHeader";
import {
  ACCENT_INSET,
  AccentCaps,
  ChildCard,
  GlassCaps,
  GlassPanel,
  IconChat,
  IconChevronRight,
  ProgressBar,
  ROW_DIVIDER,
  ScreenBody,
  SectionCaps,
  SectionLink,
  SubjectSquare,
} from "../../_study/parts";
import { accentGrad, chip, fontDisplay, ink1, ink2, ink3, status } from "../../v2/tokens";
import { hexToRgbCsv } from "../../_study/util";

type Topic = { topic: string; pct: number; average: number; count: number };

/** Полукруглый индикатор (макет 470): viewBox 120×70, дуга r=50, толщина 10. */
function Gauge({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const LEN = Math.PI * 50; // длина полудуги ≈ 157.08
  return (
    <svg width={110} height={66} viewBox="0 0 120 70" aria-hidden className="shrink-0">
      <path
        d="M10 60 A50 50 0 0 1 110 60"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <path
        d="M10 60 A50 50 0 0 1 110 60"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * LEN} ${LEN}`}
      />
      <text x={60} y={58} textAnchor="middle" fontSize={13} fontWeight={800} fill="#FFFFFF">
        {`${Math.round(clamped)}%`}
      </text>
    </svg>
  );
}

function MiniCard({
  caps,
  title,
  meta,
  right,
}: {
  caps: string;
  title: string;
  meta: string;
  right: ReactNode;
}) {
  return (
    <GlassPanel radius={18} style={{ flex: 1, minWidth: 0 }}>
      <div className="flex flex-col" style={{ padding: 12, gap: 5 }}>
        <GlassCaps>{caps}</GlassCaps>
        <span
          className="line-clamp-2"
          style={{ fontSize: 11.5, fontWeight: 800, color: ink1, lineHeight: 1.35 }}
        >
          {title}
        </span>
        <span className="flex items-center justify-between" style={{ gap: 6 }}>
          <span className="truncate" style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
            {meta}
          </span>
          {right}
        </span>
      </div>
    </GlassPanel>
  );
}

export function SubjectDetailView({
  childName,
  childClass,
  subjectName,
  subjectGlyph,
  color,
  teacherName,
  teacherInitials,
  average,
  gradeCount,
  topics,
  lastWork,
  upcomingTest,
  teacherComment,
}: {
  childName: string;
  childClass: string | null;
  subjectName: string;
  subjectGlyph: string;
  color: string;
  teacherName: string | null;
  teacherInitials: string;
  average: number | null;
  gradeCount: number;
  topics: Topic[];
  lastWork: { id: string; title: string; grade: number | null; dateLabel: string } | null;
  upcomingTest: { title: string; dateLabel: string } | null;
  teacherComment: { text: string; dateLabel: string } | null;
}) {
  const rgb = hexToRgbCsv(color);
  const gaugePct = average != null ? (average / 5) * 100 : 0;
  const green = chip(status.green.rgb);

  return (
    <>
      <InnerHeader
        title={subjectName}
        backHref="/parent/subjects"
        right={<SubjectSquare color={color} glyph={subjectGlyph} size={34} radius={11} />}
      />

      <ScreenBody>
        <ChildCard name={childName} className={childClass} />

        {/* Карточка учителя (макет 462–467). */}
        <GlassPanel radius={20}>
          <div className="flex items-center" style={{ gap: 11, padding: 13 }}>
            <span
              className="flex shrink-0 items-center justify-center text-white"
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                background: accentGrad,
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              {teacherInitials}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <GlassCaps>Учитель</GlassCaps>
              <span className="truncate" style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>
                {teacherName ?? "Не назначен"}
              </span>
            </span>
            <Link
              href="/parent/messages"
              aria-label="Написать учителю"
              className="flex shrink-0 items-center justify-center"
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                background: chip(status.violet.rgb).background,
                border: `1px solid ${chip(status.violet.rgb).borderColor}`,
              }}
            >
              <IconChat size={15} color={status.violet.text} strokeWidth={1.9} />
            </Link>
          </div>
        </GlassPanel>

        {/* Hero «Текущая успеваемость» (макет 468–471). */}
        <div
          className="flex items-center"
          style={{
            gap: 12,
            padding: 15,
            borderRadius: 22,
            background: `linear-gradient(135deg, ${color}CC, ${color})`,
            boxShadow: `0 16px 36px rgba(${rgb},0.35), ${ACCENT_INSET}`,
            color: "#fff",
          }}
        >
          <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 3 }}>
            <AccentCaps>Текущая успеваемость</AccentCaps>
            <span className="flex items-end" style={{ gap: 6 }}>
              <span style={{ fontFamily: fontDisplay, fontSize: 28, fontWeight: 600, lineHeight: 1 }}>
                {average != null ? average.toFixed(1) : "—"}
              </span>
              <span
                style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.75)", paddingBottom: 2 }}
              >
                /5.0
              </span>
            </span>
            <span
              className="self-start"
              style={{
                paddingBlock: 3,
                paddingInline: 9,
                borderRadius: 999,
                background: "rgba(255,255,255,0.22)",
                border: "1px solid rgba(255,255,255,0.4)",
                fontSize: 9.5,
                fontWeight: 800,
              }}
            >
              {gradeCount > 0 ? `${gradeCount} оценок в журнале` : "Оценок пока нет"}
            </span>
          </span>
          <Gauge pct={gaugePct} />
        </div>

        {/* Темы (макет 472–478). */}
        <SectionCaps right={<Link href="/parent/subjects"><SectionLink>Все предметы ›</SectionLink></Link>}>
          Освоение тем
        </SectionCaps>

        {topics.length === 0 ? (
          <GlassPanel radius={20}>
            <p className="text-center" style={{ padding: 16, fontSize: 11, fontWeight: 700, color: ink3 }}>
              По этому предмету ещё не было оценённых уроков с темой
            </p>
          </GlassPanel>
        ) : (
          <GlassPanel radius={20}>
            <div style={{ paddingBlock: 6, paddingInline: 14 }}>
              {topics.map((t, i) => (
                <div
                  key={t.topic}
                  className="flex items-center"
                  style={{
                    gap: 9,
                    paddingBlock: 8,
                    borderTop: i === 0 ? undefined : `1px solid ${ROW_DIVIDER}`,
                  }}
                >
                  <span
                    className="flex shrink-0 items-center justify-center text-white"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      background: `linear-gradient(135deg, ${color}CC, ${color})`,
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {t.average.toFixed(1)}
                  </span>
                  <span
                    className="truncate"
                    style={{ width: 104, fontSize: 11, fontWeight: 700, color: ink1 }}
                    title={t.topic}
                  >
                    {t.topic}
                  </span>
                  <span className="flex-1">
                    <ProgressBar pct={t.pct} fill={`linear-gradient(90deg, ${color}CC, ${color})`} />
                  </span>
                  <span
                    className="text-right"
                    style={{ width: 34, fontSize: 11.5, fontWeight: 800, color: ink1 }}
                  >
                    {t.pct}%
                  </span>
                </div>
              ))}
            </div>
          </GlassPanel>
        )}

        {/* Две колонки: последняя работа + предстоящий тест (макет 479–482). */}
        <div className="flex" style={{ gap: 10 }}>
          <MiniCard
            caps="Последняя работа"
            title={lastWork?.title ?? "Оценённых работ пока нет"}
            meta={lastWork?.dateLabel ?? "—"}
            right={
              lastWork?.grade != null ? (
                <span
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 9,
                    background: green.background,
                    border: `1px solid ${green.borderColor}`,
                    fontSize: 13,
                    fontWeight: 800,
                    color: status.green.text,
                  }}
                >
                  {lastWork.grade}
                </span>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 800, color: ink3 }}>—</span>
              )
            }
          />
          <MiniCard
            caps="Ближайший тест"
            title={upcomingTest?.title ?? "Тестов не запланировано"}
            meta={upcomingTest?.dateLabel ?? "—"}
            right={
              upcomingTest ? (
                <span
                  className="shrink-0"
                  style={{
                    paddingBlock: 3,
                    paddingInline: 8,
                    borderRadius: 999,
                    background: chip(status.blue.rgb).background,
                    border: `1px solid ${chip(status.blue.rgb).borderColor}`,
                    fontSize: 9,
                    fontWeight: 800,
                    color: status.blue.text,
                  }}
                >
                  Квиз
                </span>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 800, color: ink3 }}>—</span>
              )
            }
          />
        </div>

        {/* Комментарий учителя (макет 483–487) — только если он реально есть. */}
        {teacherComment && (
          <GlassPanel radius={20}>
            <div className="flex flex-col" style={{ paddingBlock: 13, paddingInline: 14, gap: 7 }}>
              <GlassCaps>Комментарий учителя</GlassCaps>
              <p
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  lineHeight: 1.55,
                  color: ink2,
                  whiteSpace: "pre-wrap",
                }}
              >
                {teacherComment.text}
              </p>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: ink3 }}>
                {teacherComment.dateLabel}
              </span>
            </div>
          </GlassPanel>
        )}

        {/* Действие вместо фикстурного CTA ассистента из макета. */}
        <Link
          href="/parent/homework"
          className="flex items-center transition-transform active:scale-[0.99]"
          style={{
            gap: 10,
            paddingBlock: 12,
            paddingInline: 14,
            borderRadius: 20,
            background: accentGrad,
            boxShadow: `0 16px 36px rgba(99,102,241,0.38), ${ACCENT_INSET}`,
            color: "#fff",
          }}
        >
          <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 2 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800 }}>Домашние задания</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
              Что задано и что уже сдано по всем предметам
            </span>
          </span>
          <IconChevronRight size={16} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
        </Link>
      </ScreenBody>
    </>
  );
}

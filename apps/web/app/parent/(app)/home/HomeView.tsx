"use client";

import Link from "next/link";
import { getDictionary, formatTime, format, LOCALE_TAG, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "@/components/parent/glass/GlassCard";
import { ink1, ink2, ink3, accentGradCss, glassBorder } from "@/lib/parent/glass-tokens";

export type NextLessonData = {
  subjectName: string | null;
  startsAtIso: string;
  endsAtIso: string | null;
  room: string | null;
  teacherName: string | null;
};

type Props = {
  parentName: string;
  childName: string | null;
  className: string | null;
  atSchoolSinceIso: string | null;
  lessonsToday: number;
  presentToday: number;
  pendingHomeworkCount: number;
  nextLesson: NextLessonData | null;
};

/** Реальные ФИО хранятся как "Фамилия Имя" — для обращения берём последнее слово. */
function givenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

function SparkleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="#FFFFFF">
      <path d="M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z" />
    </svg>
  );
}

export function HomeView({
  parentName,
  childName,
  className,
  atSchoolSinceIso,
  lessonsToday,
  presentToday,
  pendingHomeworkCount,
  nextLesson,
}: Props) {
  const { locale } = useLocale();
  const loc = locale as Locale;
  const d = getDictionary(loc).parentApp;

  if (!childName) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <GlassCard className="px-6 py-8 text-center">
          <p className="text-sm" style={{ color: ink2 }}>
            {d.auth.chooseChild}
          </p>
        </GlassCard>
      </div>
    );
  }

  const greetingTitle = format(d.home.greetingTitle, { name: givenName(parentName) });
  const greetingSub = format(d.home.greetingSub, { name: givenName(childName) });

  const atSchoolSinceValue = atSchoolSinceIso ? formatTime(atSchoolSinceIso, LOCALE_TAG[loc]) : "—";
  const attendedValue = `${presentToday}/${lessonsToday}`;

  const nextLessonSubject = nextLesson?.subjectName ?? d.home.nextLessonEmpty;
  const nextLessonTile = nextLesson?.subjectName ? nextLesson.subjectName.slice(0, 2) : "–";
  const nextLessonTimeLabel = nextLesson
    ? `${formatTime(nextLesson.startsAtIso, LOCALE_TAG[loc])}${nextLesson.endsAtIso ? `–${formatTime(nextLesson.endsAtIso, LOCALE_TAG[loc])}` : ""}`
    : null;
  const nextLessonRoomLabel = nextLesson?.room ? format(d.home.roomLabel, { room: nextLesson.room }) : null;
  const nextLessonMetaLabel = nextLesson
    ? [nextLessonTimeLabel, nextLessonRoomLabel, nextLesson.teacherName].filter(Boolean).join(" · ")
    : "";

  const metrics: { label: string; value: string; color?: string; flex?: number }[] = [
    { label: d.home.atSchoolSince, value: atSchoolSinceValue },
    { label: d.home.lessons, value: String(lessonsToday) },
    { label: d.home.attended, value: attendedValue, color: "#047857" },
    { label: d.home.hw, value: String(pendingHomeworkCount), color: "#C2410C" },
    { label: d.home.wallet, value: "—", flex: 1.4 },
  ];

  return (
    <div className="flex flex-1 flex-col gap-3 py-4">
      {/* Приветствие */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold" style={{ color: ink1 }}>
          {greetingTitle}
        </h1>
        <p className="text-xs font-semibold" style={{ color: ink2 }}>
          {greetingSub}
        </p>
      </div>

      {/* Карточка ребёнка + 5 метрик (реальные: в школе с / уроков / посещено / ДЗ; мок: кошелёк) */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white"
            style={{ background: accentGradCss }}
          >
            {givenName(childName).slice(0, 1)}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold" style={{ color: ink1 }}>
              {childName}
            </div>
            {className && (
              <div className="text-xs" style={{ color: ink3 }}>
                {className}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex pt-3" style={{ borderTop: `1px solid ${glassBorder}` }}>
          {metrics.map((m, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 text-center" style={{ flex: m.flex ?? 1 }}>
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: ink3 }}>
                {m.label}
              </span>
              <span className="text-[13px] font-extrabold" style={{ color: m.color ?? ink1 }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Следующий урок — реальные данные */}
      <div
        className="flex items-center gap-3 rounded-[20px] p-3.5"
        style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 12px 26px rgba(99,102,241,0.30)" }}
      >
        <div className="flex-1">
          <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/75">{d.home.nextLesson}</div>
          <div className="mt-1 text-[15.5px] font-extrabold text-white">{nextLessonSubject}</div>
          {nextLessonMetaLabel && <div className="mt-0.5 text-[11.5px] font-bold text-white/90">{nextLessonMetaLabel}</div>}
        </div>
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] border border-white/35 bg-white/15 text-[15px] font-extrabold text-white">
          {nextLessonTile}
        </div>
      </div>

      {/* К оплате / Питание — мок, не подключены к БД в этом заходе */}
      <div className="flex gap-2.5">
        <Link
          href="/parent/payments"
          className="flex-1 rounded-[18px] p-3"
          style={{ background: "linear-gradient(135deg, #fb7185, #e11d48)", boxShadow: "0 10px 22px rgba(244,63,94,0.28)" }}
        >
          <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/85">{d.status.due}</div>
          <div className="mt-1 text-[15px] font-extrabold text-white">{d.home.noDataYet}</div>
          <div className="mt-0.5 text-[10px] font-bold text-white/85">{d.stub.subtitle}</div>
        </Link>
        <div
          className="flex-1 rounded-[18px] p-3"
          style={{ background: "linear-gradient(135deg, #34d399, #059669)", boxShadow: "0 10px 22px rgba(52,211,153,0.28)" }}
        >
          <div className="text-[9px] font-extrabold uppercase tracking-wide text-white/85">{d.svc.meals}</div>
          <div className="mt-1 text-[15px] font-extrabold text-white">{d.home.noDataYet}</div>
          <div className="mt-0.5 text-[10px] font-bold text-white/85">{d.stub.subtitle}</div>
        </div>
      </div>

      {/* EduOS Assistant — мок-текст, CTA ведут на реальные существующие табы */}
      <div
        className="rounded-[20px] p-3.5"
        style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)", boxShadow: "0 12px 26px rgba(139,92,246,0.30)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] border border-white/35 bg-white/20">
            <SparkleIcon />
          </div>
          <span className="flex-1 text-[14px] font-extrabold text-white">EduOS Assistant</span>
          <span className="rounded-full border border-white/35 bg-white/20 px-2 py-0.5 text-[9px] font-extrabold text-white">NEW</span>
        </div>
        <p className="mt-2.5 text-[12px] font-semibold leading-[1.55] text-white/95">{d.home.assistantText}</p>
        <div className="mt-2.5 flex gap-2">
          <Link
            href="/parent/progress"
            className="flex flex-1 items-center justify-center rounded-xl border border-white/35 bg-white/20 px-2.5 py-2 text-center text-[11.5px] font-extrabold text-white"
          >
            {d.home.viewProgress}
          </Link>
          <Link
            href="/parent/messages"
            className="flex flex-1 items-center justify-center rounded-xl border border-white/35 bg-white/20 px-2.5 py-2 text-center text-[11.5px] font-extrabold text-white"
          >
            {d.home.msgTeacher}
          </Link>
        </div>
      </div>
    </div>
  );
}

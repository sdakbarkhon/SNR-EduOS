"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Code2, FileText, ClipboardCheck, type LucideIcon } from "lucide-react";
import {
  getDictionary,
  getSubjectStyle,
  homeworkCategory,
  deadlineUrgency,
  type ContentType,
  type HomeworkWithSubmission,
  type Locale,
} from "@snr/core";
import { cn } from "@/lib/cn";
import { SubjectIcon, useLocale } from "@/components";

const TYPE_STYLE: Record<ContentType, { bg: string; text: string; Icon: LucideIcon }> = {
  file: { bg: "bg-blue-50", text: "text-blue-600", Icon: FileText },
  test: { bg: "bg-violet-50", text: "text-violet-600", Icon: ClipboardCheck },
  programming: { bg: "bg-orange-50", text: "text-orange-600", Icon: Code2 },
};

const LOCALE_MAP: Record<string, string> = { ru: "ru-RU", en: "en-US", uz: "uz-UZ" };

export function HomeworkCard({ hw }: { hw: HomeworkWithSubmission }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const subj = hw.group.subject;
  const style = getSubjectStyle(subj);

  const cat = homeworkCategory(hw, hw.submission);
  const urgency = deadlineUrgency(hw.due_date);

  const typeStyle = TYPE_STYLE[hw.content_type];
  const typeLabel =
    hw.content_type === "test"
      ? d.homework.typeTest
      : hw.content_type === "programming"
        ? d.homework.typeProgrammingShort
        : d.homework.typeFile;

  const dueLabel = hw.due_date
    ? d.homework.dueUntil.replace(
        "{date}",
        new Date(hw.due_date).toLocaleDateString(LOCALE_MAP[locale] ?? "ru-RU", {
          day: "numeric",
          month: "long",
          timeZone: "Asia/Tashkent",
        }),
      )
    : null;

  let deadlineColorCls = "text-slate-500";
  let badge: { label: string; bg: string; text: string; Icon?: LucideIcon } | null = null;

  if (cat === "overdue") {
    deadlineColorCls = "text-red-500";
    badge = { label: d.homework.overdueBadge, bg: "bg-red-50", text: "text-red-500", Icon: AlertTriangle };
  } else if (cat === "completed") {
    deadlineColorCls = "text-slate-400";
    badge = { label: d.homework.gradedBadgeLabel, bg: "bg-green-50", text: "text-green-600", Icon: CheckCircle2 };
  } else if (cat === "review") {
    deadlineColorCls = "text-slate-400";
    badge = { label: d.homework.onReview, bg: "bg-amber-50", text: "text-amber-600", Icon: Clock };
  } else if (urgency === "soon") {
    deadlineColorCls = "text-orange-500";
    badge = { label: d.homework.deadlineSoon, bg: "bg-orange-50", text: "text-orange-500", Icon: Clock };
  } else {
    badge = { label: d.homework.activeBadge, bg: "bg-blue-50", text: "text-blue-500" };
  }

  return (
    <Link
      href={`/homework/${hw.id}`}
      className="group flex flex-col gap-2.5 min-h-[158px] rounded-[20px] border border-slate-100 p-4 shadow-[0_2px_10px_rgba(24,20,50,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(24,20,50,0.10)] hover:border-slate-200"
      style={{ background: `linear-gradient(180deg, ${style.color}1A 0%, #ffffff 44%)` }}
    >
      <div className="flex items-center gap-2.5">
        <SubjectIcon subject={subj} size={32} />
        <span className="text-[13.5px] font-bold truncate" style={{ color: style.color }}>
          {style.label}
        </span>
      </div>

      <div className="text-[17px] font-extrabold text-slate-800 leading-snug line-clamp-2">{hw.title}</div>

      <span
        className={cn(
          "inline-flex items-center self-start gap-1.5 px-2.5 py-1 rounded-lg text-[12.5px] font-bold",
          typeStyle.bg,
          typeStyle.text,
        )}
      >
        <typeStyle.Icon className="h-3.5 w-3.5" /> {typeLabel}
      </span>

      <div className="flex-1" />

      <div className="flex items-center justify-between gap-2">
        {dueLabel ? (
          <span className={cn("text-[13.5px] font-bold whitespace-nowrap", deadlineColorCls)}>{dueLabel}</span>
        ) : (
          <span />
        )}
        {badge && (
          <span
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12.5px] font-bold whitespace-nowrap shrink-0",
              badge.bg,
              badge.text,
            )}
          >
            {badge.Icon && <badge.Icon className="h-3.5 w-3.5" />}
            {badge.label}
          </span>
        )}
      </div>
    </Link>
  );
}

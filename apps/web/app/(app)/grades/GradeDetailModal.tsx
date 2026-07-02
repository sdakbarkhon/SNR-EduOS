"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { getSubjectConfig } from "@snr/core";
import type { Dictionary, StudentGradeItem } from "@snr/core";
import { SubjectIcon } from "@/components/SubjectIcon";
import { cn } from "@/lib/cn";

function gradeColor(g5: number | null): string {
  if (g5 == null) return "text-slate-400";
  const pct = g5 / 5;
  if (pct >= 0.8) return "text-emerald-600";
  if (pct >= 0.5) return "text-amber-600";
  return "text-red-500";
}

export function GradeDetailModal({
  grade,
  locale,
  t,
  onClose,
}: {
  grade: StudentGradeItem;
  locale: string;
  t: Dictionary["grades"]["detailModal"];
  onClose: () => void;
}) {
  const cfg = getSubjectConfig(grade.subject);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <SubjectIcon subject={grade.subject} size={44} />
            <div>
              <p className="text-[15px] font-extrabold leading-tight text-slate-900">{grade.title}</p>
              <p className="text-[13px] font-semibold text-slate-400">{cfg.label}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.dateLabel}</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {grade.date ? new Date(grade.date).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.gradeLabel}</p>
            <p className={cn("mt-1 text-lg font-black", gradeColor(grade.grade5))}>{grade.display}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-violet-50/60 px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-400">{t.commentLabel}</p>
          <p className="mt-1.5 text-sm italic leading-relaxed text-slate-700">
            {grade.comment ? `«${grade.comment}»` : t.noComment}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-slate-900 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          {t.closeBtn}
        </button>
      </div>
    </div>,
    document.body,
  );
}

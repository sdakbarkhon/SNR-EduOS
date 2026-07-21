"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Dictionary, LessonGradeRow } from "@snr/core";

/** Только просмотр — правку оценки/комментария делаем отдельной задачей.
 *  lesson_grades — участие/поведение на уроке, отдельной "сдачи" нет, так что
 *  тут нечего показывать кроме общих полей (в отличие от модалки на
 *  студенческой странице "Оценки", которая ещё тянет содержимое сдачи для
 *  оценок за задания). */
export function LessonGradeDetailModal({
  row,
  t,
  onClose,
}: {
  row: LessonGradeRow;
  t: Dictionary["grades"]["detailModal"];
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-extrabold leading-tight text-slate-900">{row.student_name}</p>
            <p className="text-[13px] font-semibold text-slate-400">
              {row.lesson_no ? `Урок ${row.lesson_no}` : new Date(row.lesson_starts_at).toLocaleDateString("ru", { day: "numeric", month: "long", timeZone: "Asia/Tashkent" })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="mb-3">
          <span className="inline-flex rounded-[9px] bg-violet-100 px-2.5 py-1 text-[11.5px] font-bold text-violet-700">{t.typeLesson}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.dateLabel}</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {new Date(row.graded_at).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tashkent" })}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.gradeLabel}</p>
            <p className="mt-1 text-lg font-black text-slate-800">{row.grade}/5</p>
          </div>
        </div>

        {row.lesson_topic && (
          <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Тема</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{row.lesson_topic}</p>
          </div>
        )}

        <div className="mt-3 rounded-2xl bg-violet-50/60 px-4 py-3.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-400">{t.commentLabel}</p>
          <p className="mt-1.5 text-sm italic leading-relaxed text-slate-700">
            {row.comment ? `«${row.comment}»` : t.noComment}
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

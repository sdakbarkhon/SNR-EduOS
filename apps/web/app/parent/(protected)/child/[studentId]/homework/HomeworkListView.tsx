"use client";

import { useState } from "react";
import { ChevronDown, Paperclip } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale, HomeworkWithSubmission } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SubjectIcon } from "@/components/SubjectIcon";
import type { ParentChild } from "@/lib/parent-child";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

type Status = "done" | "pending" | "overdue";

function statusOf(h: HomeworkWithSubmission): Status {
  const submitted = Boolean(h.submission || h.test_submission);
  if (submitted) return "done";
  if (h.due_date && new Date(h.due_date).getTime() < Date.now()) return "overdue";
  return "pending";
}

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  done: { bg: "#DFF7EC", color: "#20A876" },
  pending: { bg: "#FFE9CC", color: "#C9781E" },
  overdue: { bg: "#FFE1EA", color: "#D62B4B" },
};

export function HomeworkListView({ child, homework }: { child: ParentChild; homework: HomeworkWithSubmission[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentUi;
  const [openId, setOpenId] = useState<string | null>(null);

  const statusLabel: Record<Status, string> = {
    done: t.hwStatusDone,
    pending: t.hwStatusPending,
    overdue: t.hwStatusOverdue,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.homeworkTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {child.full_name}
          {child.className ? ` · ${child.className}` : ""}
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        {homework.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">{t.noHomeworkAtAll}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {homework.map((h) => {
              const status = statusOf(h);
              const style = STATUS_STYLE[status];
              const isOpen = openId === h.id;
              const submission = h.submission;
              const testSubmission = h.test_submission;
              const grade = submission?.grade ?? testSubmission?.grade ?? null;

              return (
                <li key={h.id}>
                  <button
                    onClick={() => setOpenId(isOpen ? null : h.id)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <SubjectIcon subject={h.group?.subject ?? null} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{h.title}</p>
                      <p className="truncate text-xs text-gray-400">
                        {h.group?.subject}
                        {h.due_date ? ` · ${t.dueDate.replace("{date}", formatDate(h.due_date))}` : ""}
                      </p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ color: style.color, backgroundColor: style.bg }}
                    >
                      {statusLabel[status]}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="mb-3 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
                      {h.description && <p className="text-gray-700">{h.description}</p>}
                      {h.attachments?.length > 0 && (
                        <ul className="space-y-1 text-xs text-gray-500">
                          {h.attachments.map((a, i) => (
                            <li key={i} className="flex items-center gap-1"><Paperclip className="h-3 w-3 shrink-0" /> {a.name}</li>
                          ))}
                        </ul>
                      )}
                      {status === "done" ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <span className="font-medium text-gray-700">{t.submittedByChild}</span>
                          {submission?.file_original_name && <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" /> {submission.file_original_name}</span>}
                          {grade != null && (
                            <span className="rounded-full bg-pink-50 px-2 py-0.5 font-bold text-pink-700">
                              {t.teacherGradeLabel}: {grade}
                            </span>
                          )}
                          {submission?.teacher_comment && <span className="italic text-gray-500">«{submission.teacher_comment}»</span>}
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-gray-500">{t.notSubmittedYet}</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

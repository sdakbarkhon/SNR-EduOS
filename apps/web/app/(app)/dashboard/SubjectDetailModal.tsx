"use client";

import { BookOpen } from "lucide-react";
import { getDictionary, type Locale, type SubjectWithGroup } from "@snr/core";
import { Modal } from "@/components/Modal";
import { LUCIDE_ICONS } from "@/lib/subject-icons";
import { SUBJECT_DESCRIPTIONS, DEFAULT_SUBJECT_DESCRIPTION } from "@/lib/subject-descriptions";

export function SubjectDetailModal({
  subject,
  locale,
  onClose,
}: {
  subject: SubjectWithGroup;
  locale: Locale;
  onClose: () => void;
}) {
  const t = getDictionary(locale).dashboard;
  const Icon = LUCIDE_ICONS[subject.icon] ?? BookOpen;
  const description = SUBJECT_DESCRIPTIONS[subject.name] ?? DEFAULT_SUBJECT_DESCRIPTION;

  return (
    <Modal open onClose={onClose} title={subject.name}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: subject.color }}
          >
            <Icon className="h-6 w-6 text-white" />
          </div>
          <p className="text-[14px] font-medium leading-snug text-slate-600">{description}</p>
        </div>

        <div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-500">{t.subjectModalTeacher}</span>
            <span className="font-bold text-slate-900">{subject.teacher?.full_name ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-500">{t.subjectModalClass}</span>
            <span className="font-bold text-slate-900">{subject.group?.name ?? "—"}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

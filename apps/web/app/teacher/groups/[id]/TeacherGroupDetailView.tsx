"use client";

import Link from "next/link";
import { getDictionary, getSubjectConfig, pluralizeStudents } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ChevronLeft } from "lucide-react";

interface Props {
  group: { id: string; name: string; subject: string };
  students: Array<{ id: string; full_name: string; avatar_url: string | null; status: string }>;
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) return <img src={url} alt={name} className="h-9 w-9 rounded-full object-cover" />;
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue/20 text-[13px] font-bold text-brand-blue">
      {initials}
    </div>
  );
}

export function TeacherGroupDetailView({ group, students }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const cfg = getSubjectConfig(group.subject);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/teacher/groups" className="rounded-xl p-2 text-brand-ink-muted hover:bg-white/60">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[14px] text-[24px]"
            style={{ background: cfg.color + "20" }}>
            {cfg.emoji}
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-brand-ink">{group.name}</h1>
            <div className="text-[13px] text-brand-ink-muted">{pluralizeStudents(students.length, locale)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <h2 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.detailStudents}</h2>
        {students.length === 0 ? (
          <p className="text-[14px] text-brand-ink-muted">{d.common.none}</p>
        ) : (
          <div className="space-y-2">
            {students.map((student) => (
              <div key={student.id} className="flex items-center gap-3 rounded-[14px] bg-white/60 p-3">
                <Avatar name={student.full_name} url={student.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-brand-ink">{student.full_name}</div>
                  <div className="text-[11px] text-brand-ink-muted capitalize">{student.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

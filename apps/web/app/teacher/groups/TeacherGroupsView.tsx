"use client";

import Link from "next/link";
import { getDictionary, getSubjectConfig } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ChevronRight, Users } from "lucide-react";

interface Props {
  groups: Array<{ id: string; name: string; subject: string; schedule_days: string | null }>;
  homework: Array<{ group: { id: string } }>;
}

export function TeacherGroupsView({ groups, homework }: Props) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-brand-ink">{d.teacher.groupsTitle}</h1>
      {groups.length === 0 && (
        <div className="rounded-[20px] bg-white/70 border border-white/80 p-8 text-center text-brand-ink-muted">
          {d.common.none}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((group) => {
          const cfg = getSubjectConfig(group.subject);
          const hwCount = homework.filter((h) => h.group.id === group.id).length;
          return (
            <Link key={group.id} href={`/teacher/groups/${group.id}`}
              className="flex items-center gap-4 rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 transition-all hover:bg-white hover:shadow-lg"
              style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-[28px]"
                style={{ background: cfg.color + "20" }}>
                {cfg.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-bold text-brand-ink">{group.name}</div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[12px] text-brand-ink-muted">
                    <Users size={12} />
                    {d.teacher.groupStudents}
                  </span>
                  {group.schedule_days && (
                    <span className="text-[11px] text-brand-ink-muted">{group.schedule_days}</span>
                  )}
                </div>
                <div className="mt-1 text-[12px] text-brand-ink-muted">{hwCount} заданий</div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

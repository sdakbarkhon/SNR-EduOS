"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getSubjectConfig } from "@snr/core";
import type { StudentGradeItem } from "@snr/core";
import { getGradesAdvice } from "@/app/actions/ai";

function buildSummary(grades: StudentGradeItem[]): string {
  if (!grades.length) return "";
  const recent = [...grades]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  const bySub = new Map<string, StudentGradeItem[]>();
  for (const g of recent) {
    if (!bySub.has(g.subject)) bySub.set(g.subject, []);
    bySub.get(g.subject)!.push(g);
  }
  const lines = ["Последние оценки ученика:"];
  bySub.forEach((items, subject) => {
    const label = getSubjectConfig(subject).label;
    const vals = items.map((g) => g.grade5).filter((v): v is number => v != null);
    const avg = vals.length
      ? (vals.reduce((s, n) => s + n, 0) / vals.length).toFixed(1)
      : "нет";
    const gradeStr = items.map((g) => g.display).join(", ");
    const comment = items.flatMap((g) => (g.comment ? [g.comment] : [])).at(0);
    let line = `${label}: ${gradeStr} (средняя ${avg})`;
    if (comment) line += `; комментарий: "${comment}"`;
    lines.push("- " + line);
  });
  return lines.join("\n");
}

function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function AiGradesCard({ grades }: { grades: StudentGradeItem[] }) {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!grades.length) { setLoading(false); return; }
    const summary = buildSummary(grades);
    const key = `grades_advice_${hashStr(summary)}`;
    const cached = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (cached) { setAdvice(cached); setLoading(false); return; }
    getGradesAdvice(summary).then((r) => {
      if ("text" in r) {
        setAdvice(r.text);
        if (typeof window !== "undefined") localStorage.setItem(key, r.text);
      }
      setLoading(false);
    });
  }, [grades]);

  if (!grades.length || (!loading && !advice)) return null;

  return (
    <div
      className="rounded-[20px] border border-blue-200/60 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 p-5 backdrop-blur-xl"
      style={{ boxShadow: "0 4px 24px rgba(99,102,241,0.08)" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="mb-1 text-[12px] font-bold uppercase tracking-widest text-indigo-400">
            Твой персональный совет
          </p>
          {loading ? (
            <div className="flex gap-1 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-300 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-300 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-300 [animation-delay:300ms]" />
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed text-slate-700">{advice}</p>
          )}
        </div>
      </div>
    </div>
  );
}

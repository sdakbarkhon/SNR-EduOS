"use client";

import { useState } from "react";
import { ChevronDown, Download, Pencil } from "lucide-react";
import { gradeSubmission, getDictionary, type Locale, type CodeLanguage } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { CodeViewer } from "@/components/CodeEditor";
import { cn } from "@/lib/cn";
import { CODE_LANGUAGE_FILENAMES } from "@/lib/code-languages";

type Sub = {
  id: string; student_id: string;
  code_text: string | null; grade: number | null; teacher_comment: string | null;
  student: { id: string; full_name: string; avatar_url: string | null };
};

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function TeacherProgrammingSubmissions({
  language, submissions: initial,
}: {
  language: CodeLanguage;
  submissions: Sub[];
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.homework.programming;
  const db = createClient();

  const [subs, setSubs] = useState<Sub[]>(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [grades, setGrades] = useState<Record<string, { grade: string; comment: string; saving: boolean }>>(() => {
    const m: Record<string, { grade: string; comment: string; saving: boolean }> = {};
    for (const s of initial) m[s.id] = { grade: s.grade?.toString() ?? "", comment: s.teacher_comment ?? "", saving: false };
    return m;
  });

  async function save(s: Sub) {
    const g = grades[s.id];
    const n = parseInt(g?.grade ?? "");
    if (isNaN(n) || n < 1 || n > 5) return;
    setGrades((p) => ({ ...p, [s.id]: { grade: p[s.id]?.grade ?? "", comment: p[s.id]?.comment ?? "", saving: true } }));
    try {
      const comment = g?.comment ?? "";
      await gradeSubmission(db, { submissionId: s.id, grade: n, comment });
      setSubs((p) => p.map((x) => (x.id === s.id ? { ...x, grade: n, teacher_comment: comment || null } : x)));
      setEditingId(null);
    } catch (e: unknown) {
      console.error("[grade] failed:", e);
    } finally {
      setGrades((p) => ({ ...p, [s.id]: { grade: p[s.id]?.grade ?? "", comment: p[s.id]?.comment ?? "", saving: false } }));
    }
  }

  function download(s: Sub) {
    const ext = CODE_LANGUAGE_FILENAMES[language].split(".").pop();
    const blob = new Blob([s.code_text ?? ""], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${s.student.full_name.replace(/\s+/g, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
      <h2 className="mb-4 text-[15px] font-bold text-brand-ink">{d.teacher.detailStudents}</h2>
      {subs.length === 0 ? (
        <p className="text-[14px] text-brand-ink-muted">{d.teacher.noActivity}</p>
      ) : (
        <div className="space-y-2">
          {subs.map((s) => {
            const isOpen = openId === s.id;
            const isGraded = s.grade != null;
            const isEditing = editingId === s.id;
            const g = grades[s.id];
            return (
              <div key={s.id} className="rounded-[14px] border border-slate-100 bg-white/60">
                <button onClick={() => setOpenId(isOpen ? null : s.id)} className="flex w-full items-center gap-3 p-3 text-left">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[13px] font-bold text-emerald-600">
                    {initials(s.student.full_name)}
                  </div>
                  <span className="flex-1 text-[14px] font-semibold text-brand-ink">{s.student.full_name}</span>
                  {isGraded && <span className="text-[12px] font-bold text-emerald-600">{s.grade}/5</span>}
                  <ChevronDown size={16} className={cn("text-slate-400 transition-transform", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="space-y-3 border-t border-slate-100 p-3">
                    {s.code_text ? (
                      <CodeViewer value={s.code_text} language={language} minHeight={120} />
                    ) : (
                      <p className="text-[13px] text-brand-ink-muted">{t.noCode}</p>
                    )}

                    {s.code_text && (
                      <button onClick={() => download(s)} className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 hover:underline">
                        <Download size={13} /> {t.download} .{CODE_LANGUAGE_FILENAMES[language].split(".").pop()}
                      </button>
                    )}

                    {/* Grade: read-only or form */}
                    {isGraded && !isEditing ? (
                      <div className="flex items-center justify-between rounded-xl bg-emerald-50/60 px-3 py-2">
                        <div>
                          <p className="text-[13px] font-semibold text-emerald-700">{d.teacher.classworkGradedLabel}: {s.grade}/5</p>
                          {s.teacher_comment && <p className="text-[12px] text-slate-500">{s.teacher_comment}</p>}
                        </div>
                        <button onClick={() => setEditingId(s.id)} className="flex items-center gap-1 text-[12px] font-semibold text-brand-blue hover:underline">
                          <Pencil size={12} /> Редактировать
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input type="number" min={1} max={5} placeholder="1–5"
                            value={g?.grade ?? ""}
                            onChange={(e) => setGrades((p) => ({ ...p, [s.id]: { grade: e.target.value, comment: p[s.id]?.comment ?? "", saving: false } }))}
                            className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] focus:outline-none focus:border-brand-blue/50" />
                          <input type="text" placeholder={`${d.teacher.classworkCommentLabel} (опционально)`}
                            value={g?.comment ?? ""}
                            onChange={(e) => setGrades((p) => ({ ...p, [s.id]: { grade: p[s.id]?.grade ?? "", comment: e.target.value, saving: false } }))}
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] focus:outline-none focus:border-brand-blue/50" />
                          <button onClick={() => save(s)} disabled={g?.saving}
                            className="rounded-lg bg-brand-blue px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50 hover:brightness-110">
                            {g?.saving ? "…" : d.teacher.classworkGradeBtn}
                          </button>
                        </div>
                        {isEditing && (
                          <button onClick={() => setEditingId(null)} className="text-[12px] text-slate-400 hover:text-slate-600">Отмена</button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

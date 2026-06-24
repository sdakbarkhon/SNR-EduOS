"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Star, Check, Loader2 } from "lucide-react";
import { getDictionary, gradeStudentForLesson } from "@snr/core";
import type { Locale, LessonGrade } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

const GRADE_COLORS: Record<number, { bg: string; text: string; ring: string }> = {
  1: { bg: "bg-red-500",    text: "text-white", ring: "ring-red-400" },
  2: { bg: "bg-orange-500", text: "text-white", ring: "ring-orange-400" },
  3: { bg: "bg-yellow-400", text: "text-slate-900", ring: "ring-yellow-300" },
  4: { bg: "bg-blue-500",   text: "text-white", ring: "ring-blue-400" },
  5: { bg: "bg-emerald-500",text: "text-white", ring: "ring-emerald-400" },
};

type Props = {
  lessonId: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  existing: LessonGrade | null;
  onClose: () => void;
  onSaved: (grade: LessonGrade) => void;
};

export function GradeModal({ lessonId, teacherId, studentId, studentName, existing, onClose, onSaved }: Props) {
  const { locale } = useLocale();
  const dl = getDictionary(locale as Locale).lesson;
  const db = createClient();

  const [grade, setGrade] = useState<number | null>(existing?.grade ?? null);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customText, setCustomText] = useState<string>(existing?.comment ?? "");
  const [isOther, setIsOther] = useState(false);
  const [saving, setSaving] = useState(false);

  // preset comments keyed by grade (1-5)
  const presets = grade ? (dl.gradeComments as Record<string, string[]>)[String(grade)] ?? [] : [];

  const comment = isOther ? customText : (selectedPreset != null ? presets[selectedPreset] ?? null : null);
  const canSave = grade != null && (selectedPreset != null || (isOther && customText.trim().length > 0));

  async function handleSave() {
    if (!canSave || !grade) return;
    setSaving(true);
    try {
      const saved = await gradeStudentForLesson(db, lessonId, teacherId, studentId, grade, comment);
      onSaved(saved);
      onClose();
    } catch {
      // error silently — button returns to active state
    } finally {
      setSaving(false);
    }
  }

  function selectGrade(g: number) {
    setGrade(g);
    setSelectedPreset(null);
    setIsOther(false);
    setCustomText("");
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="truncate text-sm font-bold text-slate-700">
            {dl.gradeStudent} <span className="text-brand-blue">{studentName}</span>
          </p>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Grade picker */}
          <div>
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-slate-400">{dl.gradeChoose}</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((g) => {
                const c = GRADE_COLORS[g]!;
                const active = grade === g;
                return (
                  <button
                    key={g}
                    onClick={() => selectGrade(g)}
                    className={cn(
                      "flex h-14 w-14 flex-col items-center justify-center rounded-2xl font-extrabold text-xl transition-all active:scale-95",
                      c.bg, c.text,
                      active ? `ring-2 ring-offset-2 ${c.ring} scale-110 shadow-lg` : "opacity-70 hover:opacity-90",
                    )}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment presets */}
          {grade != null && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Комментарий</p>
              <div className="space-y-1.5">
                {presets.map((text, i) => (
                  <button
                    key={i}
                    onClick={() => { setSelectedPreset(i); setIsOther(false); setCustomText(""); }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                      selectedPreset === i && !isOther
                        ? "border-brand-blue bg-blue-50 text-brand-blue"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    {selectedPreset === i && !isOther && <Check className="mr-1.5 inline h-3.5 w-3.5" />}
                    {text}
                  </button>
                ))}
                <button
                  onClick={() => { setIsOther(true); setSelectedPreset(null); }}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                    isOther
                      ? "border-brand-blue bg-blue-50 text-brand-blue"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  {isOther && <Check className="mr-1.5 inline h-3.5 w-3.5" />}
                  {dl.gradeOther}
                </button>
                {isOther && (
                  <textarea
                    autoFocus
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder={dl.gradeOtherPlaceholder}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-blue/90 active:scale-95 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            {dl.gradeSave}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

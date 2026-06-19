"use client";

import { useState, useEffect, useCallback } from "react";
import { Hand, Eye } from "lucide-react";
import { getMyRaisedHand, raiseHand, getDictionary } from "@snr/core";
import type { RaisedHand, Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";

export function RaiseHandButton({ lessonId, studentId }: { lessonId: string; studentId: string }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.lesson.raisedHand;
  const db = createClient();

  const [hand, setHand] = useState<RaisedHand | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    getMyRaisedHand(db as never, lessonId, studentId)
      .then((h) => setHand(h))
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, studentId]);

  useEffect(() => { reload(); }, [reload]);

  // Teacher may lower the hand → refresh my state in realtime.
  useRealtimeChannel(`lesson-myhand-${lessonId}`, "lesson_raised_hands", `lesson_id=eq.${lessonId}`, reload);

  const raised = !!hand;

  async function onRaise() {
    if (raised || busy) return;
    setBusy(true);
    try {
      await raiseHand(db as never, lessonId, studentId);
      reload();
    } catch { /* noop */ } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-6 shadow-sm backdrop-blur-xl">
      <button
        onClick={onRaise}
        disabled={raised || busy}
        className={`flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-full transition-all ${
          raised
            ? "bg-yellow-100 text-yellow-600 shadow-lg shadow-yellow-300/40 cursor-default"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:scale-105 active:scale-95"
        }`}
      >
        <Hand className={`h-9 w-9 ${raised ? "animate-pulse" : ""}`} />
      </button>
      <p className={`text-sm font-semibold ${raised ? "text-yellow-600" : "text-slate-600"}`}>
        {raised ? t.raised : t.raise}
      </p>
      {raised && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-3 py-1 text-[11px] font-medium text-yellow-600">
          <Eye className="h-3.5 w-3.5" />
          {t.teacherSees}
        </span>
      )}
    </div>
  );
}

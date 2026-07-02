"use client";

import { useState, useEffect, useCallback } from "react";
import { Hand } from "lucide-react";
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
  const [error, setError] = useState("");

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
    // eslint-disable-next-line no-console
    console.log("[RaiseHand] Clicked for lesson:", lessonId, "student:", studentId);
    setBusy(true);
    setError("");
    try {
      const result = await raiseHand(db as never, lessonId, studentId);
      console.log("[RaiseHand] Result:", result);
      reload();
    } catch (e) {
      console.error("[RaiseHand] error:", e);
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={onRaise}
        disabled={raised || busy}
        className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all duration-200 disabled:opacity-60 ${
          raised
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
        }`}
      >
        <Hand className={`h-3.5 w-3.5 ${raised ? "animate-pulse" : ""}`} />
        <span>{raised ? t.raised : t.raise}</span>
      </button>
      {error && (
        <span className="absolute right-0 top-full mt-1 whitespace-nowrap rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
          {error}
        </span>
      )}
    </div>
  );
}

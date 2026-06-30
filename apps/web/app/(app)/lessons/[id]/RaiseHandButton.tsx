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
    <button
      onClick={onRaise}
      disabled={raised || busy}
      className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-all duration-200 disabled:opacity-50 ${
        raised
          ? "border-yellow-400/50 bg-yellow-400/20 text-yellow-200"
          : "border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/20"
      }`}
    >
      <Hand className={`h-3.5 w-3.5 ${raised ? "animate-pulse" : ""}`} />
      <span>{raised ? t.raised : t.raise}</span>
    </button>
  );
}

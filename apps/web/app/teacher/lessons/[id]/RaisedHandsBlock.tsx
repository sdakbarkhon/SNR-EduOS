"use client";

import { useState, useEffect, useCallback } from "react";
import { Hand, X } from "lucide-react";
import { getActiveRaisedHands, lowerHand, getDictionary } from "@snr/core";
import type { RaisedHandWithStudent, Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { useRealtimeChannel } from "@/lib/realtime";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function RaisedHandsBlock({ lessonId, teacherId }: { lessonId: string; teacherId: string }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.lesson.raisedHand;
  const db = createClient();

  const [hands, setHands] = useState<RaisedHandWithStudent[]>([]);
  const [loweringId, setLoweringId] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  // Live clock for relative "X sec ago" (client-only)
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // [#418 diagnostics] render-time snapshot (client-only); nowMs is null on the
  // server pass and a number after mount — prime hydration-mismatch suspect.
  if (typeof window !== "undefined") {
    console.log("[hydration] RaisedHandsBlock render", { lessonId, handCount: hands.length, nowMs, flash });
  }

  const reload = useCallback(() => {
    getActiveRaisedHands(db as never, lessonId)
      .then((rows) => {
        setHands((prev) => {
          if (rows.length > prev.length) {
            setFlash(true);
            setTimeout(() => setFlash(false), 1200);
          }
          return rows;
        });
      })
      .catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => { reload(); }, [reload]);

  useRealtimeChannel(`lesson-hands-${lessonId}`, "lesson_raised_hands", `lesson_id=eq.${lessonId}`, reload);

  async function onLower(handId: string) {
    setLoweringId(handId);
    setHands((prev) => prev.filter((h) => h.id !== handId)); // optimistic
    try {
      await lowerHand(db as never, handId, teacherId);
    } catch {
      reload();
    } finally {
      setLoweringId(null);
    }
  }

  function ago(raisedAt: string): string {
    if (nowMs === null) return "";
    const secs = Math.max(0, Math.floor((nowMs - new Date(raisedAt).getTime()) / 1000));
    if (secs < 60) return t.agoSeconds.replace("{n}", String(secs));
    return t.agoMinutes.replace("{n}", String(Math.floor(secs / 60)));
  }

  return (
    <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600 ${flash ? "animate-bounce" : ""}`}>
          <Hand className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">
          {t.teacherTitle} ({hands.length})
        </h2>
        {flash && <span className="h-2 w-2 animate-ping rounded-full bg-yellow-400" />}
      </div>

      {hands.length === 0 ? (
        <p className="text-sm text-gray-400">{t.empty}</p>
      ) : (
        <div className="space-y-2">
          {hands.map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-xl border border-yellow-100 bg-yellow-50/60 px-4 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-200 text-[12px] font-bold text-yellow-700">
                {initials(h.student.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">{h.student.full_name}</p>
                <p className="text-[11px] text-slate-400">{ago(h.raised_at)}</p>
              </div>
              <button
                onClick={() => onLower(h.id)}
                disabled={loweringId === h.id}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                {t.lower}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

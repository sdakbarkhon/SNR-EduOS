"use client";

import { useEffect, useRef, useState } from "react";
import { getDictionary, startLive, stopLive, setLiveCode } from "@snr/core";
import type { Locale, LessonStage, CodeStageConfig, CodeLanguage } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { CodeEditor } from "@/components/CodeEditor";

const THROTTLE_MS = 500;

/**
 * Teacher's live-coding panel for the active code stage. Start/Stop toggles
 * `is_live_active`; while live, keystrokes are throttled (leading + trailing
 * write, at most one per THROTTLE_MS) into `live_code`, which Realtime
 * delivers to StudentLiveViewer. Stopping (or unmounting mid-live, e.g. the
 * teacher switches to a different stage) turns live off so students aren't
 * left staring at a stale broadcast.
 */
export function TeacherLiveCodeControl({ stage }: { stage: LessonStage }) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).lesson.live;
  const db = createClient();

  const cfg = (stage.config ?? {}) as Partial<CodeStageConfig>;
  const language: CodeLanguage = (stage.programming_language as CodeLanguage | null) ?? cfg.language ?? "python";
  const starter = stage.starter_code ?? cfg.starter_code ?? "";

  const [active, setActive] = useState(!!stage.is_live_active);
  const [code, setCode] = useState(stage.live_code ?? starter);
  const [toggling, setToggling] = useState(false);

  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  const throttleRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; last: number }>({ timer: null, last: 0 });

  function pushCode(v: string) {
    const state = throttleRef.current;
    if (state.timer) clearTimeout(state.timer);
    const elapsed = Date.now() - state.last;
    if (elapsed >= THROTTLE_MS) {
      state.last = Date.now();
      setLiveCode(db, stage.id, v).catch(() => null);
    } else {
      state.timer = setTimeout(() => {
        state.last = Date.now();
        setLiveCode(db, stage.id, v).catch(() => null);
      }, THROTTLE_MS - elapsed);
    }
  }

  function handleChange(v: string) {
    setCode(v);
    if (active) pushCode(v);
  }

  async function handleToggle() {
    setToggling(true);
    try {
      if (active) {
        await stopLive(db, stage.id);
        setActive(false);
      } else {
        await startLive(db, stage.id, code);
        setActive(true);
      }
    } catch {
      /* keep previous state on failure */
    } finally {
      setToggling(false);
    }
  }

  // Auto-stop if the teacher navigates away / switches stages while live.
  useEffect(() => {
    return () => {
      if (throttleRef.current.timer) clearTimeout(throttleRef.current.timer);
      if (activeRef.current) stopLive(db, stage.id).catch(() => null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
        active ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
      }`}>
        {active && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />}
        <span className="flex-1">{active ? t.liveOn : t.liveOff}</span>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
            active ? "bg-slate-500 hover:bg-slate-600" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {toggling ? "…" : active ? t.stop : t.start}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        <CodeEditor value={code} onChange={handleChange} language={language} height="100%" />
      </div>
    </div>
  );
}

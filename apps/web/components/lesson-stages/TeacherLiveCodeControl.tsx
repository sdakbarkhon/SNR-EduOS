"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Loader2 } from "lucide-react";
import { getDictionary, startLive, stopLive, setLiveCode } from "@snr/core";
import type { Locale, LessonStage, CodeStageConfig, CodeLanguage } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { CodeEditor } from "@/components/CodeEditor";
import { runCode, isUnsupportedCppFeatureError, type RunResult } from "@/lib/code-runner";
import type { RealtimeChannel } from "@supabase/supabase-js";

const THROTTLE_MS = 500;

/**
 * Teacher's live-coding panel for the active code stage. Start/Stop toggles
 * `is_live_active`; while live, keystrokes are throttled (leading + trailing
 * write, at most one per THROTTLE_MS) into `live_code`, which Realtime
 * (postgres_changes) delivers to StudentLiveViewer. Stopping (or unmounting
 * mid-live, e.g. the teacher switches to a different stage) turns live off so
 * students aren't left staring at a stale broadcast.
 *
 * Пачка 3, Задача 3 — кнопка "Run": выполняет код тем же клиентским раннером,
 * что песочница/этапы урока (apps/web/lib/code-runner.ts — Piston вышел из
 * строя в феврале 2026, весь запуск теперь client-side: Pyodide/JSCPP/
 * iframe-sandbox, серверного piston-эндпоинта в проекте не существует).
 * Результат показывается локально И транслируется ученикам ОТДЕЛЬНЫМ
 * broadcast-каналом stage-run-<id> (не через postgres_changes, как код —
 * вывод эфемерный, персистить в БД не нужно, миграция не требуется).
 */
export function TeacherLiveCodeControl({ stage }: { stage: LessonStage }) {
  const { locale } = useLocale();
  const t = getDictionary(locale as Locale).lesson.live;
  const dc = getDictionary(locale as Locale).lesson.code;
  const db = createClient();

  const cfg = (stage.config ?? {}) as Partial<CodeStageConfig>;
  const language: CodeLanguage = (stage.programming_language as CodeLanguage | null) ?? cfg.language ?? "python";
  const starter = stage.starter_code ?? cfg.starter_code ?? "";

  const [active, setActive] = useState(!!stage.is_live_active);
  const [code, setCode] = useState(stage.live_code ?? starter);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  const throttleRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; last: number }>({ timer: null, last: 0 });

  // Broadcast-канал для трансляции результата запуска — отдельный от
  // postgres_changes, которым синхронизируется сам код (setLiveCode).
  const runChannelRef = useRef<RealtimeChannel | null>(null);
  useEffect(() => {
    const channel = db.channel(`stage-run-${stage.id}`);
    channel.subscribe();
    runChannelRef.current = channel;
    return () => {
      db.removeChannel(channel);
      runChannelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id]);

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

  // Те же коды ошибок, что CodeStageView.tsx (isHtml здесь не нужен — live-
  // демонстрация не поддерживает html-превью, только текстовый вывод).
  function errMessage(err: string): string {
    if (err === "compile") return dc.compileError;
    if (err === "timeout") return dc.timeout;
    if (err.startsWith("exit:")) return `${dc.error} (exit ${err.slice(5)})`;
    if (err.startsWith("net:")) return `${dc.error}: ${err.slice(4)}`;
    if (isUnsupportedCppFeatureError(err)) return dc.cppUnsupported;
    return err;
  }
  function resultToString(r: RunResult | null): string {
    if (!r) return "";
    let s = "";
    if (r.stdout) s += r.stdout;
    if (r.stderr) s += `\n[stderr]\n${r.stderr}`;
    if (r.error) s += `\n[${errMessage(r.error)}]`;
    return s.trim();
  }

  async function handleRun() {
    setRunning(true);
    let r: RunResult;
    try {
      r = await runCode({ language, code });
    } catch (e) {
      r = { stdout: "", stderr: "", error: String(e) };
    }
    setResult(r);
    setRunning(false);

    if (active) {
      const outputText = resultToString(r);
      void runChannelRef.current?.send({
        type: "broadcast",
        event: "output",
        payload: { content: outputText, exitCode: r.error ? 1 : 0 },
      });
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

  const outputText = resultToString(result);

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

      <div className="flex min-h-0 flex-[3] flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{dc.editorLabel}</span>
          <button
            onClick={handleRun}
            disabled={running || !code.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? dc.running : dc.run}
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <CodeEditor value={code} onChange={handleChange} language={language} height="100%" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-400">{dc.output}</span>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-900 px-3 py-2.5 text-xs text-slate-100">
          {outputText || <span className="text-slate-500">{dc.emptyOutput}</span>}
        </pre>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft, Play, Loader2, Trash2, AlertTriangle, ExternalLink,
  Check, Save, Pencil, X,
} from "lucide-react";
import {
  getDictionary, type Locale, getMyStudent,
  getSandboxAutosave, upsertSandboxAutosave, listSandboxProjects,
  createSandboxProject, updateSandboxProjectCode, renameSandboxProject, deleteSandboxProject,
  SandboxProjectLimitError, SandboxProjectNameTakenError,
  type SandboxProject,
} from "@snr/core";
import { useLocale } from "@/components";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase/client";
import { SANDBOX_TOOLS, type SandboxTool, type SandboxToolId } from "@/lib/sandbox-tools";
import { getServicesForSubject, SUBJECT_SERVICE_MAP } from "@/lib/external-services";
import { CodeEditor } from "@/components/CodeEditor";
import { StdinInput } from "@/components/StdinInput";
import { pyodideReady } from "@/lib/pyodide";
import { runCode, isUnsupportedCppFeatureError, type RunResult } from "@/lib/code-runner";

// Промт 5Б — debounce автосохранения (3-5с диапазон из спеки, выбрана
// середина).
const AUTOSAVE_DEBOUNCE_MS = 4000;

// ── Fullscreen shell (no submit — pure sandbox) ────────────────────────────────
function SandboxFullscreen({
  title, backLabel, onClose, children,
}: {
  title: string;
  backLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = prev; };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-950">
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:px-6">
        <button
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
          <span className="hidden sm:inline">{backLabel}</span>
        </button>
        <h2 className="flex-1 truncate text-center text-sm font-medium text-slate-700 dark:text-slate-200">{title}</h2>
        <span className="w-[88px] shrink-0" />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>,
    document.body,
  );
}

// ── Iframe tool (geogebra/phet/desmos/blockly_games/visualgo/p5js/excalidraw/learningapps/sqlonline/wokwi/codesandbox) ───
function IframeSandbox({ tool, name }: { tool: SandboxTool; name: string }) {
  const { locale } = useLocale();
  const dx = getDictionary(locale as Locale).lesson.external;
  const url = tool.embedUrl ?? "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    const t = setTimeout(() => setState((s) => (s === "loading" ? "error" : s)), 30000);
    return () => clearTimeout(t);
  }, []);

  if (state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-orange-500" />
        <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">{dx.loadError}</h4>
        <p className="max-w-md text-sm text-slate-500">{dx.loadErrorBody}</p>
        <button
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
        >
          <ExternalLink className="h-4 w-4" /> {dx.openInNewTab}
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}
      <iframe
        src={url}
        title={name}
        onLoad={() => setState("ok")}
        onError={() => setState("error")}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-presentation"
        allow="accelerometer; autoplay; camera; encrypted-media; fullscreen; gyroscope; microphone; clipboard-read; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-full w-full border-none"
      />
    </div>
  );
}

// ── Sandbox projects (Промт 5Б) — autosave + named projects, CodeSandbox only ──

function savedAgoLabel(
  since: Date | null,
  now: number,
  dp: ReturnType<typeof getDictionary>["sandbox"]["projects"],
): string | null {
  if (!since) return null;
  const secs = Math.max(0, Math.floor((now - since.getTime()) / 1000));
  if (secs < 60) return dp.savedSecondsAgo.replace("{n}", String(secs));
  return dp.savedMinutesAgo.replace("{n}", String(Math.floor(secs / 60)));
}

/** Простая модалка "введи имя" — используется и для "Сохранить как...", и для "Переименовать". */
function NamePromptModal({
  title, initialValue, dp, onCancel, onConfirm,
}: {
  title: string;
  initialValue: string;
  dp: ReturnType<typeof getDictionary>["sandbox"]["projects"];
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <button onClick={onCancel} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <input
          type="text"
          autoFocus
          value={value}
          maxLength={100}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onConfirm(value); }}
          placeholder={dp.namePlaceholder}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
            {dp.cancelBtn}
          </button>
          <button
            onClick={() => value.trim() && onConfirm(value)}
            disabled={!value.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {dp.saveBtn}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ConfirmDeleteModal({
  projectName, dp, onCancel, onConfirm,
}: {
  projectName: string;
  dp: ReturnType<typeof getDictionary>["sandbox"]["projects"];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {dp.deleteConfirm.replace("{name}", projectName)}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10">
            {dp.cancelBtn}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
          >
            {dp.deleteBtn}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Code tool (Monaco + Python/C++ runner) ─────────────────────────────────────
type Lang = "python" | "cpp";

function CodeSandbox() {
  const { locale } = useLocale();
  const dc = getDictionary(locale as Locale).lesson.code;
  const dp = getDictionary(locale as Locale).sandbox.projects;
  const toast = useToast();
  const db = createClient();

  const [language, setLanguage] = useState<Lang>("python");
  const [code, setCode] = useState("");
  const [stdinValues, setStdinValues] = useState<string[]>([""]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  // ── Промт 5Б: сохранённые проекты ──────────────────────────────────────
  const [studentId, setStudentId] = useState<string | null>(null);
  const [projects, setProjects] = useState<SandboxProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [autosaveCode, setAutosaveCode] = useState(""); // для возврата из именованного проекта на "Новый проект"
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const skipNextAutosave = useRef(false);

  const stdin = stdinValues.join("\n");
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  // Обновляем "N сек назад" раз в секунду, пока индикатор виден.
  useEffect(() => {
    if (!lastSavedAt) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lastSavedAt]);

  // Резолвим ученика один раз.
  useEffect(() => {
    let cancelled = false;
    getMyStudent(db).then((s) => { if (!cancelled) setStudentId(s.id); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // При смене языка (или после резолва ученика) — своя связка ученик+сервис:
  // список именованных проектов + автосейв (загружается, только если ещё
  // не выбран именованный проект — здесь всегда так, т.к. смена языка сама
  // сбрасывает activeProjectId ниже).
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    setActiveProjectId(null);
    (async () => {
      const [list, autosave] = await Promise.all([
        listSandboxProjects(db, studentId, language),
        getSandboxAutosave(db, studentId, language),
      ]);
      if (cancelled) return;
      setProjects(list);
      const initialCode = autosave?.code ?? "";
      setAutosaveCode(initialCode);
      skipNextAutosave.current = true;
      setCode(initialCode);
      setLastSavedAt(autosave ? new Date(autosave.updated_at) : null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, language]);

  // Debounced автосохранение: именованный проект → UPDATE этого id;
  // иначе → UPSERT автосейв-слота (student_id, service_id).
  useEffect(() => {
    if (!studentId) return;
    if (skipNextAutosave.current) { skipNextAutosave.current = false; return; }
    const t = setTimeout(async () => {
      try {
        if (activeProjectId) {
          await updateSandboxProjectCode(db, activeProjectId, code);
        } else {
          await upsertSandboxAutosave(db, { studentId, serviceId: language, code });
          setAutosaveCode(code);
        }
        setLastSavedAt(new Date());
      } catch {
        // Автосохранение не должно прерывать работу ученика тостом на каждый чих.
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, studentId, language, activeProjectId]);

  function selectProject(project: SandboxProject | null) {
    skipNextAutosave.current = true;
    setActiveProjectId(project?.id ?? null);
    setCode(project ? (project.code ?? "") : autosaveCode);
  }

  async function handleSaveAs(name: string) {
    if (!studentId) return;
    try {
      const created = await createSandboxProject(db, { studentId, serviceId: language, name, code });
      setProjects((prev) => [created, ...prev]);
      setActiveProjectId(created.id);
      setSaveAsOpen(false);
    } catch (e) {
      if (e instanceof SandboxProjectNameTakenError) toast(dp.nameTakenToast);
      else if (e instanceof SandboxProjectLimitError) toast(dp.limitReached);
      else toast(dc.error);
    }
  }

  async function handleRename(newName: string) {
    if (!studentId || !activeProjectId) return;
    try {
      await renameSandboxProject(db, { projectId: activeProjectId, studentId, serviceId: language, newName });
      setProjects((prev) => prev.map((p) => (p.id === activeProjectId ? { ...p, name: newName.trim() } : p)));
      setRenameOpen(false);
    } catch (e) {
      if (e instanceof SandboxProjectNameTakenError) toast(dp.nameTakenToast);
      else toast(dc.error);
    }
  }

  async function handleDelete() {
    if (!activeProjectId) return;
    try {
      await deleteSandboxProject(db, activeProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== activeProjectId));
      selectProject(null);
      setDeleteConfirmOpen(false);
    } catch {
      toast(dc.error);
    }
  }

  function errMessage(err: string): string {
    if (err === "compile") return dc.compileError;
    if (err === "timeout") return dc.timeout;
    if (err.startsWith("exit:")) return `${dc.error} (exit ${err.slice(5)})`;
    if (err.startsWith("net:")) return `${dc.error}: ${err.slice(4)}`;
    if (isUnsupportedCppFeatureError(err)) return dc.cppUnsupported;
    return err;
  }

  async function handleRun() {
    setRunning(true);
    try {
      const r = await runCode({ language, code, stdin });
      setResult(r);
    } catch (e) {
      setResult({ stdout: "", stderr: "", error: String(e) });
    } finally {
      setRunning(false);
    }
  }

  const runLabel = running
    ? (language === "python" && !pyodideReady() ? dc.runFirst : language === "cpp" ? dc.runningCpp : dc.running)
    : dc.run;
  const savedAgo = savedAgoLabel(lastSavedAt, nowTick, dp);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {/* Language selector */}
        <div className="grid grid-cols-2 gap-3">
          {(["python", "cpp"] as Lang[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 p-3 text-sm font-bold transition-all ${
                language === lang
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/10 dark:text-slate-300"
              }`}
            >
              {lang === "python" ? dc.python : dc.cpp}
            </button>
          ))}
        </div>

        {/* Промт 5Б: панель проектов */}
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-white/10 dark:bg-white/5">
          <label className="flex min-w-[180px] flex-1 items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            {dp.myProjects}
            <select
              value={activeProjectId ?? "__new__"}
              onChange={(e) => selectProject(e.target.value === "__new__" ? null : projects.find((p) => p.id === e.target.value) ?? null)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="__new__">{dp.newProjectOption}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <div className="flex shrink-0 gap-1.5">
            <button
              onClick={() => setSaveAsOpen(true)}
              disabled={!studentId}
              title={dp.saveAsBtn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 dark:border-white/10 dark:text-slate-300"
            >
              <Save className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{dp.saveAsBtn}</span>
            </button>
            <button
              onClick={() => setRenameOpen(true)}
              disabled={!activeProjectId}
              title={dp.renameBtn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-40 dark:border-white/10 dark:text-slate-300"
            >
              <Pencil className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{dp.renameBtn}</span>
            </button>
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={!activeProjectId}
              title={dp.deleteBtn}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 disabled:opacity-40 dark:border-white/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{dp.deleteBtn}</span>
            </button>
          </div>
          {savedAgo && (
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3 w-3" /> {dp.savedLabel} · {savedAgo}
            </span>
          )}
        </section>

        {/* Editor */}
        <CodeEditor value={code} onChange={setCode} language={language} minHeight={360} />

        {/* Stdin */}
        <section>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-400">{dc.stdin}</h3>
          <StdinInput value={stdinValues} onChange={setStdinValues} />
        </section>

        {/* Run */}
        <button
          onClick={handleRun}
          disabled={running || !code.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {runLabel}
        </button>

        {/* Output */}
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">{dc.output}</h3>
            {result && (
              <button
                onClick={() => setResult(null)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-600"
              >
                <Trash2 className="h-3 w-3" /> {dc.clear}
              </button>
            )}
          </div>
          <div className="min-h-[120px] max-h-[260px] overflow-auto rounded-xl p-4 font-mono text-[13px] leading-relaxed" style={{ background: "#1a1a1a" }}>
            {!result ? (
              <span className="text-slate-500">—</span>
            ) : (
              <>
                {result.stdout && <pre className="whitespace-pre-wrap text-slate-100">{result.stdout}</pre>}
                {result.stderr && <pre className="whitespace-pre-wrap text-red-400">{result.stderr}</pre>}
                {result.error && <pre className="whitespace-pre-wrap text-orange-400">{errMessage(result.error)}</pre>}
                {!result.stdout && !result.stderr && !result.error && (
                  <span className="text-slate-500">{dc.emptyOutput}</span>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {saveAsOpen && (
        <NamePromptModal
          title={dp.saveAsBtn}
          initialValue=""
          dp={dp}
          onCancel={() => setSaveAsOpen(false)}
          onConfirm={handleSaveAs}
        />
      )}
      {renameOpen && activeProject && (
        <NamePromptModal
          title={dp.renameBtn}
          initialValue={activeProject.name}
          dp={dp}
          onCancel={() => setRenameOpen(false)}
          onConfirm={handleRename}
        />
      )}
      {deleteConfirmOpen && activeProject && (
        <ConfirmDeleteModal
          projectName={activeProject.name}
          dp={dp}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// ── Main sandbox grid ──────────────────────────────────────────────────────────
export function SandboxView({ initialToolId }: { initialToolId?: SandboxToolId } = {}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.sandbox;
  const [active, setActive] = useState<SandboxTool | null>(
    () => SANDBOX_TOOLS.find((tool) => tool.id === initialToolId) ?? null,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const toolMeta = (id: SandboxToolId) => t.tools[id];

  // БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 5.4 — subject filter above the tool grid.
  // "code" (Python/C++ sandbox) counts as Программирование; "all" (default)
  // shows every tool, unchanged from before this filter existed.
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const subjectOptions = Object.keys(SUBJECT_SERVICE_MAP);
  const visibleTools = subjectFilter === "all"
    ? SANDBOX_TOOLS
    : SANDBOX_TOOLS.filter((tool) =>
        tool.id === "code" ? subjectFilter === "Программирование" : getServicesForSubject(subjectFilter).includes(tool.id),
      );

  return (
    <div>
      <p className="max-w-2xl text-sm text-slate-500">{t.subtitle}</p>

      <label className="mt-4 flex max-w-xs items-center gap-2 text-sm font-medium text-slate-600">
        {t.filterLabel}
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">{t.filterAll}</option>
          {subjectOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {visibleTools.map((tool) => {
          const meta = toolMeta(tool.id);
          return (
            <button
              key={tool.id}
              onClick={() => setActive(tool)}
              disabled={!mounted}
              className="group flex flex-col items-start gap-3 rounded-[20px] border border-white bg-white/70 p-5 text-left shadow-md backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-lg disabled:opacity-60"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${tool.gradient} text-white shadow-sm`}>
                <tool.Icon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{meta.name}</h3>
                <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{meta.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fullscreen tool runner */}
      {mounted && active && (
        <SandboxFullscreen
          title={toolMeta(active.id).name}
          backLabel={t.backToMenu}
          onClose={() => setActive(null)}
        >
          {active.kind === "code"
            ? <CodeSandbox />
            : <IframeSandbox tool={active} name={toolMeta(active.id).name} />}
        </SandboxFullscreen>
      )}
    </div>
  );
}

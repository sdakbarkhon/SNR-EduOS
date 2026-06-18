"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ChevronLeft, MapPin, Target, BookOpen, Hammer, Pencil,
  CheckSquare, Trophy, Check, Plus, X, FileText, Download,
  Trash2, Upload, Play, Square, Clock,
} from "lucide-react";
import {
  updateLesson, setStageEnabled, setStageCompleted, setStageNotes,
  uploadLessonMaterial, deleteLessonMaterial, getLessonMaterialUrl,
  getSubjectStyle, startLesson, endLesson,
} from "@snr/core";
import type { TeacherLessonView, LessonStatus, LessonStage, StageKey, LessonMaterial, Teacher } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";

const ALL_STAGE_KEYS: StageKey[] = ["goal", "theory", "practice", "classwork", "review", "summary"];
const REQUIRED = new Set<StageKey>(["goal", "summary"]);
const STAGE_ORDER: Record<StageKey, number> = {
  goal: 1, theory: 2, practice: 3, classwork: 4, review: 5, summary: 6,
};
const STAGE_ICONS: Record<StageKey, React.ReactNode> = {
  goal:       <Target className="h-4 w-4" />,
  theory:     <BookOpen className="h-4 w-4" />,
  practice:   <Hammer className="h-4 w-4" />,
  classwork:  <Pencil className="h-4 w-4" />,
  review:     <CheckSquare className="h-4 w-4" />,
  summary:    <Trophy className="h-4 w-4" />,
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}
function fmtBytes(b: number | null): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

type StageState = {
  enabled: boolean;
  id: string | null;
  is_completed: boolean;
  notes: string;
  notesOpen: boolean;
};

function initStageState(stages: LessonStage[]): Record<StageKey, StageState> {
  const map: Record<string, LessonStage> = {};
  for (const s of stages) map[s.stage_key] = s;
  const result = {} as Record<StageKey, StageState>;
  for (const key of ALL_STAGE_KEYS) {
    const s = map[key];
    result[key] = {
      enabled: !!s,
      id: s?.id ?? null,
      is_completed: s?.is_completed ?? false,
      notes: s?.teacher_notes ?? "",
      notesOpen: !!(s?.teacher_notes),
    };
  }
  return result;
}

export function TeacherLessonDetailView({
  lesson,
  teacher,
}: {
  lesson: TeacherLessonView;
  teacher: Teacher;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [title, setTitle] = useState(lesson.title ?? "");
  const [desc, setDesc] = useState(lesson.description ?? "");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  const [stages, setStages] = useState<Record<StageKey, StageState>>(() =>
    initStageState(lesson.stages)
  );

  const [materials, setMaterials] = useState<LessonMaterial[]>(lesson.materials);
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const db = createClient();

  const [status, setStatus] = useState<LessonStatus>(lesson.status);
  const [startedAt, setStartedAt] = useState<string | null>(lesson.started_at);
  const [endedAt, setEndedAt] = useState<string | null>(lesson.ended_at);
  const [statusLoading, setStatusLoading] = useState(false);
  const [elapsedMin, setElapsedMin] = useState(0);

  useEffect(() => {
    if (status !== "in_progress" || !startedAt) return;
    const tick = () => setElapsedMin(Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [status, startedAt]);

  async function handleStart() {
    setStatusLoading(true);
    try {
      await startLesson(db, lesson.id);
      const now = new Date().toISOString();
      setStatus("in_progress");
      setStartedAt(now);
    } catch { /* noop */ } finally { setStatusLoading(false); }
  }

  async function handleEnd() {
    setStatusLoading(true);
    try {
      await endLesson(db, lesson.id);
      setStatus("completed");
      setEndedAt(new Date().toISOString());
    } catch { /* noop */ } finally { setStatusLoading(false); }
  }

  const style = getSubjectStyle(lesson.group.subject);
  const stageLabels: Record<StageKey, string> = {
    goal:       d.lesson.stage1,
    theory:     d.lesson.stage2,
    practice:   d.lesson.stage3,
    classwork:  d.lesson.stage4,
    review:     d.lesson.stage5,
    summary:    d.lesson.stage6,
  };

  // ── Info save ──────────────────────────────────────────────────────
  async function handleSaveInfo() {
    setInfoSaving(true);
    try {
      await updateLesson(db, lesson.id, { title: title || null, description: desc || null });
      setInfoSaved(true);
      setTimeout(() => setInfoSaved(false), 2000);
    } catch { /* noop */ } finally {
      setInfoSaving(false);
    }
  }

  const infoChanged = title !== (lesson.title ?? "") || desc !== (lesson.description ?? "");

  // ── Stage toggle ───────────────────────────────────────────────────
  async function handleToggleStage(key: StageKey) {
    if (REQUIRED.has(key)) return;
    const next = !stages[key].enabled;
    setStages((prev) => ({ ...prev, [key]: { ...prev[key], enabled: next } }));
    await setStageEnabled(db, lesson.id, key, next).catch(() =>
      setStages((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !next } }))
    );
  }

  async function handleToggleCompleted(key: StageKey) {
    const next = !stages[key].is_completed;
    setStages((prev) => ({ ...prev, [key]: { ...prev[key], is_completed: next } }));
    await setStageCompleted(db, lesson.id, key, next).catch(() =>
      setStages((prev) => ({ ...prev, [key]: { ...prev[key], is_completed: !next } }))
    );
  }

  function handleNotesBlur(key: StageKey) {
    setStageNotes(db, lesson.id, key, stages[key].notes).catch(() => null);
  }

  // ── Material upload ────────────────────────────────────────────────
  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const mat = await uploadLessonMaterial(db, {
        lessonId: lesson.id,
        teacherId: teacher.id,
        file: uploadFile,
        title: uploadTitle.trim(),
      });
      setMaterials((prev) => [...prev, mat]);
      setUploadModal(false);
      setUploadTitle("");
      setUploadFile(null);
    } catch { /* noop */ } finally {
      setUploading(false);
    }
  }

  async function handleDeleteMaterial(mat: LessonMaterial) {
    if (!confirm(d.lesson.deleteConfirm)) return;
    await deleteLessonMaterial(db, mat.id, mat.file_storage_path).catch(() => null);
    setMaterials((prev) => prev.filter((m) => m.id !== mat.id));
  }

  async function handleDownloadMaterial(mat: LessonMaterial) {
    const url = await getLessonMaterialUrl(db, mat.file_storage_path, mat.file_original_name ?? mat.title).catch(() => null);
    if (url) window.open(url, "_blank");
  }

  const timeRange = lesson.ends_at
    ? `${fmtTime(lesson.starts_at)} – ${fmtTime(lesson.ends_at)}`
    : fmtTime(lesson.starts_at);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back */}
      <Link
        href="/teacher/lessons"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-600"
      >
        <ChevronLeft className="h-4 w-4" />
        {d.lesson.backToLessons}
      </Link>

      {/* Header card — color varies by status */}
      {(() => {
        const bg =
          status === "in_progress" ? "linear-gradient(135deg, #16a34a, #15803d)"
          : status === "completed"  ? "linear-gradient(135deg, #6b7280, #4b5563)"
          : `linear-gradient(135deg, ${style.color}, color-mix(in sRGB, ${style.color} 60%, #1e1b4b))`;
        return (
          <div className="flex flex-col gap-2 rounded-2xl p-6 text-white shadow-xl" style={{ background: bg }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {style.label} · {lesson.group.name}
            </p>
            {lesson.lesson_no && <p className="text-xs text-white/60">Урок №{lesson.lesson_no}</p>}
            <h1 className="text-2xl font-bold">
              {lesson.title ?? lesson.topic ?? `Урок от ${fmtDate(lesson.starts_at)}`}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-white/10 px-3 py-1">{timeRange}</span>
              <span className="rounded-full bg-white/10 px-3 py-1">{fmtDate(lesson.starts_at)}</span>
              {lesson.room && (
                <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
                  <MapPin className="h-3.5 w-3.5" /> Каб. {lesson.room}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Status control */}
      {status === "scheduled" && (
        <div className="flex items-center justify-between rounded-2xl border border-yellow-200 bg-yellow-50 px-5 py-4">
          <p className="text-sm text-yellow-800">Урок запланирован. Нажмите когда начнётся.</p>
          <button
            onClick={handleStart}
            disabled={statusLoading}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-green-500/25 hover:bg-green-700 active:scale-95 disabled:opacity-50"
          >
            <Play className="h-4 w-4 fill-white" /> Начать урок
          </button>
        </div>
      )}
      {status === "in_progress" && (
        <div className="flex items-center justify-between rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="text-sm text-green-800 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Урок идёт. Длится {elapsedMin} мин.
          </p>
          <button
            onClick={handleEnd}
            disabled={statusLoading}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/25 hover:bg-red-700 active:scale-95 disabled:opacity-50"
          >
            <Square className="h-4 w-4 fill-white" /> Закончить урок
          </button>
        </div>
      )}
      {status === "completed" && (
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4">
          <Check className="h-5 w-5 text-gray-500" />
          <p className="text-sm text-gray-600">
            Урок завершён
            {startedAt && endedAt && ` · ${fmtTime(startedAt)} – ${fmtTime(endedAt)}`}
          </p>
        </div>
      )}

      {/* About lesson block */}
      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{d.lesson.aboutLesson}</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{d.lesson.titleLabel}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={d.lesson.titlePlaceholder}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{d.lesson.descLabel}</label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={d.lesson.descPlaceholder}
              className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          {infoChanged && (
            <button
              onClick={handleSaveInfo}
              disabled={infoSaving}
              className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-60"
            >
              {infoSaved ? "✓ Сохранено" : infoSaving ? d.lesson.uploading : d.lesson.saveBtn}
            </button>
          )}
        </div>
      </section>

      {/* Stages block */}
      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{d.lesson.stagesTitle}</h2>
          <p className="text-xs text-gray-400">{d.lesson.stagesHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ALL_STAGE_KEYS.map((key) => {
            const st = stages[key];
            const label = stageLabels[key];
            const required = REQUIRED.has(key);
            const order = STAGE_ORDER[key];

            if (!st.enabled) {
              return (
                <button
                  key={key}
                  onClick={() => handleToggleStage(key)}
                  className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 p-4 text-gray-400 transition-all hover:border-blue-300 hover:text-blue-500"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              );
            }

            return (
              <div
                key={key}
                className={`relative flex flex-col gap-2 rounded-2xl border p-4 transition-all ${
                  st.is_completed
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-gray-100 bg-white shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                    {STAGE_ICONS[key]}
                  </span>
                  {!required && (
                    <button
                      onClick={() => handleToggleStage(key)}
                      className="rounded-full p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-400"
                      title={d.lesson.removeStageLabel}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs font-bold text-gray-700">{label}</p>
                <p className="text-[10px] font-medium text-gray-400">Этап {order}</p>
                <button
                  onClick={() => handleToggleCompleted(key)}
                  className={`mt-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                    st.is_completed
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  {st.is_completed ? <Check className="h-3.5 w-3.5" /> : <div className="h-3.5 w-3.5 rounded-sm border-2 border-current" />}
                  {st.is_completed ? d.lesson.stageCompletedLabel : "Отметить"}
                </button>
                <button
                  onClick={() => setStages((p) => ({ ...p, [key]: { ...p[key], notesOpen: !p[key].notesOpen } }))}
                  className="text-left text-xs text-gray-400 hover:text-blue-500"
                >
                  {st.notesOpen ? "▲" : "▼"} {d.lesson.teacherNotesLabel}
                </button>
                {st.notesOpen && (
                  <textarea
                    rows={2}
                    value={st.notes}
                    placeholder={d.lesson.teacherNotesPlaceholder}
                    onChange={(e) => setStages((p) => ({ ...p, [key]: { ...p[key], notes: e.target.value } }))}
                    onBlur={() => handleNotesBlur(key)}
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white/80 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-400"
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Materials block */}
      <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">{d.lesson.materialsTitle}</h2>
          <button
            onClick={() => setUploadModal(true)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95"
          >
            {d.lesson.addMaterialLabel}
          </button>
        </div>

        {materials.length === 0 ? (
          <p className="text-sm text-gray-400">{d.lesson.materialsEmpty}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map((mat) => (
              <div
                key={mat.id}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{mat.title}</p>
                  {mat.file_size_bytes && (
                    <p className="text-xs text-gray-400">{fmtBytes(mat.file_size_bytes)}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => handleDownloadMaterial(mat)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                    title={d.lesson.download}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteMaterial(mat)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    title={d.lesson.deleteConfirm}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upload modal */}
      {uploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#1D1D1F]">{d.lesson.addMaterialTitle}</h3>
              <button onClick={() => setUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{d.lesson.materialTitleLabel}</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder={d.lesson.materialTitlePlaceholder}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-sm text-gray-500 transition-all hover:border-blue-300 hover:text-blue-500"
                >
                  <Upload className="h-5 w-5" />
                  {uploadFile ? uploadFile.name : "Выбрать файл (макс. 50 МБ)"}
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setUploadModal(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {d.common.cancel}
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile || !uploadTitle.trim()}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                >
                  {uploading ? d.lesson.uploading : d.lesson.saveBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

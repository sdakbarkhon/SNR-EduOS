"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Upload, X, Plus, Trash2, GripVertical, FileText, AlertTriangle, Search } from "lucide-react";
import {
  createCurriculumPlan, replaceCurriculumPlan, uploadCurriculumPlanFile,
  getCurriculumPlanForGroupSubject, getDictionary,
} from "@snr/core";
import type { CurriculumPlanWithTopics, Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

type GroupItem = { id: string; name: string };
type SubjectItem = { id: string; name: string; group_id: string };
type TopicDraft = { key: string; title: string; description: string; estimatedLessons: number };

export function CurriculumPlansView({
  plans: initialPlans,
  groups,
  subjects,
  teacherId,
}: {
  plans: CurriculumPlanWithTopics[];
  groups: GroupItem[];
  subjects: SubjectItem[];
  teacherId: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).curriculum;
  const [plans, setPlans] = useState(initialPlans);
  const [uploadModal, setUploadModal] = useState(false);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const filteredPlans = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) =>
      (p.group_name ?? "").toLowerCase().includes(q) ||
      (p.subject_name ?? "").toLowerCase().includes(q),
    );
  }, [plans, query]);

  function handleSaved(saved: CurriculumPlanWithTopics) {
    setPlans((prev) => [saved, ...prev.filter((p) => !(p.group_id === saved.group_id && p.subject_id === saved.subject_id))]);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="group relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" />
          <input
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Поиск по группе или предмету…"
            className="w-full rounded-xl border border-slate-200 bg-white/60 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          onClick={() => setUploadModal(true)}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-95"
        >
          <Upload className="h-4 w-4" /> {d.uploadPlan}
        </button>
      </div>

      {filteredPlans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-10 text-center text-sm text-slate-400">
          {plans.length === 0 ? "Пока нет ни одного плана. Загрузите первый — AI разложит его на темы." : "Ничего не найдено"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filteredPlans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{p.subject_name}</p>
              <h3 className="mt-1 truncate text-base font-bold text-slate-900">{p.group_name}</h3>
              <p className="mt-2 text-sm text-slate-500">{p.topics.length} {topicWord(p.topics.length)}</p>
            </div>
          ))}
        </div>
      )}

      {uploadModal && (
        <UploadPlanModal
          groups={groups}
          subjects={subjects}
          teacherId={teacherId}
          onClose={() => setUploadModal(false)}
          onSaved={(saved) => { handleSaved(saved); setUploadModal(false); }}
        />
      )}
    </div>
  );
}

function topicWord(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "тема";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "темы";
  return "тем";
}

// ── Upload modal (2 шага: форма+парсинг → редактор тем) ─────────────────────

function UploadPlanModal({
  groups, subjects, teacherId, onClose, onSaved,
}: {
  groups: GroupItem[];
  subjects: SubjectItem[];
  teacherId: string;
  onClose: () => void;
  onSaved: (plan: CurriculumPlanWithTopics) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).curriculum;
  const db = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"form" | "topics">("form");
  const [groupId, setGroupId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [topics, setTopics] = useState<TopicDraft[]>([]);
  const [sourceFileType, setSourceFileType] = useState<"pdf" | "docx" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmReplace, setConfirmReplace] = useState<CurriculumPlanWithTopics | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const groupSubjects = subjects.filter((s) => s.group_id === groupId);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setFile(null); setFileError(""); return; }
    const isPdfOrDocx = f.type === "application/pdf"
      || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || f.name.toLowerCase().endsWith(".pdf") || f.name.toLowerCase().endsWith(".docx");
    if (!isPdfOrDocx) { setFileError(d.errorPdfDocxOnly); setFile(null); e.target.value = ""; return; }
    if (f.size > 20 * 1024 * 1024) { setFileError(d.errorFileTooLarge); setFile(null); e.target.value = ""; return; }
    setFileError("");
    setFile(f);
  }

  async function handleParse() {
    if (!file || !groupId || !subjectId) return;
    setParsing(true); setParseError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("group_id", groupId);
      fd.append("subject_id", subjectId);
      const res = await fetch("/api/curriculum-plans/parse", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setParseError(json.error || d.errorParseFailed); return; }
      setTopics((json.topics as Array<{ title: string; description: string | null; estimated_lessons: number }>)
        .map((t) => ({ key: crypto.randomUUID(), title: t.title, description: t.description ?? "", estimatedLessons: t.estimated_lessons })));
      setSourceFileType(json.sourceFileType);
      setStep("topics");
    } catch {
      setParseError("Ошибка сети");
    } finally {
      setParsing(false);
    }
  }

  function updateTopic(key: string, patch: Partial<TopicDraft>) {
    setTopics((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }
  function removeTopic(key: string) {
    setTopics((prev) => prev.filter((t) => t.key !== key));
  }
  function addTopic() {
    setTopics((prev) => [...prev, { key: crypto.randomUUID(), title: "", description: "", estimatedLessons: 1 }]);
  }
  function moveTopic(from: number, to: number) {
    setTopics((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (!moved) return prev;
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function doSave(replaceExisting: CurriculumPlanWithTopics | null) {
    setSaving(true); setSaveError("");
    try {
      const group = groups.find((g) => g.id === groupId);
      const subject = subjects.find((s) => s.id === subjectId);
      const { storagePath } = await uploadCurriculumPlanFile(db, { teacherId, file: file! });
      const planInput = {
        groupId, subjectId, teacherId,
        title: `${subject?.name ?? "Предмет"} — ${group?.name ?? "Группа"}`,
        sourceFileUrl: storagePath,
        sourceFileType,
        topics: topics.map((t) => ({ title: t.title.trim() || "Без названия", description: t.description.trim() || null, estimatedLessons: t.estimatedLessons })),
      };
      const saved = replaceExisting
        ? await replaceCurriculumPlan(db, replaceExisting.id, planInput)
        : await createCurriculumPlan(db, planInput);
      onSaved({
        ...saved,
        group_name: group?.name,
        subject_name: subject?.name,
        topics: topics.map((t, i) => ({
          id: `local-${i}`, plan_id: saved.id, order_index: i,
          title: t.title.trim() || "Без названия", description: t.description.trim() || null, estimated_lessons: t.estimatedLessons,
        })),
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
      setConfirmReplace(null);
    }
  }

  async function handleSaveClick() {
    if (topics.length === 0) { setSaveError("Добавьте хотя бы одну тему"); return; }
    setSaveError("");
    const existing = await getCurriculumPlanForGroupSubject(db, groupId, subjectId).catch(() => null);
    if (existing) { setConfirmReplace(existing); return; }
    await doSave(null);
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  const labelCls = "mb-1 block text-xs font-semibold text-gray-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{d.uploadPlan}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "form" ? (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Группа *</label>
                <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setSubjectId(""); }} className={inputCls}>
                  <option value="">Выберите группу</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              {groupId && (
                <div>
                  <label className={labelCls}>Предмет *</label>
                  <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={inputCls}>
                    <option value="">— выберите предмет —</option>
                    {groupSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={labelCls}>Файл плана (PDF/DOCX, макс. 20 МБ) *</label>
                <input ref={fileRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={handleFileChange} />
                <button onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500">
                  <FileText className="h-5 w-5" />
                  {file ? file.name : "Выбрать PDF или DOCX файл"}
                </button>
                {fileError && <p className="mt-1.5 text-[12px] text-red-500">{fileError}</p>}
              </div>
              {parseError && <p className="text-sm text-red-500">{parseError}</p>}
              <button
                onClick={handleParse}
                disabled={parsing || !groupId || !subjectId || !file}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:bg-violet-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {parsing ? "Распознаём план…" : d.parseWithAi}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {topics.length} {topicWord(topics.length)} — отредактируйте перед сохранением
              </p>
              {topics.map((t, i) => (
                <div
                  key={t.key}
                  draggable
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIndex !== null && dragIndex !== i) moveTopic(dragIndex, i); setDragIndex(null); }}
                  className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                >
                  <div className="flex shrink-0 cursor-grab items-center text-slate-300 active:cursor-grabbing">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text" value={t.title} onChange={(e) => updateTopic(t.key, { title: e.target.value })}
                      placeholder="Название темы" className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold outline-none focus:border-blue-400"
                    />
                    <textarea
                      rows={1} value={t.description} onChange={(e) => updateTopic(t.key, { description: e.target.value })}
                      placeholder="Описание (опционально)" className="w-full resize-none rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-slate-600 outline-none focus:border-blue-400"
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-medium text-slate-500">Уроков на тему:</label>
                      <input
                        type="number" min={1} max={20} value={t.estimatedLessons}
                        onChange={(e) => updateTopic(t.key, { estimatedLessons: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                  <button onClick={() => removeTopic(t.key)} className="shrink-0 text-slate-300 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button onClick={addTopic} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-500">
                <Plus className="h-4 w-4" /> Добавить тему
              </button>
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            </div>
          )}
        </div>

        {step === "topics" && (
          <div className="flex shrink-0 gap-3 border-t border-slate-100 px-6 py-4">
            <button onClick={() => setStep("form")} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Назад</button>
            <button onClick={handleSaveClick} disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Сохраняем…" : "Сохранить план"}
            </button>
          </div>
        )}
      </div>

      {confirmReplace && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold">{d.planExistsWarning}</h3>
            </div>
            <p className="text-sm text-slate-600">
              У этой группы и предмета уже есть план ({confirmReplace.topics.length} {topicWord(confirmReplace.topics.length)}). Заменить его новым?
              Уже созданные уроки не удаляются — просто отвяжутся от старых тем.
            </p>
            <div className="mt-4 flex gap-3">
              <button onClick={() => setConfirmReplace(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Отмена</button>
              <button onClick={() => doSave(confirmReplace)} disabled={saving} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? "Заменяем…" : "Заменить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

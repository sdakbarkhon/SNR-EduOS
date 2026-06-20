"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Plus, Trash2 } from "lucide-react";
import { createProject, createProjectStages, getDictionary, type Locale } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";

type Group = { id: string; name: string; subject: string };
type Stage = { title: string; description: string };

export function TeacherProjectFormModal({
  teacherId, groups, onClose,
}: {
  teacherId: string;
  groups: Group[];
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.teacher.projects;
  const router = useRouter();
  const db = createClient();

  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [stages, setStages] = useState<Stage[]>([{ title: "", description: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const subject = groups.find((g) => g.id === groupId)?.subject ?? "";

  function addStage() {
    if (stages.length >= 20) return;
    setStages((s) => [...s, { title: "", description: "" }]);
  }
  function removeStage(i: number) {
    setStages((s) => s.filter((_, idx) => idx !== i));
  }
  function updateStage(i: number, patch: Partial<Stage>) {
    setStages((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  }

  async function save() {
    if (!title.trim()) { setError("Введите название"); return; }
    if (!groupId) { setError("Выберите группу"); return; }
    const validStages = stages.filter((s) => s.title.trim());
    if (validStages.length === 0) { setError("Добавьте хотя бы один этап"); return; }
    setSaving(true);
    setError("");
    try {
      const projectId = await createProject(db, {
        teacherId, groupId, subject, title: title.trim(),
        description: description.trim() || null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      });
      await createProjectStages(db, projectId, validStages.map((s) => ({ title: s.title.trim(), description: s.description.trim() || null })));
      onClose();
      router.push(`/teacher/projects/${projectId}`);
    } catch (e) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{t.formTitle}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-500">{t.group}</span>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
                className="rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-slate-500">{t.subject}</span>
              <input value={subject} disabled className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500" />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-500">{t.name}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-500">{t.description}</span>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              className="resize-none rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-500">{t.deadline}</span>
            <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </label>

          {/* Stages */}
          <div className="space-y-2">
            <p className="text-[14px] font-bold text-slate-800">{t.stagesBlock}</p>
            {stages.map((s, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[12px] font-bold text-blue-700">{i + 1}</span>
                  <input value={s.title} onChange={(e) => updateStage(i, { title: e.target.value })} placeholder={t.stageTitle}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <button onClick={() => removeStage(i)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
                </div>
                <input value={s.description} onChange={(e) => updateStage(i, { description: e.target.value })} placeholder={t.stageDesc}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] focus:outline-none focus:border-blue-500" />
              </div>
            ))}
            <button onClick={addStage} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-2.5 text-[13px] font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-600">
              <Plus size={15} /> {t.addStage}
            </button>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="border-t border-slate-100 p-4">
          <button onClick={save} disabled={saving}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}>
            {saving ? d.common.loading : t.createBtn}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

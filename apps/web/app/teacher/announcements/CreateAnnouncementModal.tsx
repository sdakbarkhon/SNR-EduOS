"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createAnnouncement, getDictionary, type Locale, type AnnouncementScope, type AnnouncementCategory } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

export function CreateAnnouncementModal({
  teacherId, groups, students, onClose,
}: {
  teacherId: string;
  groups: Array<{ id: string; name: string }>;
  students: Array<{ id: string; full_name: string }>;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.teacher.announcements;
  const router = useRouter();
  const db = createClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<AnnouncementScope>("group");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [pinned, setPinned] = useState(false);
  const [category, setCategory] = useState<AnnouncementCategory>("general");
  const [isTicker, setIsTicker] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!title.trim() || !body.trim()) { setError("Заполните заголовок и текст"); return; }
    if (scope === "group" && !groupId) { setError("Выберите группу"); return; }
    if (scope === "student" && !studentId) { setError("Выберите ученика"); return; }
    setSaving(true);
    setError("");
    try {
      await createAnnouncement(db, {
        teacherId, scope, title: title.trim(), body: body.trim(), isPinned: pinned,
        groupId: scope === "group" ? groupId : null,
        targetStudentId: scope === "student" ? studentId : null,
        category,
        isTicker,
        validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      });
      onClose();
      router.refresh();
    } catch (e) {
      setError((e as Error).message ?? d.common.error);
    } finally {
      setSaving(false);
    }
  }

  const opts: { key: AnnouncementScope; label: string }[] = [
    { key: "group", label: t.audienceGroup },
    { key: "all_my_groups", label: t.audienceAll },
    { key: "student", label: t.audienceStudent },
  ];

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">{t.formTitle}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-500">{t.titleLabel}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-500">{t.bodyLabel}</span>
            <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)}
              className="resize-none rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </label>

          <div>
            <p className="mb-2 text-[13px] font-medium text-slate-500">{t.audience}</p>
            <div className="space-y-2">
              {opts.map((o) => (
                <label key={o.key} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", scope === o.key ? "border-blue-500 bg-blue-50" : "border-slate-200")}>
                  <input type="radio" checked={scope === o.key} onChange={() => setScope(o.key)} className="text-blue-600" />
                  <span className="font-medium text-slate-700">{o.label}</span>
                </label>
              ))}
            </div>
            {scope === "group" && (
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)}
                className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
            {scope === "student" && (
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)}
                className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
                {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-500">{t.categoryLabel}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500">
              {(["general","academic","event","urgent","reminder"] as AnnouncementCategory[]).map((c) => (
                <option key={c} value={c}>{(d.announcements as Record<string, string>)[`category${c.charAt(0).toUpperCase()}${c.slice(1)}`]}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <span className="text-[13px] font-medium text-slate-700">{t.pinLabel}</span>
          </label>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={isTicker} onChange={(e) => setIsTicker(e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            <span className="text-[13px] font-medium text-slate-700">{t.isTickerLabel}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-500">{t.validUntilLabel}</span>
            <input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500" />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="border-t border-slate-100 p-4">
          <button onClick={save} disabled={saving}
            className="w-full rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}>
            {saving ? d.common.loading : t.publish}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Megaphone, BookOpen, CalendarDays, AlertTriangle, Bell, Pin,
  Trash2, Globe, CheckCircle2,
} from "lucide-react";
import {
  createAnnouncement, deleteAnnouncement, togglePinAnnouncement, getDictionary,
  type Locale, type TeacherAnnouncement, type AnnouncementCategory, type AnnouncementScope,
} from "@snr/core";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";

const CATEGORY_CFG: Record<AnnouncementCategory, { cls: string; Icon: typeof Megaphone }> = {
  general:  { cls: "bg-slate-100 text-slate-600",   Icon: Megaphone },
  academic: { cls: "bg-blue-100 text-blue-700",     Icon: BookOpen },
  event:    { cls: "bg-violet-100 text-violet-700", Icon: CalendarDays },
  urgent:   { cls: "bg-red-100 text-red-700",       Icon: AlertTriangle },
  reminder: { cls: "bg-amber-100 text-amber-700",   Icon: Bell },
};

function CreateModal({
  adminId,
  groups,
  onClose,
}: {
  adminId: string;
  groups: Array<{ id: string; name: string }>;
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
  const [category, setCategory] = useState<AnnouncementCategory>("general");
  const [isTicker, setIsTicker] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!title.trim() || !body.trim()) { setError("Заполните заголовок и текст"); return; }
    if (scope === "group" && !groupId) { setError("Выберите группу"); return; }
    setSaving(true); setError("");
    try {
      await createAnnouncement(db, {
        adminId,
        scope,
        title: title.trim(),
        body: body.trim(),
        isPinned: false,
        groupId: scope === "group" ? groupId : null,
        targetStudentId: null,
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

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
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
              {([
                { key: "group", label: t.audienceGroup },
                { key: "all_my_groups", label: t.audienceAll },
              ] as { key: AnnouncementScope; label: string }[]).map((o) => (
                <label key={o.key} className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                  scope === o.key ? "border-blue-500 bg-blue-50" : "border-slate-200")}>
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
            style={{ background: "linear-gradient(135deg,#7C3AED,#4C1D95)" }}>
            {saving ? d.common.loading : t.publish}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AdminAnnouncementsView({
  adminId,
  announcements: initial,
  groups,
}: {
  adminId: string;
  announcements: TeacherAnnouncement[];
  groups: Array<{ id: string; name: string }>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();
  const db = createClient();

  const [list, setList] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function togglePin(a: TeacherAnnouncement) {
    setList((p) => p.map((x) => (x.id === a.id ? { ...x, is_pinned: !x.is_pinned } : x))
      .sort((x, y) => Number(y.is_pinned) - Number(x.is_pinned)));
    await togglePinAnnouncement(db, a.id, !a.is_pinned).catch(() => null);
  }

  async function doDelete() {
    if (!deleteId) return;
    setList((p) => p.filter((x) => x.id !== deleteId));
    await deleteAnnouncement(db, deleteId).catch(() => null);
    setDeleteId(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-bold text-slate-800">{d.admin.navAnnouncements}</h1>
        <button onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/25 hover:brightness-110">
          <Plus size={16} /> {d.teacher.announcements.create}
        </button>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border border-white/70 bg-white/60 py-20 text-center backdrop-blur-xl">
          <Megaphone className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">{d.teacher.announcements.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const catCfg = CATEGORY_CFG[a.category ?? "general"];
            const catLabel = (d.announcements as Record<string, string>)[`category${(a.category ?? "general").charAt(0).toUpperCase()}${(a.category ?? "general").slice(1)}`];
            const date = new Date(a.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Tashkent" });
            const validDate = a.valid_until ? new Date(a.valid_until).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Tashkent" }) : null;
            const scopeLabel = a.scope === "group" ? (a.groupName ?? "Группа") : a.scope === "student" ? (a.targetStudentName ?? "Ученик") : "Все группы";
            return (
              <div key={a.id} className={cn("rounded-2xl border p-5 shadow-sm backdrop-blur-xl",
                a.is_pinned ? "border-l-4 border-amber-300 bg-amber-50/50" : "border-white/70 bg-white/70")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.is_pinned && <Pin size={14} className="text-amber-500" />}
                      <h3 className="text-[16px] font-bold text-slate-800">{a.title}</h3>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", catCfg.cls)}>
                        <catCfg.Icon size={10} /> {catLabel}
                      </span>
                      {a.is_ticker && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          {d.announcements.tickerBadge}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-400">
                      <span className="inline-flex items-center gap-1"><Globe size={12} /> {scopeLabel}</span>
                      <span>{date}</span>
                      {validDate && <span>{d.announcements.validUntil.replace("{date}", validDate)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => togglePin(a)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-500"
                      title={a.is_pinned ? "Открепить" : "Закрепить"}>
                      <Pin size={15} className={a.is_pinned ? "text-amber-500" : ""} />
                    </button>
                    <button onClick={() => setDeleteId(a.id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{a.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <CreateModal adminId={adminId} groups={groups} onClose={() => { setFormOpen(false); router.refresh(); }} />
      )}
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={doDelete}
        title={d.teacher.announcements.deleteConfirm}
        variant="danger"
        confirmText={d.teacher.announcements.delete}
        cancelText={d.common.cancel}
      />
    </div>
  );
}

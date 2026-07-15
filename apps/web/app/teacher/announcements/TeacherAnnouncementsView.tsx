"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Megaphone, Pin, PinOff, Trash2, Users, User, Globe, BookOpen, CalendarDays, AlertTriangle, Bell, Search } from "lucide-react";
import {
  getDictionary, togglePinAnnouncement, deleteAnnouncement,
  type Locale, type TeacherAnnouncement, type AnnouncementCategory,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CreateAnnouncementModal } from "./CreateAnnouncementModal";
import { cn } from "@/lib/cn";

export function TeacherAnnouncementsView({
  teacherId, announcements: initial, groups, students,
}: {
  teacherId: string;
  announcements: TeacherAnnouncement[];
  groups: Array<{ id: string; name: string }>;
  students: Array<{ id: string; full_name: string }>;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.teacher.announcements;
  const router = useRouter();
  const db = createClient();

  const [list, setList] = useState(initial);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      a.body.toLowerCase().includes(q) ||
      (a.groupName ?? "").toLowerCase().includes(q) ||
      (a.targetStudentName ?? "").toLowerCase().includes(q),
    );
  }, [list, query]);

  async function togglePin(a: TeacherAnnouncement) {
    setList((p) => p.map((x) => (x.id === a.id ? { ...x, is_pinned: !x.is_pinned } : x)).sort((x, y) => Number(y.is_pinned) - Number(x.is_pinned)));
    await togglePinAnnouncement(db, a.id, !a.is_pinned).catch(() => null);
  }
  async function doDelete() {
    if (!deleteId) return;
    setList((p) => p.filter((x) => x.id !== deleteId));
    await deleteAnnouncement(db, deleteId).catch(() => null);
    setDeleteId(null);
  }

  const CATEGORY_CFG: Record<AnnouncementCategory, { cls: string; Icon: typeof Megaphone }> = {
    general:  { cls: "bg-slate-100 text-slate-600", Icon: Megaphone },
    academic: { cls: "bg-blue-100 text-blue-700",   Icon: BookOpen },
    event:    { cls: "bg-violet-100 text-violet-700", Icon: CalendarDays },
    urgent:   { cls: "bg-red-100 text-red-700",     Icon: AlertTriangle },
    reminder: { cls: "bg-amber-100 text-amber-700", Icon: Bell },
  };

  function audience(a: TeacherAnnouncement) {
    if (a.scope === "group") return { Icon: Users, label: t.audienceGroupLabel.replace("{name}", a.groupName ?? "") };
    if (a.scope === "student") return { Icon: User, label: a.targetStudentName ?? "" };
    return { Icon: Globe, label: t.audienceAllLabel };
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-4">
        <div className="group relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-600" />
          <input
            type="text"
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Поиск по объявлениям…"
            className="w-full rounded-xl border border-white/50 bg-white/60 py-2.5 pl-11 pr-4 text-sm font-medium text-brand-ink shadow-sm backdrop-blur outline-none transition-all placeholder:text-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <button onClick={() => setFormOpen(true)} className="flex shrink-0 items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-blue/25 hover:brightness-110">
          <Plus size={16} /> {t.create}
        </button>
      </div>

      {filteredList.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border border-white/70 bg-white/60 py-20 text-center backdrop-blur-xl">
          <Megaphone className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-brand-ink-muted">{list.length === 0 ? t.empty : d.homework.noResultsTitle}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((a) => {
            const aud = audience(a);
            const date = new Date(a.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Tashkent" });
            const catCfg = CATEGORY_CFG[a.category ?? "general"];
            const catLabel = (d.announcements as Record<string, string>)[`category${(a.category ?? "general").charAt(0).toUpperCase()}${(a.category ?? "general").slice(1)}`];
            const validDate = a.valid_until ? new Date(a.valid_until).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Tashkent" }) : null;
            return (
              <div key={a.id} className={cn("rounded-2xl border p-5 shadow-sm backdrop-blur-xl", a.is_pinned ? "border-amber-200 bg-amber-50/50" : "border-white/70 bg-white/70")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.is_pinned && <Pin size={14} className="text-amber-500" />}
                      <h3 className="truncate text-[16px] font-bold text-brand-ink">{a.title}</h3>
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", catCfg.cls)}>
                        <catCfg.Icon size={10} /> {catLabel}
                      </span>
                      {a.is_ticker && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          {d.announcements.tickerBadge}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-brand-ink-muted">
                      <span className="inline-flex items-center gap-1"><aud.Icon size={13} /> {aud.label}</span>
                      <span>{date}</span>
                      {validDate && <span className="text-slate-400">{d.announcements.validUntil.replace("{date}", validDate)}</span>}
                      <span className="font-medium text-blue-600">{t.readCount.replace("{read}", String(a.readCount)).replace("{total}", String(a.totalRecipients))}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => togglePin(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-500" title={a.is_pinned ? t.unpin : t.pin}>
                      {a.is_pinned ? <PinOff size={15} /> : <Pin size={15} />}
                    </button>
                    <button onClick={() => setDeleteId(a.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title={t.delete}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{a.body}</p>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && <CreateAnnouncementModal teacherId={teacherId} groups={groups} students={students} onClose={() => { setFormOpen(false); router.refresh(); }} />}
      <ConfirmModal open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={doDelete} title={t.deleteConfirm} variant="danger" confirmText={t.delete} cancelText={d.common.cancel} />
    </div>
  );
}

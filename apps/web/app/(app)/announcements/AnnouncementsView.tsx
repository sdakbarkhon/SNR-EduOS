"use client";

import { useState } from "react";
import { Megaphone, Pin, ChevronDown, BookOpen, CalendarDays, AlertTriangle, Bell, Clock } from "lucide-react";
import {
  getDictionary, markAnnouncementRead,
  type Locale, type StudentAnnouncement, type AnnouncementCategory,
} from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

const CATEGORY_CFG: Record<AnnouncementCategory, { cls: string; Icon: typeof Megaphone }> = {
  general:  { cls: "bg-slate-100 text-slate-600",   Icon: Megaphone },
  academic: { cls: "bg-blue-100 text-blue-700",     Icon: BookOpen },
  event:    { cls: "bg-violet-100 text-violet-700", Icon: CalendarDays },
  urgent:   { cls: "bg-red-100 text-red-700",       Icon: AlertTriangle },
  reminder: { cls: "bg-amber-100 text-amber-700",   Icon: Bell },
};

export function AnnouncementsView({ studentId, announcements }: { studentId: string; announcements: StudentAnnouncement[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.announcements;
  const db = createClient();

  const [list, setList] = useState(announcements);
  const [openId, setOpenId] = useState<string | null>(null);

  function toggle(a: StudentAnnouncement) {
    const opening = openId !== a.id;
    setOpenId(opening ? a.id : null);
    if (opening && !a.isRead && studentId) {
      setList((p) => p.map((x) => (x.id === a.id ? { ...x, isRead: true } : x)));
      markAnnouncementRead(db, a.id, studentId).catch(() => null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight text-slate-900">{t.title}</h1>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[24px] border border-white/70 bg-white/60 py-20 text-center backdrop-blur-xl">
          <Megaphone className="h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">{t.empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => {
            const isOpen = openId === a.id;
            const date = new Date(a.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Tashkent" });
            const cat = a.category ?? "general";
            const catCfg = CATEGORY_CFG[cat];
            const catLabel = (t as Record<string, string>)[`category${cat.charAt(0).toUpperCase()}${cat.slice(1)}`];
            const validDate = a.valid_until ? new Date(a.valid_until).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "Asia/Tashkent" }) : null;
            return (
              <div key={a.id} className={cn("overflow-hidden rounded-2xl border shadow-sm backdrop-blur-xl transition-colors",
                a.category === "urgent" ? "border-l-4 border-red-400 bg-red-50/30" :
                a.is_pinned ? "border-l-4 border-amber-300 bg-amber-50/40" : "border-white/70 bg-white/70")}>
                <button onClick={() => toggle(a)} className="flex w-full items-start gap-3 p-5 text-left">
                  <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full", catCfg.cls)}>
                    <catCfg.Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.is_pinned && <Pin size={13} className="text-amber-500" />}
                      <h3 className="text-[15px] font-bold text-slate-800">{a.title}</h3>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", catCfg.cls)}>{catLabel}</span>
                      {!a.isRead && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{t.newBadge}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
                      <span>{a.teacherName ?? t.by} · {date}</span>
                      {validDate && (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock size={11} /> {t.validUntil.replace("{date}", validDate)}
                        </span>
                      )}
                    </div>
                    {!isOpen && <p className="mt-2 line-clamp-1 text-sm text-slate-500">{a.body}</p>}
                  </div>
                  <ChevronDown size={18} className={cn("mt-1 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 pb-5 pt-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{a.body}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

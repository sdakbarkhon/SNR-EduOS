"use client";

import { useState } from "react";
import { Megaphone, Pin, ChevronDown } from "lucide-react";
import { getDictionary, markAnnouncementRead, type Locale, type StudentAnnouncement } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/LocaleProvider";
import { cn } from "@/lib/cn";

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
            return (
              <div key={a.id} className={cn("overflow-hidden rounded-2xl border shadow-sm backdrop-blur-xl transition-colors",
                a.is_pinned ? "border-l-4 border-amber-300 bg-amber-50/40" : "border-white/70 bg-white/70")}>
                <button onClick={() => toggle(a)} className="flex w-full items-start gap-3 p-5 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {a.is_pinned && <Pin size={14} className="text-amber-500" />}
                      <h3 className="text-[16px] font-bold text-slate-800">{a.title}</h3>
                      {!a.isRead && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">{t.newBadge}</span>}
                    </div>
                    <p className="mt-1 text-[12px] text-slate-400">{a.teacherName ?? t.by} · {date}</p>
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

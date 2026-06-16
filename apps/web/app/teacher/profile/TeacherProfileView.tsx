"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, getSubjectConfig, updateTeacherProfile } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { LogOut, User } from "lucide-react";
import { cn } from "@/lib/cn";

type Tab = "profile" | "interface";

interface Props {
  teacher: { id: string; full_name: string | null; avatar_url: string | null; username: string | null } | null;
  groups: Array<{ id: string; name: string; subject: string }>;
}

export function TeacherProfileView({ teacher, groups }: Props) {
  const { locale, setLocale } = useLocale();
  const d = getDictionary(locale as Locale);
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState(teacher?.full_name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: d.profile.tabProfile },
    { key: "interface", label: d.profile.tabInterface },
  ];

  async function saveProfile() {
    if (!teacher) return;
    setSaving(true);
    try {
      await updateTeacherProfile(supabase, { teacherId: teacher.id, fullName: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function Avatar() {
    if (teacher?.avatar_url) return <img src={teacher.avatar_url} alt="avatar" className="h-20 w-20 rounded-full object-cover" />;
    const initials = (teacher?.full_name ?? "T").split(" ").slice(0, 2).map((w) => w[0]).join("");
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-blue/20 text-[26px] font-bold text-brand-blue">
        {initials}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-[22px] font-bold text-brand-ink">{d.teacher.profileTitle}</h1>

      {/* Avatar + name */}
      <div className="flex items-center gap-4 rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
        <Avatar />
        <div>
          <div className="text-[18px] font-bold text-brand-ink">{teacher?.full_name ?? d.teacher.role}</div>
          <div className="text-[13px] text-brand-ink-muted">{d.teacher.role}</div>
          {teacher?.username && <div className="text-[12px] text-slate-400 mt-1">@{teacher.username}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn("rounded-[10px] px-4 py-1.5 text-[13px] font-semibold transition-all",
              tab === t.key ? "bg-brand-blue text-white" : "bg-white/70 border border-white/80 text-brand-ink-muted hover:text-brand-ink")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 space-y-4"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-brand-ink-muted">ФИО</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="rounded-[10px] border border-slate-200 bg-white/80 px-3 py-2.5 text-[14px] text-brand-ink focus:outline-none focus:border-brand-blue/50" />
          </label>

          {/* Groups list */}
          <div>
            <div className="text-[13px] font-medium text-brand-ink-muted mb-2">{d.teacher.profileGroups}</div>
            <div className="space-y-1">
              {groups.map((g) => {
                const cfg = getSubjectConfig(g.subject);
                return (
                  <div key={g.id} className="flex items-center gap-2 rounded-[10px] bg-slate-50 px-3 py-2">
                    <span className="text-[16px]">{cfg.emoji}</span>
                    <span className="text-[13px] font-medium text-brand-ink">{g.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={saveProfile} disabled={saving}
            className="rounded-[12px] px-5 py-2.5 text-[14px] font-bold text-white disabled:opacity-50 transition-all hover:brightness-110"
            style={{ background: "linear-gradient(135deg,#1D6FF5,#0B3EDB)" }}>
            {saved ? "✓ Сохранено" : saving ? d.common.loading : d.common.save}
          </button>
        </div>
      )}

      {tab === "interface" && (
        <div className="rounded-[20px] bg-white/70 border border-white/80 backdrop-blur-xl p-5 space-y-4"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.07)" }}>
          <div>
            <div className="text-[13px] font-medium text-brand-ink-muted mb-2">{d.profile.language}</div>
            <div className="flex gap-2">
              {(["ru", "uz", "en"] as const).map((l) => (
                <button key={l} onClick={() => setLocale(l)}
                  className={cn("rounded-[10px] px-4 py-2 text-[13px] font-semibold uppercase transition-all",
                    locale === l ? "bg-brand-blue text-white" : "border border-slate-200 bg-white text-brand-ink-muted hover:text-brand-ink")}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Logout */}
      <button onClick={logout}
        className="flex items-center gap-2 rounded-[12px] border border-red-200 bg-red-50 px-5 py-2.5 text-[14px] font-semibold text-danger transition-all hover:bg-red-100">
        <LogOut size={16} />
        {d.profile.logout}
      </button>
    </div>
  );
}

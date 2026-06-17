"use client";

import { useState } from "react";
import { getDictionary, updateTeacherProfile } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { User, Shield, Bell, LayoutTemplate, Camera, Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Tab = "profile" | "security" | "notifications" | "interface";

interface Props {
  teacher: { id: string; full_name: string | null; avatar_url: string | null; username: string | null } | null;
  groups: Array<{ id: string; name: string; subject: string }>;
}

function classBadge(name: string): string {
  const last = name.trim().split(/\s+/).pop() ?? name;
  return last.length <= 4 ? last : name.slice(0, 2).toUpperCase();
}

export function TeacherProfileView({ teacher, groups }: Props) {
  const { locale, setLocale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();

  const initialParts = (teacher?.full_name ?? "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(initialParts[0] ?? "");
  const [lastName, setLastName] = useState(initialParts.slice(1).join(" "));
  const [tab, setTab] = useState<Tab>("profile");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const tabs: { key: Tab; label: string; icon: typeof User }[] = [
    { key: "profile", label: d.profile.tabProfile, icon: User },
    { key: "security", label: d.profile.tabSecurity, icon: Shield },
    { key: "notifications", label: d.profile.tabNotifications, icon: Bell },
    { key: "interface", label: d.profile.tabInterface, icon: LayoutTemplate },
  ];

  const initials = (teacher?.full_name ?? "T").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  async function saveProfile() {
    if (!teacher) return;
    setSaving(true);
    try {
      await updateTeacherProfile(supabase, { teacherId: teacher.id, fullName: `${firstName} ${lastName}`.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Настройки</h1>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Vertical tabs */}
        <div className="w-full shrink-0 space-y-1 md:w-64">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-[12px] px-4 py-3 font-semibold transition-all",
                  active ? "bg-blue-50/80 text-blue-700" : "text-gray-600 hover:bg-white/50",
                )}>
                {active && <span className="absolute left-0 h-6 w-1 rounded-r-md bg-blue-600" />}
                <Icon className={cn("h-5 w-5", active ? "text-blue-600" : "text-gray-400")} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="min-h-[460px] flex-1 rounded-[24px] border border-white/50 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl md:p-8">
          {tab === "profile" && (
            <div className="space-y-8">
              <h2 className="text-xl font-bold text-gray-900">Личные данные</h2>

              <div className="flex items-center gap-6">
                <div className="relative">
                  {teacher?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={teacher.avatar_url} alt="avatar" className="h-24 w-24 rounded-[20px] border-4 border-white object-cover shadow-sm" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-[20px] border-4 border-white bg-blue-100 text-3xl font-bold text-blue-600 shadow-sm">
                      {initials}
                    </div>
                  )}
                  <button onClick={() => alert(d.teacher.menuStub)}
                    className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700">
                    <Camera className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{teacher?.full_name ?? d.teacher.role}</h3>
                  <p className="mb-2 text-sm font-medium text-gray-500">{d.teacher.role}</p>
                  {teacher?.username && (
                    <span className="rounded-[8px] border border-blue-200/50 bg-blue-100/80 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      @{teacher.username}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">Имя</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-[12px] border border-gray-200 bg-white/50 px-4 py-2.5 font-medium outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-gray-700">Фамилия</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-[12px] border border-gray-200 bg-white/50 px-4 py-2.5 font-medium outline-none focus:border-blue-400" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-gray-700">Email</label>
                  <input type="email" disabled
                    value={teacher?.username ? `${teacher.username}@teachers.snr.local` : ""}
                    className="w-full cursor-not-allowed rounded-[12px] border border-gray-200 bg-gray-50/50 px-4 py-2.5 font-medium text-gray-500 outline-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-bold text-gray-700">Закреплённые классы</label>
                  <div className="flex flex-wrap gap-2 rounded-[12px] border border-gray-200 bg-white/50 p-3">
                    {groups.map((g) => (
                      <span key={g.id} className="rounded-[8px] border border-gray-200/50 bg-gray-100/80 px-3 py-1 text-sm font-semibold text-gray-700">
                        {classBadge(g.name)}
                      </span>
                    ))}
                    <button onClick={() => alert(d.teacher.menuStub)}
                      className="rounded-[8px] border border-dashed border-gray-300 px-3 py-1 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50">
                      + Добавить
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={saveProfile} disabled={saving}
                  className="rounded-[12px] bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:opacity-50">
                  {saved ? "✓ Сохранено" : saving ? d.common.loading : "Сохранить изменения"}
                </button>
              </div>
            </div>
          )}

          {tab === "interface" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">{d.profile.tabInterface}</h2>
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">{d.profile.language}</label>
                <div className="flex gap-2">
                  {(["ru", "uz", "en"] as const).map((l) => (
                    <button key={l} onClick={() => setLocale(l)}
                      className={cn("rounded-[10px] px-4 py-2 text-sm font-semibold uppercase transition-all",
                        locale === l ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:text-gray-900")}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(tab === "security" || tab === "notifications") && (
            <div className="flex h-full flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gray-100 bg-gray-50">
                <Settings2 className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900">В разработке</h3>
              <p className="max-w-sm font-medium text-gray-500">
                Раздел «{tabs.find((t) => t.key === tab)?.label}» будет доступен в следующих обновлениях.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

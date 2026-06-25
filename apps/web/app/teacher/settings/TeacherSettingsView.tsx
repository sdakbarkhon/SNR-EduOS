"use client";

import { useRef, useState } from "react";
import {
  getDictionary,
  updateTeacherProfile,
  updateTeacherAvatar,
  updateTeacherNotificationPrefs,
  uploadTeacherAvatar,
} from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { User, Shield, Bell, LayoutTemplate, Camera, Check, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/Avatar";

type Tab = "profile" | "security" | "notifications" | "interface";

interface Teacher {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  username: string | null;
  phone?: string | null;
  bio?: string | null;
  notification_preferences?: Record<string, boolean> | null;
}

interface Props {
  teacher: Teacher | null;
  groups: Array<{ id: string; name: string; subject: string }>;
}

const DEFAULT_NOTIF_PREFS = {
  on_submission: true,
  on_lesson_soon: true,
  on_announcement: true,
  on_leave_request: true,
};

export function TeacherSettingsView({ teacher, groups }: Props) {
  const { locale, setLocale } = useLocale();
  const d = getDictionary(locale as Locale);
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("profile");

  // Profile tab state
  const [fullName, setFullName] = useState(teacher?.full_name ?? "");
  const [phone, setPhone] = useState(teacher?.phone ?? "");
  const [bio, setBio] = useState(teacher?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(teacher?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Security tab state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Notifications tab state
  const rawPrefs = (teacher?.notification_preferences as Record<string, boolean> | null) ?? DEFAULT_NOTIF_PREFS;
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    on_submission: rawPrefs.on_submission ?? true,
    on_lesson_soon: rawPrefs.on_lesson_soon ?? true,
    on_announcement: rawPrefs.on_announcement ?? true,
    on_leave_request: rawPrefs.on_leave_request ?? true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  const tabs: { key: Tab; label: string; icon: typeof User }[] = [
    { key: "profile", label: d.settings.tabProfile, icon: User },
    { key: "security", label: d.settings.tabSecurity, icon: Shield },
    { key: "notifications", label: d.settings.tabNotifications, icon: Bell },
    { key: "interface", label: d.settings.tabInterface, icon: LayoutTemplate },
  ];

  const initials = (teacher?.full_name ?? "T").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !teacher) return;
    setAvatarUploading(true);
    try {
      const url = await uploadTeacherAvatar(supabase, { teacherId: teacher.id, blob: file, fileName: file.name });
      await updateTeacherAvatar(supabase, { teacherId: teacher.id, avatarUrl: url });
      setAvatarUrl(url);
    } catch {
      // silent
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfile() {
    if (!teacher) return;
    setProfileSaving(true);
    try {
      await updateTeacherProfile(supabase, {
        teacherId: teacher.id,
        fullName: fullName.trim() || (teacher.full_name ?? ""),
        phone: phone.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch {
      // silent
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePassword() {
    if (newPw !== confirmPw) {
      setPwMessage({ kind: "err", text: d.settings.passwordMismatch });
      return;
    }
    if (newPw.length < 6) {
      setPwMessage({ kind: "err", text: "Минимум 6 символов" });
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwMessage({ kind: "ok", text: d.settings.passwordChanged });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPwMessage({ kind: "err", text: msg });
    } finally {
      setPwSaving(false);
    }
  }

  async function saveNotifPrefs() {
    if (!teacher) return;
    setNotifSaving(true);
    try {
      await updateTeacherNotificationPrefs(supabase, { teacherId: teacher.id, prefs: notifPrefs });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2500);
    } catch {
      // silent
    } finally {
      setNotifSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">{d.settings.title}</h1>

      <div className="flex flex-col gap-8 md:flex-row">
        {/* Vertical tabs */}
        <div className="w-full shrink-0 space-y-1 md:w-64">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-[12px] px-4 py-3 font-semibold transition-all",
                  active ? "bg-blue-50/80 text-blue-700" : "text-gray-600 hover:bg-white/50",
                )}
              >
                {active && <span className="absolute left-0 h-6 w-1 rounded-r-md bg-blue-600" />}
                <Icon className={cn("h-5 w-5", active ? "text-blue-600" : "text-gray-400")} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="min-h-[460px] flex-1 rounded-[24px] border border-white/50 bg-white/70 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl md:p-8">

          {/* Profile tab */}
          {tab === "profile" && (
            <div className="space-y-8">
              <h2 className="text-xl font-bold text-gray-900">{d.settings.tabProfile}</h2>

              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar name={teacher?.full_name ?? "T"} src={avatarUrl ?? undefined} size={80} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{teacher?.full_name ?? d.teacher.role}</p>
                  <p className="text-sm text-gray-500">{d.settings.changeAvatar}</p>
                  {avatarUploading && <p className="mt-1 text-xs text-blue-600">{d.common.loading}</p>}
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-bold text-gray-700">{d.settings.fullName}</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-[12px] border border-gray-200 bg-white/50 px-4 py-2.5 font-medium outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-gray-700">{d.settings.username}</label>
                  <input
                    disabled
                    value={teacher?.username ?? ""}
                    className="w-full cursor-not-allowed rounded-[12px] border border-gray-200 bg-gray-50/50 px-4 py-2.5 font-medium text-gray-400 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-gray-700">{d.settings.email}</label>
                  <input
                    disabled
                    value={teacher?.username ? `${teacher.username}@teachers.snr.local` : ""}
                    className="w-full cursor-not-allowed rounded-[12px] border border-gray-200 bg-gray-50/50 px-4 py-2.5 font-medium text-gray-400 outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-gray-700">{d.settings.phone}</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 000 00 00"
                    className="w-full rounded-[12px] border border-gray-200 bg-white/50 px-4 py-2.5 font-medium outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  {/* spacer */}
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-bold text-gray-700">{d.settings.bio}</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-[12px] border border-gray-200 bg-white/50 px-4 py-2.5 font-medium outline-none focus:border-blue-400"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="rounded-[12px] bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {profileSaved ? (
                    <><Check className="mr-1 inline-block h-4 w-4" /> Сохранено</>
                  ) : profileSaving ? d.common.loading : d.settings.saveChanges}
                </button>
              </div>
            </div>
          )}

          {/* Security tab */}
          {tab === "security" && (
            <div className="space-y-8">
              <h2 className="text-xl font-bold text-gray-900">{d.settings.tabSecurity}</h2>
              <p className="text-sm text-gray-500">{d.settings.passwordReset}</p>

              <div className="space-y-5 max-w-sm">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-gray-700">{d.settings.newPassword}</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? "text" : "password"}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="w-full rounded-[12px] border border-gray-200 bg-white/50 px-4 py-2.5 pr-10 font-medium outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-gray-700">{d.settings.confirmPassword}</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? "text" : "password"}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="w-full rounded-[12px] border border-gray-200 bg-white/50 px-4 py-2.5 pr-10 font-medium outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {pwMessage && (
                <p className={cn("text-sm font-medium", pwMessage.kind === "ok" ? "text-green-600" : "text-red-600")}>
                  {pwMessage.text}
                </p>
              )}

              <div className="flex justify-end">
                <button
                  onClick={savePassword}
                  disabled={pwSaving || !newPw || !confirmPw}
                  className="rounded-[12px] bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {pwSaving ? d.common.loading : d.settings.saveChanges}
                </button>
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {tab === "notifications" && (
            <div className="space-y-8">
              <h2 className="text-xl font-bold text-gray-900">{d.settings.tabNotifications}</h2>
              <p className="text-sm font-medium text-gray-600">{d.settings.notifyTitle}</p>

              <div className="space-y-4">
                {(
                  [
                    { key: "on_submission", label: d.settings.notifySubmission },
                    { key: "on_lesson_soon", label: d.settings.notifyLessonSoon },
                    { key: "on_announcement", label: d.settings.notifyAnnouncement },
                    { key: "on_leave_request", label: d.settings.notifyLeaveRequest },
                  ] as const
                ).map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-4 rounded-[14px] border border-gray-100 bg-white/60 px-5 py-4 shadow-sm transition-colors hover:bg-white/90">
                    <span className="flex-1 text-sm font-semibold text-gray-800">{label}</span>
                    <div
                      onClick={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))}
                      className={cn(
                        "relative h-6 w-11 rounded-full transition-colors",
                        notifPrefs[key] ? "bg-blue-600" : "bg-gray-200",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                          notifPrefs[key] ? "translate-x-5" : "translate-x-0.5",
                        )}
                      />
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={saveNotifPrefs}
                  disabled={notifSaving}
                  className="rounded-[12px] bg-blue-600 px-6 py-2.5 font-bold text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {notifSaved ? (
                    <><Check className="mr-1 inline-block h-4 w-4" /> Сохранено</>
                  ) : notifSaving ? d.common.loading : d.settings.saveChanges}
                </button>
              </div>
            </div>
          )}

          {/* Interface tab */}
          {tab === "interface" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">{d.settings.tabInterface}</h2>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">{d.settings.language}</label>
                <div className="flex gap-2">
                  {(["ru", "uz", "en"] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLocale(l)}
                      className={cn(
                        "rounded-[10px] px-4 py-2 text-sm font-semibold uppercase transition-all",
                        locale === l ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:text-gray-900",
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-500">{d.settings.darkThemeComingSoon}</label>
                <div className="flex gap-2">
                  <button disabled className="cursor-not-allowed rounded-[10px] border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-400">
                    🌙 Dark
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

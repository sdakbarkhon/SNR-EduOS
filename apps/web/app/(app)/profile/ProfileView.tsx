"use client";

import { useRef, useState } from "react";
import {
  Camera, Check, Edit2, Lock, LogOut, Mail, Monitor, Moon,
  Phone, Save, Settings, ShieldCheck, Sun, User, X,
} from "lucide-react";
import {
  defaultLocale,
  getDictionary,
  getSubjectStyle,
  uploadAvatar,
  updateStudentAvatar,
  upsertNotificationSettings,
} from "@snr/core";
import type { Database } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components";
import { SubjectIcon } from "@/components";
import { useTheme, type Theme } from "@/components/ThemeProvider";
import { useLocale } from "@/components/LocaleProvider";
import { useLogout, LogoutOverlay } from "@/components/LogoutOverlay";
import type { Locale } from "@snr/core";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Group = Database["public"]["Tables"]["groups"]["Row"];
type NotifSettings = Database["public"]["Tables"]["notification_settings"]["Row"];

type ProfileTab = "profile" | "security" | "notifications" | "interface";

const TABS: { key: ProfileTab; labelKey: "tabProfile" | "tabSecurity" | "tabNotifications" | "tabInterface" }[] = [
  { key: "profile", labelKey: "tabProfile" },
  { key: "security", labelKey: "tabSecurity" },
  { key: "notifications", labelKey: "tabNotifications" },
  { key: "interface", labelKey: "tabInterface" },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full shadow-inner transition-colors duration-200 focus:outline-none ${checked ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"}`}
    >
      <span
        aria-hidden
        className={`pointer-events-none mt-1 inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ${checked ? "translate-x-7" : "translate-x-1"}`}
      />
    </button>
  );
}

export function ProfileView({
  student: initialStudent,
  groups,
  notifSettings: initialNotif,
  curatorName,
}: {
  student: Student;
  groups: Group[];
  notifSettings: NotifSettings | null;
  curatorName: string;
}) {
  const sb = createClient();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  const d = getDictionary(locale as Locale);
  const { loggingOut, logout } = useLogout();

  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [student, setStudent] = useState(initialStudent);

  // ── Аватар ──────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(sb, {
        studentId: student.id,
        blob: file,
        fileName: file.name,
      });
      await updateStudentAvatar(sb, { studentId: student.id, avatarUrl: url });
      setStudent((s) => ({ ...s, avatar_url: url }));
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Уведомления ─────────────────────────────────────────────────────────
  const [notif, setNotif] = useState({
    push_homework: initialNotif?.push_homework ?? true,
    push_schedule: initialNotif?.push_schedule ?? true,
    push_grades: initialNotif?.push_grades ?? true,
    push_attendance: initialNotif?.push_attendance ?? false,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  async function handleToggle(key: keyof typeof notif) {
    const next = { ...notif, [key]: !notif[key] };
    setNotif(next);
    setNotifSaving(true);
    try {
      await upsertNotificationSettings(sb, { student_id: student.id, ...next });
    } finally {
      setNotifSaving(false);
    }
  }

  // ── Безопасность ─────────────────────────────────────────────────────────
  const [editField, setEditField] = useState<"phone" | "email" | null>(null);
  const [secPhone, setSecPhone] = useState(student.username || "");
  const [secEmail, setSecEmail] = useState(`${student.username?.toLowerCase()}@students.snr.local`);
  const [pwResetSent, setPwResetSent] = useState(false);

  async function handlePasswordReset() {
    await sb.auth.resetPasswordForEmail(secEmail);
    setPwResetSent(true);
  }

  // ── ProfileColumn (всегда слева) ─────────────────────────────────────────
  const initials = student.full_name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const ProfileColumn = (
    <GlassCard className="flex flex-col h-fit overflow-hidden p-8 dark:bg-slate-800/70">
      <div className="flex flex-col items-center">
        {/* Avatar */}
        <div className="relative mb-8">
          <div className="w-36 h-36 rounded-full border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-blue-400 to-cyan-400">
            {student.avatar_url ? (
              <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-4xl font-black">
                {initials}
              </div>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
            className="absolute bottom-1 right-2 bg-blue-600 text-white p-3 rounded-full shadow-lg border-2 border-white hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-60"
          >
            <Camera size={18} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        {/* Section title */}
        <div className="w-full flex justify-center mb-6 border-b border-slate-200/50 dark:border-slate-700/50 pb-4">
          <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{d.profile.tabProfile}</h3>
        </div>

        {/* Name + role */}
        <div className="w-full space-y-6">
          <div className="flex flex-col items-center mb-2">
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{student.full_name}</h2>
            <p className="text-xs text-blue-500 font-bold mt-1 uppercase tracking-wider">Студент EduOS</p>
          </div>

          {/* Fields */}
          <div className="bg-white/30 dark:bg-slate-700/30 rounded-2xl p-6 border border-white/50 dark:border-slate-600/30 shadow-sm space-y-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">ФИО</p>
              <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <User size={16} className="text-blue-500" />
                {student.full_name}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Логин</p>
              <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Phone size={16} className="text-slate-400" />
                {student.username}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">E-mail</p>
              <p className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Mail size={16} className="text-slate-400" />
                {secEmail}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logout */}
      <div className="mt-8">
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 py-3 text-sm font-bold text-rose-600 transition hover:bg-rose-100 dark:border-rose-800/50 dark:bg-rose-900/20 dark:text-rose-400"
        >
          <LogOut size={16} />
          {d.profile.logout}
        </button>
      </div>
      {loggingOut && <LogoutOverlay />}
    </GlassCard>
  );

  // ── Вкладка Профиль ───────────────────────────────────────────────────────
  const ProfileTab = (
    <div className="space-y-8">
      <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{d.profile.tabProfile === "Профиль" ? "Учебная информация" : "Academic info"}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white/40 dark:bg-slate-700/40 p-6 rounded-2xl border border-white/50 dark:border-slate-600/30 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{d.profile.gradeLabel}</p>
          <p className="text-slate-800 dark:text-slate-100 font-bold text-xl">{student.grade}</p>
        </div>
        <div className="bg-white/40 dark:bg-slate-700/40 p-6 rounded-2xl border border-white/50 dark:border-slate-600/30 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{d.profile.curator}</p>
          <p className="text-slate-800 dark:text-slate-100 font-bold text-xl">{curatorName || "—"}</p>
        </div>
      </div>

      <div className="bg-white/40 dark:bg-slate-700/40 p-6 rounded-2xl border border-white/50 dark:border-slate-600/30 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">{d.profile.groups}</p>
        <div className="flex flex-col gap-4">
          {groups.map((g) => {
            const style = getSubjectStyle(g.subject);
            return (
              <div
                key={g.id}
                className="flex items-center justify-between bg-white/50 dark:bg-slate-600/30 p-5 rounded-2xl transition-transform hover:-translate-y-0.5"
                style={{ borderLeft: `4px solid ${style.color}` }}
              >
                <div className="flex items-center gap-3">
                  <SubjectIcon subject={g.subject} size={20} />
                  <span className="text-slate-800 dark:text-slate-200 font-bold text-lg">{style.label}</span>
                </div>
                {g.schedule_days && (
                  <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider bg-white/50 dark:bg-slate-700/50 px-3 py-1.5 rounded-lg border border-white/60 dark:border-slate-600/40">
                    {g.schedule_days}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Вкладка Безопасность ─────────────────────────────────────────────────
  const SecurityTab = (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-blue-500" size={28} />
        <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{d.profile.tabSecurity}</h3>
      </div>

      <div className="space-y-6">
        {/* Phone */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Логин / телефон</label>
            {editField === "phone" ? (
              <span className="text-green-600 text-xs font-bold">Редактирование…</span>
            ) : (
              <button onClick={() => setEditField("phone")} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:text-blue-700">
                <Edit2 size={12} /> Редактировать
              </button>
            )}
          </div>
          <input
            type="text"
            value={secPhone}
            onChange={(e) => setSecPhone(e.target.value)}
            readOnly={editField !== "phone"}
            className={`w-full font-bold rounded-xl px-4 py-3.5 outline-none transition-colors ${
              editField === "phone"
                ? "bg-white/60 border border-white/80 text-slate-800 focus:ring-2 focus:ring-blue-500/50"
                : "bg-slate-50/50 dark:bg-slate-700/50 border border-slate-200/50 dark:border-slate-600/30 text-slate-500 cursor-not-allowed"
            }`}
          />
        </div>

        {/* Email */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">Привязанный E-mail</label>
            {editField === "email" ? (
              <span className="text-green-600 text-xs font-bold">Редактирование…</span>
            ) : (
              <button onClick={() => setEditField("email")} className="text-blue-600 text-xs font-bold flex items-center gap-1 hover:text-blue-700">
                <Edit2 size={12} /> Редактировать
              </button>
            )}
          </div>
          <input
            type="email"
            value={secEmail}
            onChange={(e) => setSecEmail(e.target.value)}
            readOnly={editField !== "email"}
            className={`w-full font-bold rounded-xl px-4 py-3.5 outline-none transition-colors ${
              editField === "email"
                ? "bg-white/60 border border-white/80 text-slate-800 focus:ring-2 focus:ring-blue-500/50"
                : "bg-slate-50/50 dark:bg-slate-700/50 border border-slate-200/50 dark:border-slate-600/30 text-slate-500 cursor-not-allowed"
            }`}
          />
        </div>
      </div>

      {/* Save/Cancel */}
      {editField && (
        <div className="flex gap-4 justify-end pt-4 border-t border-slate-200/50">
          <button onClick={() => setEditField(null)} className="flex items-center gap-2 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-6 py-3 rounded-xl font-bold border border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md transition-all">
            <X size={16} /> Отмена
          </button>
          <button onClick={() => setEditField(null)} className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all">
            <Save size={16} /> Сохранить
          </button>
        </div>
      )}

      {/* Password */}
      <div className="border-t border-slate-200/50 dark:border-slate-700/50 pt-8">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Смена пароля</h3>
        <p className="text-sm text-slate-500 mb-6 font-medium">Вам на почту будет отправлена ссылка для сброса и создания нового пароля.</p>
        {pwResetSent ? (
          <p className="flex items-center gap-1 text-sm font-semibold text-green-600"><Check className="h-4 w-4" /> Письмо отправлено</p>
        ) : (
          <button
            onClick={handlePasswordReset}
            className="flex items-center gap-2 bg-white/80 dark:bg-slate-700/80 hover:bg-white dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-3.5 px-6 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm transition-all active:scale-95"
          >
            <Lock size={18} /> Изменить пароль
          </button>
        )}
      </div>
    </div>
  );

  // ── Вкладка Уведомления ─────────────────────────────────────────────────
  const NotificationsTab = (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100">{d.profile.tabNotifications}</h3>
        {notifSaving && <span className="text-xs text-slate-400">Сохранение…</span>}
      </div>
      <div className="bg-white/40 dark:bg-slate-700/40 rounded-2xl border border-white/50 dark:border-slate-600/30 divide-y divide-slate-100/50 dark:divide-slate-700/50 shadow-sm">
        {([
          ["push_homework", d.profile.notifHomework],
          ["push_schedule", d.profile.notifSchedule],
          ["push_grades", d.profile.notifGrades],
          ["push_attendance", d.profile.notifAttendance],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between p-5 hover:bg-white/60 dark:hover:bg-slate-600/30 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
            <span className={`font-semibold ${notif[key] ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"}`}>{label}</span>
            <Toggle checked={notif[key]} onChange={() => handleToggle(key)} />
          </div>
        ))}
      </div>
    </div>
  );

  // ── Вкладка Интерфейс ────────────────────────────────────────────────────
  const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
    { id: "light", label: "Светлая", icon: Sun },
    { id: "dark", label: "Тёмная", icon: Moon },
    { id: "system", label: "Системная", icon: Monitor },
  ];

  const LANGS: { id: Locale; flag: string; label: string }[] = [
    { id: "ru", flag: "🇷🇺", label: "Русский" },
    { id: "en", flag: "🇺🇸", label: "Английский" },
    { id: "uz", flag: "🇺🇿", label: "Узбекский" },
  ];

  const InterfaceTab = (
    <div className="space-y-10">
      {/* Тема */}
      <div>
        <h3 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 mb-5">{d.profile.theme}</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {THEMES.map(({ id, label, icon: Icon }) => {
            const isActive = theme === id;
            return (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all duration-200 border flex items-center justify-center gap-2 ${
                  isActive
                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                    : "bg-white/50 dark:bg-slate-700/50 border-white/80 dark:border-slate-600/40 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-600/50 hover:scale-[1.01]"
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Язык */}
      <div className="border-t border-slate-200/50 dark:border-slate-700/50 pt-8">
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-5">{d.profile.language}</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          {LANGS.map(({ id, flag, label }) => {
            const isActive = locale === id;
            return (
              <button
                key={id}
                onClick={() => setLocale(id)}
                className={`flex-1 py-4 px-6 rounded-xl font-bold transition-all duration-200 border flex items-center justify-center gap-2 ${
                  isActive
                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]"
                    : "bg-white/50 dark:bg-slate-700/50 border-white/80 dark:border-slate-600/40 text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-600/50 hover:scale-[1.01]"
                }`}
              >
                <span className="text-xl">{flag}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const tabContent: Record<ProfileTab, React.ReactNode> = {
    profile: ProfileTab,
    security: SecurityTab,
    notifications: NotificationsTab,
    interface: InterfaceTab,
  };

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
            <Settings size={22} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">{d.profile.title}</h1>
        </div>

        {/* Tab strip */}
        <nav className="flex flex-wrap gap-1 bg-white/40 dark:bg-slate-700/40 backdrop-blur-md p-1 rounded-2xl border border-white/60 dark:border-slate-600/30 w-fit">
          {TABS.map(({ key, labelKey }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative px-4 md:px-6 py-2 rounded-full text-sm transition-all duration-200 font-medium ${
                  isActive
                    ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-white/30 dark:hover:bg-slate-600/30"
                }`}
              >
                {d.profile[labelKey]}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main grid */}
      <div className="grid lg:grid-cols-[360px_1fr] gap-8 items-start">
        {/* Left: always visible */}
        {ProfileColumn}

        {/* Right: tab content */}
        <GlassCard className="flex flex-col p-6 md:p-10 min-h-[500px] dark:bg-slate-800/70">
          {tabContent[activeTab]}
        </GlassCard>
      </div>
    </div>
  );
}

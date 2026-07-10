"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Code2, Bot, Calculator, Languages, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { defaultLocale, getDictionary } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

// PROMT 3 — demo teachers split by subject. claim_demo_account signature
// extended (p_kind, p_grade, p_subject_slug) — теперь клик по конкретной
// предметной карточке отдаёт свободного demo_teacher_{slug}_XX.
type StudentGrade = "10" | "7" | "3";
type TeacherSlug = "programming" | "robotics" | "math" | "english" | "russian";

interface StudentRole {
  kind: "student";
  grade: StudentGrade;
  labelKey: "roleStudent10" | "roleStudent7" | "roleStudent3";
  avatar: string;
  color: string;
}

interface TeacherRole {
  kind: "teacher";
  subjectSlug: TeacherSlug;
  labelKey:
    | "roleTeacherProgramming"
    | "roleTeacherRobotics"
    | "roleTeacherMath"
    | "roleTeacherEnglish"
    | "roleTeacherRussian";
  Icon: typeof Code2;
  color: string;
}

const STUDENT_ROLES: StudentRole[] = [
  { kind: "student", grade: "3", labelKey: "roleStudent3", avatar: "🐣", color: "from-emerald-500 to-teal-600" },
  { kind: "student", grade: "7", labelKey: "roleStudent7", avatar: "👦", color: "from-blue-500 to-cyan-600" },
  { kind: "student", grade: "10", labelKey: "roleStudent10", avatar: "🧑‍💻", color: "from-orange-500 to-red-600" },
];

const TEACHER_ROLES: TeacherRole[] = [
  { kind: "teacher", subjectSlug: "programming", labelKey: "roleTeacherProgramming", Icon: Code2,      color: "from-sky-500 to-blue-600" },
  { kind: "teacher", subjectSlug: "robotics",    labelKey: "roleTeacherRobotics",    Icon: Bot,        color: "from-indigo-500 to-violet-600" },
  { kind: "teacher", subjectSlug: "math",        labelKey: "roleTeacherMath",        Icon: Calculator, color: "from-amber-500 to-orange-500" },
  { kind: "teacher", subjectSlug: "english",     labelKey: "roleTeacherEnglish",     Icon: Languages,  color: "from-rose-500 to-pink-600" },
  { kind: "teacher", subjectSlug: "russian",     labelKey: "roleTeacherRussian",     Icon: BookOpen,   color: "from-red-500 to-rose-600" },
];

export function DemoRoleModal({ onClose }: { onClose: () => void }) {
  const d = getDictionary(defaultLocale).demoMode;
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  async function claim(kind: "student" | "teacher", grade: string | null, subjectSlug: string | null, key: string, redirectTo: string) {
    setLoading(key);
    setError("");
    try {
      // claim_demo_account signature: (p_kind, p_grade, p_subject_slug)
      // p_subject_slug only meaningful for teacher; server ignores it for students.
      const { data, error: rpcError } = await supabase.rpc("claim_demo_account", {
        p_kind: kind,
        p_grade: grade ?? undefined,
        p_subject_slug: subjectSlug ?? undefined,
      });
      if (rpcError) throw rpcError;
      const claimed = data?.[0];
      if (!claimed) {
        setError(d.allBusy);
        setLoading(null);
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: claimed.email,
        password: "demo2026",
      });
      if (authError) throw authError;
      sessionStorage.setItem("show-demo-welcome", "true");
      // `loading`/`isPending` intentionally stay true straight through navigation
      // so the button keeps its spinner until the destination page renders.
      startTransition(() => {
        router.replace(redirectTo);
        router.refresh();
      });
    } catch (err) {
      console.error("[demo-login] error:", err);
      setError(String((err as Error)?.message ?? err));
      setLoading(null);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-4xl rounded-3xl bg-white p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{d.modalTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{d.modalSubtitle}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        {/* Students */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{d.sectionStudents}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STUDENT_ROLES.map((role) => {
              const key = `student-${role.grade}`;
              const label = d[role.labelKey];
              const busy = loading !== null || isPending;
              return (
                <button
                  key={key}
                  onClick={() => claim(role.kind, role.grade, null, key, "/dashboard")}
                  disabled={busy}
                  className="group flex flex-col items-center rounded-2xl border-2 border-slate-200 p-6 transition-all hover:border-violet-400 hover:shadow-xl disabled:opacity-50"
                >
                  <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${role.color} text-3xl`}>
                    {role.avatar}
                  </div>
                  <p className="text-center font-bold text-slate-900">{label}</p>
                  <div className="mt-4 w-full">
                    <span className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${role.color} py-2 text-sm font-medium text-white ${loading === key ? "opacity-50" : ""}`}>
                      {loading === key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {loading === key ? d.loginProgress : d.loginBtn}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Teachers by subject */}
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{d.sectionTeachers}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {TEACHER_ROLES.map((role) => {
              const key = `teacher-${role.subjectSlug}`;
              const label = d[role.labelKey];
              const busy = loading !== null || isPending;
              return (
                <button
                  key={key}
                  onClick={() => claim(role.kind, null, role.subjectSlug, key, "/teacher/dashboard")}
                  disabled={busy}
                  className="group flex flex-col items-center rounded-2xl border-2 border-slate-200 p-5 transition-all hover:border-violet-400 hover:shadow-xl disabled:opacity-50"
                >
                  <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${role.color} text-white`}>
                    <role.Icon className="h-7 w-7" />
                  </div>
                  <p className="text-center text-sm font-bold leading-tight text-slate-900">{label}</p>
                  <div className="mt-3 w-full">
                    <span className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${role.color} py-1.5 text-xs font-medium text-white ${loading === key ? "opacity-50" : ""}`}>
                      {loading === key && <Loader2 className="h-3 w-3 animate-spin" />}
                      {loading === key ? d.loginProgress : d.loginBtn}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">{d.resetNote}</p>
      </div>
    </div>,
    document.body,
  );
}

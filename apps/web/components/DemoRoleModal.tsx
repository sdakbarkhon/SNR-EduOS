"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Lock, GraduationCap, Code2, Bot, Calculator, Languages, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { defaultLocale, getDictionary } from "@snr/core";
import { demoLogin } from "@/app/actions/auth";

// P2-фикс (revert бага А пачки 2) — единая модалка «Демо» с 6 карточками:
// 1 «Ученик» (случайный из пула ~96, БЕЗ выбора класса — старая модель
// 3-классов из до-P2 модалки убрана) + 5 предметников. Куратор teacher_karim
// в модалке не участвует (он не предметник — subject_slug=NULL).
// Занятость каждой карточки — из GET /api/demo/status
// (student_available + occupied_subjects, миграция 133 RPC-функции).

type TeacherSlug = "programming" | "robotics" | "math" | "english" | "russian";

interface TeacherRole {
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

const TEACHER_ROLES: TeacherRole[] = [
  { subjectSlug: "programming", labelKey: "roleTeacherProgramming", Icon: Code2,      color: "from-sky-500 to-blue-600" },
  { subjectSlug: "robotics",    labelKey: "roleTeacherRobotics",    Icon: Bot,        color: "from-indigo-500 to-violet-600" },
  { subjectSlug: "math",        labelKey: "roleTeacherMath",        Icon: Calculator, color: "from-amber-500 to-orange-500" },
  { subjectSlug: "english",     labelKey: "roleTeacherEnglish",     Icon: Languages,  color: "from-rose-500 to-pink-600" },
  { subjectSlug: "russian",     labelKey: "roleTeacherRussian",     Icon: BookOpen,   color: "from-red-500 to-rose-600" },
];

const STUDENT_COLOR = "from-emerald-500 to-teal-600";

export function DemoRoleModal({ onClose }: { onClose: () => void }) {
  const d = getDictionary(defaultLocale).demoMode;
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [occupiedSubjects, setOccupiedSubjects] = useState<Set<string>>(new Set());
  const [studentAvailable, setStudentAvailable] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      setStatusLoading(true);
      try {
        const res = await fetch("/api/demo/status", { cache: "no-store" });
        const j: { occupied_subjects?: string[]; student_available?: boolean } = await res.json();
        if (!cancelled) {
          setOccupiedSubjects(new Set(j.occupied_subjects ?? []));
          setStudentAvailable(j.student_available !== false);
        }
      } catch {
        // если статус не грузится — показываем всё как свободное, RPC на
        // claim всё равно вернёт no_available_slot если реально занято.
        if (!cancelled) {
          setOccupiedSubjects(new Set());
          setStudentAvailable(true);
        }
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    void loadStatus();
    return () => { cancelled = true; };
  }, []);

  async function claimStudent() {
    const key = "student";
    setLoading(key);
    setError("");
    try {
      const result = await demoLogin({ kind: "student" });
      if (!result.ok) {
        if (result.error === "all_busy") {
          setStudentAvailable(false);
          setError(d.allBusy);
        } else {
          setError(d.loginFailed);
        }
        setLoading(null);
        return;
      }
      sessionStorage.setItem("show-demo-welcome", "true");
      startTransition(() => {
        router.replace(result.dest);
        router.refresh();
      });
    } catch (err) {
      console.error("[demo-login] error:", err);
      setError(String((err as Error)?.message ?? err));
      setLoading(null);
    }
  }

  async function claimTeacher(slug: TeacherSlug, key: string) {
    setLoading(key);
    setError("");
    try {
      const result = await demoLogin({ kind: "teacher", slug });
      if (!result.ok) {
        if (result.error === "all_busy") {
          // Race: между рендером и кликом кто-то занял этот слот.
          setOccupiedSubjects((prev) => new Set([...prev, slug]));
          setError(d.allBusy);
        } else {
          setError(d.loginFailed);
        }
        setLoading(null);
        return;
      }
      sessionStorage.setItem("show-demo-welcome", "true");
      startTransition(() => {
        router.replace(result.dest);
        router.refresh();
      });
    } catch (err) {
      console.error("[demo-login] error:", err);
      setError(String((err as Error)?.message ?? err));
      setLoading(null);
    }
  }

  const busy = loading !== null || isPending;
  const studentDisabled = busy || !studentAvailable || statusLoading;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-3xl rounded-3xl bg-white p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
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

        {/* Карточка ученика — случайный из пула ~96, без выбора класса. */}
        <div className="mb-6">
          <button
            onClick={claimStudent}
            disabled={studentDisabled}
            aria-disabled={studentDisabled}
            className={
              !studentAvailable
                ? "group flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-100 p-5 opacity-60 cursor-not-allowed"
                : "group flex w-full items-center gap-4 rounded-2xl border-2 border-slate-200 p-5 transition-all hover:border-violet-400 hover:shadow-xl disabled:opacity-50"
            }
          >
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${!studentAvailable ? "from-slate-400 to-slate-500" : STUDENT_COLOR} text-white`}>
              {!studentAvailable ? <Lock className="h-6 w-6" /> : <GraduationCap className="h-7 w-7" />}
            </div>
            <p className="flex-1 text-left text-sm font-bold text-slate-900">{d.modalCardStudent}</p>
            {!studentAvailable ? (
              <span className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-500 px-4 py-1.5 text-xs font-medium text-white">
                {d.slotOccupied}
              </span>
            ) : (
              <span className={`flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${STUDENT_COLOR} px-4 py-1.5 text-xs font-medium text-white ${loading === "student" ? "opacity-50" : ""}`}>
                {loading === "student" && <Loader2 className="h-3 w-3 animate-spin" />}
                {loading === "student" ? d.loginProgress : d.loginBtn}
              </span>
            )}
          </button>
        </div>

        {/* 5 карточек предметников. */}
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{d.modalCardTeacher}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {TEACHER_ROLES.map((role) => {
              const key = `teacher-${role.subjectSlug}`;
              const label = d[role.labelKey];
              const isOccupied = occupiedSubjects.has(role.subjectSlug);
              const disabled = busy || isOccupied || statusLoading;
              return (
                <button
                  key={key}
                  onClick={() => claimTeacher(role.subjectSlug, key)}
                  disabled={disabled}
                  aria-disabled={disabled}
                  className={
                    isOccupied
                      ? "group flex flex-col items-center rounded-2xl border-2 border-slate-200 bg-slate-100 p-5 opacity-60 cursor-not-allowed"
                      : "group flex flex-col items-center rounded-2xl border-2 border-slate-200 p-5 transition-all hover:border-violet-400 hover:shadow-xl disabled:opacity-50"
                  }
                >
                  <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${isOccupied ? "from-slate-400 to-slate-500" : role.color} text-white`}>
                    {isOccupied ? <Lock className="h-6 w-6" /> : <role.Icon className="h-7 w-7" />}
                  </div>
                  <p className="text-center text-sm font-bold leading-tight text-slate-900">{label}</p>
                  <div className="mt-3 w-full">
                    {isOccupied ? (
                      <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-500 py-1.5 text-xs font-medium text-white">
                        {d.slotOccupied}
                      </span>
                    ) : (
                      <span className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${role.color} py-1.5 text-xs font-medium text-white ${loading === key ? "opacity-50" : ""}`}>
                        {loading === key && <Loader2 className="h-3 w-3 animate-spin" />}
                        {loading === key ? d.loginProgress : d.loginBtn}
                      </span>
                    )}
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

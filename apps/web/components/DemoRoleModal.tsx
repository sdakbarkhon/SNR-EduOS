"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Lock, Baby, Backpack, Laptop, Code2, Bot, Calculator, Languages, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { defaultLocale, getDictionary } from "@snr/core";
import { demoLogin } from "@/app/actions/auth";

// P3-фикс — модалка «Демо» вернулась к исходной структуре «до Пачки 2»:
// 3 карточки классов (3-й/7-й/10-й) + 5 карточек предметников = 8 карточек.
// Иконки/цвета классов — те же, что были в оригинальной домодалке (commit
// d1442e4^): Baby/emerald (3), Backpack/blue (7), Laptop/orange (10).
// Отличие от старой (до-P2) модели: клик по классу теперь берёт СЛУЧАЙНОГО
// ученика ТОЛЬКО из этого класса через grade_level (миграция 135), а не из
// синтетического пула demo_student_{grade}_NN — пул теперь единый ~96
// (после конверсии 90 demo→real в 132), фильтруется по students.grade.
// Куратор teacher_karim в модалке не участвует (не предметник).
// Занятость — из GET /api/demo/status: occupied_grades (класс занят, если
// ВСЕ его активные ученики заняты активным lease) + occupied_subjects
// (как раньше, по subject_slug).

type GradeLevel = 3 | 7 | 10;
type TeacherSlug = "programming" | "robotics" | "math" | "english" | "russian";

interface GradeRole {
  gradeLevel: GradeLevel;
  labelKey: "modalCardGrade3" | "modalCardGrade7" | "modalCardGrade10";
  Icon: typeof Baby;
  color: string;
}

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

const GRADE_ROLES: GradeRole[] = [
  { gradeLevel: 3,  labelKey: "modalCardGrade3",  Icon: Baby,     color: "from-emerald-500 to-teal-600" },
  { gradeLevel: 7,  labelKey: "modalCardGrade7",  Icon: Backpack, color: "from-blue-500 to-cyan-600" },
  { gradeLevel: 10, labelKey: "modalCardGrade10", Icon: Laptop,   color: "from-orange-500 to-red-600" },
];

const TEACHER_ROLES: TeacherRole[] = [
  { subjectSlug: "programming", labelKey: "roleTeacherProgramming", Icon: Code2,      color: "from-sky-500 to-blue-600" },
  { subjectSlug: "robotics",    labelKey: "roleTeacherRobotics",    Icon: Bot,        color: "from-indigo-500 to-violet-600" },
  { subjectSlug: "math",        labelKey: "roleTeacherMath",        Icon: Calculator, color: "from-amber-500 to-orange-500" },
  { subjectSlug: "english",     labelKey: "roleTeacherEnglish",     Icon: Languages,  color: "from-rose-500 to-pink-600" },
  { subjectSlug: "russian",     labelKey: "roleTeacherRussian",     Icon: BookOpen,   color: "from-red-500 to-rose-600" },
];

export function DemoRoleModal({ onClose }: { onClose: () => void }) {
  const d = getDictionary(defaultLocale).demoMode;
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [occupiedSubjects, setOccupiedSubjects] = useState<Set<string>>(new Set());
  const [occupiedGrades, setOccupiedGrades] = useState<Set<number>>(new Set());
  const [statusLoading, setStatusLoading] = useState(true);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      setStatusLoading(true);
      try {
        const res = await fetch("/api/demo/status", { cache: "no-store" });
        const j: { occupied_subjects?: string[]; occupied_grades?: number[] } = await res.json();
        if (!cancelled) {
          setOccupiedSubjects(new Set(j.occupied_subjects ?? []));
          setOccupiedGrades(new Set(j.occupied_grades ?? []));
        }
      } catch {
        // если статус не грузится — показываем всё как свободное, RPC на
        // claim всё равно вернёт no_available_slot если реально занято.
        if (!cancelled) {
          setOccupiedSubjects(new Set());
          setOccupiedGrades(new Set());
        }
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    }
    void loadStatus();
    return () => { cancelled = true; };
  }, []);

  async function claimGrade(gradeLevel: GradeLevel, key: string) {
    setLoading(key);
    setError("");
    try {
      const result = await demoLogin({ kind: "student", gradeLevel });
      if (!result.ok) {
        if (result.error === "all_busy") {
          // Race: между рендером и кликом класс успели полностью занять.
          setOccupiedGrades((prev) => new Set([...prev, gradeLevel]));
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

        {/* Ученики — 3 карточки классов. */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">{d.modalSectionStudents}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {GRADE_ROLES.map((role) => {
              const key = `grade-${role.gradeLevel}`;
              const label = d[role.labelKey];
              const isOccupied = occupiedGrades.has(role.gradeLevel);
              const disabled = busy || isOccupied || statusLoading;
              return (
                <button
                  key={key}
                  onClick={() => claimGrade(role.gradeLevel, key)}
                  disabled={disabled}
                  aria-disabled={disabled}
                  className={
                    isOccupied
                      ? "group flex flex-col items-center rounded-2xl border-2 border-slate-200 bg-slate-100 p-6 opacity-60 cursor-not-allowed"
                      : "group flex flex-col items-center rounded-2xl border-2 border-slate-200 p-6 transition-all hover:border-violet-400 hover:shadow-xl disabled:opacity-50"
                  }
                >
                  <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${isOccupied ? "from-slate-400 to-slate-500" : role.color} text-white`}>
                    {isOccupied ? <Lock className="h-7 w-7" /> : <role.Icon className="h-8 w-8" />}
                  </div>
                  <p className="text-center font-bold text-slate-900">{label}</p>
                  <div className="mt-4 w-full">
                    {isOccupied ? (
                      <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-500 py-2 text-sm font-medium text-white">
                        {d.slotOccupied}
                      </span>
                    ) : (
                      <span className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${role.color} py-2 text-sm font-medium text-white ${loading === key ? "opacity-50" : ""}`}>
                        {loading === key && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {loading === key ? d.loginProgress : d.loginBtn}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Учителя — 5 карточек предметников. */}
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

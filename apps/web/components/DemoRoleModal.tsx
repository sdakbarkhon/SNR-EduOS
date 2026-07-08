"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { defaultLocale, getDictionary } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 4.2 — accounts are no longer hardcoded (that
// broke entirely the moment migration 97 wiped the old demo_teacher/
// demo_student_3/7/10 accounts these buttons used to point at). Each click
// now claims a free slot from the demo_sessions pool (migration 99's
// claim_demo_account RPC) among the 90 demo_student_{10,7,3}_NN / 5
// demo_teacher_NN accounts, and signs into whichever one it returns.
interface DemoRole {
  kind: "student" | "teacher";
  grade: "10" | "7" | "3" | null;
  labelKey: "roleStudent10" | "roleStudent7" | "roleStudent3" | "roleTeacher";
  avatar: string;
  color: string;
  redirectTo: string;
}

const DEMO_ROLES: DemoRole[] = [
  { kind: "teacher", grade: null, labelKey: "roleTeacher", avatar: "👨‍🏫", color: "from-violet-500 to-purple-600", redirectTo: "/teacher/dashboard" },
  { kind: "student", grade: "3", labelKey: "roleStudent3", avatar: "🐣", color: "from-emerald-500 to-teal-600", redirectTo: "/dashboard" },
  { kind: "student", grade: "7", labelKey: "roleStudent7", avatar: "👦", color: "from-blue-500 to-cyan-600", redirectTo: "/dashboard" },
  { kind: "student", grade: "10", labelKey: "roleStudent10", avatar: "🧑‍💻", color: "from-orange-500 to-red-600", redirectTo: "/dashboard" },
];

export function DemoRoleModal({ onClose }: { onClose: () => void }) {
  const d = getDictionary(defaultLocale).demoMode;
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  async function handleLogin(role: DemoRole) {
    const key = role.grade ?? role.kind;
    setLoading(key);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("claim_demo_account", {
        p_kind: role.kind,
        p_grade: role.grade ?? undefined,
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
      // `loading` is intentionally never cleared here — it (and isPending)
      // stay true straight through the navigation so the button keeps its
      // spinner until the destination page is actually on screen.
      startTransition(() => {
        router.replace(role.redirectTo);
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
      <div className="w-full max-w-4xl rounded-3xl bg-white p-8 shadow-2xl">
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

        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_ROLES.map((role) => {
            const key = role.grade ?? role.kind;
            const label = d[role.labelKey];
            return (
              <button
                key={key}
                onClick={() => handleLogin(role)}
                disabled={loading !== null || isPending}
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

        <p className="mt-6 text-center text-xs text-slate-400">{d.resetNote}</p>
      </div>
    </div>,
    document.body,
  );
}

"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { defaultLocale, getDictionary } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

interface DemoAccount {
  email: string;
  password: string;
  role: string;
  name: string;
  avatar: string;
  color: string;
  redirectTo: string;
}

// 2 accounts dedicated to the "Demo Mode" button (migration 66) — separate
// from teacher_demo/aziz_03/nodira_07/sherzod_10, which used to double as
// both real test accounts AND the demo-button destination, causing the demo
// banner to show up on ordinary logins to those accounts.
const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: "demo_teacher@demo.snr.local",
    password: "demo2026",
    role: "Учитель",
    name: "Демо Учитель",
    avatar: "👨‍🏫",
    color: "from-violet-500 to-purple-600",
    redirectTo: "/teacher/dashboard",
  },
  {
    email: "demo_student@demo.snr.local",
    password: "demo2026",
    role: "Ученик",
    name: "Демо Ученик",
    avatar: "👦",
    color: "from-blue-500 to-cyan-600",
    redirectTo: "/dashboard",
  },
];

export function DemoRoleModal({ onClose }: { onClose: () => void }) {
  const d = getDictionary(defaultLocale).demoMode;
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(account: DemoAccount) {
    setLoading(account.email);
    setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: account.email,
        password: account.password,
      });
      if (authError) throw authError;
      sessionStorage.setItem("show-demo-welcome", "true");
      router.push(account.redirectTo);
      router.refresh();
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

        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              onClick={() => handleLogin(account)}
              disabled={loading !== null}
              className="group flex flex-col items-center rounded-2xl border-2 border-slate-200 p-6 transition-all hover:border-violet-400 hover:shadow-xl disabled:opacity-50"
            >
              <div className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${account.color} text-3xl`}>
                {account.avatar}
              </div>
              <p className="text-center font-bold text-slate-900">{account.name}</p>
              <p className="mt-1 text-xs text-slate-500">{account.role}</p>
              <div className="mt-4 w-full">
                <span className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r ${account.color} py-2 text-sm font-medium text-white ${loading === account.email ? "opacity-50" : ""}`}>
                  {loading === account.email && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loading === account.email ? d.loginProgress : d.loginBtn}
                </span>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">{d.resetNote}</p>
      </div>
    </div>,
    document.body,
  );
}

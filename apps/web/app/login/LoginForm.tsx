"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { defaultLocale, getDictionary, signInWithUsername } from "@snr/core";
import { createClient } from "@/lib/supabase/client";
import { DemoRoleModal } from "@/components/DemoRoleModal";

export function LoginForm() {
  const d = getDictionary(defaultLocale);
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: authError, data } = await signInWithUsername(supabase, username, password);
    setLoading(false);
    if (authError) {
      setError(d.auth.invalid);
      return;
    }
    // Determine destination from DB (admin > teacher > student) so that a
    // user who appears in admins table always lands on /admin regardless of email domain.
    const userId = data?.user?.id;
    let dest = "/dashboard";
    if (userId) {
      const [adminRes, teacherRes] = await Promise.all([
        supabase.from("admins" as any).select("id").eq("user_id", userId).maybeSingle(),
        supabase.from("teachers" as any).select("id").eq("user_id", userId).maybeSingle(),
      ]);
      if (adminRes.data) dest = "/admin";
      else if (teacherRes.data) dest = "/teacher/dashboard";
    }
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-[380px] shrink-0 md:max-w-[440px] lg:mx-0 lg:max-w-[420px]">
      <form
        onSubmit={onSubmit}
        className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-white/60 via-white/40 to-white/20 p-7 ring-1 ring-white/50 backdrop-blur-[40px] sm:p-8 md:rounded-[28px] md:p-10"
        style={{
          boxShadow:
            "0 32px 80px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.8)",
        }}
      >
        <h2 className="mb-6 text-center text-[22px] font-bold tracking-tight text-brand-ink md:mb-8 md:text-[26px] lg:text-left">
          {d.auth.title}
        </h2>

        <div className="relative z-10 space-y-4 md:space-y-6">
          {/* Логин */}
          <div className="flex flex-col gap-1.5 md:gap-2">
            <label className="text-[13px] font-medium tracking-wide text-brand-ink-muted md:text-[14px]">
              {d.auth.usernameLabel}
            </label>
            <div className="overflow-hidden rounded-[10px] border border-transparent bg-brand-field transition-all focus-within:border-brand-blue/30 focus-within:ring-2 focus-within:ring-brand-blue/40 md:rounded-xl">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={d.auth.usernamePlaceholder}
                autoCapitalize="none"
                autoComplete="username"
                className="w-full bg-transparent px-3 py-3 text-[15px] font-medium text-brand-ink outline-none placeholder:text-slate-400 md:px-4 md:py-3.5 md:text-[16px]"
              />
            </div>
          </div>

          {/* Пароль */}
          <div className="flex flex-col gap-1.5 md:gap-2">
            <label className="text-[13px] font-medium tracking-wide text-brand-ink-muted md:text-[14px]">
              {d.auth.passwordLabel}
            </label>
            <div className="relative flex items-center overflow-hidden rounded-[10px] border border-transparent bg-brand-field transition-all focus-within:border-brand-blue/30 focus-within:ring-2 focus-within:ring-brand-blue/40 md:rounded-xl">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder={d.auth.passwordPlaceholder}
                className="w-full bg-transparent px-3 py-3 pr-10 text-[16px] font-medium text-brand-ink outline-none placeholder:text-slate-400 md:px-4 md:py-3.5 md:pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                className="absolute right-0 top-0 flex h-full items-center justify-center px-3 text-slate-400 transition-colors hover:text-brand-ink-muted focus-visible:outline-none md:px-4"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Запомнить меня */}
          <div className="pt-1 md:pt-2">
            <label className="group inline-flex cursor-pointer items-center gap-3">
              <div className="relative flex h-[16px] w-[16px] items-center justify-center rounded-[4px] border-[1.5px] border-[#CBD5E1] bg-white shadow-sm transition-colors group-hover:border-brand-blue has-[:checked]:border-transparent has-[:checked]:bg-brand-blue md:h-[18px] md:w-[18px]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="peer sr-only"
                />
                <svg
                  className="h-[9px] w-[9px] text-white opacity-0 transition-opacity peer-checked:opacity-100 md:h-[10px] md:w-[10px]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[13px] font-medium text-brand-ink-muted transition-colors group-hover:text-brand-ink md:text-[14px]">
                {d.auth.rememberMe}
              </span>
            </label>
          </div>

          {error && <p className="text-[13px] font-medium text-danger">{error}</p>}

          {/* Войти */}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-[12px] py-[13px] text-[15px] font-bold tracking-wide text-white transition-all hover:-translate-y-[1px] hover:brightness-110 active:translate-y-0 active:scale-[0.98] disabled:opacity-60 md:mt-2 md:rounded-[14px] md:py-[15px] md:text-[16px]"
            style={{
              background: "linear-gradient(135deg, #1D6FF5 0%, #0B3EDB 100%)",
              boxShadow: "0 10px 28px rgba(11, 62, 219, 0.5)",
            }}
          >
            {loading ? d.common.loading : d.auth.submit}
          </button>

          {/* Забыли пароль */}
          <div className="mt-3 text-center md:mt-4">
            <a
              href="#"
              className="text-[13px] font-medium text-brand-blue transition-colors hover:underline md:text-[14px]"
            >
              {d.auth.forgot}
            </a>
          </div>
        </div>
      </form>

      <div className="mt-6 border-t border-white/30 pt-6">
        <button
          type="button"
          onClick={() => setShowDemoModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-3 font-medium text-violet-700 transition-all hover:bg-violet-100"
        >
          <Sparkles className="h-5 w-5" />
          {d.demoMode.buttonLabel}
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">{d.demoMode.buttonHint}</p>
      </div>

      {showDemoModal && <DemoRoleModal onClose={() => setShowDemoModal(false)} />}
    </div>
  );
}

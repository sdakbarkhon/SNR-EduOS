"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, User, Lock, ArrowRight, GraduationCap, Sparkles } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { loginWithUsername } from "@/app/actions/auth";
import { DemoRoleModal } from "@/components/DemoRoleModal";
import { Logo } from "@/components/Logo";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 23 23">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}

export function LoginForm({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const t = d.auth;
  const router = useRouter();
  const searchParams = useSearchParams();
  // Pre-filled after a parent completes /parent/join, so they don't have to
  // retype the username they just chose.
  const [username, setUsername] = useState(() => searchParams.get("username") ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  // Single-session: middleware выкинул эту сессию, потому что тем же
  // аккаунтом вошли с другого устройства. Постоянный error-pill, не
  // 2.5-секундный notice — сообщение должно дожить до взгляда пользователя.
  useEffect(() => {
    if (searchParams.get("reason") === "session_replaced") {
      setError(t.sessionReplaced);
    }
  }, [searchParams, t.sessionReplaced]);

  // Warm the two most likely post-login route bundles so the RSC payload
  // isn't fetched cold the instant login succeeds (Iter5 hotfix P14.1).
  useEffect(() => {
    router.prefetch("/dashboard");
    router.prefetch("/teacher/dashboard");
  }, [router]);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // Single-session: логин через server action — там ставятся auth-cookie,
    // регистрируется user_sessions-строка (вытесняя предыдущую сессию этого
    // аккаунта) и вычисляется destination по ролям (super_admin > admin >
    // parent > teacher > student).
    let result: Awaited<ReturnType<typeof loginWithUsername>>;
    try {
      result = await loginWithUsername(username, password);
    } catch {
      setLoading(false);
      setError(t.invalid);
      return;
    }
    if (!result.ok) {
      setLoading(false);
      setError(t.invalid);
      return;
    }
    const dest = result.dest;
    // A direct username/password login into a demo account (e.g. typing
    // "demo_student_10_01" instead of using the Demo Mode button) should
    // still get the welcome modal + banner — same flag the DemoRoleModal sets.
    if (result.isDemo) {
      sessionStorage.setItem("show-demo-welcome", "true");
    }
    // `loading` stays true straight through the navigation below (it's only
    // ever reset to false on the error path above) — the button never goes
    // idle between "auth succeeded" and "new page is actually on screen".
    // isPending (true for the duration of the transition) switches the
    // button label to a distinct "entering" phase so the two waits read
    // differently, and prevents React from painting the old page as stale.
    startTransition(() => {
      router.replace(dest);
      router.refresh();
    });
  }

  return (
    <div className="relative z-30 w-full max-w-md">
      <div
        className="relative overflow-hidden rounded-[2rem] border border-white/40 bg-white/70 backdrop-blur-xl"
        style={{ boxShadow: "0 20px 60px -15px rgba(0,0,0,0.15)" }}
      >
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/30 blur-3xl" />

        {/* Промт 6.2: раньше carta была capped на calc(100vh-8rem) и обрезала
            контент на планшете 768 — теперь высота card естественная,
            скроллится вся страница (page.tsx: min-h-screen). */}
        <div className="p-6">
          {/* Промт 6.2.1: логотип SNR EduOS отсутствовал в форме входа —
              тот же компонент/файл, что в сайдбарах ученика/учителя.
              Иконка-заглушка (GraduationCap) оставлена как была, ниже. */}
          <Logo priority className="mb-3 h-8" />

          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/70 shadow-sm">
            <GraduationCap className="h-5 w-5 text-[#FFB020]" strokeWidth={2.5} />
          </div>

          <h1 className="mb-4 text-2xl font-bold leading-tight tracking-tight text-slate-900">
            {t.title}
          </h1>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            {/* Логин */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{t.usernameLabel}</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder}
                  autoCapitalize="none"
                  autoComplete="username"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 py-2.5 pl-11 pr-3 text-sm text-slate-900 placeholder-slate-500 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#FF8A45]"
                />
              </div>
            </div>

            {/* Пароль */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-700">{t.passwordLabel}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  autoComplete="current-password"
                  required
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 py-2.5 pl-11 pr-10 text-sm text-slate-900 placeholder-slate-500 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#FF8A45]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t.hidePassword : t.showPassword}
                  className="absolute right-0 top-0 flex h-full items-center px-3 text-slate-500 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Запомнить меня */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="remember-me"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 bg-white/50 text-[#FFC145] focus:ring-[#FFC145]"
              />
              <label htmlFor="remember-me" className="ml-2 cursor-pointer select-none text-sm font-medium text-slate-700">
                {t.rememberMe}
              </label>
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || isPending}
              className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-transparent bg-gradient-to-r from-[#FFC145] to-[#FF6B6B] px-4 py-3 text-base font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="relative z-10 flex items-center gap-2">
                {isPending ? t.enteringApp : loading ? t.signingIn : (
                  <>
                    {t.submit}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" strokeWidth={2} />
                  </>
                )}
              </span>
            </button>
          </form>

          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => showNotice(t.comingSoon)}
              className="text-sm font-medium text-blue-500 transition-colors hover:text-blue-700"
            >
              {t.forgot}
            </button>
          </div>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/40" />
            <span className="text-xs font-medium text-slate-600">{t.orLoginWith}</span>
            <div className="h-px flex-1 bg-white/40" />
          </div>

          {/* OAuth row — Demo Mode is folded in as the first button (not part
              of the Stitch design, added per explicit spec). */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setShowDemoModal(true)}
              title={d.demoMode.buttonLabel}
              className="group flex items-center justify-center gap-1 rounded-xl border border-white/80 bg-white/70 py-3 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow-md"
            >
              <Sparkles className="h-4 w-4 text-violet-500 group-hover:text-violet-600" />
              <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900">
                {d.demoMode.shortLabel}
              </span>
            </button>
            <button
              type="button"
              onClick={() => showNotice(t.comingSoon)}
              className="flex items-center justify-center rounded-xl border border-white/50 bg-white/80 py-3 shadow-sm transition-colors hover:bg-white"
            >
              <GoogleIcon />
            </button>
            <button
              type="button"
              onClick={() => showNotice(t.comingSoon)}
              className="flex items-center justify-center rounded-xl border border-white/50 bg-white/80 py-3 shadow-sm transition-colors hover:bg-white"
            >
              <Image src="/oauth/oneid.jpg" alt="OneID" width={32} height={32} className="h-6 w-6 object-contain" />
            </button>
            <button
              type="button"
              onClick={() => showNotice(t.comingSoon)}
              className="flex items-center justify-center rounded-xl border border-white/50 bg-white/80 py-3 shadow-sm transition-colors hover:bg-white"
            >
              <MicrosoftIcon />
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
          <div className="rounded-full bg-slate-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur-sm">
            {notice}
          </div>
        </div>
      )}

      {showDemoModal && <DemoRoleModal onClose={() => setShowDemoModal(false)} />}
    </div>
  );
}

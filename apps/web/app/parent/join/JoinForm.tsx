"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { actionVerifyInviteCode, actionCompleteJoin } from "./actions";

const TRANSLIT_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function suggestUsername(fullName: string): string {
  const translit = fullName
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT_MAP[ch] ?? ch)
    .join("");
  return translit.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

type Step =
  | { kind: "code" }
  | { kind: "register"; fullName: string; children: { id: string; full_name: string }[] }
  | { kind: "done" };

export function JoinForm({ initialCode }: { initialCode: string }) {
  const { locale } = useLocale();
  const d = getDictionary(locale);
  const t = d.parentJoin;
  const router = useRouter();

  const [code, setCode] = useState(initialCode);
  const [step, setStep] = useState<Step>({ kind: "code" });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function checkCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await actionVerifyInviteCode(code);
      if (!result.valid) {
        setError(t.invalidCode);
        return;
      }
      setStep({ kind: "register", fullName: result.fullName, children: result.children });
      setUsername(suggestUsername(result.fullName));
    });
  }

  function submitRegistration(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("code", code);
      fd.set("username", username);
      fd.set("password", password);
      const result = await actionCompleteJoin(fd);
      if (!result.success) {
        setError(
          result.error === "username_taken" ? t.usernameTaken
          : result.error === "invalid_code" ? t.invalidCode
          : t.serverError,
        );
        return;
      }
      setStep({ kind: "done" });
      setTimeout(() => {
        router.push(`/login?username=${encodeURIComponent(username)}`);
      }, 1500);
    });
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl ring-1 ring-black/5">
      <h1 className="mb-6 text-center text-xl font-bold text-gray-800">{t.title}</h1>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {step.kind === "code" && (
        <form onSubmit={checkCode} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.codeLabel}</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t.codePlaceholder}
              required
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-lg font-semibold tracking-widest outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {isPending ? t.checking : t.checkCodeBtn}
          </button>
        </form>
      )}

      {step.kind === "register" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-violet-50 px-4 py-3 ring-1 ring-violet-100">
            <p className="text-sm font-semibold text-gray-800">{step.fullName}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t.childrenLabel}</p>
            <ul className="mt-1 space-y-0.5">
              {step.children.map((c) => (
                <li key={c.id} className="text-sm text-gray-600">{c.full_name}</li>
              ))}
            </ul>
          </div>

          <form onSubmit={submitRegistration} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.usernameLabel}</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoCapitalize="none"
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.passwordLabel}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.confirmPasswordLabel}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep({ kind: "code" }); setError(null); }}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {t.changeCodeBtn}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {isPending ? t.creating : t.createAccountBtn}
              </button>
            </div>
          </form>
        </div>
      )}

      {step.kind === "done" && (
        <p className="text-center text-sm font-medium text-emerald-600">{t.successRedirecting}</p>
      )}
    </div>
  );
}

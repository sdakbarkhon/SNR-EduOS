"use client";

import { useEffect, useRef, useState } from "react";
import { Apple, Smartphone } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";

/**
 * Блок «Установить приложение» внизу страницы логина.
 * Приложений в сторах пока нет — кнопки активны, но по клику только
 * показывают notice (тот же визуальный паттерн, что и showNotice в
 * LoginForm.tsx: используется отдельное локальное состояние, потому что
 * страница логина не обёрнута в ToastProvider). Никаких переходов по
 * ссылкам — ни href, ни window.open.
 */
export function MobileAppsSection({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth.mobileApps;
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); }, []);

  function showNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  }

  return (
    <div className="relative z-20 flex w-full justify-center px-6 pb-32 pt-2 lg:px-16 lg:pb-40">
      <div className="flex w-full max-w-3xl flex-col items-center gap-3">
        <p className="text-center text-sm font-medium text-slate-600">{t.label}</p>

        <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => showNotice(t.androidComingSoon)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
          >
            <Smartphone className="h-5 w-5 text-emerald-600" strokeWidth={2} />
            {t.android}
          </button>
          <button
            type="button"
            onClick={() => showNotice(t.iosComingSoon)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/80 px-4 py-3 text-sm font-medium text-slate-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
          >
            <Apple className="h-5 w-5 text-slate-800" strokeWidth={2} />
            {t.ios}
          </button>
        </div>
      </div>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
          <div className="rounded-full bg-slate-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur-sm">
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}

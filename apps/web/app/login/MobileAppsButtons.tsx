"use client";

import { useEffect, useRef, useState } from "react";
import { Apple, Smartphone } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";

/**
 * Компактные кнопки «Скачать приложение» — правая часть футера (BottomBar),
 * на месте, где раньше стоял LanguageSelector (он переехал в правый верхний
 * угол страницы, см. page.tsx). Сторов ещё нет — кнопки активны, клик
 * показывает notice (тот же визуальный паттерн showNotice, что в
 * LoginForm.tsx), никаких переходов по ссылкам. Всегда icon-only (подпись —
 * только в title/aria-label): footer — общая строка с центрированной
 * copyright-пилюлей (BottomBar.tsx), на lg+ ширины ровно двух кнопок с
 * полным текстом уже не хватает без наезда на неё — см. коммит,
 * добавивший эту компоновку.
 */
export function MobileAppsButtons({ locale }: { locale: Locale }) {
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
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => showNotice(t.androidComingSoon)}
          title={t.android}
          aria-label={t.android}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/50 shadow-lg backdrop-blur-xl transition hover:bg-white/70"
        >
          <Smartphone className="h-4 w-4 text-emerald-600" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => showNotice(t.iosComingSoon)}
          title={t.ios}
          aria-label={t.ios}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/50 shadow-lg backdrop-blur-xl transition hover:bg-white/70"
        >
          <Apple className="h-4 w-4 text-slate-800" strokeWidth={2} />
        </button>
      </div>

      {notice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-4">
          <div className="rounded-full bg-slate-900/90 px-5 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur-sm">
            {notice}
          </div>
        </div>
      )}
    </>
  );
}

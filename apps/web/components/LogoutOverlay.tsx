"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { Logo } from "./Logo";
import { signOut } from "@/app/actions/auth";

/**
 * Единая логика "Выйти" для всех ролей (админ/супер-админ/учитель/родитель/
 * ученик + demo-баннер). Раньше часть кнопок ждала (`<form action={signOut}>`
 * или `await signOut()` без индикации) весь server-action round trip
 * (~2-3с, Supabase auth во Frankfurt) с нулевым визуальным откликом —
 * выглядело как зависание. Часть кнопок уже делала `router.replace("/login")`
 * СРАЗУ + signOut() в фоне — быстрее на вид, но гонка: middleware /login
 * может отбить обратно на дашборд, если auth-кука ещё не очищена к моменту
 * его запроса (signOut() чистит куку и только потом редиректит сам, двумя
 * независимыми запросами это не гарантировано по порядку).
 *
 * Здесь — третий вариант: оверлей показывается СИНХРОННО в момент клика (до
 * await), но сам signOut() по-прежнему ДОЖИДАЕМСЯ — редирект на /login
 * выполняет redirect() ВНУТРИ signOut() (кука уже гарантированно снята к
 * этому моменту, гонки нет). НЕ оборачивать в try/catch/.catch() — redirect()
 * в Next.js работает через throw как управляющий сигнал, это тот же паттерн,
 * что уже проверен в DemoBanner.tsx.
 */
export function useLogout() {
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    await signOut();
  }, []);

  return { loggingOut, logout };
}

export function LogoutOverlay() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-black/60 p-4 backdrop-blur-sm">
      <Logo className="h-8 opacity-90" />
      <Loader2 className="h-8 w-8 animate-spin text-white" />
      <span className="text-sm font-medium text-white">{d.common.loggingOut}</span>
    </div>,
    document.body,
  );
}

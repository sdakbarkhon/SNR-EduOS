"use client";

// Дом менеджера — заход 1. Экран намеренно почти пустой: он говорит, кто
// вошёл и чего пока нет. Обещать разделы, которых ещё не существует, хуже,
// чем честно сказать «будет в следующих заходах».

import { LogOut, ShieldCheck } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
// Выход — общей парой useLogout + LogoutOverlay, а не своей формой. Правило
// одно на все роли: оверлей показывается синхронно по клику, а сам выход
// дожидается, потому что редирект живёт внутри signOut и куку он снимает
// раньше. Своя форма повторила бы гонку, которую этой парой и чинили.
import { useLogout, LogoutOverlay } from "@/components/LogoutOverlay";

export function ManagerHomeView({ fullName }: { fullName: string }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).superadmin;
  const { loggingOut, logout } = useLogout();

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100">
            <ShieldCheck className="h-6 w-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{d.mgrHomeTitle}</h1>
            <p className="text-sm text-zinc-500">{fullName}</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-zinc-600">{d.mgrHomeSoon}</p>

        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="mt-6 flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" /> {d.mgrHomeLogout}
        </button>
      </div>
      {loggingOut && <LogoutOverlay />}
    </div>
  );
}

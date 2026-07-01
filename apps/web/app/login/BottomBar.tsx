import { Shield } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { LanguageSelector } from "./LanguageSelector";

export function BottomBar({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth;

  return (
    <div className="relative z-20 flex flex-col items-stretch gap-3 px-4 pb-4 md:flex-row md:items-center md:justify-between md:px-6 md:pb-0 lg:fixed lg:inset-x-0 lg:bottom-6 lg:flex-row lg:px-6">
      <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/50 px-4 py-3 shadow-lg backdrop-blur-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80">
          <Shield className="h-5 w-5 text-blue-500" fill="#dbeafe" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">{t.security.title}</p>
          <p className="text-xs text-slate-600">{t.security.subtitle}</p>
        </div>
      </div>

      <p className="rounded-full border border-white/60 bg-white/50 px-4 py-2 text-center text-sm font-medium text-slate-700 backdrop-blur-xl">
        © 2026 SNR EduOS. {t.rightsReserved}
      </p>

      <div className="self-center md:self-auto">
        <LanguageSelector />
      </div>
    </div>
  );
}

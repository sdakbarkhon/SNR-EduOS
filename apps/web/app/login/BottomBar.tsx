import { Shield } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { LanguageSelector } from "./LanguageSelector";

/**
 * Mirrors the main content grid's columns (lg:px-16 on the left, p-6/lg:p-12
 * + max-w-md on the right) so the security card lines up under the branding
 * column's left edge ("Учись") and the language selector's right edge lines
 * up with the login card's right edge, instead of both just hugging the
 * viewport edges independently.
 */
export function BottomBar({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 grid grid-cols-1 items-center lg:grid-cols-2">
      <div className="hidden lg:flex lg:px-16">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/60 bg-white/50 px-4 py-3 shadow-lg backdrop-blur-xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80">
            <Shield className="h-5 w-5 text-blue-500" fill="#dbeafe" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{t.security.title}</p>
            <p className="text-xs text-slate-600">{t.security.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-center p-6 lg:p-12">
        <div className="pointer-events-auto flex w-full max-w-md justify-end">
          <LanguageSelector />
        </div>
      </div>

      {/* Independently centered on the page — not part of either column.
          col-span-2 so its grid area spans the full row: an absolutely
          positioned grid item resolves left/top percentages against its own
          grid area, not the whole container, unless it spans everything. */}
      <p className="pointer-events-auto absolute left-1/2 top-1/2 col-span-2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/60 bg-white/50 px-4 py-2 text-center text-sm font-medium text-slate-700 backdrop-blur-xl">
        © 2026 SNR EduOS. {t.rightsReserved}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@snr/core";

const LANGUAGES: { code: Locale; name: string }[] = [
  { code: "ru", name: "Русский" },
  { code: "en", name: "English" },
  { code: "uz", name: "O'zbek" },
];

export function LanguageSelector() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0]!;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-2xl border border-white/60 bg-white/50 px-4 py-2 shadow-lg backdrop-blur-xl transition hover:bg-white/70"
      >
        <Globe className="h-4 w-4 text-slate-600" />
        <span className="text-sm font-medium text-slate-700">{current.name}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 min-w-[140px] overflow-hidden rounded-xl border border-slate-100 bg-white shadow-xl">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => { setLocale(lang.code); setOpen(false); }}
              className={`w-full px-4 py-2 text-left text-sm transition hover:bg-slate-50 ${
                lang.code === locale ? "font-semibold text-slate-900" : "text-slate-700"
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

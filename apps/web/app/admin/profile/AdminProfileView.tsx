"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { Shield } from "lucide-react";

const LANGUAGES: { code: Locale; label: string }[] = [
  { code: "ru", label: "Русский" },
  { code: "uz", label: "O'zbekcha" },
  { code: "en", label: "English" },
];

export function AdminProfileView({
  fullName,
  email,
  schoolName,
}: {
  fullName: string;
  email: string | null;
  schoolName: string | null;
}) {
  const { locale, setLocale } = useLocale();
  const d = getDictionary(locale as Locale);
  const a = d.admin;
  const s = d.settings;

  const rows: { label: string; value: string }[] = [
    { label: s.fullName, value: fullName },
    { label: s.email, value: email ?? "—" },
    { label: a.profileSchool, value: schoolName ?? "—" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">{a.navProfile}</h1>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
            <Shield size={26} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-gray-800">{fullName}</div>
            <div className="text-sm text-gray-500">{a.role}</div>
          </div>
        </div>

        <dl className="mt-6 space-y-3 border-t border-gray-100 pt-5">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2">
              <dt className="text-sm text-gray-500">{row.label}</dt>
              <dd className="text-sm font-medium text-gray-800">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{s.language}</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const active = locale === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setLocale(lang.code)}
                className={
                  active
                    ? "rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white"
                    : "rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
                }
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

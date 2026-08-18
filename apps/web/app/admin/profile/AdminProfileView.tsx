"use client";

import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { SchoolMark } from "@/components/SchoolMark";
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
  schoolLogoUrl,
  schoolCard,
}: {
  fullName: string;
  email: string | null;
  schoolName: string | null;
  schoolLogoUrl: string | null;
  /** Данные организации. Все поля необязательные — заполненные показываются,
   *  пустые не занимают места вовсе. */
  schoolCard: {
    address: string | null; phone: string | null; email: string | null;
    director_name: string | null; website: string | null;
  } | null;
}) {
  const { locale, setLocale } = useLocale();
  const d = getDictionary(locale as Locale);
  const a = d.admin;
  const s = d.settings;
  const t = d.superadmin;

  const rows: { label: string; value: string }[] = [
    { label: s.fullName, value: fullName },
    { label: s.email, value: email ?? "—" },
    { label: a.profileSchool, value: schoolName ?? "—" },
  ];

  // Показываем только заполненное: строка «Сайт: —» ничего не сообщает, а
  // место занимает. Пустая карточка — законное состояние, школы заведены
  // раньше этих полей.
  const orgRows = (
    [
      [t.fieldDirector, schoolCard?.director_name],
      [t.fieldAddress, schoolCard?.address],
      [t.fieldPhone, schoolCard?.phone],
      [t.fieldEmail, schoolCard?.email],
      [t.fieldWebsite, schoolCard?.website],
    ] as [string, string | null | undefined][]
  ).filter((r): r is [string, string] => Boolean(r[1]));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">{a.navProfile}</h1>

      {/* Школа — первой: админ должен с одного взгляда видеть, где он. Если
          логотипа нет, SchoolMark покажет буквы названия, а не пустой квадрат. */}
      {schoolName && (
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center gap-4">
            <SchoolMark name={schoolName} logoUrl={schoolLogoUrl} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-gray-800">{schoolName}</div>
              <div className="text-sm text-gray-500">
                {schoolLogoUrl ? a.profileSchoolLogo : t.logoNone}
              </div>
            </div>
          </div>

          {orgRows.length > 0 && (
            <dl className="mt-6 space-y-3 border-t border-gray-100 pt-5">
              {orgRows.map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-2">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-800">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

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

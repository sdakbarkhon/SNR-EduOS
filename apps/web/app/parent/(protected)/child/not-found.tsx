"use client";

import Link from "next/link";
import { UserX } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

export default function ChildNotFound() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.parentUi;

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-black/5">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-50 text-pink-400">
        <UserX className="h-7 w-7" />
      </span>
      <div>
        <h1 className="text-lg font-bold text-gray-800">{t.notFoundChildTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.notFoundChildDescription}</p>
      </div>
      <Link
        href="/parent/dashboard"
        className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700"
      >
        {t.backToDashboard}
      </Link>
    </div>
  );
}

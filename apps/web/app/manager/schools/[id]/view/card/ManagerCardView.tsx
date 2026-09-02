"use client";

// Карточка школы, правимая менеджером. Заход 3, первый сквозной случай записи.
//
// ШЕСТЬ ПОЛЕЙ И НИ ОДНИМ БОЛЬШЕ. Название, код, автостарт уроков и
// длительность урока менеджеру запрещены — их здесь нет ни в форме, ни в
// действии, которое эту форму принимает.
//
// СКРЫТЫЕ ПОЛЯ «БЫЛО» — тот же приём, что у карточки суперадмина: сервер
// отличает «не трогал» от «стёр нарочно» и пишет только правда изменённое.
// Без них пустое поле затирало бы значение при каждом сохранении.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Building2, Check, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { origName } from "@/lib/form-patch";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { actionManagerUpdateSchoolCard } from "./actions";

type Карточка = {
  address: string | null;
  phone: string | null;
  email: string | null;
  director_name: string | null;
  website: string | null;
  legal_details: string | null;
};

const ПОЛЯ: Array<{ key: keyof Карточка; labelKey: string; long?: boolean }> = [
  { key: "address", labelKey: "svCardAddress" },
  { key: "phone", labelKey: "svCardPhone" },
  { key: "email", labelKey: "svCardEmail" },
  { key: "director_name", labelKey: "svCardDirector" },
  { key: "website", labelKey: "svCardWebsite" },
  { key: "legal_details", labelKey: "svCardLegal", long: true },
];

export function ManagerCardView({
  schoolId, schoolName, card, readOnly,
}: {
  schoolId: string;
  schoolName: string;
  card: Карточка;
  readOnly: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).superadmin;
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function сохранить(fd: FormData) {
    setError("");
    setSaved(false);
    startTransition(async () => {
      try {
        await unwrap(actionManagerUpdateSchoolCard(schoolId, fd));
        setSaved(true);
      } catch (e) {
        setError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100">
          <Building2 className="h-4.5 w-4.5 text-violet-600" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-zinc-900">{d.mgrCardTitle}</h2>
          <p className="truncate text-xs text-zinc-500">{schoolName}</p>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); сохранить(new FormData(e.currentTarget)); }}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
      >
        {ПОЛЯ.map((f) => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {d[f.labelKey as keyof typeof d] as string}
            </label>
            {/* Скрытое «было» — по нему сервер поймёт, трогали ли поле. */}
            <input type="hidden" name={origName(f.key)} defaultValue={card[f.key] ?? ""} />
            {f.long ? (
              <textarea
                name={f.key}
                rows={3}
                defaultValue={card[f.key] ?? ""}
                disabled={readOnly}
                className="resize-y rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
              />
            ) : (
              <input
                name={f.key}
                defaultValue={card[f.key] ?? ""}
                disabled={readOnly}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
              />
            )}
          </div>
        ))}

        <p className="text-xs leading-relaxed text-zinc-400">{d.mgrCardHint}</p>

        {saved && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{d.mgrCardSaved}</p>
        )}
        {error && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href={`/manager/schools/${schoolId}/view`}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <ArrowLeft className="h-4 w-4" /> {d.svExit}
          </Link>
          {!readOnly && (
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {d.mgrCardSave}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

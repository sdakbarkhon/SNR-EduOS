"use client";

import { useState, useTransition } from "react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { actionChangeOwnPassword, actionSetOwnGoogleEmail } from "../actions";
import { GoogleEmailField } from "@/components/admin/GoogleEmailField";
import { useFlash, FlashBanner } from "@/components/admin/Flash";

export function SettingsView({ googleEmail }: { googleEmail?: string | null }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.superadmin;

  const [isPending, startTransition] = useTransition();
  const { flash, flashMsg } = useFlash();


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t.settingsTitle}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.settingsSubtitle}</p>
      </div>

      <FlashBanner msg={flashMsg} />

      {/* Почта для входа через Google — себе. Ролей выше суперадминистратора
          нет, просить кого-то вписать ему адрес некого, поэтому единственное
          место, где это можно сделать, — его собственные настройки
          (миграция 214). */}
      <div className="max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{t.googleBlockTitle}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              try {
                await unwrap(actionSetOwnGoogleEmail(fd));
                flash(t.googleEmailSavedMsg);
              } catch (err) {
                flash(humanizeAdminError(err, locale as Locale));
              }
            });
          }}
          className="space-y-4"
        >
          <GoogleEmailField defaultValue={googleEmail} placeholder="super@gmail.com" />
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {t.schoolSaveBtn}
          </button>
        </form>
      </div>

      <div className="max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">{t.changePassword}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              try {
                await unwrap(actionChangeOwnPassword(fd));
                flash(t.passwordChangedMsg);
                (e.target as HTMLFormElement).reset();
              } catch (err) {
                flash(humanizeAdminError(err, locale as Locale));
              }
            });
          }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.fieldNewPassword}</label>
            <input
              name="new_password"
              type="text"
              required
              minLength={6}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {isPending ? t.saving : t.saveBtn}
          </button>
        </form>
      </div>
    </div>
  );
}

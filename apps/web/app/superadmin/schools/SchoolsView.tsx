"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { actionCreateSchool } from "../actions";

type School = { id: string; name: string; code: string | null; autostart_enabled: boolean; created_at: string };

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>,
    document.body,
  );
}

function ModalCard({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
    />
  );
}

export function SchoolsView({ schools }: { schools: School[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.superadmin;

  const [showAdd, setShowAdd] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 6000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t.schoolsTitle}</h1>
          <p className="mt-1 text-sm text-gray-500">{t.schoolsSubtitle}</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          <Plus className="h-4 w-4" />
          {t.createSchoolBtn}
        </button>
      </div>

      {flashMsg && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          {flashMsg}
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t.schoolsTableName}</th>
                <th className="px-4 py-3">{t.schoolsTableCode}</th>
                <th className="px-4 py-3">{t.autostartLabel}</th>
                <th className="px-4 py-3">{t.schoolsTableCreated}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schools.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">{t.noSchools}</td>
                </tr>
              ) : (
                schools.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.code ?? "—"}</td>
                    <td className="px-4 py-3">
                      {s.autostart_enabled ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">{t.autostartEnabled}</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200">{t.autostartDisabled}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(s.created_at).toLocaleDateString("ru-RU")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <Backdrop onClose={() => setShowAdd(false)}>
          <ModalCard title={t.createSchoolBtn} onClose={() => setShowAdd(false)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    await actionCreateSchool(fd);
                    flash(t.schoolCreatedMsg.replace("{name}", String(fd.get("name"))));
                    setShowAdd(false);
                  } catch (err) {
                    flash(humanizeAdminError(err, locale as Locale));
                  }
                });
              }}
              className="space-y-4"
            >
              <Field label={t.fieldSchoolName}><Input name="name" required placeholder="SNR International School" /></Field>
              <Field label={t.fieldSchoolCode}><Input name="code" required placeholder="SNR-REAL" autoCapitalize="none" /></Field>
              <label className="flex items-center gap-2.5 pt-1 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="autostart_enabled"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300 text-slate-700 focus:ring-slate-400"
                />
                {t.autostartLabel}
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60">
                  {isPending ? t.creating : t.createBtn}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}
    </div>
  );
}

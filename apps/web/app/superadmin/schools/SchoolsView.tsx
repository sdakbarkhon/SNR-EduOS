"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Archive, ArchiveRestore, Plus, Trash2, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import {
  actionCreateSchool,
  actionDeleteSchoolForever,
  actionSchoolWipePreview,
  actionSetSchoolArchived,
} from "../actions";
import type { SchoolWipePreview } from "@/lib/school-lifecycle";

type School = {
  id: string; name: string; code: string | null;
  autostart_enabled: boolean; created_at: string;
  /** false — школа в архиве (миграция 202). */
  is_active: boolean;
};

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

  // Диалог «убрать школу»: сначала выбор между архивом и удалением, и только
  // после выбора «удалить» — цена решения и подтверждение названием.
  const [wipe, setWipe] = useState<School | null>(null);
  const [preview, setPreview] = useState<SchoolWipePreview | null>(null);
  const [mode, setMode] = useState<"choose" | "delete">("choose");
  const [confirmText, setConfirmText] = useState("");

  function openWipe(school: School) {
    setWipe(school);
    setMode("choose");
    setConfirmText("");
    setPreview(null);
    startTransition(async () => {
      try {
        setPreview(await actionSchoolWipePreview(school.id));
      } catch (err) {
        flash(humanizeAdminError(err, locale as Locale));
      }
    });
  }

  function closeWipe() {
    setWipe(null);
    setPreview(null);
    setConfirmText("");
  }

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
                <th className="px-4 py-3 text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {schools.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t.noSchools}</td>
                </tr>
              ) : (
                schools.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {s.name}
                      {!s.is_active && (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                          {t.schoolArchivedBadge}
                        </span>
                      )}
                    </td>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {s.is_active ? (
                          <button
                            onClick={() => openWipe(s)}
                            title={t.schoolWipeBtn}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => startTransition(async () => {
                              try {
                                await actionSetSchoolArchived(s.id, false);
                                flash(t.schoolRestoredMsg.replace("{name}", s.name));
                              } catch (err) {
                                flash(humanizeAdminError(err, locale as Locale));
                              }
                            })}
                            title={t.schoolRestoreBtn}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </button>
                        )}
                      </div>
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

      {/* Убрать школу: сначала выбор, потом — если удаление — цена и слово. */}
      {wipe && (
        <Backdrop onClose={closeWipe}>
          <ModalCard title={t.schoolWipeTitle.replace("{name}", wipe.name)} onClose={closeWipe}>
            {mode === "choose" ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{t.schoolWipeIntro}</p>

                <button
                  onClick={() => startTransition(async () => {
                    try {
                      await actionSetSchoolArchived(wipe.id, true);
                      flash(t.schoolArchivedMsg.replace("{name}", wipe.name));
                      closeWipe();
                    } catch (err) {
                      flash(humanizeAdminError(err, locale as Locale));
                    }
                  })}
                  disabled={isPending}
                  className="w-full rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-left hover:bg-amber-50 disabled:opacity-60"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <Archive className="h-4 w-4" /> {t.schoolArchiveOption}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-amber-700">{t.schoolArchiveHint}</span>
                </button>

                <button
                  onClick={() => setMode("delete")}
                  className="w-full rounded-xl border border-red-200 bg-red-50/60 p-4 text-left hover:bg-red-50"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-red-700">
                    <Trash2 className="h-4 w-4" /> {t.schoolDeleteOption}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-red-600">{t.schoolDeleteHint}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Цена решения — числами, до подтверждения. */}
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t.schoolWipeWhatGoes}</p>
                  {preview ? (
                    <ul className="mt-2 space-y-0.5 text-sm text-gray-700">
                      <li>{t.wipeStudents.replace("{n}", String(preview.students))}</li>
                      <li>{t.wipeTeachers.replace("{n}", String(preview.teachers))}</li>
                      <li>{t.wipeParents.replace("{n}", String(preview.parents))}</li>
                      <li>{t.wipeGroups.replace("{n}", String(preview.groups))}</li>
                      <li>{t.wipeLessons.replace("{n}", String(preview.lessons))}</li>
                      <li>{t.wipeGrades.replace("{n}", String(preview.grades))}</li>
                      <li>{t.wipeFiles.replace("{n}", String(preview.files))}</li>
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-gray-400">{t.wipeCounting}</p>
                  )}
                </div>

                <p className="text-sm font-medium text-red-700">{t.schoolDeleteIrreversible}</p>

                <Field label={t.schoolDeleteConfirmLabel.replace("{name}", wipe.name)}>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={wipe.name}
                    autoCapitalize="none"
                  />
                </Field>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setMode("choose")}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    {t.backBtn}
                  </button>
                  <button
                    type="button"
                    disabled={isPending || confirmText.trim() !== wipe.name.trim()}
                    onClick={() => startTransition(async () => {
                      try {
                        const res = await actionDeleteSchoolForever(wipe.id, confirmText);
                        flash(
                          t.schoolDeletedMsg
                            .replace("{name}", wipe.name)
                            .replace("{files}", String(res.files))
                            .replace("{users}", String(res.users)),
                        );
                        closeWipe();
                      } catch (err) {
                        flash(humanizeAdminError(err, locale as Locale));
                      }
                    })}
                    className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    {isPending ? t.deleting : t.schoolDeleteConfirmBtn}
                  </button>
                </div>
              </div>
            )}
          </ModalCard>
        </Backdrop>
      )}
    </div>
  );
}

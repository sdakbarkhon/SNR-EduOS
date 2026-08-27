"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, X, RefreshCw, Pencil, Trash2, KeyRound } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GoogleEmailField } from "@/components/admin/GoogleEmailField";
import { origName } from "@/lib/form-patch";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import {
  actionCreateSchoolAdmin, actionUpdateSchoolAdmin,
  actionDeleteSchoolAdmin, actionResetSchoolAdminPassword,
} from "../actions";

type Admin = {
  id: string;
  user_id: string | null;
  full_name: string;
  school_id: string;
  created_at: string;
  /** Почта Google для входа (миграция 213). */
  // 19.08.2026 — БЫЛО googleEmail, И ЭТО ПОРТИЛО ДАННЫЕ.
  //
  // Страница отдаёт строку как есть из базы, там колонка называется
  // google_email (admins/page.tsx:37). Тип здесь объявлен руками, и в нём
  // стояло camelCase — поэтому modal.admin.googleEmail всегда было undefined,
  // поле в форме рисовалось пустым, а сохранение писало эту пустоту поверх
  // настоящей почты. Каждое «Сохранить» отвязывало вход через Google.
  //
  // TypeScript такое не ловит: тип написан вручную и компилятор верит ему на
  // слово, а объект приходит переменной, а не литералом, так что проверка
  // лишних свойств не срабатывает. Единственная защита — совпадение имён с
  // тем, что реально приходит из базы. Остальные поля тут в snake_case ровно
  // поэтому.
  google_email?: string | null;
};

type School = { id: string; name: string };

type Modal =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "edit"; admin: Admin }
  | { kind: "delete"; admin: Admin }
  | { kind: "reset"; admin: Admin };

function generatePassword(len = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

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

export function AdminsView({
  admins,
  schools,
  emails,
  defaultOpenAdd,
}: {
  admins: Admin[];
  schools: School[];
  emails: Record<string, string>;
  defaultOpenAdd?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.superadmin;

  const [modal, setModal] = useState<Modal>(defaultOpenAdd ? { kind: "add" } : { kind: "none" });
  const [search, setSearch] = useState("");
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pwd, setPwd] = useState(() => generatePassword());

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 8000);
  }

  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? "—";

  const filtered = admins.filter((a) => {
    const q = search.toLowerCase();
    return a.full_name.toLowerCase().includes(q) || (emails[a.user_id ?? ""] ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.adminsTitle}</h1>
        <button
          onClick={() => setModal({ kind: "add" })}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          <Plus className="h-4 w-4" />
          {t.addAdmin}
        </button>
      </div>

      {flashMsg && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          {flashMsg}
        </div>
      )}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-gray-100 p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none ring-1 ring-gray-200 focus:ring-slate-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t.tableFullName}</th>
                <th className="px-4 py-3">{t.tableUsername}</th>
                <th className="px-4 py-3">{t.tableSchool}</th>
                <th className="px-4 py-3">{t.tableCreated}</th>
                <th className="px-4 py-3 text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t.noResults}</td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">{a.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{emails[a.user_id ?? ""] ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{schoolName(a.school_id)}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(a.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal({ kind: "edit", admin: a })}
                          title={t.editAdminTitle}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-slate-50 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setModal({ kind: "reset", admin: a })}
                          title={t.resetPasswordBtn}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setModal({ kind: "delete", admin: a })}
                          title={t.deleteAdminTitle}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal.kind === "add" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard title={t.addAdminTitle} onClose={() => setModal({ kind: "none" })}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    await unwrap(actionCreateSchoolAdmin(fd));
                    flash(
                      t.createdMsg
                        .replace("{username}", String(fd.get("username")))
                        .replace("{password}", String(fd.get("password"))),
                    );
                    setModal({ kind: "none" });
                    setPwd(generatePassword());
                  } catch (err) {
                    flash(humanizeAdminError(err, locale as Locale));
                  }
                });
              }}
              className="space-y-4"
            >
              <Field label={t.fieldFullName}><Input name="full_name" required placeholder="Иван Петров" /></Field>
              <Field label={t.fieldUsername}><Input name="username" required placeholder="admin_maktab2" autoCapitalize="none" /></Field>
              {/* Почту администратора вписывает суперадминистратор — сам себе
                  администратор её назначить не может. */}
              <GoogleEmailField placeholder="admin@gmail.com" />
              <Field label={t.fieldPassword}>
                <div className="flex gap-2">
                  <input
                    name="password"
                    required
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setPwd(generatePassword())}
                    className="flex items-center gap-1 rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {t.generatePassword}
                  </button>
                </div>
              </Field>
              <Field label={t.fieldSchool}>
                <select
                  name="school_id"
                  required
                  defaultValue={schools[0]?.id ?? ""}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal({ kind: "none" })} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60">
                  {isPending ? t.creating : t.createBtn}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}

      {modal.kind === "edit" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard title={t.editAdminTitle} onClose={() => setModal({ kind: "none" })}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    await unwrap(actionUpdateSchoolAdmin(fd));
                    flash(t.adminUpdatedMsg);
                    setModal({ kind: "none" });
                  } catch (err) {
                    flash(humanizeAdminError(err, locale as Locale));
                  }
                });
              }}
              className="space-y-4"
            >
              <input type="hidden" name="admin_id" value={modal.admin.id} />
              <Field label={t.fieldFullName}><Input name="full_name" required defaultValue={modal.admin.full_name} /></Field>
              <Field label={t.fieldSchool}>
                <select
                  name="school_id"
                  required
                  defaultValue={modal.admin.school_id}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </Field>
              {/* Скрытое поле с исходным значением — по нему сервер поймёт,
                  трогали почту или нет, и не станет писать колонку впустую.
                  Разбор приёма: lib/form-patch.ts. */}
              <input type="hidden" name={origName("google_email")} defaultValue={modal.admin.google_email ?? ""} />
              <GoogleEmailField defaultValue={modal.admin.google_email} placeholder="admin@gmail.com" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal({ kind: "none" })} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60">
                  {isPending ? t.saving : t.saveBtn}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}

      {modal.kind === "reset" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard title={t.resetPasswordBtn} onClose={() => setModal({ kind: "none" })}>
            <p className="mb-6 text-sm text-gray-600">
              {t.resetAdminPasswordConfirm.replace("{name}", modal.admin.full_name)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModal({ kind: "none" })} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                {t.cancelBtn}
              </button>
              <button
                onClick={() => {
                  const userId = modal.admin.user_id;
                  if (!userId) { flash(t.noAccountError); setModal({ kind: "none" }); return; }
                  startTransition(async () => {
                    try {
                      const newPassword = await unwrap(actionResetSchoolAdminPassword(userId));
                      flash(t.newPasswordFlash.replace("{name}", modal.admin.full_name).replace("{password}", newPassword));
                      setModal({ kind: "none" });
                    } catch (err) {
                      flash(humanizeAdminError(err, locale as Locale));
                    }
                  });
                }}
                disabled={isPending}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {isPending ? t.resetting : t.resetPasswordBtn}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {modal.kind === "delete" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard title={t.deleteAdminTitle} onClose={() => setModal({ kind: "none" })}>
            <p className="mb-6 text-sm text-gray-600">
              {t.deleteAdminConfirm.replace("{name}", modal.admin.full_name)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModal({ kind: "none" })} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                {t.cancelBtn}
              </button>
              <button
                onClick={() => {
                  const userId = modal.admin.user_id;
                  if (!userId) { flash(t.noAccountError); setModal({ kind: "none" }); return; }
                  startTransition(async () => {
                    try {
                      await unwrap(actionDeleteSchoolAdmin(userId));
                      flash(t.adminDeletedMsg);
                      setModal({ kind: "none" });
                    } catch (err) {
                      flash(humanizeAdminError(err, locale as Locale));
                    }
                  });
                }}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? t.deleting : d.admin.deleteBtn}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}
    </div>
  );
}

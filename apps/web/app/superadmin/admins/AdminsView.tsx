"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, X, RefreshCw, Pencil, Trash2, KeyRound } from "lucide-react";
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
        <h1 className="text-2xl font-bold text-gray-800">Администраторы школ</h1>
        <button
          onClick={() => setModal({ kind: "add" })}
          className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          <Plus className="h-4 w-4" />
          Добавить админа
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
            placeholder="Поиск по имени или логину…"
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none ring-1 ring-gray-200 focus:ring-slate-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Логин</th>
                <th className="px-4 py-3">Школа</th>
                <th className="px-4 py-3">Создан</th>
                <th className="px-4 py-3 text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Ничего не найдено</td>
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
                          title="Редактировать"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-slate-50 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setModal({ kind: "reset", admin: a })}
                          title="Сбросить пароль"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setModal({ kind: "delete", admin: a })}
                          title="Удалить"
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
          <ModalCard title="Добавить администратора школы" onClose={() => setModal({ kind: "none" })}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    await actionCreateSchoolAdmin(fd);
                    flash(`Админ создан. Username: ${fd.get("username")}, Пароль: ${fd.get("password")}`);
                    setModal({ kind: "none" });
                    setPwd(generatePassword());
                  } catch (err) {
                    flash("Ошибка: " + (err as Error).message);
                  }
                });
              }}
              className="space-y-4"
            >
              <Field label="ФИО"><Input name="full_name" required placeholder="Иван Петров" /></Field>
              <Field label="Username"><Input name="username" required placeholder="admin_maktab2" autoCapitalize="none" /></Field>
              <Field label="Пароль">
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
                    Генерировать
                  </button>
                </div>
              </Field>
              <Field label="Школа">
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
                <button type="button" onClick={() => setModal({ kind: "none" })} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60">
                  {isPending ? "Создание…" : "Создать"}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}

      {modal.kind === "edit" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard title="Редактировать администратора" onClose={() => setModal({ kind: "none" })}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    await actionUpdateSchoolAdmin(fd);
                    flash("Изменения сохранены.");
                    setModal({ kind: "none" });
                  } catch (err) {
                    flash("Ошибка: " + (err as Error).message);
                  }
                });
              }}
              className="space-y-4"
            >
              <input type="hidden" name="admin_id" value={modal.admin.id} />
              <Field label="ФИО"><Input name="full_name" required defaultValue={modal.admin.full_name} /></Field>
              <Field label="Школа">
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
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal({ kind: "none" })} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60">
                  {isPending ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}

      {modal.kind === "reset" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard title="Сбросить пароль" onClose={() => setModal({ kind: "none" })}>
            <p className="mb-6 text-sm text-gray-600">
              Сбросить пароль администратора «{modal.admin.full_name}»? Новый пароль будет показан один раз.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModal({ kind: "none" })} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              <button
                onClick={() => {
                  const userId = modal.admin.user_id;
                  if (!userId) { flash("Ошибка: у администратора нет учётной записи"); setModal({ kind: "none" }); return; }
                  startTransition(async () => {
                    try {
                      const newPassword = await actionResetSchoolAdminPassword(userId);
                      flash(`Новый пароль для ${modal.admin.full_name}: ${newPassword}`);
                      setModal({ kind: "none" });
                    } catch (err) {
                      flash("Ошибка: " + (err as Error).message);
                    }
                  });
                }}
                disabled={isPending}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {isPending ? "…" : "Сбросить"}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {modal.kind === "delete" && (
        <Backdrop onClose={() => setModal({ kind: "none" })}>
          <ModalCard title="Удалить администратора" onClose={() => setModal({ kind: "none" })}>
            <p className="mb-6 text-sm text-gray-600">
              Удалить администратора «{modal.admin.full_name}»? Это действие необратимо — учётная запись входа будет удалена.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModal({ kind: "none" })} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Отмена
              </button>
              <button
                onClick={() => {
                  const userId = modal.admin.user_id;
                  if (!userId) { flash("Ошибка: у администратора нет учётной записи"); setModal({ kind: "none" }); return; }
                  startTransition(async () => {
                    try {
                      await actionDeleteSchoolAdmin(userId);
                      flash("Администратор удалён.");
                      setModal({ kind: "none" });
                    } catch (err) {
                      flash("Ошибка: " + (err as Error).message);
                    }
                  });
                }}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Удаление…" : "Удалить"}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}
    </div>
  );
}

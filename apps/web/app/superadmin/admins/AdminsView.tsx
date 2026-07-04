"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, X, RefreshCw } from "lucide-react";
import { actionCreateSchoolAdmin } from "../actions";

type Admin = {
  id: string;
  user_id: string | null;
  full_name: string;
  school_id: string;
  created_at: string;
};

type School = { id: string; name: string };

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
  const [showAdd, setShowAdd] = useState(!!defaultOpenAdd);
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
          onClick={() => setShowAdd(true)}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Ничего не найдено</td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <Backdrop onClose={() => setShowAdd(false)}>
          <ModalCard title="Добавить администратора школы" onClose={() => setShowAdd(false)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(async () => {
                  try {
                    await actionCreateSchoolAdmin(fd);
                    flash(`Админ создан. Username: ${fd.get("username")}, Пароль: ${fd.get("password")}`);
                    setShowAdd(false);
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
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60">
                  {isPending ? "Создание…" : "Создать"}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}
    </div>
  );
}

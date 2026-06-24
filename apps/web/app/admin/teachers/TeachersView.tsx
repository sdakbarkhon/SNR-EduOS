"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Pencil, KeyRound, Trash2, Plus, X, RefreshCw } from "lucide-react";
import {
  actionCreateTeacher,
  actionUpdateTeacher,
  actionResetTeacherPassword,
  actionDeleteTeacher,
} from "../actions";

type Teacher = {
  id: string;
  user_id: string | null;
  full_name: string;
  username: string | null;
  created_at: string;
};

type Modal =
  | { kind: "add" }
  | { kind: "edit"; teacher: Teacher }
  | { kind: "reset"; teacher: Teacher }
  | { kind: "delete"; teacher: Teacher };

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
      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
    />
  );
}

export function TeachersView({
  teachers,
  defaultOpenAdd,
}: {
  teachers: Teacher[];
  defaultOpenAdd?: boolean;
}) {
  const [modal, setModal] = useState<Modal | null>(defaultOpenAdd ? { kind: "add" } : null);
  const [search, setSearch] = useState("");
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 5000);
  }

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return t.full_name.toLowerCase().includes(q) || (t.username ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Учителя</h1>
        <button
          onClick={() => setModal({ kind: "add" })}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Добавить учителя
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
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none ring-1 ring-gray-200 focus:ring-emerald-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Логин</th>
                <th className="px-4 py-3">Создан</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">Ничего не найдено</td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">{t.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">@{t.username ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(t.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal({ kind: "edit", teacher: t })} className="rounded-lg p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600" title="Редактировать">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setModal({ kind: "reset", teacher: t })} className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600" title="Сбросить пароль">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => setModal({ kind: "delete", teacher: t })} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Удалить">
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

      {modal?.kind === "add" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="Добавить учителя" onClose={() => setModal(null)}>
            <AddTeacherForm
              isPending={isPending}
              onClose={() => setModal(null)}
              onSubmit={(fd) => {
                startTransition(async () => {
                  try {
                    await actionCreateTeacher(fd);
                    flash(`Учитель создан. Username: ${fd.get("username")}, Пароль: ${fd.get("password")}`);
                    setModal(null);
                  } catch (e) {
                    flash("Ошибка: " + (e as Error).message);
                  }
                });
              }}
            />
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "edit" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="Редактировать учителя" onClose={() => setModal(null)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.append("teacher_id", modal.teacher.id);
                fd.append("user_id", modal.teacher.user_id ?? "");
                startTransition(async () => {
                  try {
                    await actionUpdateTeacher(fd);
                    flash("Данные учителя обновлены");
                    setModal(null);
                  } catch (e) {
                    flash("Ошибка: " + (e as Error).message);
                  }
                });
              }}
              className="space-y-4"
            >
              <Field label="ФИО"><Input name="full_name" required defaultValue={modal.teacher.full_name} /></Field>
              <Field label="Username"><Input name="username" required defaultValue={modal.teacher.username ?? ""} autoCapitalize="none" /></Field>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">
                  {isPending ? "Сохранение…" : "Сохранить"}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "reset" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="Сбросить пароль" onClose={() => setModal(null)}>
            <p className="mb-6 text-sm text-gray-600">Сбросить пароль для <strong>{modal.teacher.full_name}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
              <button
                onClick={() => startTransition(async () => {
                  try {
                    if (!modal.teacher.user_id) throw new Error("No user_id");
                    const pwd = await actionResetTeacherPassword(modal.teacher.user_id);
                    flash(`Новый пароль для ${modal.teacher.full_name}: ${pwd}`);
                    setModal(null);
                  } catch (e) {
                    flash("Ошибка: " + (e as Error).message);
                  }
                })}
                disabled={isPending}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {isPending ? "Сброс…" : "Сбросить"}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "delete" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="Удалить учителя" onClose={() => setModal(null)}>
            <p className="mb-2 text-sm text-gray-600">Удалить учителя <strong>{modal.teacher.full_name}</strong>?</p>
            <p className="mb-2 text-xs text-amber-600">Нельзя удалить учителя, у которого есть группы. Сначала переназначьте группы.</p>
            <p className="mb-6 text-xs font-semibold text-red-600">Это действие необратимо!</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
              <button
                onClick={() => startTransition(async () => {
                  try {
                    if (!modal.teacher.user_id) throw new Error("No user_id");
                    await actionDeleteTeacher(modal.teacher.id, modal.teacher.user_id);
                    flash("Учитель удалён");
                    setModal(null);
                  } catch (e) {
                    const msg = (e as Error).message;
                    flash(msg.includes("BLOCKED") ? "Нельзя удалить учителя с группами" : "Ошибка: " + msg);
                  }
                })}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "Удаление…" : "Удалить навсегда"}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}
    </div>
  );
}

function AddTeacherForm({
  isPending,
  onClose,
  onSubmit,
}: {
  isPending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [pwd, setPwd] = useState(() => generatePassword());
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-4"
    >
      <Field label="ФИО"><Input name="full_name" required placeholder="Анна Смирнова" /></Field>
      <Field label="Username"><Input name="username" required placeholder="teacher_anna" autoCapitalize="none" /></Field>
      <Field label="Пароль">
        <div className="flex gap-2">
          <input
            name="password"
            required
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
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
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
        <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
          {isPending ? "Создание…" : "Создать"}
        </button>
      </div>
    </form>
  );
}

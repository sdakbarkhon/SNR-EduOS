"use client";

import { useState, useTransition } from "react";
import { actionChangeOwnPassword } from "../actions";

export function SettingsView() {
  const [isPending, startTransition] = useTransition();
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 5000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Настройки</h1>
        <p className="mt-1 text-sm text-gray-500">Учётные данные супер-администратора</p>
      </div>

      {flashMsg && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">
          {flashMsg}
        </div>
      )}

      <div className="max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="mb-4 text-base font-semibold text-gray-700">Смена пароля</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              try {
                await actionChangeOwnPassword(fd);
                flash("Пароль изменён");
                (e.target as HTMLFormElement).reset();
              } catch (err) {
                flash("Ошибка: " + (err as Error).message);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Новый пароль</label>
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
            {isPending ? "Сохранение…" : "Сохранить"}
          </button>
        </form>
      </div>
    </div>
  );
}

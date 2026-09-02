"use client";

// Экран «Менеджеры» у суперадмина. Заход 1, миграция 250.
//
// СЛЕПОК С ЭКРАНА АДМИНИСТРАТОРОВ ШКОЛ, минус всё школьное: у менеджера школы
// нет, поэтому нет ни колонки школы, ни выпадающего списка при заведении, ни
// перевода в другую школу. Остальное — те же четыре окна: завести, править,
// удалить, сбросить пароль.
//
// ПАРОЛЬ ПОКАЗЫВАЕТСЯ ОДИН РАЗ. При заведении его придумывает форма, при
// сбросе — сервер; и там и там он живёт только в этом окне, пока его не
// закрыли. В журнал он не попадает: действия перечисляют поля поимённо, и
// пароля среди них нет.

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Plus, X, RefreshCw, Pencil, Trash2, KeyRound, UserCog } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GoogleEmailField } from "@/components/admin/GoogleEmailField";
import { origName } from "@/lib/form-patch";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import {
  actionCreateManager, actionUpdateManager,
  actionDeleteManager, actionResetManagerPassword,
} from "../actions";

type Manager = {
  id: string;
  user_id: string;
  full_name: string;
  username: string | null;
  google_email: string | null;
  created_at: string;
  email: string | null;
};

type Modal =
  | { kind: "none" }
  | { kind: "add" }
  | { kind: "edit"; manager: Manager }
  | { kind: "delete"; manager: Manager }
  | { kind: "reset"; manager: Manager };

/** Тот же набор знаков, что у школьных админов: без похожих друг на друга
 *  «l», «I», «O» и нуля — пароль диктуют голосом. */
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

function Card({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
    />
  );
}

export function ManagersView({
  managers, defaultOpenAdd,
}: {
  managers: Manager[];
  defaultOpenAdd?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).superadmin;

  const [modal, setModal] = useState<Modal>(defaultOpenAdd ? { kind: "add" } : { kind: "none" });
  const [search, setSearch] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [password, setPassword] = useState(generatePassword());
  /** Пароль, показанный после сброса. Живёт только в окне. */
  const [shown, setShown] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const запрос = search.trim().toLowerCase();
  const видимые = запрос
    ? managers.filter((m) =>
      m.full_name.toLowerCase().includes(запрос)
      || (m.username ?? "").toLowerCase().includes(запрос)
      || (m.email ?? "").toLowerCase().includes(запрос))
    : managers;

  function закрыть() {
    setModal({ kind: "none" });
    setError("");
    setShown(null);
  }

  function сообщить(текст: string) {
    setFlash(текст);
    setTimeout(() => setFlash(null), 6000);
  }

  function создать(fd: FormData) {
    setError("");
    startTransition(async () => {
      try {
        await unwrap(actionCreateManager(fd));
        сообщить(d.mgrCreatedMsg
          .replace("{name}", String(fd.get("full_name")))
          .replace("{login}", String(fd.get("username")))
          .replace("{password}", String(fd.get("password"))));
        закрыть();
      } catch (e) {
        setError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  function сохранить(fd: FormData) {
    setError("");
    startTransition(async () => {
      try {
        await unwrap(actionUpdateManager(fd));
        сообщить(d.mgrUpdatedMsg);
        закрыть();
      } catch (e) {
        setError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  function удалить(m: Manager) {
    setError("");
    startTransition(async () => {
      try {
        await unwrap(actionDeleteManager(m.user_id));
        сообщить(d.mgrDeletedMsg.replace("{name}", m.full_name));
        закрыть();
      } catch (e) {
        setError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  function сбросить(m: Manager) {
    setError("");
    startTransition(async () => {
      try {
        setShown(await unwrap(actionResetManagerPassword(m.user_id)));
      } catch (e) {
        setError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <UserCog className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{d.mgrTitle}</h1>
            <p className="text-sm text-zinc-500">{d.mgrHint}</p>
          </div>
        </div>
        <button
          onClick={() => { setPassword(generatePassword()); setModal({ kind: "add" }); }}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> {d.mgrAdd}
        </button>
      </div>

      {flash && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{flash}</p>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={d.mgrSearchPlaceholder}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-violet-400"
      />

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">{d.mgrColName}</th>
              <th className="px-4 py-3">{d.mgrColLogin}</th>
              <th className="px-4 py-3">{d.mgrColCreated}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {видимые.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-400">
                  {managers.length === 0 ? d.mgrEmpty : d.mgrNoResults}
                </td>
              </tr>
            ) : (
              видимые.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50/60">
                  <td className="px-4 py-3 font-medium text-zinc-800">
                    {m.full_name}
                    {m.google_email && (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {m.google_email}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{m.username ?? m.email ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(m.created_at).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setModal({ kind: "edit", manager: m })}
                        title={d.mgrEdit}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-violet-50 hover:text-violet-600"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setShown(null); setModal({ kind: "reset", manager: m }); }}
                        title={d.mgrReset}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-amber-50 hover:text-amber-600"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setModal({ kind: "delete", manager: m })}
                        title={d.mgrDelete}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
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

      {/* ── ЗАВЕСТИ ──────────────────────────────────────────────────── */}
      {modal.kind === "add" && (
        <Backdrop onClose={закрыть}>
          <Card title={d.mgrAdd} onClose={закрыть}>
            <form
              onSubmit={(e) => { e.preventDefault(); создать(new FormData(e.currentTarget)); }}
              className="space-y-4"
            >
              <Field label={d.mgrFieldName}>
                <Input name="full_name" required autoFocus placeholder="Иванова Мария" />
              </Field>
              <Field label={d.mgrFieldLogin}>
                <Input name="username" required autoComplete="off" placeholder="manager1" />
                <p className="text-xs text-zinc-400">{d.mgrLoginHint}</p>
              </Field>
              <Field label={d.mgrFieldPassword}>
                <div className="flex gap-2">
                  <Input
                    name="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    title={d.mgrRegenerate}
                    className="rounded-xl border border-zinc-200 px-3 text-zinc-500 hover:bg-zinc-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-zinc-400">{d.mgrPasswordHint}</p>
              </Field>
              <GoogleEmailField placeholder="manager@gmail.com" />

              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={закрыть} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                  {d.mgrCancel}
                </button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                  {isPending ? "…" : d.mgrCreate}
                </button>
              </div>
            </form>
          </Card>
        </Backdrop>
      )}

      {/* ── ПРАВИТЬ ──────────────────────────────────────────────────── */}
      {modal.kind === "edit" && (
        <Backdrop onClose={закрыть}>
          <Card title={d.mgrEdit} onClose={закрыть}>
            <form
              onSubmit={(e) => { e.preventDefault(); сохранить(new FormData(e.currentTarget)); }}
              className="space-y-4"
            >
              <input type="hidden" name="manager_id" value={modal.manager.id} />
              <Field label={d.mgrFieldName}>
                <Input name="full_name" required defaultValue={modal.manager.full_name} />
              </Field>
              {/* Логин не правится: он и есть адрес учётной записи, а его смена
                  означала бы завести нового человека. Так же у школьных
                  админов. */}
              <Field label={d.mgrFieldLogin}>
                <Input value={modal.manager.username ?? "—"} disabled />
              </Field>
              {/* Скрытое поле «было» — по нему сервер отличит «не трогал» от
                  «стёр нарочно». Разбор — lib/form-patch.ts. */}
              <input type="hidden" name={origName("google_email")} defaultValue={modal.manager.google_email ?? ""} />
              <GoogleEmailField defaultValue={modal.manager.google_email} placeholder="manager@gmail.com" />

              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={закрыть} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                  {d.mgrCancel}
                </button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                  {isPending ? "…" : d.mgrSave}
                </button>
              </div>
            </form>
          </Card>
        </Backdrop>
      )}

      {/* ── УДАЛИТЬ ──────────────────────────────────────────────────── */}
      {modal.kind === "delete" && (
        <Backdrop onClose={закрыть}>
          <Card title={d.mgrDeleteTitle} onClose={закрыть}>
            <p className="mb-5 text-sm text-zinc-600">
              {d.mgrDeleteConfirm.replace("{name}", modal.manager.full_name)}
            </p>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={закрыть} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                {d.mgrCancel}
              </button>
              <button
                onClick={() => удалить(modal.manager)}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "…" : d.mgrDelete}
              </button>
            </div>
          </Card>
        </Backdrop>
      )}

      {/* ── СБРОСИТЬ ПАРОЛЬ ──────────────────────────────────────────── */}
      {modal.kind === "reset" && (
        <Backdrop onClose={закрыть}>
          <Card title={d.mgrResetTitle} onClose={закрыть}>
            {shown ? (
              <>
                <p className="mb-2 text-sm text-zinc-600">
                  {d.mgrResetDone.replace("{name}", modal.manager.full_name)}
                </p>
                <p className="mb-5 rounded-xl bg-zinc-100 px-4 py-3 text-center font-mono text-lg text-zinc-900">
                  {shown}
                </p>
                <p className="mb-5 text-xs text-zinc-400">{d.mgrResetOnce}</p>
                <button onClick={закрыть} className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                  {d.mgrClose}
                </button>
              </>
            ) : (
              <>
                <p className="mb-5 text-sm text-zinc-600">
                  {d.mgrResetConfirm.replace("{name}", modal.manager.full_name)}
                </p>
                {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={закрыть} className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                    {d.mgrCancel}
                  </button>
                  <button
                    onClick={() => сбросить(modal.manager)}
                    disabled={isPending}
                    className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                  >
                    {isPending ? "…" : d.mgrReset}
                  </button>
                </div>
              </>
            )}
          </Card>
        </Backdrop>
      )}
    </div>
  );
}

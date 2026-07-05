"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Plus, Copy, RefreshCw, Trash2 } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { actionRegenerateInviteCode, actionDeleteParent } from "./actions";

type ParentRow = {
  id: string;
  full_name: string;
  phone: string | null;
  isRegistered: boolean;
  created_at: string;
  children: string[];
  inviteCode: string | null;
  inviteExpired: boolean;
};

type Student = { id: string; full_name: string; username: string };

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

export function ParentsView({ parents }: { parents: ParentRow[]; allStudents: Student[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.adminParents;

  const [search, setSearch] = useState("");
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<ParentRow | null>(null);

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 6000);
  }

  const filtered = parents.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => flash(t.copied));
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/parent/join?code=${code}`;
    navigator.clipboard.writeText(url).then(() => flash(t.copied));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.title}</h1>
        <Link
          href="/admin/parents/new"
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          {t.addParent}
        </Link>
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
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none ring-1 ring-gray-200 focus:ring-violet-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t.tableFullName}</th>
                <th className="px-4 py-3">{t.tablePhone}</th>
                <th className="px-4 py-3">{t.tableChildren}</th>
                <th className="px-4 py-3">{t.tableStatus}</th>
                <th className="px-4 py-3">{t.tableCreated}</th>
                <th className="px-4 py-3 text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">{t.noParents}</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">{p.full_name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{p.children.join(", ") || "—"}</td>
                    <td className="px-4 py-3">
                      {p.isRegistered ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          {t.statusRegistered}
                        </span>
                      ) : p.inviteCode && !p.inviteExpired ? (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                            {t.statusPending}
                          </span>
                          <button
                            onClick={() => copyCode(p.inviteCode!)}
                            title={t.copyCodeBtn}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-red-200">
                            {t.statusExpired}
                          </span>
                          <button
                            onClick={() => startTransition(async () => {
                              try {
                                await actionRegenerateInviteCode(p.id);
                                flash(t.regenerateCodeBtn + " ✓");
                              } catch (err) {
                                flash("Ошибка: " + (err as Error).message);
                              }
                            })}
                            disabled={isPending}
                            title={t.regenerateCodeBtn}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(p.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {!p.isRegistered && p.inviteCode && !p.inviteExpired && (
                          <button
                            onClick={() => copyLink(p.inviteCode!)}
                            title={t.copyLink}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(p)}
                          title={t.deleteBtn}
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

      {deleteTarget && (
        <Backdrop onClose={() => setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-gray-800">{t.deleteBtn}</h2>
            <p className="mb-6 text-sm text-gray-600">
              {t.deleteConfirm.replace("{name}", deleteTarget.full_name)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                {t.cancelBtn}
              </button>
              <button
                onClick={() => startTransition(async () => {
                  try {
                    await actionDeleteParent(deleteTarget.id);
                    flash(t.deleteBtn + " ✓");
                    setDeleteTarget(null);
                  } catch (err) {
                    flash("Ошибка: " + (err as Error).message);
                  }
                })}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? "…" : t.deleteBtn}
              </button>
            </div>
          </div>
        </Backdrop>
      )}
    </div>
  );
}

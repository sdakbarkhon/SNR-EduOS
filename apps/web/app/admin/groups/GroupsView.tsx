"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { actionCreateGroup, actionUpdateGroup, actionDeleteGroup } from "../actions";
import { subjects } from "@snr/core";

type Teacher = { id: string; full_name: string };
type Group = {
  id: string;
  name: string;
  subject: string;
  teacher_id: string | null;
  teachers: { id: string; full_name: string } | null;
  student_groups: { student_id: string }[];
};

type Modal =
  | { kind: "add" }
  | { kind: "edit"; group: Group }
  | { kind: "delete"; group: Group };

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

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
    />
  );
}

function GroupForm({
  defaultValues,
  teachers,
  isPending,
  onClose,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: Partial<Group>;
  teachers: Teacher[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  submitLabel: string;
}) {
  const subjectEntries = Object.entries(subjects);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-4"
    >
      <Field label="Название группы">
        <Input name="name" required placeholder="Математика 7А" defaultValue={defaultValues?.name} />
      </Field>
      <Field label="Предмет">
        <Select name="subject" required defaultValue={defaultValues?.subject ?? ""}>
          <option value="" disabled>Выберите предмет</option>
          {subjectEntries.map(([key, cfg]) => (
            <option key={key} value={key}>{cfg.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Учитель">
        <Select name="teacher_id" required defaultValue={defaultValues?.teacher_id ?? undefined}>
          <option value="" disabled>Выберите учителя</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
        <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60">
          {isPending ? "…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function GroupsView({
  groups,
  teachers,
  defaultOpenAdd,
}: {
  groups: Group[];
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

  const filtered = groups.filter((g) => {
    const q = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.subject.toLowerCase().includes(q) ||
      (g.teachers?.full_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Группы</h1>
        <button
          onClick={() => setModal({ kind: "add" })}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          <Plus className="h-4 w-4" />
          Создать группу
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
            placeholder="Поиск по названию или учителю…"
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none ring-1 ring-gray-200 focus:ring-amber-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Предмет</th>
                <th className="px-4 py-3">Учитель</th>
                <th className="px-4 py-3">Учеников</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Ничего не найдено</td>
                </tr>
              ) : (
                filtered.map((g) => {
                  const subjectLabel = subjects[g.subject]?.label ?? g.subject;
                  return (
                    <tr key={g.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-800">{g.name}</td>
                      <td className="px-4 py-3 text-gray-500">{subjectLabel}</td>
                      <td className="px-4 py-3 text-gray-500">{g.teachers?.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{g.student_groups.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setModal({ kind: "edit", group: g })} className="rounded-lg p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600" title="Редактировать">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setModal({ kind: "delete", group: g })} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Удалить">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal?.kind === "add" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="Создать группу" onClose={() => setModal(null)}>
            <GroupForm
              teachers={teachers}
              isPending={isPending}
              onClose={() => setModal(null)}
              onSubmit={(fd) => startTransition(async () => {
                try {
                  await actionCreateGroup(fd);
                  flash(`Группа «${fd.get("name")}» создана`);
                  setModal(null);
                } catch (e) {
                  flash("Ошибка: " + (e as Error).message);
                }
              })}
              submitLabel="Создать"
            />
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "edit" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="Редактировать группу" onClose={() => setModal(null)}>
            <GroupForm
              defaultValues={modal.group}
              teachers={teachers}
              isPending={isPending}
              onClose={() => setModal(null)}
              onSubmit={(fd) => {
                fd.append("group_id", modal.group.id);
                startTransition(async () => {
                  try {
                    await actionUpdateGroup(fd);
                    flash("Группа обновлена");
                    setModal(null);
                  } catch (e) {
                    flash("Ошибка: " + (e as Error).message);
                  }
                });
              }}
              submitLabel="Сохранить"
            />
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "delete" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title="Удалить группу" onClose={() => setModal(null)}>
            <p className="mb-2 text-sm text-gray-600">
              Удалить группу <strong>{modal.group.name}</strong>? Все уроки и оценки в ней будут удалены.
            </p>
            <p className="mb-6 text-xs font-semibold text-red-600">Это действие необратимо!</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">Отмена</button>
              <button
                onClick={() => startTransition(async () => {
                  try {
                    await actionDeleteGroup(modal.group.id);
                    flash("Группа удалена");
                    setModal(null);
                  } catch (e) {
                    flash("Ошибка: " + (e as Error).message);
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

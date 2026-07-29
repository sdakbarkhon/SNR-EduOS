"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Pencil, KeyRound, Trash2, Plus, X, RefreshCw } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import {
  actionCreateStudent,
  actionUpdateStudent,
  actionResetStudentPassword,
  actionDeleteStudent,
} from "../actions";

type Group = { id: string; name: string; subject: string };
type Student = {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  created_at: string;
  student_groups: Array<{ group_id: string; groups: { id: string; name: string; subject: string } | null }>;
};

type Modal =
  | { kind: "add" }
  | { kind: "edit"; student: Student }
  | { kind: "reset"; student: Student }
  | { kind: "delete"; student: Student };

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

export function StudentsView({
  students,
  groups,
  defaultOpenAdd,
}: {
  students: Student[];
  groups: Group[];
  defaultOpenAdd?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin;

  const [modal, setModal] = useState<Modal | null>(defaultOpenAdd ? { kind: "add" } : null);
  const [search, setSearch] = useState("");
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 5000);
  }

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const groupName = s.student_groups[0]?.groups?.name ?? "";
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.username.toLowerCase().includes(q) ||
      groupName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.studentsTitle}</h1>
        <button
          onClick={() => setModal({ kind: "add" })}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          {t.addStudentTitle}
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
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none ring-1 ring-gray-200 focus:ring-violet-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t.tableFullName}</th>
                <th className="px-4 py-3">{t.tableUsername}</th>
                <th className="px-4 py-3">{t.tableGroup}</th>
                <th className="px-4 py-3">{t.tableCreated}</th>
                <th className="px-4 py-3 text-right">{t.tableActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    {t.noResults}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const groupName = s.student_groups[0]?.groups?.name ?? "—";
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-800">{s.full_name}</td>
                      <td className="px-4 py-3 text-gray-500">@{s.username}</td>
                      <td className="px-4 py-3 text-gray-500">{groupName}</td>
                      <td className="px-4 py-3 text-gray-400">
                        {new Date(s.created_at).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setModal({ kind: "edit", student: s })}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600"
                            title={t.editBtn}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setModal({ kind: "reset", student: s })}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600"
                            title={t.resetPasswordBtn}
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setModal({ kind: "delete", student: s })}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            title={t.deleteBtn}
                          >
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

      {/* ADD MODAL */}
      {modal?.kind === "add" && (
        <Backdrop onClose={() => setModal(null)}>
          <AddStudentModal
            groups={groups}
            isPending={isPending}
            t={t}
            onClose={() => setModal(null)}
            onSubmit={async (fd) => {
              startTransition(async () => {
                try {
                  await actionCreateStudent(fd);
                  flash(
                    t.createdMsg
                      .replace("{username}", String(fd.get("username")))
                      .replace("{password}", String(fd.get("password"))),
                  );
                  setModal(null);
                } catch (e) {
                  flash(humanizeAdminError(e, locale as Locale));
                }
              });
            }}
          />
        </Backdrop>
      )}

      {/* EDIT MODAL */}
      {modal?.kind === "edit" && (
        <Backdrop onClose={() => setModal(null)}>
          <EditStudentModal
            student={modal.student}
            groups={groups}
            isPending={isPending}
            t={t}
            onClose={() => setModal(null)}
            onSubmit={async (fd) => {
              startTransition(async () => {
                try {
                  await actionUpdateStudent(fd);
                  flash(t.studentUpdatedMsg);
                  setModal(null);
                } catch (e) {
                  flash(humanizeAdminError(e, locale as Locale));
                }
              });
            }}
          />
        </Backdrop>
      )}

      {/* RESET PASSWORD MODAL */}
      {modal?.kind === "reset" && (
        <Backdrop onClose={() => setModal(null)}>
          <ResetPasswordModal
            student={modal.student}
            isPending={isPending}
            t={t}
            onClose={() => setModal(null)}
            onConfirm={() => {
              startTransition(async () => {
                try {
                  const newPwd = await actionResetStudentPassword(modal.student.user_id);
                  flash(t.passwordResetMsg.replace("{name}", modal.student.full_name).replace("{password}", newPwd));
                  setModal(null);
                } catch (e) {
                  flash(humanizeAdminError(e, locale as Locale));
                }
              });
            }}
          />
        </Backdrop>
      )}

      {/* DELETE MODAL */}
      {modal?.kind === "delete" && (
        <Backdrop onClose={() => setModal(null)}>
          <DeleteStudentModal
            student={modal.student}
            isPending={isPending}
            t={t}
            onClose={() => setModal(null)}
            onConfirm={() => {
              startTransition(async () => {
                try {
                  await actionDeleteStudent(modal.student.user_id);
                  flash(t.deletedMsg);
                  setModal(null);
                } catch (e) {
                  flash(humanizeAdminError(e, locale as Locale));
                }
              });
            }}
          />
        </Backdrop>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type AdminDict = ReturnType<typeof getDictionary>["admin"];

function ModalCard({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
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

function AddStudentModal({
  groups,
  isPending,
  t,
  onClose,
  onSubmit,
}: {
  groups: Group[];
  isPending: boolean;
  t: AdminDict;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [pwd, setPwd] = useState(() => generatePassword());

  return (
    <ModalCard title={t.addStudentTitle} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
        className="space-y-4"
      >
        <Field label={t.fieldFullName}>
          <Input name="full_name" required placeholder="Алишер Назаров" />
        </Field>
        <Field label={t.fieldUsername}>
          <Input name="username" required placeholder="alisher_07" autoCapitalize="none" />
        </Field>
        <Field label={t.fieldPassword}>
          <div className="flex gap-2">
            <Input
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
              {t.generatePassword}
            </button>
          </div>
        </Field>
        <Field label={t.fieldGroup}>
          <Select name="group_id" required defaultValue="">
            <option value="" disabled>{t.selectGroupPlaceholder}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            {t.cancelBtn}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {isPending ? t.creating : t.createBtn}
          </button>
        </div>
      </form>
    </ModalCard>
  );
}

function EditStudentModal({
  student,
  groups,
  isPending,
  t,
  onClose,
  onSubmit,
}: {
  student: Student;
  groups: Group[];
  isPending: boolean;
  t: AdminDict;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const currentGroupId = student.student_groups[0]?.groups?.id ?? "";

  return (
    <ModalCard title={t.editStudentTitle} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.append("student_id", student.id);
          fd.append("user_id", student.user_id);
          fd.append("old_group_id", currentGroupId);
          onSubmit(fd);
        }}
        className="space-y-4"
      >
        <Field label={t.fieldFullName}>
          <Input name="full_name" required defaultValue={student.full_name} />
        </Field>
        <Field label={t.fieldUsername}>
          <Input name="username" required defaultValue={student.username} autoCapitalize="none" />
        </Field>
        <Field label={t.fieldGroup}>
          <Select name="group_id" defaultValue={currentGroupId}>
            <option value="">{t.noGroupOption}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </Select>
        </Field>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
            {t.cancelBtn}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {isPending ? t.saving : t.saveBtn}
          </button>
        </div>
      </form>
    </ModalCard>
  );
}

function ResetPasswordModal({
  student,
  isPending,
  t,
  onClose,
  onConfirm,
}: {
  student: Student;
  isPending: boolean;
  t: AdminDict;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalCard title={t.resetPasswordTitle} onClose={onClose}>
      <p className="mb-6 text-sm text-gray-600">
        {t.resetPasswordConfirm.replace("{name}", student.full_name)} {t.resetPasswordHint}
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          {t.cancelBtn}
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {isPending ? t.resetting : t.resetBtn}
        </button>
      </div>
    </ModalCard>
  );
}

function DeleteStudentModal({
  student,
  isPending,
  t,
  onClose,
  onConfirm,
}: {
  student: Student;
  isPending: boolean;
  t: AdminDict;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalCard title={t.deleteStudentTitle} onClose={onClose}>
      <p className="mb-2 text-sm text-gray-600">
        {t.deleteStudentConfirm.replace("{name}", student.full_name)}
      </p>
      <p className="mb-6 text-xs font-semibold text-red-600">{t.deleteWarning}</p>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          {t.cancelBtn}
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? t.deleting : t.confirmDeleteBtn}
        </button>
      </div>
    </ModalCard>
  );
}

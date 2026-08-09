"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Pencil, KeyRound, Trash2, Plus, X, RefreshCw } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import {
  actionCreateTeacher,
  actionUpdateTeacher,
  actionResetTeacherPassword,
  actionDeleteTeacher,
  actionTeacherDeletionImpact,
  actionSetAssignmentTeacher,
} from "../actions";
import type { TeacherDeletionImpact } from "@/lib/admin-api";

/**
 * Честное подтверждение удаления. Z.2.3: раньше здесь стояли две
 * захардкоженные фразы — «удалить?» и «нельзя, если есть группы» — обе не
 * зависели от того, что у учителя на самом деле есть. Теперь диалог сначала
 * спрашивает сервер и показывает числа: что помешает и что уйдёт следом.
 */
function DeleteTeacherImpact({
  teacherId, t, onLoaded,
}: {
  teacherId: string;
  t: AdminDict;
  onLoaded: (impact: TeacherDeletionImpact | null) => void;
}) {
  const [impact, setImpact] = useState<TeacherDeletionImpact | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    onLoaded(null);
    actionTeacherDeletionImpact(teacherId)
      .then((res) => { if (alive) { setImpact(res); onLoaded(res); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
    // onLoaded — сеттер из useState родителя, стабилен между рендерами
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  if (failed) return <p className="mb-4 text-xs text-gray-500">{t.deleteWarning}</p>;
  if (!impact) return <p className="mb-4 text-xs text-gray-500">{t.impactLoading}</p>;

  const bindings = impact.assignments + impact.groupLinks + impact.curatorOf;
  const cascade = impact.curriculumPlans + impact.announcements;

  return (
    <div className="mb-4 space-y-2">
      {impact.lessons > 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {t.teacherHasLessonsShort
            .replace("{count}", String(impact.lessons))}
          {impact.lessonGroups.length > 0 && <><br />{impact.lessonGroups.slice(0, 4).join("; ")}</>}
        </p>
      )}
      {impact.gradedRecords > 0 && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {t.teacherHasGradesShort.replace("{count}", String(impact.gradedRecords))}
        </p>
      )}
      {!impact.blocked && bindings === 0 && cascade === 0 && (
        <p className="text-xs text-gray-500">{t.teacherDeleteClean}</p>
      )}
      {!impact.blocked && bindings > 0 && (
        <p className="text-xs text-gray-600">
          {t.teacherDeleteBindings
            .replace("{assignments}", String(impact.assignments))
            .replace("{groups}", String(impact.groupLinks))
            .replace("{curator}", String(impact.curatorOf))}
        </p>
      )}
      {!impact.blocked && cascade > 0 && (
        <p className="text-xs text-amber-700">
          {t.teacherDeleteCascade
            .replace("{plans}", String(impact.curriculumPlans))
            .replace("{announcements}", String(impact.announcements))}
        </p>
      )}
      {!impact.blocked && <p className="text-xs text-gray-600">{t.teacherDeleteAccount}</p>}
    </div>
  );
}

type Teacher = {
  id: string;
  user_id: string | null;
  full_name: string;
  username: string | null;
  created_at: string;
};

/** Z.2.4 — строка «предмет × группа», где учитель назначен. */
export type TeacherBindingRow = {
  assignmentId: string;
  subjectName: string;
  groupName: string;
  isCurator: boolean;
  /** Есть ли строка в group_teachers. Пусто — учитель не видит группу, и это
   *  ровно тот рассинхрон, ради которого делался Z.2.4. */
  seesGroup: boolean;
  lessons: number;
};

/** Что учитель ведёт и где. Снятие идёт тем же единым действием, что и
 *  назначение: `subjects.teacher_id` плюс `group_teachers`. Доступ к группе
 *  снимается, только если учитель в ней больше ничего не ведёт и не куратор —
 *  иначе снятие одного предмета отобрало бы всю группу. */
function TeacherBindings({
  rows, t, disabled, onUnassign,
}: {
  rows: TeacherBindingRow[];
  t: AdminDict;
  disabled: boolean;
  onUnassign: (assignmentId: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="mt-1 text-xs font-normal text-gray-400">{t.subjectsAndGroupsEmpty}</p>;
  }
  return (
    <ul className="mt-1.5 space-y-1">
      {rows.map((r) => (
        <li key={r.assignmentId} className="flex items-center gap-1.5 text-xs font-normal">
          <span className="text-gray-600">{r.groupName} · {r.subjectName}</span>
          {r.isCurator && (
            <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-600">{t.curatorBadge}</span>
          )}
          {!r.seesGroup && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">{t.seesGroupNo}</span>
          )}
          {r.lessons > 0 && (
            <span className="text-[10px] text-gray-400">{t.lessonsCount.replace("{n}", String(r.lessons))}</span>
          )}
          <button
            onClick={() => onUnassign(r.assignmentId)}
            disabled={disabled}
            className="rounded px-1 text-[10px] text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            {t.unassignBtn}
          </button>
        </li>
      ))}
    </ul>
  );
}

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
  bindings,
  defaultOpenAdd,
}: {
  teachers: Teacher[];
  /** Z.2.4 — что каждый ведёт, ключ = teacher.id. Считается на сервере. */
  bindings: Record<string, TeacherBindingRow[]>;
  defaultOpenAdd?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin;

  const [modal, setModal] = useState<Modal | null>(defaultOpenAdd ? { kind: "add" } : null);
  /** Что удаление затронет — приходит из DeleteTeacherImpact; кнопка
   *  «Удалить» гаснет, пока не посчитано, и остаётся погашенной, если нельзя. */
  const [impact, setImpact] = useState<TeacherDeletionImpact | null>(null);
  const [search, setSearch] = useState("");
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 5000);
  }

  const filtered = teachers.filter((tc) => {
    const q = search.toLowerCase();
    return tc.full_name.toLowerCase().includes(q) || (tc.username ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.teachersTitle}</h1>
        <button
          onClick={() => setModal({ kind: "add" })}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          {t.addTeacherTitle}
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
            placeholder={t.teachersSearchPlaceholder}
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none ring-1 ring-gray-200 focus:ring-emerald-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t.tableFullName}</th>
                <th className="px-4 py-3">{t.tableUsername}</th>
                <th className="px-4 py-3">{t.tableCreated}</th>
                <th className="px-4 py-3 text-right">{t.tableActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">{t.noResults}</td>
                </tr>
              ) : (
                filtered.map((tc) => (
                  <tr key={tc.id} className="align-top hover:bg-gray-50/60">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {tc.full_name}
                      <TeacherBindings
                        rows={bindings[tc.id] ?? []}
                        t={t}
                        disabled={isPending}
                        onUnassign={(assignmentId) => startTransition(async () => {
                          try {
                            await actionSetAssignmentTeacher(assignmentId, null);
                            flash(t.teacherUpdatedMsg);
                          } catch (e) {
                            flash(humanizeAdminError(e, locale as Locale));
                          }
                        })}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500">@{tc.username ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(tc.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setModal({ kind: "edit", teacher: tc })} className="rounded-lg p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600" title={t.editBtn}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setModal({ kind: "reset", teacher: tc })} className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600" title={t.resetPasswordBtn}>
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => setModal({ kind: "delete", teacher: tc })} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title={t.deleteBtn}>
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
          <ModalCard title={t.addTeacherTitle} onClose={() => setModal(null)}>
            <AddTeacherForm
              isPending={isPending}
              t={t}
              onClose={() => setModal(null)}
              onSubmit={(fd) => {
                startTransition(async () => {
                  try {
                    await actionCreateTeacher(fd);
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
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "edit" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={t.editTeacherTitle} onClose={() => setModal(null)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                fd.append("teacher_id", modal.teacher.id);
                fd.append("user_id", modal.teacher.user_id ?? "");
                startTransition(async () => {
                  try {
                    await actionUpdateTeacher(fd);
                    flash(t.teacherUpdatedMsg);
                    setModal(null);
                  } catch (e) {
                    flash(humanizeAdminError(e, locale as Locale));
                  }
                });
              }}
              className="space-y-4"
            >
              <Field label={t.fieldFullName}><Input name="full_name" required defaultValue={modal.teacher.full_name} /></Field>
              <Field label={t.fieldUsername}><Input name="username" required defaultValue={modal.teacher.username ?? ""} autoCapitalize="none" /></Field>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
                <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">
                  {isPending ? t.saving : t.saveBtn}
                </button>
              </div>
            </form>
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "reset" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={t.resetPasswordTitle} onClose={() => setModal(null)}>
            <p className="mb-6 text-sm text-gray-600">{t.resetPasswordConfirm.replace("{name}", modal.teacher.full_name)}</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
              <button
                onClick={() => startTransition(async () => {
                  try {
                    if (!modal.teacher.user_id) throw new Error("No user_id");
                    const pwd = await actionResetTeacherPassword(modal.teacher.user_id);
                    flash(t.passwordResetMsg.replace("{name}", modal.teacher.full_name).replace("{password}", pwd));
                    setModal(null);
                  } catch (e) {
                    flash(humanizeAdminError(e, locale as Locale));
                  }
                })}
                disabled={isPending}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {isPending ? t.resetting : t.resetBtn}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "delete" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={t.deleteTeacherTitle} onClose={() => setModal(null)}>
            <p className="mb-3 text-sm text-gray-600">{t.deleteTeacherConfirm.replace("{name}", modal.teacher.full_name)}</p>
            <DeleteTeacherImpact teacherId={modal.teacher.id} t={t} onLoaded={setImpact} />
            <p className="mb-6 text-xs font-semibold text-red-600">{t.deleteWarning}</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
              <button
                onClick={() => startTransition(async () => {
                  try {
                    await actionDeleteTeacher(modal.teacher.id, modal.teacher.user_id ?? "");
                    flash(t.teacherDeletedMsg);
                    setModal(null);
                  } catch (e) {
                    flash(humanizeAdminError(e, locale as Locale));
                  }
                })}
                disabled={isPending || impact?.blocked === true}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isPending ? t.deleting : t.confirmDeleteBtn}
              </button>
            </div>
          </ModalCard>
        </Backdrop>
      )}
    </div>
  );
}

type AdminDict = ReturnType<typeof getDictionary>["admin"];

function AddTeacherForm({
  isPending,
  t,
  onClose,
  onSubmit,
}: {
  isPending: boolean;
  t: AdminDict;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [pwd, setPwd] = useState(() => generatePassword());
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-4"
    >
      <Field label={t.fieldFullName}><Input name="full_name" required placeholder="Анна Смирнова" /></Field>
      <Field label={t.fieldUsername}><Input name="username" required placeholder="teacher_anna" autoCapitalize="none" /></Field>
      <Field label={t.fieldPassword}>
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
            {t.generatePassword}
          </button>
        </div>
      </Field>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
        <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
          {isPending ? t.creating : t.createBtn}
        </button>
      </div>
    </form>
  );
}

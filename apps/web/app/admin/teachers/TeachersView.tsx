"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Pencil, KeyRound, Trash2, Plus, X, RefreshCw } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GoogleEmailField } from "@/components/admin/GoogleEmailField";
import { origName } from "@/lib/form-patch";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { useSubmitGuard } from "@/lib/use-submit-guard";
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
    unwrap(actionTeacherDeletionImpact(teacherId))
      .then((res) => { if (alive) { setImpact(res); onLoaded(res); } })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
    // onLoaded — сеттер из useState родителя, стабилен между рендерами
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  if (failed) return <p className="mb-4 text-xs text-gray-500">{t.deleteWarning}</p>;
  if (!impact) return <p className="mb-4 text-xs text-gray-500">{t.impactLoading}</p>;

  // 30.08.2026 — impact.curatorOf из суммы убран: кураторства больше нет,
  // groups.teacher_id пуст у всех групп (миграция 242).
  const bindings = impact.assignments + impact.groupLinks;
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
            .replace("{groups}", String(impact.groupLinks))}
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
  /**
   * Почта Google для входа (миграция 213).
   *
   * 20.08.2026 — БЫЛО googleEmail, ровно та же беда, что на экране учеников и
   * что была у администраторов (коммит 6b57543). Страница отдаёт строку как
   * есть из базы, там колонка google_email; тип здесь написан руками, и
   * camelCase давал вечный undefined: поле рисовалось пустым, а сохранение
   * писало пустоту поверх настоящей почты, отвязывая учителю вход через
   * Google. Компилятор молчит — тип рукописный, объект приходит переменной.
   */
  google_email?: string | null;
  /** Телефон и описание: колонки были всегда, заполнить их было негде. */
  phone: string | null;
  bio: string | null;
  created_at: string;
};

/** Z.2.4 — строка «предмет × группа», где учитель назначен. */
export type TeacherBindingRow = {
  assignmentId: string;
  subjectName: string;
  groupName: string;
  // 30.08.2026 — поля isCurator здесь больше нет: роль убрана из продукта,
  // значок «куратор» рядом с назначением показывать нечему.
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
  /** Строка целиком, а не один идентификатор: сообщение должно назвать
   *  предмет и группу, а они здесь уже есть — доставать нечего. */
  onUnassign: (row: TeacherBindingRow) => void;
}) {
  if (rows.length === 0) {
    // Раньше здесь была только констатация «Пока ничего не ведёт». Она не
    // говорила, что учитель поэтому и видит пустой кабинет, и куда идти, чтобы
    // это исправить. Даём ссылку прямо на «Назначения».
    return (
      <p className="mt-1 text-xs font-normal text-gray-400">
        {t.subjectsAndGroupsEmpty}{" "}
        <Link href="/admin/subject-assignments" className="font-medium text-violet-600 hover:underline">
          {t.subjectsAndGroupsEmptyCta}
        </Link>
      </p>
    );
  }
  return (
    <ul className="mt-1.5 space-y-1">
      {rows.map((r) => (
        <li key={r.assignmentId} className="flex items-center gap-1.5 text-xs font-normal">
          <span className="text-gray-600">{r.groupName} · {r.subjectName}</span>
          {!r.seesGroup && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">{t.seesGroupNo}</span>
          )}
          {r.lessons > 0 && (
            <span className="text-[10px] text-gray-400">{t.lessonsCount.replace("{n}", String(r.lessons))}</span>
          )}
          <button
            onClick={() => onUnassign(r)}
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

/** Тот же вид, что у Input — на экране учеников он объявлен так же. */
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        props.className ??
        "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
      }
    />
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
  catalog,
  groups,
  defaultOpenAdd,
  /**
   * Школа, в которой идёт работа. Срез 3b, роль менеджера.
   *
   * НЕ ПЕРЕДАНО — ничего не меняется: форма уходит байт в байт прежней,
   * доводы прежние, школу подставляют правила доступа. Так работает админ.
   *
   * ПЕРЕДАНО — школа кладётся в каждую форму и в каждый довод. Так работает
   * менеджер: своей школы у него нет, и подставить её некому.
   */
  schoolId,
}: {
  teachers: Teacher[];
  /** Z.2.4 — что каждый ведёт, ключ = teacher.id. Считается на сервере. */
  bindings: Record<string, TeacherBindingRow[]>;
  /** Справочник предметов школы и её группы — для блока «Предметы». */
  catalog: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  defaultOpenAdd?: boolean;
  schoolId?: string;
}) {
  /** Дописать школу в форму. Без неё форма остаётся прежней. */
  const сШколой = (fd: FormData) => {
    if (schoolId) fd.set("school_id", schoolId);
    return fd;
  };

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
  // Z.2.9 — второй клик до перерисовки больше не создаёт вторую запись.
  const guard = useSubmitGuard();

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 5000);
  }

  // «Ничего не найдено» — ответ на поиск. Пустая школа требует другого
  // текста: что здесь будет и с чего начать.
  const emptyText = search.trim() ? t.noResults : t.emptyTeachers;

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
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">{emptyText}</td>
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
                        onUnassign={(row) => startTransition(async () => {
                          try {
                            // 03.09.2026, пункт 103. Здесь стояло
                            // «Данные учителя обновлены» — та же строка, что
                            // после правки карточки учителя. Одно сообщение на
                            // два разных события: человек не мог отличить
                            // «переименовал учителя» от «снял с него предмет».
                            //
                            // Теперь сообщение называет, ЧТО снято, и —
                            // отдельной фразой — потерял ли учитель доступ к
                            // группе. Второе не считается лишним запросом:
                            // setAssignmentTeacher и так выполняет удаление из
                            // group_teachers, просто раньше его результат
                            // выбрасывался, а теперь возвращается.
                            const res = await unwrap(actionSetAssignmentTeacher(row.assignmentId, null));
                            const шаблон = res?.lostGroupAccess
                              ? t.unassignedLostGroupMsg
                              : t.unassignedMsg;
                            flash(
                              шаблон
                                .replace("{subject}", row.subjectName)
                                .replace("{group}", row.groupName),
                            );
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
              catalog={catalog}
              groups={groups}
              isPending={isPending}
              t={t}
              onClose={() => setModal(null)}
              onSubmit={(fd) => {
                guard(startTransition, async () => {
                  try {
                    const res = await unwrap(actionCreateTeacher(сШколой(fd)));
                    // Сообщение говорит «Учитель создан» — раньше здесь стояла
                    // фраза про ученика, чинили это отдельным заходом. Плюс
                    // число назначенных предметов: админ должен видеть, что
                    // блок «Предметы» сработал, а не гадать.
                    const назначено = res?.assigned ?? 0;
                    flash(
                      t.teacherCreatedMsg
                        .replace("{username}", String(fd.get("username")))
                        .replace("{password}", String(fd.get("password")))
                      + (назначено > 0
                        ? ". " + t.assignedCountMsg.replace("{n}", String(назначено))
                        : "")
                      + отказПредмета(res?.failed, t, locale as Locale),
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
                    const res = await unwrap(actionUpdateTeacher(сШколой(fd)));
                    const назначено = res?.assigned ?? 0;
                    flash(
                      t.teacherUpdatedMsg
                      + (назначено > 0
                        ? ". " + t.assignedCountMsg.replace("{n}", String(назначено))
                        : "")
                      + отказПредмета(res?.failed, t, locale as Locale),
                    );
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
              {/* Скрытое поле с исходным значением: по нему сервер отличит
                  «не трогал» от «стёр нарочно». Разбор — lib/form-patch.ts. */}
              <input type="hidden" name={origName("google_email")} defaultValue={modal.teacher.google_email ?? ""} />
              <GoogleEmailField defaultValue={modal.teacher.google_email} placeholder="anna@gmail.com" />
              <Field label={t.fieldTeacherPhone}>
                <Input name="phone" type="tel" defaultValue={modal.teacher.phone ?? ""} placeholder="+998 90 123-45-67" />
              </Field>
              <Field label={t.fieldTeacherBio}>
                <Input name="bio" defaultValue={modal.teacher.bio ?? ""} />
              </Field>
              {/* Блок добавляет НОВЫЕ назначения. Уже существующие снимаются
                  списком под учителем и правятся на экране «Назначения» —
                  второй способ править одно и то же тут не заводим. */}
              <SubjectAssignmentRows
                t={t}
                catalog={catalog}
                groups={groups}
                hasExisting={(bindings[modal.teacher.id]?.length ?? 0) > 0}
              />
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
                    const pwd = await unwrap(actionResetTeacherPassword(modal.teacher.user_id, schoolId));
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
                    await unwrap(actionDeleteTeacher(modal.teacher.id, modal.teacher.user_id ?? "", schoolId));
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

/**
 * Блок «Предметы» — назначения прямо в окне учителя.
 *
 * ЗАЧЕМ ОН ЗДЕСЬ. Раньше предмет назначался на отдельном экране, и
 * пропустить этот шаг было легко: учитель заведён, а уроков не видит. Это
 * было состоянием по умолчанию — так живёт один из десяти учителей в базе.
 *
 * ПОЧЕМУ НЕ ОБЯЗАТЕЛЬНЫЙ. Учителя заводят и без предмета — например,
 * куратора класса. Но если ни одна строка не заполнена, окно говорит об
 * этом прямо: молчание админ прочитал бы как «всё в порядке».
 *
 * Поля всех строк называются одинаково (assign_catalog / assign_group) —
 * именно так браузер шлёт повторяющиеся имена, а сервер читает их парами
 * (см. readTeacherAssignments в actions.ts).
 */
/**
 * Хвост сообщения про НЕ назначенный предмет.
 *
 * Учитель к этому моменту уже заведён, и молчать о причине нельзя: без
 * неё админ решит, что предмет назначился. Показываем причину первого
 * отказа — они почти всегда одинаковы (пара «предмет × группа» занята).
 */
function отказПредмета(failed: string[] | undefined, t: AdminDict, locale: Locale): string {
  if (!failed?.length) return "";
  return ". " + t.assignFailedMsg.replace(
    "{reason}",
    humanizeAdminError(new Error(failed[0]), locale),
  );
}

function SubjectAssignmentRows({
  t,
  catalog,
  groups,
  hasExisting,
}: {
  t: AdminDict;
  catalog: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  /** Ведёт ли учитель что-то УЖЕ. В окне правки предупреждение о пустом
   *  предмете иначе врёт: у человека три предмета, а окно говорит, что
   *  он не увидит уроков. Найдено живой проверкой на Elena Sokolova. */
  hasExisting?: boolean;
}) {
  const [rows, setRows] = useState<Array<{ catalog: string; group: string }>>([{ catalog: "", group: "" }]);
  const anyComplete = rows.some((r) => r.catalog && r.group);

  const setRow = (i: number, patch: Partial<{ catalog: string; group: string }>) =>
    setRows((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
      <div className="text-sm font-semibold text-gray-700">{t.sectionSubjects}</div>
      <p className="text-xs text-gray-400">{t.subjectsHint}</p>
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[9rem] flex-1">
            <Select
              name="assign_catalog"
              value={row.catalog}
              onChange={(e) => setRow(i, { catalog: e.target.value })}
            >
              <option value="">{t.assignmentsPickSubject}</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="min-w-[9rem] flex-1">
            <Select
              name="assign_group"
              value={row.group}
              onChange={(e) => setRow(i, { group: e.target.value })}
            >
              <option value="">{t.assignmentsPickGroup}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </Select>
          </div>
          {rows.length > 1 ? (
            <button
              type="button"
              onClick={() => setRows((prev) => prev.filter((_, k) => k !== i))}
              className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200"
            >
              {t.removeSubjectRow}
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { catalog: "", group: "" }])}
        className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200"
      >
        + {t.addSubjectRow}
      </button>
      {/* Предупреждение, а не запрет: учителя без предмета заводить можно.
          Молчит, если предметы у него уже есть: тогда пустой блок означает
          «ничего не добавляю», а не «останется без уроков». */}
      {!anyComplete && !hasExisting ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{t.noSubjectWarning}</p>
      ) : null}
    </div>
  );
}

function AddTeacherForm({
  isPending,
  t,
  catalog,
  groups,
  onClose,
  onSubmit,
}: {
  isPending: boolean;
  t: AdminDict;
  catalog: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
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
      <GoogleEmailField placeholder="anna@gmail.com" />
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
      <Field label={t.fieldTeacherPhone}><Input name="phone" type="tel" placeholder="+998 90 123-45-67" /></Field>
      <Field label={t.fieldTeacherBio}><Input name="bio" placeholder="" /></Field>
      <SubjectAssignmentRows t={t} catalog={catalog} groups={groups} />
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
        <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
          {isPending ? t.creating : t.createBtn}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Pencil, KeyRound, Trash2, Plus, X, RefreshCw, Wallet } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GoogleEmailField } from "@/components/admin/GoogleEmailField";
import { origName } from "@/lib/form-patch";
import { gradeFromGroupName } from "@/lib/group-grade";
import { formatCoursePriceInput, formatSum } from "@/lib/course-price";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { useSubmitGuard } from "@/lib/use-submit-guard";
import {
  actionCreateStudent,
  actionUpdateStudent,
  actionResetStudentPassword,
  actionTopUpStudentBalance,
  actionDeleteStudent,
} from "../actions";

type Group = { id: string; name: string; subject: string };
type Student = {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  /**
   * Почта Google для входа (миграция 213).
   *
   * 20.08.2026 — БЫЛО googleEmail, И ЭТО ПОРТИЛО ДАННЫЕ. Страница отдаёт
   * строку как есть из базы, там колонка называется google_email. Тип здесь
   * объявлен руками, и в нём стояло camelCase — значит student.googleEmail
   * всегда было undefined, поле в форме рисовалось пустым, а сохранение
   * писало эту пустоту поверх настоящей почты. Каждое «Сохранить» отвязывало
   * ученику вход через Google.
   *
   * TypeScript такое не ловит: тип написан вручную и компилятор верит ему на
   * слово, а объект приходит переменной, а не литералом, поэтому проверка
   * лишних свойств не срабатывает. Единственная защита — совпадение имён с
   * тем, что реально приходит из базы. Остальные поля тут в snake_case ровно
   * поэтому.
   *
   * Вторая половина починки — в actions.ts: запись идёт только если почту
   * правда меняли (lib/form-patch.ts).
   */
  google_email?: string | null;
  /** Баланс ученика. Из базы приходит строкой: numeric(…, 2) в JSON —
   *  строка, а не число, иначе длинные суммы теряли бы точность. */
  balance: string | number;
  created_at: string;
  student_groups: Array<{ group_id: string; groups: { id: string; name: string; subject: string } | null }>;
};

type Modal =
  | { kind: "add" }
  | { kind: "edit"; student: Student }
  | { kind: "reset"; student: Student }
  | { kind: "topup"; student: Student }
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
  // Z.2.9 — второй клик до перерисовки больше не создаёт вторую запись.
  const guard = useSubmitGuard();

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 5000);
  }

  // Пустой список и «поиск ничего не нашёл» — разные вещи. Раньше оба
  // показывали «Ничего не найдено»: в новой школе это выглядело как поломка,
  // а не как «здесь пока пусто, начните отсюда».
  const noGroups = groups.length === 0;
  const emptyText = search.trim()
    ? t.noResults
    : noGroups ? t.emptyStudentsNeedGroup : t.emptyStudents;

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
        {/* Форма ученика требует группу — без единой группы она открывается
            пустой, и выбрать в ней нечего. Выключаем кнопку и подписываем
            причину, вместо того чтобы вести человека в тупик. */}
        <button
          onClick={() => setModal({ kind: "add" })}
          disabled={noGroups}
          title={noGroups ? t.needGroupFirst : undefined}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-violet-600"
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
                <th className="px-4 py-3">{t.tableGrade}</th>
                <th className="px-4 py-3">{t.tableBalance}</th>
                <th className="px-4 py-3">{t.tableCreated}</th>
                <th className="px-4 py-3 text-right">{t.tableActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const groupName = s.student_groups[0]?.groups?.name ?? "—";
                  // Z.2.7 — класс выводится из группы (решение заказчика 6.6).
                  // Отдельного поля в форме нет и не появится; колонка
                  // students.grade остаётся нетронутой — на её значениях
                  // работает подбор демо-слотов (claim_demo_slot).
                  const grade = gradeFromGroupName(s.student_groups[0]?.groups?.name);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-800">{s.full_name}</td>
                      <td className="px-4 py-3 text-gray-500">@{s.username}</td>
                      <td className="px-4 py-3 text-gray-500">{groupName}</td>
                      <td className="px-4 py-3 text-gray-500">{grade ?? t.gradeFromGroupUnknown}</td>
                      {/* Ноль здесь значит ровно ноль денег, а не «не задано»
                          (в отличие от цены класса), поэтому пишем числом. */}
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {formatSum(Number(s.balance ?? 0))} {t.sumUnit}
                      </td>
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
                            onClick={() => setModal({ kind: "topup", student: s })}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"
                            title={t.topUpBalanceBtn}
                          >
                            <Wallet className="h-4 w-4" />
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
              guard(() => startTransition(async () => {
                try {
                  await unwrap(actionCreateStudent(fd));
                  flash(
                    t.createdMsg
                      .replace("{username}", String(fd.get("username")))
                      .replace("{password}", String(fd.get("password"))),
                  );
                  setModal(null);
                } catch (e) {
                  flash(humanizeAdminError(e, locale as Locale));
                }
              }));
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
                  await unwrap(actionUpdateStudent(fd));
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
                  const newPwd = await unwrap(actionResetStudentPassword(modal.student.user_id));
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

      {/* TOP-UP MODAL — заход 3 по платежам. */}
      {modal?.kind === "topup" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard
            title={t.topUpBalanceTitle.replace("{name}", modal.student.full_name)}
            onClose={() => setModal(null)}
          >
            <TopUpForm
              student={modal.student}
              t={t}
              isPending={isPending}
              onClose={() => setModal(null)}
              onSubmit={(fd) => startTransition(async () => {
                try {
                  await unwrap(actionTopUpStudentBalance(fd));
                  flash(
                    t.balanceToppedUpMsg
                      .replace("{name}", modal.student.full_name)
                      .replace("{amount}", `${String(fd.get("amount"))} ${t.sumUnit}`),
                  );
                  setModal(null);
                } catch (e) {
                  flash(humanizeAdminError(e, locale as Locale));
                }
              })}
            />
          </ModalCard>
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
                  await unwrap(actionDeleteStudent(modal.student.user_id));
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

/**
 * Пополнение баланса рукой админа. Заход 3 по платежам: пока кассы нет, это
 * единственный способ положить деньги на баланс, и им же проверяется вся
 * цепочка «цена класса → счёт → погашение».
 *
 * Сумма набирается тем же полем, что цена группы: всё, кроме цифр, в него не
 * попадает, а «500 000» с пробелами читается верно. Правило чтения одно —
 * lib/course-price.ts, и сервер разбирает строку тем же кодом.
 *
 * Причина обязательна. Движение по балансу отменить нельзя — журнал только
 * пополняется (миграция 227), — и через месяц «откуда эти деньги» будет
 * некому объяснить, если причину не записать сейчас.
 */
function TopUpForm({
  student,
  t,
  isPending,
  onClose,
  onSubmit,
}: {
  student: Student;
  t: ReturnType<typeof getDictionary>["admin"];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [amount, setAmount] = useState("");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-4"
    >
      <input type="hidden" name="student_id" value={student.id} />
      <Field label={t.fieldTopUpAmount}>
        <Input
          name="amount"
          value={amount}
          onChange={(e) => setAmount(formatCoursePriceInput(e.target.value))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="500 000"
          required
        />
        <p className="text-xs text-gray-400">{t.topUpHint}</p>
      </Field>
      <Field label={t.fieldTopUpReason}>
        <Input name="note" required placeholder={t.topUpReasonPlaceholder} />
      </Field>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          {t.cancelBtn}
        </button>
        <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
          {isPending ? "…" : t.topUpBtn}
        </button>
      </div>
    </form>
  );
}

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
        {/* Один блок на все роли — см. components/admin/GoogleEmailField.tsx.
            Раньше здесь стояло голое поле без единого слова о том, зачем оно. */}
        <GoogleEmailField placeholder="alisher@gmail.com" />
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
        {/* Скрытое поле с исходным значением — по нему сервер поймёт, трогали
            почту или нет, и не станет писать колонку впустую. Разбор приёма:
            lib/form-patch.ts. */}
        <input type="hidden" name={origName("google_email")} defaultValue={student.google_email ?? ""} />
        <GoogleEmailField defaultValue={student.google_email} placeholder="alisher@gmail.com" />
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

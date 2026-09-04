"use client";

import { useState, useTransition } from "react";
import { Building2, Plus, Pencil, X, Trash2, Merge, Loader2 } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { ModalPortal } from "@/components/ModalPortal";
import {
  actionCreateDepartment,
  actionRenameDepartment,
  actionDepartmentImpact,
  actionDeleteDepartment,
  actionMergeDepartments,
} from "../actions";

/**
 * КАФЕДРЫ ШКОЛЫ. 05.09.2026, миграция 255.
 *
 * Кафедра завелась сущностью в базе, но управлять ею было нечем: при переезде
 * каждый предмет получил свою кафедру с тем же именем, а решение заказчика
 * звучало «админ сольёт две в одну, когда захочет». Без этого экрана слияние
 * делалось только руками в базе.
 *
 * ЧЕТЫРЕ ДЕЙСТВИЯ И НИ ОДНОГО ЛИШНЕГО: список, переименование, слияние,
 * удаление пустой. Значка и цвета у кафедры нет намеренно — она не предмет;
 * вид на экранах по-прежнему берётся у предмета.
 *
 * ПЕРЕД СЛИЯНИЕМ ПОКАЗЫВАЕМ, ЧТО ПЕРЕЕДЕТ. Числа спрашиваются у сервера
 * заново, а не берутся с карточки: пока админ смотрел на список, коллега мог
 * положить материал. Карточка — подсказка, решение принимается по свежим
 * числам.
 *
 * УДАЛИТЬ НЕПУСТУЮ НЕ ДАСТ БАЗА (ON DELETE RESTRICT). Это защита, а не
 * помеха, поэтому отказ говорит не «нельзя», а сколько именно предметов и
 * материалов держат кафедру и что с этим делать.
 */

export type DepartmentRow = {
  id: string;
  name: string;
  subjects: number;
  materials: number;
};

type ModalState =
  | { mode: "none" }
  | { mode: "add" }
  | { mode: "rename"; row: DepartmentRow }
  | { mode: "merge"; row: DepartmentRow };

export function AdminDepartmentsView({
  departments,
  schoolId,
}: {
  departments: DepartmentRow[];
  /** Школа приходит ТОЛЬКО у менеджера: своей у него нет. Админ её не шлёт. */
  schoolId?: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;

  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [isPending, startTransition] = useTransition();
  const [formName, setFormName] = useState("");
  const [formError, setFormError] = useState("");
  const [mergeTargetId, setMergeTargetId] = useState("");

  function openAdd() {
    setFormName(""); setFormError("");
    setModal({ mode: "add" });
  }
  function openRename(row: DepartmentRow) {
    setFormName(row.name); setFormError("");
    setModal({ mode: "rename", row });
  }
  function openMerge(row: DepartmentRow) {
    setFormError("");
    setMergeTargetId(departments.find((x) => x.id !== row.id)?.id ?? "");
    setModal({ mode: "merge", row });
  }

  function handleSave() {
    const name = formName.trim();
    if (!name) { setFormError(d.departmentsEnterName); return; }
    setFormError("");
    startTransition(async () => {
      try {
        if (modal.mode === "add") await unwrap(actionCreateDepartment(name, schoolId));
        else if (modal.mode === "rename") await unwrap(actionRenameDepartment(modal.row.id, name, schoolId));
        setModal({ mode: "none" });
      } catch (e) {
        setFormError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  /** Слияние. Сначала спрашиваем сервер, что переедет, и показываем числа. */
  function handleMerge() {
    if (modal.mode !== "merge") return;
    const from = modal.row;
    const to = departments.find((x) => x.id === mergeTargetId);
    if (!to) { setFormError(d.departmentsPickTarget); return; }
    setFormError("");
    startTransition(async () => {
      try {
        const impact = await unwrap(actionDepartmentImpact(from.id, schoolId));
        const текст = d.departmentsMergeConfirm
          .replace("{from}", from.name)
          .replace("{to}", to.name)
          .replace("{subjects}", String(impact.subjects))
          .replace("{materials}", String(impact.materials));
        if (!confirm(текст)) return;
        await unwrap(actionMergeDepartments(from.id, to.id, schoolId));
        setModal({ mode: "none" });
      } catch (e) {
        setFormError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  /** Удаление. Пустую — после подтверждения; непустую база и не отдаст,
   *  поэтому отказ показываем ДО похода в неё, с числами. */
  function handleDelete(row: DepartmentRow) {
    startTransition(async () => {
      try {
        const impact = await unwrap(actionDepartmentImpact(row.id, schoolId));
        if (impact.blocked) {
          // Текст отказа один на все точки входа — тот же, что вернул бы
          // сервер, если бы удаление всё-таки поехало. Второй фразы про то же
          // самое здесь не заводим.
          alert(humanizeAdminError(
            new Error(`BLOCKED_DEPARTMENT_IN_USE:${impact.subjects}:${impact.materials}`),
            locale as Locale,
          ));
          return;
        }
        if (!confirm(d.departmentsDeleteConfirm.replace("{name}", row.name))) return;
        await unwrap(actionDeleteDepartment(row.id, schoolId));
      } catch (e) {
        alert(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-900">
            <Building2 className="h-6 w-6 text-zinc-400" />
            {d.departmentsTitle}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{d.departmentsSubtitle}</p>
        </div>
        <button
          onClick={openAdd}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {d.departmentsAdd}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {departments.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">{d.departmentsEmpty}</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {departments.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-900">{row.name}</span>
                  <span className="block text-xs text-zinc-500">
                    {d.departmentsSubjectsCount.replace("{count}", String(row.subjects))}
                    {" · "}
                    {d.departmentsMaterialsCount.replace("{count}", String(row.materials))}
                  </span>
                </span>

                <button
                  onClick={() => openRename(row)}
                  disabled={isPending}
                  title={d.departmentsEdit}
                  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-60"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {departments.length > 1 && (
                  <button
                    onClick={() => openMerge(row)}
                    disabled={isPending}
                    title={d.departmentsMerge}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-60"
                  >
                    <Merge className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(row)}
                  disabled={isPending}
                  title={d.departmentsDelete}
                  className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modal.mode !== "none" && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-100 p-5">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {modal.mode === "add" ? d.departmentsAdd
                    : modal.mode === "rename" ? d.departmentsEdit
                    : d.departmentsMerge}
                </h2>
                <button
                  onClick={() => setModal({ mode: "none" })}
                  className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {modal.mode === "merge" ? (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">
                      {d.departmentsMergeInto.replace("{name}", modal.row.name)}
                    </label>
                    <select
                      value={mergeTargetId}
                      onChange={(e) => setMergeTargetId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
                    >
                      {departments.filter((x) => x.id !== modal.row.id).map((x) => (
                        <option key={x.id} value={x.id}>{x.name}</option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-zinc-500">{d.departmentsMergeHint}</p>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">{d.departmentsName}</label>
                    <input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
                      autoFocus
                    />
                  </div>
                )}

                {formError && <p className="text-sm text-red-600">{formError}</p>}
              </div>

              <div className="flex justify-end gap-2 border-t border-zinc-100 p-5">
                <button
                  onClick={() => setModal({ mode: "none" })}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  {d.cancelBtn}
                </button>
                <button
                  onClick={modal.mode === "merge" ? handleMerge : handleSave}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {modal.mode === "merge" ? d.departmentsMerge : d.saveBtn}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

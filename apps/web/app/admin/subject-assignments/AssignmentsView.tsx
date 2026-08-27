"use client";

import { useState, useMemo, useTransition } from "react";
import { Layers, Plus, Pencil, Trash2, X, Check, Loader2, Info } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import { LUCIDE_ICONS } from "@/lib/subject-icons";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import {
  actionCreateSubjectAssignment,
  actionUpdateSubjectAssignment,
  actionDeleteSubjectAssignment,
  actionCreateSchoolSubject,
} from "../actions";

// Z.2.2 — «кто что где ведёт». Одна строка = один предмет в одной группе с
// одним учителем.
//
// Z.2.4 — назначение учителя здесь пишет уже все поверхности сразу:
// subjects.teacher_id (право вести), group_teachers (доступ к группе) и, в
// реальных школах, teachers.subject_slug при первом назначении. Логика в
// createSubjectAssignment/updateSubjectAssignment (lib/admin-api.ts), форма
// не изменилась.
//
// Z.2.3 — удаление назначения теперь отклоняется сервером, если на нём висят
// уроки, задания или учебный план; humanizeAdminError превращает отказ в
// фразу с числами.

export type Assignment = {
  id: string;
  name: string;
  icon: string;
  color: string;
  catalog_id: string | null;
  group_id: string;
  teacher_id: string | null;
  group: { id: string; name: string } | null;
  teacher: { id: string; full_name: string } | null;
};
export type CatalogItem = { id: string; name: string; icon: string; color: string; is_active: boolean };
type Group = { id: string; name: string };
type Teacher = { id: string; full_name: string };

type ModalState =
  | { mode: "none" }
  | { mode: "add" }
  | { mode: "edit"; row: Assignment }
  | { mode: "delete"; row: Assignment };

const NEW_SUBJECT = "__new__";

function SubjectGlyph({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = LUCIDE_ICONS[name] ?? LUCIDE_ICONS.BookOpen!;
  return <Icon size={size} className={className} />;
}

export function AssignmentsView({
  assignments, catalog, groups, teachers, defaultOpenAdd,
}: {
  assignments: Assignment[];
  catalog: CatalogItem[];
  groups: Group[];
  teachers: Teacher[];
  defaultOpenAdd?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;

  const [modal, setModal] = useState<ModalState>(defaultOpenAdd ? { mode: "add" } : { mode: "none" });
  const [isPending, startTransition] = useTransition();

  // Filters
  const [fGroup, setFGroup] = useState("");
  const [fCatalog, setFCatalog] = useState("");
  const [fTeacher, setFTeacher] = useState("");

  // Form
  const [formCatalogId, setFormCatalogId] = useState("");
  const [formNewName, setFormNewName] = useState("");
  const [formGroupId, setFormGroupId] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formError, setFormError] = useState("");

  // Скрытые предметы не предлагаются при создании — но если назначение уже
  // ссылается на скрытый, он остаётся в списке при редактировании, иначе
  // сохранение молча переключило бы предмет.
  const activeCatalog = useMemo(() => catalog.filter((c) => c.is_active), [catalog]);
  const pickerCatalog = useMemo(() => {
    if (modal.mode !== "edit" || !modal.row.catalog_id) return activeCatalog;
    const current = catalog.find((c) => c.id === modal.row.catalog_id);
    return current && !current.is_active ? [current, ...activeCatalog] : activeCatalog;
  }, [modal, catalog, activeCatalog]);

  const rows = useMemo(() => assignments.filter((a) =>
    (!fGroup || a.group_id === fGroup)
    && (!fCatalog || a.catalog_id === fCatalog)
    && (!fTeacher || a.teacher_id === fTeacher),
  ), [assignments, fGroup, fCatalog, fTeacher]);

  function openAdd() {
    setFormCatalogId(""); setFormNewName(""); setFormGroupId(""); setFormTeacherId(""); setFormError("");
    setModal({ mode: "add" });
  }

  function openEdit(row: Assignment) {
    setFormCatalogId(row.catalog_id ?? ""); setFormNewName("");
    setFormGroupId(row.group_id); setFormTeacherId(row.teacher_id ?? ""); setFormError("");
    setModal({ mode: "edit", row });
  }

  function handleSave() {
    const creatingNew = formCatalogId === NEW_SUBJECT;
    if (creatingNew && !formNewName.trim()) { setFormError(d.subjectsEnterName); return; }
    if (!creatingNew && !formCatalogId) { setFormError(d.assignmentsPickSubject); return; }
    if (!formGroupId) { setFormError(d.assignmentsPickGroup); return; }
    setFormError("");

    startTransition(async () => {
      try {
        // «Создать новый» — предмет заводится в справочнике прямо отсюда и
        // сразу используется, без ухода со страницы.
        let catalogId = formCatalogId;
        if (creatingNew) {
          const nf = new FormData();
          nf.set("name", formNewName.trim());
          catalogId = await unwrap(actionCreateSchoolSubject(nf));
        }

        const fd = new FormData();
        fd.set("catalog_id", catalogId);
        fd.set("group_id", formGroupId);
        fd.set("teacher_id", formTeacherId);
        if (modal.mode === "edit") {
          fd.set("id", modal.row.id);
          await unwrap(actionUpdateSubjectAssignment(fd));
        } else {
          await unwrap(actionCreateSubjectAssignment(fd));
        }
        setModal({ mode: "none" });
      } catch (e) {
        setFormError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  function handleDelete() {
    if (modal.mode !== "delete") return;
    const id = modal.row.id;
    startTransition(async () => {
      try {
        await unwrap(actionDeleteSubjectAssignment(id));
        setModal({ mode: "none" });
      } catch (e) {
        alert(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  const missingBasics = groups.length === 0 || teachers.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Layers className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{d.assignmentsTitle}</h1>
            <p className="text-sm text-zinc-500">{d.assignmentsHint}</p>
          </div>
        </div>
        {/* Назначение связывает предмет, группу и учителя. Предмет можно
            завести прямо в форме, а группу и учителя — нет: без них форма
            открывается с пустыми списками. */}
        <button
          onClick={openAdd}
          disabled={missingBasics}
          title={missingBasics ? d.needBasicsFirst : undefined}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-violet-600"
        >
          <Plus className="h-4 w-4" /> {d.assignmentsAdd}
        </button>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <select
          value={fGroup} onChange={(e) => setFGroup(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">{d.assignmentsAllGroups}</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select
          value={fCatalog} onChange={(e) => setFCatalog(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">{d.assignmentsAllSubjects}</option>
          {catalog.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={fTeacher} onChange={(e) => setFTeacher(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">{d.assignmentsAllTeachers}</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">
            {missingBasics ? d.assignmentsEmptyNeedBasics : d.assignmentsEmpty}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center gap-4 px-5 py-4">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: a.color }}
                >
                  <SubjectGlyph name={a.icon} size={18} className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-zinc-900">{a.name}</p>
                  <p className="text-xs text-zinc-500">
                    {a.group?.name ?? "—"} · {a.teacher ? a.teacher.full_name : d.subjectsNotAssigned}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(a)} disabled={isPending}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                    title={d.editBtn}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setModal({ mode: "delete", row: a })} disabled={isPending}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title={d.deleteBtn}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add / Edit */}
      {(modal.mode === "add" || modal.mode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 p-5">
              <h2 className="text-lg font-semibold text-zinc-900">
                {modal.mode === "add" ? d.assignmentsAdd : d.assignmentsEdit}
              </h2>
              <button onClick={() => setModal({ mode: "none" })} className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">{d.assignmentsSubject}</label>
                <select
                  value={formCatalogId}
                  onChange={(e) => setFormCatalogId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">{d.assignmentsPickSubject}</option>
                  {pickerCatalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.is_active ? "" : ` (${d.subjectsHiddenBadge})`}
                    </option>
                  ))}
                  <option value={NEW_SUBJECT}>+ {d.assignmentsCreateSubject}</option>
                </select>
              </div>

              {formCatalogId === NEW_SUBJECT && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsName}</label>
                  <input
                    type="text"
                    value={formNewName}
                    onChange={(e) => setFormNewName(e.target.value)}
                    placeholder="Астрономия"
                    autoFocus
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <p className="mt-1 text-xs text-zinc-500">{d.assignmentsCreateSubjectHint}</p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">{d.fieldGroup}</label>
                <select
                  value={formGroupId}
                  onChange={(e) => setFormGroupId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">{d.assignmentsPickGroup}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsTeacher}</label>
                <select
                  value={formTeacherId}
                  onChange={(e) => setFormTeacherId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">{d.subjectsNotAssigned}</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-zinc-500">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {d.assignmentsTeacherChatsHint}
                </p>
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-100 p-5">
              <button
                onClick={() => setModal({ mode: "none" })}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100"
              >
                {d.cancelBtn}
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {d.saveBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {modal.mode === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold text-zinc-900">{d.assignmentsDeleteTitle}</h2>
            <p className="mb-1 text-sm text-zinc-600">
              {d.assignmentsDeleteConfirm
                .replace("{name}", modal.row.name)
                .replace("{group}", modal.row.group?.name ?? "")}
            </p>
            <p className="mb-5 text-sm text-red-600">{d.assignmentsDeleteWarning}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModal({ mode: "none" })}
                className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                {d.cancelBtn}
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className={cn(
                  "flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700",
                  isPending && "opacity-60",
                )}
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {d.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

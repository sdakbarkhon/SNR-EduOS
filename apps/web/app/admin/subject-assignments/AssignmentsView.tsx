"use client";

import { useState, useMemo, useTransition } from "react";
import { Layers, Plus, Pencil, Trash2, X, Check, Loader2, Info, ListChecks, AlertTriangle } from "lucide-react";
import { getDictionary, format, сообщениеОПеременах } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import { LUCIDE_ICONS } from "@/lib/subject-icons";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { ВыборГалочками } from "@/components/CheckboxPicker";
import {
  actionCreateSubjectAssignment,
  actionUpdateSubjectAssignment,
  actionDeleteSubjectAssignment,
  actionCreateSchoolSubject,
  actionPlanBulkAssignment,
  actionApplyBulkAssignment,
} from "../actions";
import type { BulkAssignPlan, BulkAssignResult } from "@/lib/admin-api";
import { ModalPortal } from "@/components/ModalPortal";
import { useFlash, FlashBanner } from "@/components/admin/Flash";

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
  /**
   * Школа, в которой идёт работа. Срез 3c, роль менеджера.
   *
   * НЕ ПЕРЕДАНО — ничего не меняется: форма уходит байт в байт прежней,
   * доводы прежние, школу подставляют правила доступа. Так работает админ.
   *
   * ПЕРЕДАНО — школа кладётся в каждую форму и в каждый довод. Так работает
   * менеджер: своей школы у него нет, и подставить её некому.
   */
  schoolId,
}: {
  assignments: Assignment[];
  catalog: CatalogItem[];
  groups: Group[];
  teachers: Teacher[];
  defaultOpenAdd?: boolean;
  schoolId?: string;
}) {
  /** Дописать школу в форму. Без неё форма остаётся прежней. */
  const сШколой = (fd: FormData) => {
    if (schoolId) fd.set("school_id", schoolId);
    return fd;
  };

  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;

  // Форма назначения требует готовую группу и учителя: без них её списки
  // пусты, а поля обязательны.
  //
  // 03.09.2026 — ТА ЖЕ ДЫРА, ЧТО ЧИНИЛАСЬ НА /admin/groups. Кнопки гаснут по
  // missingBasics, а окно, открытое сразу по адресу с ?action=add, про запрет
  // не знало вовсе и открывалось в тупик. Поэтому запор считается ВЫШЕ
  // состояния и входит в его начальное значение.
  //
  // Справочник в запор НЕ добавлен намеренно: при пустом справочнике форма
  // работает через «+ Создать предмет», и запрещать этот путь было бы хуже,
  // чем оставить как есть. Врала подпись, а не проверка, — её и поправили
  // («Нужны группы и учителя»).
  const missingBasics = groups.length === 0 || teachers.length === 0;

  const [modal, setModal] = useState<ModalState>(
    defaultOpenAdd && !missingBasics ? { mode: "add" } : { mode: "none" },
  );
  const [isPending, startTransition] = useTransition();
  /*
   * ЭКРАН БОЛЬШЕ НЕ МОЛЧИТ. Пункт 212, 06.09.2026.
   *
   * Создание, правка и удаление назначения не показывали НИЧЕГО: модалка
   * закрывалась, страница перерисовывалась, и человек оставался гадать,
   * сработало ли. Это хуже неточной фразы.
   *
   * Плашка та же, что у учителей и учеников, — общий хук, а не девятая
   * ручная копия (components/admin/Flash.tsx).
   */
  const { flash, flashMsg } = useFlash();

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
          catalogId = await unwrap(actionCreateSchoolSubject(сШколой(nf)));
        }

        const fd = new FormData();
        fd.set("catalog_id", catalogId);
        fd.set("group_id", formGroupId);
        fd.set("teacher_id", formTeacherId);

        // Имена для сообщения — из тех же списков, что рисуют экран. Их
        // достаточно: назначение состоит ровно из предмета, группы и учителя,
        // и все трое здесь под рукой.
        const предметСтал = creatingNew
          ? formNewName.trim()
          : catalog.find((c) => c.id === catalogId)?.name ?? "—";
        const группаСтала = groups.find((g) => g.id === formGroupId)?.name ?? "—";
        const учительСтал = teachers.find((t) => t.id === formTeacherId)?.full_name ?? null;

        if (modal.mode === "edit") {
          const было = modal.row;
          fd.set("id", было.id);
          await unwrap(actionUpdateSubjectAssignment(сШколой(fd)));
          /*
           * ЧТО ИМЕННО ПОМЕНЯЛИ — по правилу из @snr/core. Форма правит три
           * вещи, и все три весомые: у предмета и группы меняется, к чему
           * привязаны уроки, у учителя — кто вообще видит эту пару. Мелочей,
           * которые стоило бы свернуть в «поправлено», здесь нет вовсе.
           */
          const весомые: string[] = [];
          const предметБыл = было.name;
          const группаБыла = было.group?.name ?? "—";

          if (предметСтал !== предметБыл) {
            весомые.push(format(d.assignmentSubjectChangedMsg, { from: предметБыл, to: предметСтал }));
          }
          if (группаСтала !== группаБыла) {
            весомые.push(format(d.assignmentGroupChangedMsg, { from: группаБыла, to: группаСтала }));
          }
          if ((было.teacher_id ?? "") !== formTeacherId) {
            весомые.push(учительСтал
              ? format(d.assignmentTeacherSetMsg, { subject: предметСтал, group: группаСтала, teacher: учительСтал })
              : format(d.assignmentTeacherClearedMsg, { subject: предметСтал, group: группаСтала }));
          }
          flash(сообщениеОПеременах({ весомые, сведения: [] }, { ничего: d.assignmentNoChangeMsg }));
        } else {
          await unwrap(actionCreateSubjectAssignment(сШколой(fd)));
          flash(учительСтал
            ? format(d.assignmentCreatedMsg, { subject: предметСтал, group: группаСтала, teacher: учительСтал })
            : format(d.assignmentCreatedNoTeacherMsg, { subject: предметСтал, group: группаСтала }));
        }
        setModal({ mode: "none" });
      } catch (e) {
        setFormError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  function handleDelete() {
    if (modal.mode !== "delete") return;
    const строка = modal.row;
    startTransition(async () => {
      try {
        await unwrap(actionDeleteSubjectAssignment(строка.id, schoolId));
        // Строка сейчас исчезнет из таблицы — назвать её надо ДО того, как
        // человек перестанет её видеть.
        flash(format(d.assignmentDeletedMsg, {
          subject: строка.name,
          group: строка.group?.name ?? "—",
        }));
        setModal({ mode: "none" });
      } catch (e) {
        alert(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  // ═══ МАССОВОЕ НАЗНАЧЕНИЕ ═══════════════════════════════════════════════
  //
  // ДВА НАБОРА ГАЛОЧЕК, ОДНА ФОРМА. Предметы и группы отмечаются независимо,
  // и берётся их произведение: один предмет в шесть групп и шесть предметов в
  // одну группу — это один и тот же механизм, разводить его на две формы
  // незачем.
  //
  // Учитель один на всю пачку. Двух учителей сразу здесь быть не может: пара
  // «предмет + группа» держит ровно одного, и выбор второго означал бы
  // перебивку — а её заказчик запретил.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTeacher, setBulkTeacher] = useState("");
  const [bulkSubjects, setBulkSubjects] = useState<Set<string>>(new Set());
  const [bulkGroups, setBulkGroups] = useState<Set<string>>(new Set());
  const [bulkPlan, setBulkPlan] = useState<BulkAssignPlan | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkAssignResult | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");

  /** Любая правка выбора обесценивает расчёт. Показывать вчерашнее число над
   *  сегодняшним выбором нельзя: человек согласится не на то, что увидит. */
  function сбросРасчёт() {
    setBulkPlan(null);
    setBulkResult(null);
    setBulkError("");
  }

  const переключить = (набор: Set<string>, поставить: (s: Set<string>) => void) => (id: string) => {
    const копия = new Set(набор);
    if (копия.has(id)) копия.delete(id); else копия.add(id);
    поставить(копия);
    сбросРасчёт();
  };

  function openBulk() {
    setBulkTeacher("");
    setBulkSubjects(new Set());
    setBulkGroups(new Set());
    сбросРасчёт();
    setBulkOpen(true);
  }

  function bulkFormData(): FormData {
    const fd = new FormData();
    fd.set("catalog_ids", JSON.stringify([...bulkSubjects]));
    fd.set("group_ids", JSON.stringify([...bulkGroups]));
    fd.set("teacher_id", bulkTeacher);
    return fd;
  }

  /** ШАГ 1 — ПОСЧИТАТЬ, НИЧЕГО НЕ ЗАПИСЫВАЯ. Считает сервер тем же кодом,
   *  которым потом пишет: иначе показанное и сделанное разойдутся. Точное
   *  число чатов на клиенте не собрать — нужны размеры групп, уже
   *  существующие ветки и наличие учётных записей. */
  function handleBulkPlan() {
    if (bulkSubjects.size === 0 || bulkGroups.size === 0) {
      setBulkError(d.assignmentsBulkNeedPick);
      return;
    }
    setBulkBusy(true);
    setBulkError("");
    setBulkResult(null);
    startTransition(async () => {
      try {
        setBulkPlan(await unwrap(actionPlanBulkAssignment(сШколой(bulkFormData()))));
      } catch (e) {
        setBulkError(humanizeAdminError(e, locale as Locale));
      } finally {
        setBulkBusy(false);
      }
    });
  }

  /** ШАГ 2 — записать. Частичный отказ не теряет прошедшего: сервер отдаёт
   *  числа и причину по каждой непрошедшей паре, и мы показываем обе правды
   *  сразу — сколько прошло и что именно не прошло. */
  function handleBulkApply() {
    setBulkBusy(true);
    setBulkError("");
    startTransition(async () => {
      try {
        const итог = await unwrap(actionApplyBulkAssignment(сШколой(bulkFormData())));
        setBulkResult(итог);
        setBulkPlan(null);
      } catch (e) {
        setBulkError(humanizeAdminError(e, locale as Locale));
      } finally {
        setBulkBusy(false);
      }
    });
  }


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
        <div className="flex flex-wrap items-center gap-2">
          {/* Массовое рядом с одиночным, а не вместо него: одно назначение
              всё ещё делается быстрее в маленькой форме. */}
          <button
            onClick={openBulk}
            disabled={missingBasics}
            title={missingBasics ? d.needBasicsFirst : undefined}
            className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ListChecks className="h-4 w-4" /> {d.assignmentsBulk}
          </button>
          <button
            onClick={openAdd}
            disabled={missingBasics}
            title={missingBasics ? d.needBasicsFirst : undefined}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-violet-600"
          >
            <Plus className="h-4 w-4" /> {d.assignmentsAdd}
          </button>
        </div>
      </div>

      <FlashBanner msg={flashMsg} />

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
        <ModalPortal>
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
        </ModalPortal>
      )}

      {/* ── МАССОВОЕ НАЗНАЧЕНИЕ ─────────────────────────────────────── */}
      {bulkOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-100 p-5">
                <h2 className="text-lg font-semibold text-zinc-900">{d.assignmentsBulkTitle}</h2>
                <button
                  onClick={() => setBulkOpen(false)}
                  disabled={bulkBusy}
                  className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                <p className="text-xs leading-relaxed text-zinc-500">{d.assignmentsBulkHint}</p>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">{d.assignmentsBulkTeacher}</label>
                  <select
                    value={bulkTeacher}
                    onChange={(e) => { setBulkTeacher(e.target.value); сбросРасчёт(); }}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {/* «Не назначен» оставлен намеренно: так одной пачкой можно
                        завести предмет во все группы и раздать учителей потом.
                        Чатов при этом не будет ни одного — оба триггера выходят
                        первой строкой при пустом учителе. */}
                    <option value="">{d.subjectsNotAssigned}</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </div>

                <ВыборГалочками
                  title={format(d.assignmentsBulkSubjects, { n: bulkSubjects.size })}
                  items={activeCatalog.map((c) => ({ id: c.id, label: c.name }))}
                  picked={bulkSubjects}
                  onToggle={переключить(bulkSubjects, setBulkSubjects)}
                  onAll={() => { setBulkSubjects(new Set(activeCatalog.map((c) => c.id))); сбросРасчёт(); }}
                  onNone={() => { setBulkSubjects(new Set()); сбросРасчёт(); }}
                  allLabel={d.assignmentsBulkSelectAll}
                  noneLabel={d.assignmentsBulkClear}
                />

                <ВыборГалочками
                  title={format(d.assignmentsBulkGroups, { n: bulkGroups.size })}
                  items={groups.map((g) => ({ id: g.id, label: g.name }))}
                  picked={bulkGroups}
                  onToggle={переключить(bulkGroups, setBulkGroups)}
                  onAll={() => { setBulkGroups(new Set(groups.map((g) => g.id))); сбросРасчёт(); }}
                  onNone={() => { setBulkGroups(new Set()); сбросРасчёт(); }}
                  allLabel={d.assignmentsBulkSelectAll}
                  noneLabel={d.assignmentsBulkClear}
                />

                {/* ── ЧТО ПРОИЗОЙДЁТ. Показывается ДО согласия ───────────── */}
                {bulkPlan && (
                  <div className="space-y-1.5 rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-xs">
                    <div className="font-semibold text-violet-900">{d.assignmentsBulkPlanTitle}</div>
                    {bulkPlan.willCreate === 0 && bulkPlan.willAssign === 0 ? (
                      <p className="text-amber-700">{d.assignmentsBulkPlanNothing}</p>
                    ) : (
                      <>
                        {bulkPlan.willCreate > 0 && (
                          <p className="text-zinc-700">{format(d.assignmentsBulkPlanCreate, { n: bulkPlan.willCreate })}</p>
                        )}
                        {bulkPlan.willAssign > 0 && (
                          <p className="text-zinc-700">{format(d.assignmentsBulkPlanAssign, { n: bulkPlan.willAssign })}</p>
                        )}
                        {bulkPlan.chats.teacherHasNoAccount ? (
                          <p className="text-amber-700">{d.assignmentsBulkPlanNoAccount}</p>
                        ) : bulkPlan.chats.newThreads > 0 ? (
                          <p className="text-zinc-700">
                            {format(d.assignmentsBulkPlanChats, {
                              threads: bulkPlan.chats.newThreads,
                              participants: bulkPlan.chats.newParticipants,
                            })}
                          </p>
                        ) : (
                          <p className="text-zinc-500">{d.assignmentsBulkPlanNoChats}</p>
                        )}
                        {/* Тихий ноль называется вслух: эти чаты не заведутся, и
                            без этой строки никто бы не узнал. */}
                        {bulkPlan.chats.silentStudents > 0 && (
                          <p className="text-amber-700">
                            {format(d.assignmentsBulkPlanSilent, { n: bulkPlan.chats.silentStudents })}
                          </p>
                        )}
                      </>
                    )}
                    {bulkPlan.blocked.length > 0 && (
                      <div className="mt-2 border-t border-violet-100 pt-2">
                        <div className="font-semibold text-zinc-600">
                          {format(d.assignmentsBulkOccupied, { n: bulkPlan.blocked.length })}
                        </div>
                        <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
                          {bulkPlan.blocked.map((b) => (
                            <li key={`${b.catalogId}-${b.groupId}`} className="text-zinc-500">
                              {b.reason === "already_this_teacher"
                                ? format(d.assignmentsBulkAlready, { subject: b.subjectName, group: b.groupName })
                                : format(d.assignmentsBulkOccupiedBy, {
                                    subject: b.subjectName, group: b.groupName, teacher: b.teacherName ?? "—",
                                  })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* ── ЧТО ПОЛУЧИЛОСЬ. Обе правды сразу ──────────────────── */}
                {bulkResult && (
                  <div className="space-y-1.5 rounded-xl bg-emerald-50 p-3 text-xs">
                    <p className="font-semibold text-emerald-800">
                      {format(d.assignmentsBulkDone, { created: bulkResult.created, assigned: bulkResult.assigned })}
                    </p>
                    {bulkResult.failed.length > 0 && (
                      <div className="border-t border-emerald-100 pt-1.5">
                        <div className="font-semibold text-red-700">
                          {format(d.assignmentsBulkFailedTitle, { n: bulkResult.failed.length })}
                        </div>
                        <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
                          {bulkResult.failed.map((f, i) => (
                            <li key={i} className="text-red-600">
                              {format(d.assignmentsBulkFailedRow, {
                                subject: f.subjectName, group: f.groupName, reason: f.reason,
                              })}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {bulkError && (
                  <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    {bulkError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-zinc-100 p-5">
                <button
                  onClick={() => setBulkOpen(false)}
                  disabled={bulkBusy}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-50"
                >
                  {d.cancelBtn}
                </button>
                {/* Кнопка «Назначить» появляется ТОЛЬКО после расчёта и только
                    если делать есть что. Так человек не может согласиться на
                    то, чего не видел, — тот же порядок, что у массового
                    создания уроков. */}
                {bulkPlan && (bulkPlan.willCreate > 0 || bulkPlan.willAssign > 0) ? (
                  <button
                    onClick={handleBulkApply}
                    disabled={bulkBusy}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
                  >
                    {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {bulkBusy ? d.assignmentsBulkApplying : d.assignmentsBulkApply}
                  </button>
                ) : (
                  <button
                    onClick={handleBulkPlan}
                    disabled={bulkBusy}
                    className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
                  >
                    {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                    {bulkBusy ? d.assignmentsBulkCounting : bulkPlan ? d.assignmentsBulkRecount : d.assignmentsBulkPlanTitle}
                  </button>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete */}
      {modal.mode === "delete" && (
        <ModalPortal>
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
        </ModalPortal>
      )}
    </div>
  );
}

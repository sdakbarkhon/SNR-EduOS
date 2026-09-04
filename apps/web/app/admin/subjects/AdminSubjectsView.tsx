"use client";

import { useState, useTransition } from "react";
import { Library, Plus, Pencil, X, Check, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import { getDictionary, SUBJECT_DEFAULTS } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import { LUCIDE_ICONS, ICON_NAMES } from "@/lib/subject-icons";
import { SERVICE_CONFIG, EXTERNAL_SERVICE_ORDER } from "@/lib/external-services";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import {
  actionCreateSchoolSubject,
  actionUpdateSchoolSubject,
  actionSetSchoolSubjectActive,
  actionSchoolSubjectImpact,
  actionDeleteSchoolSubject,
} from "../actions";
import { ModalPortal } from "@/components/ModalPortal";

// Z.2.2 — справочник предметов школы. Ни групп, ни учителей: «кто что где
// ведёт» живёт на /admin/subject-assignments.
//
// Z.2.3 — удаление появилось, но только для пустого предмета: если он хоть
// где-то назначен, кнопки нет, а остаётся скрытие. Заведённый по ошибке
// предмет иначе оставался бы в списке навсегда выключенным.

export type CatalogRow = {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_active: boolean;
  assignments: number;
  /** Внешние сервисы предмета (миграция 258). Пусто — набор ещё не задан,
   *  форма покажет все отмеченными: так же ведёт себя и колонка. */
  services?: string[];
};

type ModalState = { mode: "none" } | { mode: "add" } | { mode: "edit"; row: CatalogRow };

/** Иконка предмета по имени из БД. Фолбэк на BookOpen — тот же, что в
 *  LessonCard; после синхронизации реестров он срабатывает только на
 *  by-hand значениях, которых нет в пикере. */
function SubjectGlyph({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = LUCIDE_ICONS[name] ?? LUCIDE_ICONS.BookOpen!;
  return <Icon size={size} className={className} />;
}

/**
 * 06.09.2026 — СПИСКА «ИЗВЕСТНЫХ НАЗВАНИЙ» ЗДЕСЬ БОЛЬШЕ НЕТ.
 *
 * Он приходил из словаря предметов в коде, и смысл у него был такой: система
 * узнаёт вот эти названия, у них будет свой цвет и значок, а «своё» название
 * получит серую заглушку и предупреждение. Словарь снесён — узнавать нечем и
 * незачем: цвет и значок админ выбирает руками прямо здесь, у любого
 * названия. Предупреждать больше не о чем.
 *
 * Подсказка по названию осталась (SUBJECT_DEFAULTS): набрал «Математика» —
 * форма предложит калькулятор и оранжевый. Это подсказка, а не правило: любой
 * выбор перебивает её.
 */
/** Служебное значение пункта «завести кафедру тут же». */
const NEW_DEPARTMENT = "__new__";

// 04.09.2026 — список берётся из реестра, а не пишется рядом с ним. Пока он
// был своим, админу предлагали значки, которых приложение не умело рисовать:
// выбранная Library молча становилась книгой.
const ICON_OPTIONS = ICON_NAMES;

const COLOR_OPTIONS = [
  "#F5A623", "#EF4444", "#F97316", "#F0556B", "#F43F5E", "#B5793A",
  "#14B8A6", "#2DBE7E", "#39B6F5", "#9B5DE5", "#7A4DFF", "#0EA5E9",
  "#2D5BFF", "#EC4899", "#8B5CF6", "#71717A", "#16A34A", "#64748B",
];

export function AdminSubjectsView({
  subjects,
  departments = [],
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
  subjects: CatalogRow[];
  /** Кафедры школы для выбора при создании предмета (миграция 255). */
  departments?: Array<{ id: string; name: string }>;
  schoolId?: string;
}) {
  /** Дописать школу в форму. Без неё форма остаётся прежней. */
  const сШколой = (fd: FormData) => {
    if (schoolId) fd.set("school_id", schoolId);
    return fd;
  };

  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;

  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [isPending, startTransition] = useTransition();

  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("BookOpen");
  const [formColor, setFormColor] = useState("#64748B");
  const [formError, setFormError] = useState("");
  /**
   * ВНЕШНИЕ СЕРВИСЫ ПРЕДМЕТА. 06.09.2026, миграция 258.
   *
   * До неё список решала карта в коде по русскому названию: пять имён, и
   * предмет вне карты получал четыре сервиса из четырнадцати. Теперь решает
   * школа — галочками.
   *
   * У нового предмета отмечены ВСЕ. Список сужает человек осознанно: лишнюю
   * галочку видно и снять её — одно движение, а недостающей не видно вовсе.
   */
  const [formServices, setFormServices] = useState<string[]>([...EXTERNAL_SERVICE_ORDER]);
  /** Кафедра нового предмета: id существующей, NEW_DEPARTMENT — завести тут
   *  же, пустая строка — не выбирал, кафедру заведёт сервер по названию
   *  предмета. Последнее и есть запасной путь: он остался ради того, чтобы
   *  предмет нельзя было создать вообще без кафедры. */
  const [formDepartmentId, setFormDepartmentId] = useState("");
  const [formDepartmentName, setFormDepartmentName] = useState("");

  function openAdd() {
    setFormName(""); setFormIcon("BookOpen"); setFormColor("#64748B"); setFormError("");
    setFormDepartmentId(""); setFormDepartmentName("");
    setFormServices([...EXTERNAL_SERVICE_ORDER]);
    setModal({ mode: "add" });
  }

  function openEdit(row: CatalogRow) {
    setFormName(row.name); setFormIcon(row.icon); setFormColor(row.color); setFormError("");
    // Набора нет (миграция ещё не применена) — показываем все отмеченными:
    // ровно то, что покажет и колонка со своим умолчанием.
    setFormServices(row.services && row.services.length > 0
      ? [...row.services]
      : [...EXTERNAL_SERVICE_ORDER]);
    setModal({ mode: "edit", row });
  }

  // Автоподстановка стиля по известному названию — тот же SUBJECT_DEFAULTS,
  // что был здесь до Z.2.2. Срабатывает только пока админ не выбрал своё.
  function onNameChange(name: string) {
    setFormName(name);
    const def = SUBJECT_DEFAULTS[name.trim()];
    if (def && formIcon === "BookOpen") setFormIcon(def.icon);
    if (def && formColor === "#64748B") setFormColor(def.color);
  }

  function handleSave() {
    if (!formName.trim()) { setFormError(d.subjectsEnterName); return; }
    setFormError("");
    const fd = new FormData();
    fd.set("name", formName.trim());
    fd.set("icon", formIcon);
    fd.set("color", formColor);
    fd.set("services", JSON.stringify(formServices));
    if (modal.mode === "edit") fd.set("id", modal.row.id);
    if (modal.mode === "add") {
      if (formDepartmentId === NEW_DEPARTMENT) {
        const имя = formDepartmentName.trim();
        if (!имя) { setFormError(d.departmentsEnterName); return; }
        fd.set("department_name", имя);
      } else if (formDepartmentId) {
        fd.set("department_id", formDepartmentId);
      }
    }

    startTransition(async () => {
      try {
        if (modal.mode === "add") await unwrap(actionCreateSchoolSubject(сШколой(fd)));
        else if (modal.mode === "edit") await unwrap(actionUpdateSchoolSubject(сШколой(fd)));
        setModal({ mode: "none" });
      } catch (e) {
        setFormError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  function toggleActive(row: CatalogRow) {
    startTransition(async () => {
      try {
        await unwrap(actionSetSchoolSubjectActive(row.id, !row.is_active, schoolId));
      } catch (e) {
        alert(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  /** Z.2.3 — удаление предмета справочника. Счётчик назначений на карточке
   *  может отставать от базы (кто-то назначил предмет в соседней вкладке),
   *  поэтому перед удалением спрашиваем сервер заново и показываем, что
   *  именно мешает. Отказ сервера — вторая линия, а не единственная. */
  function removeSubject(row: CatalogRow) {
    startTransition(async () => {
      try {
        const impact = await unwrap(actionSchoolSubjectImpact(row.id, schoolId));
        if (impact.blocked) {
          alert(d.catalogSubjectInUseHint
            .replace("{assignments}", String(impact.assignments))
            .replace("{lessons}", String(impact.lessons))
            .replace("{homework}", String(impact.homework))
            .replace("{plans}", String(impact.plans))
            .replace("{materials}", String(impact.materials)));
          return;
        }
        if (!confirm(`${d.catalogSubjectDeleteTitle}: «${row.name}». ${d.catalogSubjectDeleteClean}`)) return;
        await unwrap(actionDeleteSchoolSubject(row.id, schoolId));
      } catch (e) {
        alert(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100">
            <Library className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">{d.subjectsTitle}</h1>
            <p className="text-sm text-zinc-500">{d.subjectsCatalogHint}</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow transition-colors hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> {d.subjectsAdd}
        </button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {subjects.length === 0 ? (
          <div className="py-12 text-center text-sm text-zinc-500">{d.subjectsCatalogEmpty}</div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {subjects.map((s) => (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 transition-opacity",
                  !s.is_active && "opacity-50",
                )}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{ background: s.color }}
                >
                  <SubjectGlyph name={s.icon} size={18} className="text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("truncate font-semibold", s.is_active ? "text-zinc-900" : "text-zinc-500")}>
                      {s.name}
                    </p>
                    {!s.is_active && (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-600">
                        {d.subjectsHiddenBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {s.assignments > 0
                      ? d.subjectsUsageCount.replace("{count}", String(s.assignments))
                      : d.subjectsUsageNone}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <div
                    className="h-4 w-4 rounded-full ring-1 ring-zinc-200"
                    style={{ background: s.color }}
                    title={s.color}
                  />
                  <button
                    onClick={() => openEdit(s)}
                    disabled={isPending}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                    title={d.editBtn}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(s)}
                    disabled={isPending}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                    title={s.is_active ? d.subjectsHide : d.subjectsShow}
                  >
                    {s.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {/* Z.2.3 — удаление только для действительно пустого
                      предмета. Кнопки нет вовсе, если он где-то назначен:
                      сначала предлагаем скрытие, и это честнее отказа после
                      нажатия. Сервер проверяет то же самое сам. */}
                  {s.assignments === 0 && (
                    <button
                      onClick={() => removeSubject(s)}
                      disabled={isPending}
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title={d.deleteBtn}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add / Edit modal */}
      {(modal.mode === "add" || modal.mode === "edit") && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-zinc-100 p-5">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {modal.mode === "add" ? d.subjectsAdd : d.subjectsEdit}
                </h2>
                <button
                  onClick={() => setModal({ mode: "none" })}
                  className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {/* Название — свободный текст. Предмет придумывает школа, и
                    список «известных» ей больше не предлагается: узнавать было
                    нечем, а цвет со значком она выбирает ниже сама. */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsName}</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => onNameChange(e.target.value)}
                    placeholder="Хореография"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    autoFocus
                  />
                </div>

                {/* Кафедра. Только при создании: перевод существующего
                    предмета на другую кафедру — это слияние, и делается оно на
                    своём экране, где видно, что переедет. */}
                {modal.mode === "add" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsDepartment}</label>
                    <select
                      value={formDepartmentId}
                      onChange={(e) => setFormDepartmentId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
                    >
                      <option value="">{d.subjectsDepartmentAuto}</option>
                      {departments.map((dep) => (
                        <option key={dep.id} value={dep.id}>{dep.name}</option>
                      ))}
                      <option value={NEW_DEPARTMENT}>{d.subjectsDepartmentNew}</option>
                    </select>
                    {formDepartmentId === NEW_DEPARTMENT && (
                      <input
                        value={formDepartmentName}
                        onChange={(e) => setFormDepartmentName(e.target.value)}
                        placeholder={d.departmentsName}
                        className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-zinc-400"
                      />
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsIcon}</label>
                  <div className="grid grid-cols-8 gap-1.5">
                    {ICON_OPTIONS.map((icon) => (
                      <button
                        key={icon}
                        onClick={() => setFormIcon(icon)}
                        className={cn(
                          "flex items-center justify-center rounded-lg border py-1.5 transition-colors",
                          formIcon === icon
                            ? "border-violet-500 bg-violet-50 text-violet-700"
                            : "border-zinc-200 text-zinc-600 hover:border-zinc-400",
                        )}
                        title={icon}
                      >
                        <SubjectGlyph name={icon} size={16} />
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {d.subjectsIconSelected.replace("{icon}", formIcon)}
                  </p>
                </div>

                {/* Внешние сервисы. Не «какие бывают», а «какие предлагать
                    учителю этого предмета»: список сужает школа. */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsServices}</label>
                  <p className="mb-2 text-xs text-zinc-500">{d.subjectsServicesHint}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EXTERNAL_SERVICE_ORDER.map((key) => {
                      const on = formServices.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFormServices((prev) =>
                            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                            on
                              ? "border-zinc-900 bg-zinc-900/5 font-medium text-zinc-900"
                              : "border-zinc-200 text-zinc-500 hover:bg-zinc-50",
                          )}
                        >
                          <span className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300",
                          )}>
                            {on && <Check className="h-3 w-3" />}
                          </span>
                          {SERVICE_CONFIG[key].name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsColor}</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setFormColor(color)}
                        className={cn(
                          "h-7 w-7 rounded-full transition-all",
                          formColor === color ? "scale-110 ring-2 ring-violet-500 ring-offset-2" : "hover:scale-105",
                        )}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>

                {modal.mode === "edit" && modal.row.assignments > 0 && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    {d.subjectsRenameHint.replace("{count}", String(modal.row.assignments))}
                  </p>
                )}
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
    </div>
  );
}

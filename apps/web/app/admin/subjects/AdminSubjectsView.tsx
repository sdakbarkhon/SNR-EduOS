"use client";

import { useState, useTransition } from "react";
import { Library, Plus, Pencil, X, Check, Loader2, Eye, EyeOff, Trash2 } from "lucide-react";
import { getDictionary, SUBJECT_DEFAULTS, subjects as SUBJECT_CONFIG } from "@snr/core";
import type { Locale } from "@snr/core";
import { cn } from "@/lib/cn";
import { useLocale } from "@/components/LocaleProvider";
import { LUCIDE_ICONS } from "@/lib/subject-icons";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import {
  actionCreateSchoolSubject,
  actionUpdateSchoolSubject,
  actionSetSchoolSubjectActive,
  actionSchoolSubjectImpact,
  actionDeleteSchoolSubject,
} from "../actions";

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
};

type ModalState = { mode: "none" } | { mode: "add" } | { mode: "edit"; row: CatalogRow };

/** Иконка предмета по имени из БД. Фолбэк на BookOpen — тот же, что в
 *  LessonCard; после синхронизации реестров он срабатывает только на
 *  by-hand значениях, которых нет в пикере. */
function SubjectGlyph({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = LUCIDE_ICONS[name] ?? LUCIDE_ICONS.BookOpen!;
  return <Icon size={size} className={className} />;
}

/** Десять названий, которые система узнаёт: только для них у предмета свой
 *  цвет и значок. Список берём из того же конфига, что рисует предметы на
 *  экранах, — второго списка заводить нельзя, разойдётся. */
const KNOWN_SUBJECT_NAMES = Object.values(SUBJECT_CONFIG).map((s) => s.label);
/** Служебное значение пункта «своё название» — им не может быть настоящее имя. */
const CUSTOM_NAME = "__custom__";

const ICON_OPTIONS = [
  "Calculator", "BookOpen", "Globe", "Languages", "BookText", "Scroll",
  "Map", "Leaf", "Atom", "FlaskConical", "Monitor", "Code", "Bot",
  "Dumbbell", "Music", "Palette", "Hammer", "TreePine", "Library",
  "Users", "Lightbulb", "Target", "Rocket",
];

const COLOR_OPTIONS = [
  "#F5A623", "#EF4444", "#F97316", "#F0556B", "#F43F5E", "#B5793A",
  "#14B8A6", "#2DBE7E", "#39B6F5", "#9B5DE5", "#7A4DFF", "#0EA5E9",
  "#2D5BFF", "#EC4899", "#8B5CF6", "#71717A", "#16A34A", "#64748B",
];

export function AdminSubjectsView({ subjects }: { subjects: CatalogRow[] }) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;

  const [modal, setModal] = useState<ModalState>({ mode: "none" });
  const [isPending, startTransition] = useTransition();

  const [formName, setFormName] = useState("");
  const [formIcon, setFormIcon] = useState("BookOpen");
  const [formColor, setFormColor] = useState("#64748B");
  const [formError, setFormError] = useState("");

  function openAdd() {
    setFormName(""); setFormIcon("BookOpen"); setFormColor("#64748B"); setFormError("");
    setModal({ mode: "add" });
  }

  function openEdit(row: CatalogRow) {
    setFormName(row.name); setFormIcon(row.icon); setFormColor(row.color); setFormError("");
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
    if (modal.mode === "edit") fd.set("id", modal.row.id);

    startTransition(async () => {
      try {
        if (modal.mode === "add") await unwrap(actionCreateSchoolSubject(fd));
        else if (modal.mode === "edit") await unwrap(actionUpdateSchoolSubject(fd));
        setModal({ mode: "none" });
      } catch (e) {
        setFormError(humanizeAdminError(e, locale as Locale));
      }
    });
  }

  function toggleActive(row: CatalogRow) {
    startTransition(async () => {
      try {
        await unwrap(actionSetSchoolSubjectActive(row.id, !row.is_active));
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
        const impact = await unwrap(actionSchoolSubjectImpact(row.id));
        if (impact.blocked) {
          alert(d.catalogSubjectInUseHint
            .replace("{assignments}", String(impact.assignments))
            .replace("{lessons}", String(impact.lessons))
            .replace("{homework}", String(impact.homework))
            .replace("{plans}", String(impact.plans)));
          return;
        }
        if (!confirm(`${d.catalogSubjectDeleteTitle}: «${row.name}». ${d.catalogSubjectDeleteClean}`)) return;
        await unwrap(actionDeleteSchoolSubject(row.id));
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
              {/* Раньше название вводилось свободным текстом, и опечатка вроде
                  «Матем.» молча лишала предмет своего цвета и значка: система
                  узнаёт ровно десять названий. Теперь их предлагаем списком, а
                  своё название остаётся возможным — но с предупреждением. */}
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">{d.subjectsName}</label>
                <select
                  value={KNOWN_SUBJECT_NAMES.includes(formName) ? formName : CUSTOM_NAME}
                  onChange={(e) => onNameChange(e.target.value === CUSTOM_NAME ? "" : e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="" disabled>{d.subjectsPickKnown}</option>
                  {KNOWN_SUBJECT_NAMES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value={CUSTOM_NAME}>{d.subjectsOwnName}</option>
                </select>

                {!KNOWN_SUBJECT_NAMES.includes(formName) && (
                  <>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Хореография"
                      className="mt-2 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <p className="mt-1 text-xs text-amber-600">{d.subjectsOwnNameWarning}</p>
                  </>
                )}
              </div>

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
      )}
    </div>
  );
}

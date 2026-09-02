"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Plus, X, ListPlus, AlertTriangle, Loader2 } from "lucide-react";
// Z.2.2: захардкоженная карта `subjects` (10 ключей из config/subjects.ts)
// больше НЕ питает выпадающий список — предметы берутся из справочника школы
// (school_subjects). getSubjectKeyByLabel остаётся: это мост «русское название
// → слаг», нужный чтобы groups.subject продолжал хранить слаг, как сегодня, и
// getSubjectStyle по всему приложению не сломался. Сам config/subjects.ts
// живёт дальше — он слой стилей для всего проекта, включая apps/mobile.
import { getDictionary, getSubjectKeyByLabel, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { useSubmitGuard } from "@/lib/use-submit-guard";
import {
  expandGroupNames, parseGroupLetters, checkGroupNames, chatThreadsForGroups,
  GROUP_BULK_MAX, GROUP_TEMPLATE_NUMBER, GROUP_TEMPLATE_LETTER,
} from "@snr/core";
import { formatCoursePrice, formatCoursePriceInput } from "@/lib/course-price";
import { actionCreateGroup, actionUpdateGroup, actionDeleteGroup, actionCreateGroupsBulk } from "../actions";
import type { BulkGroupsResult } from "@/lib/admin-api";

export type CatalogItem = { id: string; name: string; is_active: boolean };
type Group = {
  id: string;
  name: string;
  subject: string;
  teacher_id: string | null;
  /** Цена обучения в месяц, сумы, целое. НОЛЬ ЗНАЧИТ «не задана», а не
   *  «бесплатно» — см. lib/course-price.ts. */
  course_price: number;
  // 30.08.2026 — связи teachers здесь больше нет: колонка «Куратор» ушла
  // из таблицы вместе с ролью.
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

/**
 * Поле цены обучения.
 *
 * НЕ type="number" — сознательно. Числовое поле браузера не даёт вставить
 * «4 500 000» с пробелами (а деньги пишут именно так), зато пропускает «e»,
 * «-» и дробную точку. Здесь наоборот: поле текстовое, но на каждом нажатии
 * из него выбрасывается всё, кроме цифр, и разряды собираются заново. Буква,
 * точка, запятая и минус в поле просто не появляются, а вставленное из буфера
 * «4 500 000» читается верно.
 *
 * Пустое поле — это ноль, то есть «цена не задана». При нуле поле и
 * открывается пустым: иначе админ не отличит «мы решили не брать денег» от
 * «мы ещё не заполнили».
 */
function CoursePriceInput({ defaultValue }: { defaultValue: number }) {
  const [value, setValue] = useState(defaultValue > 0 ? formatCoursePrice(defaultValue) : "");
  return (
    <Input
      name="course_price"
      value={value}
      onChange={(e) => setValue(formatCoursePriceInput(e.target.value))}
      inputMode="numeric"
      autoComplete="off"
      placeholder="0"
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

type AdminDict = ReturnType<typeof getDictionary>["admin"];

function GroupForm({
  defaultValues,
  catalog,
  isPending,
  t,
  onClose,
  onSubmit,
  submitLabel,
}: {
  defaultValues?: Partial<Group>;
  catalog: CatalogItem[];
  isPending: boolean;
  t: AdminDict;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
  submitLabel: string;
}) {
  // ЧТО ИМЕННО ЛЕЖИТ В groups.subject. Server action пишет туда
  // `getSubjectKeyByLabel(имя) ?? имя` — то есть слаг, если предмет есть в
  // захардкоженной карте, и САМО НАЗВАНИЕ, если его там нет. Второй случай
  // настоящий: школа заводит свой предмет («Схемотехника»), в карте его нет,
  // и в колонке оказывается русское слово.
  //
  // 22.08.2026 — ОТСЮДА И БРАЛАСЬ ПУСТОТА. Форма сравнивала только по слагу
  // (`getSubjectKeyByLabel(c.name) === currentSlug`), для своего предмета
  // получала null против «Схемотехника», совпадения не находила и открывала
  // пустое поле выбора. Затирания не было — поле обязательное, — но админ,
  // зашедший переименовать группу, выбирал предмет заново и мог промахнуться.
  // Теперь сравнение повторяет запись сервера буква в букву.
  const storedFor = (name: string) => getSubjectKeyByLabel(name) ?? name;

  // Скрытые предметы не предлагаем; но если у редактируемой группы стоит
  // именно скрытый — оставляем его в списке, иначе сохранение молча
  // переключило бы предмет на другой.
  const currentSlug = defaultValues?.subject ?? "";
  const options = catalog.filter((c) => c.is_active || storedFor(c.name) === currentSlug);
  const matched = options.find((c) => storedFor(c.name) === currentSlug);

  // Предмет группы, которого в справочнике больше нет (переименовали, завели
  // группу до справочника). Показываем его КАК ЕСТЬ вместо пустоты — иначе
  // админ не видит, что вообще стоит у группы. Выбрать его снова нельзя:
  // строка неактивна и её значение пустое, а поле обязательное, поэтому
  // сохранить, не выбрав живой предмет, браузер не даст. Молча подменить
  // предмет тоже невозможно.
  const orphanSubject = currentSlug && !matched ? currentSlug : null;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}
      className="space-y-4"
    >
      <Field label={t.fieldGroupName}>
        <Input name="name" required placeholder="Математика 7А" defaultValue={defaultValues?.name} />
      </Field>
      <Field label={t.fieldSubject}>
        {/* Z.2.2: значение — id записи справочника; слаг для groups.subject
            резолвит server action. Пустой справочник = новая школа, админ
            заводит предметы на /admin/subjects. */}
        <Select
          name="subject_catalog_id"
          required
          defaultValue={matched?.id ?? ""}
        >
          <option value="" disabled>
            {orphanSubject ?? (catalog.length === 0 ? t.groupsNoSubjectsYet : t.selectSubjectPlaceholder)}
          </option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.is_active ? "" : ` (${t.subjectsHiddenBadge})`}
            </option>
          ))}
        </Select>
      </Field>
      {/* ПОЛЯ КУРАТОРА ЗДЕСЬ БОЛЬШЕ НЕТ (30.08.2026). Роль убрана из
          продукта: миграция 242 обнулила groups.teacher_id у всех групп и
          удалила единственного куратора, 243 снимает правила и триггеры.
          Форма перестаёт присылать teacher_id — server action уже умеет
          обходиться без него и пишет null (см. admin/actions.ts). */}
      {/* Заход 2 по платежам. Цену задаёт ТОЛЬКО админ школы: у учителя
          этой формы нет вовсе, а правило доступа на groups даёт запись
          одному fn_is_admin() своей школы. */}
      <Field label={t.fieldCoursePrice}>
        <CoursePriceInput defaultValue={defaultValues?.course_price ?? 0} />
        <p className="text-xs text-gray-400">{t.coursePriceHint}</p>
      </Field>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
        <button type="submit" disabled={isPending} className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60">
          {isPending ? "…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function GroupsView({
  groups,
  catalog,
  defaultOpenAdd,
}: {
  groups: Group[];
  catalog: CatalogItem[];
  defaultOpenAdd?: boolean;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.admin;

  // Z.2.2: подпись предмета в таблице берём из справочника школы, а не из
  // захардкоженной карты. groups.subject хранит слаг, справочник — русские
  // названия, поэтому мост тот же getSubjectKeyByLabel.
  const nameBySlug = new Map<string, string>();
  for (const c of catalog) {
    const slug = getSubjectKeyByLabel(c.name);
    if (slug) nameBySlug.set(slug, c.name);
  }

  // Форма группы требует предмет из справочника. Пока активных предметов
  // нет, создавать нечем — и это должно решаться ДО открытия окна.
  //
  // 03.09.2026 — ДЫРА, ЗАКРЫТАЯ ЗДЕСЬ. Кнопка выключалась по noSubjects, а
  // окно, открытое сразу по адресу /admin/groups?action=add с дашборда, про
  // запрет не знало вовсе: список предметов пуст, поле обязательное, форма
  // открывалась в тупик. Поэтому noSubjects считается выше состояния и входит
  // в его начальное значение.
  const noSubjects = catalog.filter((cItem) => cItem.is_active).length === 0;

  const [modal, setModal] = useState<Modal | null>(
    defaultOpenAdd && !noSubjects ? { kind: "add" } : null,
  );
  const [search, setSearch] = useState("");
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Z.2.9 — второй клик до перерисовки больше не создаёт вторую запись.
  const guard = useSubmitGuard();

  // ═══ МАССОВОЕ СОЗДАНИЕ ГРУПП (пункт 227) ═══════════════════════════════
  //
  // СПИСОК ИМЁН — ОСНОВА, ШАБЛОН — ПОМОЩНИК. Диапазон «с 1 по 12» покрывает
  // только школьные классы; у центра имена вида «Science 1-класс» и «W-5».
  // Поэтому шаблон лишь ЗАПОЛНЯЕТ правимый список, а не заменяет его.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPattern, setBulkPattern] = useState(`${GROUP_TEMPLATE_NUMBER}-${GROUP_TEMPLATE_LETTER} класс`);
  const [bulkFrom, setBulkFrom] = useState("1");
  const [bulkTo, setBulkTo] = useState("11");
  const [bulkLetters, setBulkLetters] = useState("А");
  const [bulkNames, setBulkNames] = useState("");
  const [bulkSubject, setBulkSubject] = useState("");
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkTruncated, setBulkTruncated] = useState<number | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkGroupsResult | null>(null);
  const [bulkError, setBulkError] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Занятость считается ПРЯМО ЗДЕСЬ, из уже загруженных групп: второго
  // запроса за ней нет и заводить его незачем. Правило сравнения имён — одно
  // на клиент и сервер, живёт в ядре (checkGroupNames → groupNameKey).
  const bulkList = bulkNames.split("\n").map((x) => x.trim()).filter(Boolean);
  const bulkCheck = checkGroupNames(bulkList, groups.map((g) => g.name));

  function openBulk() {
    setBulkNames("");
    setBulkSubject("");
    setBulkPrice("");
    setBulkTruncated(null);
    setBulkResult(null);
    setBulkError("");
    setBulkOpen(true);
  }

  /** Подстановка по шаблону. Заменяет список ЦЕЛИКОМ — об этом сказано над
   *  кнопкой, чтобы набранное руками не пропадало неожиданно. */
  function fillFromTemplate() {
    const from = Number.parseInt(bulkFrom, 10);
    const to = Number.parseInt(bulkTo, 10);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;
    const { names, wouldBe } = expandGroupNames({
      pattern: bulkPattern, from, to, letters: parseGroupLetters(bulkLetters),
    });
    setBulkNames(names.join("\n"));
    // Обрезание не молчит: человек просил 999, получил 200.
    setBulkTruncated(wouldBe > names.length ? wouldBe : null);
    setBulkResult(null);
    setBulkError("");
  }

  function handleBulkCreate() {
    if (bulkCheck.fresh.length === 0 || !bulkSubject) return;
    setBulkBusy(true);
    setBulkError("");
    const fd = new FormData();
    fd.set("names", JSON.stringify(bulkCheck.fresh));
    fd.set("subject_catalog_id", bulkSubject);
    fd.set("course_price", bulkPrice);
    startTransition(async () => {
      try {
        const итог = await unwrap(actionCreateGroupsBulk(fd));
        setBulkResult(итог);
        // Созданные имена уходят из списка: повторное нажатие не должно
        // пытаться завести их снова.
        setBulkNames(
          [...итог.failed.map((f) => f.name), ...bulkCheck.taken, ...bulkCheck.duplicated].join("\n"),
        );
      } catch (e) {
        setBulkError(humanizeAdminError(e, locale as Locale));
      } finally {
        setBulkBusy(false);
      }
    });
  }

  function flash(msg: string) {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(null), 5000);
  }

  const emptyText = search.trim()
    ? t.noResults
    : noSubjects ? t.emptyGroupsNeedSubject : t.emptyGroups;

  const filtered = groups.filter((g) => {
    const q = search.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.subject.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t.groupsTitle}</h1>
        <button
          onClick={openBulk}
          disabled={noSubjects}
          title={noSubjects ? t.needSubjectFirst : undefined}
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ListPlus className="h-4 w-4" />
          {t.groupsBulk}
        </button>
        <button
          onClick={() => setModal({ kind: "add" })}
          disabled={noSubjects}
          title={noSubjects ? t.needSubjectFirst : undefined}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-500"
        >
          <Plus className="h-4 w-4" />
          {t.addGroupTitle}
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
            placeholder={t.groupsSearchPlaceholder}
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm outline-none ring-1 ring-gray-200 focus:ring-amber-400"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">{t.fieldGroupName}</th>
                <th className="px-4 py-3">{t.fieldSubject}</th>
                <th className="px-4 py-3">{t.tableStudentCount}</th>
                <th className="px-4 py-3">{t.tableCoursePrice}</th>
                <th className="px-4 py-3 text-right">{t.tableActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">{emptyText}</td>
                </tr>
              ) : (
                filtered.map((g) => {
                  const subjectLabel = nameBySlug.get(g.subject) ?? g.subject;
                  return (
                    <tr key={g.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3 font-medium text-gray-800">{g.name}</td>
                      <td className="px-4 py-3 text-gray-500">{subjectLabel}</td>
                      <td className="px-4 py-3 text-gray-500">{g.student_groups.length}</td>
                      {/* «0 сум» здесь был бы неправдой: ноль означает, что
                          цену ещё не заполнили. Так и пишем. */}
                      <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                        {g.course_price > 0
                          ? `${formatCoursePrice(g.course_price)} ${t.sumUnit}`
                          : <span className="text-gray-300">{t.coursePriceNotSet}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setModal({ kind: "edit", group: g })} className="rounded-lg p-1.5 text-gray-400 hover:bg-violet-50 hover:text-violet-600" title={t.editBtn}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setModal({ kind: "delete", group: g })} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title={t.deleteBtn}>
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

      {/* ── МАССОВОЕ СОЗДАНИЕ ГРУПП (пункт 227) ─────────────────────── */}
      {bulkOpen && (
        <Backdrop onClose={() => !bulkBusy && setBulkOpen(false)}>
          <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-5">
              <h2 className="text-lg font-bold text-gray-800">{t.groupsBulkTitle}</h2>
              <button
                onClick={() => setBulkOpen(false)}
                disabled={bulkBusy}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <p className="text-xs leading-relaxed text-gray-500">{t.groupsBulkHint}</p>

              {/* ── ШАБЛОН-ПОМОЩНИК. Он ЗАПОЛНЯЕТ список, а не заменяет его
                     собой: центру с именами «Science 1-класс» и «W-5» шаблон
                     не подходит, и он просто печатает своё. ────────────── */}
              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                <Field label={t.groupsBulkTemplate}>
                  <Input
                    value={bulkPattern}
                    onChange={(e) => setBulkPattern(e.target.value)}
                    autoComplete="off"
                  />
                </Field>
                <p className="text-[11px] leading-snug text-gray-400">{t.groupsBulkTemplateHint}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    {t.groupsBulkFrom}
                    <input
                      value={bulkFrom}
                      onChange={(e) => setBulkFrom(e.target.value.replace(/[^\d-]/g, ""))}
                      inputMode="numeric"
                      className="w-14 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-amber-400"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600">
                    {t.groupsBulkTo}
                    <input
                      value={bulkTo}
                      onChange={(e) => setBulkTo(e.target.value.replace(/[^\d-]/g, ""))}
                      inputMode="numeric"
                      className="w-14 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-amber-400"
                    />
                  </label>
                  <label className="flex min-w-[9rem] flex-1 items-center gap-1.5 text-xs text-gray-600">
                    {t.groupsBulkLetters}
                    <input
                      value={bulkLetters}
                      onChange={(e) => setBulkLetters(e.target.value)}
                      placeholder={t.groupsBulkLettersPlaceholder}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-amber-400"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={fillFromTemplate}
                    className="rounded-xl bg-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-300"
                  >
                    {t.groupsBulkFill}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">{t.groupsBulkOverwrite}</p>
              </div>

              {/* ── СПИСОК ИМЁН. Он же и есть показ до согласия: видно не
                     «будет создано 24», а двадцать четыре имени. ───────── */}
              <Field label={t.groupsBulkNames.replace("{n}", String(bulkList.length))}>
                <textarea
                  value={bulkNames}
                  onChange={(e) => { setBulkNames(e.target.value); setBulkResult(null); setBulkError(""); }}
                  rows={7}
                  placeholder={t.groupsBulkNamesPlaceholder}
                  className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                />
              </Field>

              {bulkTruncated !== null && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
                  {t.groupsBulkTooMany
                    .replace("{n}", String(bulkTruncated))
                    .replace("{max}", String(GROUP_BULK_MAX))}
                </p>
              )}

              <Field label={t.fieldSubject}>
                <select
                  value={bulkSubject}
                  onChange={(e) => setBulkSubject(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                >
                  <option value="" disabled>{t.selectSubjectPlaceholder}</option>
                  {catalog.filter((cItem) => cItem.is_active).map((cItem) => (
                    <option key={cItem.id} value={cItem.id}>{cItem.name}</option>
                  ))}
                </select>
              </Field>

              <Field label={t.fieldCoursePrice}>
                <Input
                  value={bulkPrice}
                  onChange={(e) => setBulkPrice(formatCoursePriceInput(e.target.value))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                />
                <p className="text-xs text-gray-400">{t.groupsBulkPriceHint}</p>
                {/* Про ноль говорим прямо: fn_issue_monthly_invoices берёт
                    только группы с course_price > 0, и ученик такой группы
                    попадает в «помехи» с причиной no_price. Проверено на
                    живой базе 03.09.2026. */}
                {bulkPrice.replace(/\s/g, "") === "" && (
                  <p className="text-xs text-amber-700">{t.groupsBulkZeroPrice}</p>
                )}
              </Field>

              {/* ── ЧТО ПРОИЗОЙДЁТ ─────────────────────────────────────── */}
              {bulkList.length > 0 && (
                <div className="space-y-1 rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs">
                  {bulkCheck.fresh.length === 0 ? (
                    <p className="text-amber-800">{t.groupsBulkNothing}</p>
                  ) : (
                    <>
                      <p className="font-semibold text-gray-800">
                        {t.groupsBulkWillCreate.replace("{n}", String(bulkCheck.fresh.length))}
                      </p>
                      <p className="text-gray-600">
                        {t.groupsBulkThreads.replace("{n}", String(chatThreadsForGroups(bulkCheck.fresh.length)))}
                      </p>
                    </>
                  )}
                  {bulkCheck.taken.length > 0 && (
                    <p className="text-gray-500">
                      <span className="font-semibold">
                        {t.groupsBulkTaken.replace("{n}", String(bulkCheck.taken.length))}:
                      </span>{" "}
                      {bulkCheck.taken.join(", ")}
                    </p>
                  )}
                  {bulkCheck.duplicated.length > 0 && (
                    <p className="text-gray-500">
                      <span className="font-semibold">
                        {t.groupsBulkDuplicated.replace("{n}", String(bulkCheck.duplicated.length))}:
                      </span>{" "}
                      {bulkCheck.duplicated.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* ── ЧТО ПОЛУЧИЛОСЬ. Обе правды сразу ───────────────────── */}
              {bulkResult && (
                <div className="space-y-1 rounded-xl bg-emerald-50 p-3 text-xs">
                  <p className="font-semibold text-emerald-800">
                    {t.groupsBulkDone.replace("{created}", String(bulkResult.created))}
                  </p>
                  {bulkResult.blocked.length > 0 && (
                    <p className="text-amber-700">
                      {t.groupsBulkSkipped.replace("{n}", String(bulkResult.blocked.length))}
                    </p>
                  )}
                  {bulkResult.failed.length > 0 && (
                    <div className="border-t border-emerald-100 pt-1.5">
                      <p className="font-semibold text-red-700">
                        {t.groupsBulkFailedTitle.replace("{n}", String(bulkResult.failed.length))}
                      </p>
                      <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto">
                        {bulkResult.failed.map((f, i) => (
                          <li key={i} className="text-red-600">
                            {t.groupsBulkFailedRow.replace("{name}", f.name).replace("{reason}", f.reason)}
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

            <div className="flex gap-3 border-t border-gray-100 p-5">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                disabled={bulkBusy}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                {t.cancelBtn}
              </button>
              <button
                type="button"
                onClick={handleBulkCreate}
                disabled={bulkBusy || bulkCheck.fresh.length === 0 || !bulkSubject}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListPlus className="h-4 w-4" />}
                {bulkBusy
                  ? t.groupsBulkCreating
                  : `${t.groupsBulkCreate} (${bulkCheck.fresh.length})`}
              </button>
            </div>
          </div>
        </Backdrop>
      )}

      {modal?.kind === "add" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={t.addGroupTitle} onClose={() => setModal(null)}>
            <GroupForm
              catalog={catalog}
              isPending={isPending}
              t={t}
              onClose={() => setModal(null)}
              onSubmit={(fd) => guard(startTransition, async () => {
                try {
                  await unwrap(actionCreateGroup(fd));
                  flash(t.groupCreatedMsg.replace("{name}", String(fd.get("name"))));
                  setModal(null);
                } catch (e) {
                  flash(humanizeAdminError(e, locale as Locale));
                }
              })}
              submitLabel={t.createBtn}
            />
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "edit" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={t.editGroupTitle} onClose={() => setModal(null)}>
            <GroupForm
              defaultValues={modal.group}
              catalog={catalog}
              isPending={isPending}
              t={t}
              onClose={() => setModal(null)}
              onSubmit={(fd) => {
                fd.append("group_id", modal.group.id);
                startTransition(async () => {
                  try {
                    await unwrap(actionUpdateGroup(fd));
                    flash(t.groupUpdatedMsg);
                    setModal(null);
                  } catch (e) {
                    flash(humanizeAdminError(e, locale as Locale));
                  }
                });
              }}
              submitLabel={t.saveBtn}
            />
          </ModalCard>
        </Backdrop>
      )}

      {modal?.kind === "delete" && (
        <Backdrop onClose={() => setModal(null)}>
          <ModalCard title={t.deleteGroupTitle} onClose={() => setModal(null)}>
            <p className="mb-2 text-sm text-gray-600">
              {t.deleteGroupConfirm.replace("{name}", modal.group.name)}
            </p>
            <p className="mb-6 text-xs font-semibold text-red-600">{t.deleteWarning}</p>
            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">{t.cancelBtn}</button>
              <button
                onClick={() => startTransition(async () => {
                  try {
                    await unwrap(actionDeleteGroup(modal.group.id));
                    flash(t.groupDeletedMsg);
                    setModal(null);
                  } catch (e) {
                    flash(humanizeAdminError(e, locale as Locale));
                  }
                })}
                disabled={isPending}
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

"use client";

// ЕДИНОЕ ОКНО СОЗДАНИЯ. Пункт 228, 03.09.2026.
//
// ═══ ПОЧЕМУ НА ДАШБОРДЕ, А НЕ НА «ГРУППАХ» ════════════════════════════════
//
// На /admin/groups уже две кнопки — «Создать группу» и «Создать сразу
// несколько». Третья рядом стала бы загадкой: человек не поймёт, чем они
// отличаются. А на дашборде есть готовая, никем не занятая точка входа —
// «Быстрые действия», где сегодня ровно три ссылки.
//
// Разделение при этом честное, и это не отговорка:
//
//   дашборд              одна группа со СВОИМИ предметами и учителем, целиком
//   /admin/groups        одна группа | много групп (предмет один на пачку)
//   /admin/subject-assignments   много назначений на одного учителя
//
// Массовое создание групп для этой задачи не годится вовсе: предмет там один
// на всю пачку, а тут у одного класса их три.
//
// ═══ ПОРЯДОК НА ЭКРАНЕ И ПОРЯДОК ЗАПИСИ — РАЗНЫЕ ══════════════════════════
//
// Видно: группа → предметы → учитель. Пишется: справочник → группа →
// назначения, потому что groups.subject объявлен NOT NULL и берётся из
// справочника, а назначение требует готовую группу. Окно прячет этот
// порядок, а не спорит с ним.
//
// ═══ ЗАНЯТОЕ ПОКАЗЫВАЕТСЯ ДО ЗАПИСИ ═══════════════════════════════════════
//
// Имя группы — против существующих (то же правило, что у индекса из миграции
// 249: без регистра и краевых пробелов). Новые предметы — против справочника,
// тоже без регистра: в базе на school_subjects уникальность С учётом
// регистра, и «робототехника» легла бы рядом с «Робототехника». Отбиваем
// здесь и на сервере; саму уникальность в базе не трогаем.

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { X, Sparkles, Loader2, AlertTriangle, Check } from "lucide-react";
import { getDictionary, groupNameKey, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ВыборГалочками } from "@/components/CheckboxPicker";
import { humanizeAdminError } from "@/lib/admin-error-messages";
import { unwrap } from "@/lib/action-result";
import { formatCoursePriceInput } from "@/lib/course-price";
import { actionQuickStart, actionQuickStartData } from "./actions";
import type { QuickStartResult } from "@/lib/admin-api";

type Данные = {
  catalog: Array<{ id: string; name: string; is_active: boolean }>;
  groups: Array<{ id: string; name: string }>;
  teachers: Array<{ id: string; full_name: string }>;
};

export function QuickStartModal({
  onClose,
  /**
   * Школа. Срез 3c: у менеджера дашборда админа нет, и окно живёт на
   * ОБЗОРНОЙ вкладке школы — она и есть его дашборд для этой школы. Оттуда
   * школа и приходит.
   *
   * Не передана — работает как раньше, у админа его собственная школа.
   */
  schoolId,
}: {
  onClose: () => void;
  schoolId?: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;

  const [данные, setДанные] = useState<Данные | null>(null);
  const [groupName, setGroupName] = useState("");
  const [price, setPrice] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [newNames, setNewNames] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [result, setResult] = useState<QuickStartResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  // Списки грузятся ПО ОТКРЫТИЮ, а не на каждый заход на дашборд: он и без
  // того делает одиннадцать счётных запросов, а это окно открывают редко.
  useEffect(() => {
    let жив = true;
    startTransition(async () => {
      try {
        const r = await unwrap(actionQuickStartData(schoolId));
        if (жив) setДанные(r);
      } catch (e) {
        if (жив) setError(humanizeAdminError(e, locale as Locale));
      }
    });
    return () => { жив = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const активные = (данные?.catalog ?? []).filter((c) => c.is_active);

  // ── занятость имени группы ──
  const имяЗанято = Boolean(
    groupName.trim()
    && (данные?.groups ?? []).some((g) => groupNameKey(g.name) === groupNameKey(groupName)),
  );

  // ── новые предметы: что из них уже есть в справочнике (без регистра) ──
  const новые = newNames.split("\n").map((x) => x.trim()).filter(Boolean);
  const ключиСправочника = new Set((данные?.catalog ?? []).map((c) => c.name.trim().toLowerCase()));
  const ужеЕсть: string[] = [];
  const действительноНовые: string[] = [];
  const виденные = new Set<string>();
  for (const имя of новые) {
    const ключ = имя.toLowerCase();
    if (виденные.has(ключ)) continue;
    виденные.add(ключ);
    if (ключиСправочника.has(ключ)) ужеЕсть.push(имя);
    else действительноНовые.push(имя);
  }

  const назначений = picked.size + новые.length > 0
    ? picked.size + действительноНовые.length + ужеЕсть.length
    : 0;
  const можно = Boolean(groupName.trim()) && !имяЗанято && !busy && !result;

  function создать() {
    if (!можно) return;
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.set("group_name", groupName.trim());
    fd.set("course_price", price);
    fd.set("catalog_ids", JSON.stringify([...picked]));
    fd.set("new_subject_names", JSON.stringify(новые));
    fd.set("teacher_id", teacherId);
    if (schoolId) fd.set("school_id", schoolId);
    startTransition(async () => {
      try {
        setResult(await unwrap(actionQuickStart(fd)));
      } catch (e) {
        setError(humanizeAdminError(e, locale as Locale));
      } finally {
        setBusy(false);
      }
    });
  }

  const шаг = (n: number, подпись: string) => (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">{n}</span>
      <span className="text-sm font-bold text-gray-800">{подпись}</span>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-800">{d.quickStartTitle}</h2>
          <button onClick={onClose} disabled={busy} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <p className="text-xs leading-relaxed text-gray-500">{d.quickStartHint}</p>

          {!данные ? (
            <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> …
            </div>
          ) : (
            <>
              {/* ── ШАГ 1. ГРУППА ─────────────────────────────────────── */}
              <div>
                {шаг(1, d.quickStartStepGroup)}
                <input
                  value={groupName}
                  onChange={(e) => { setGroupName(e.target.value); setResult(null); setError(""); }}
                  placeholder={d.quickStartGroupNamePlaceholder}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                />
                {/* Занятое имя видно ДО записи. Индекс из миграции 249 отобьёт
                    его и на сервере, но человеку надо сказать раньше. */}
                {имяЗанято && (
                  <p className="mt-1 text-xs font-semibold text-red-600">{d.quickStartNameTaken}</p>
                )}
                <input
                  value={price}
                  onChange={(e) => setPrice(formatCoursePriceInput(e.target.value))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                />
                <p className="mt-1 text-xs text-gray-400">{d.quickStartPriceHint}</p>
              </div>

              {/* ── ШАГ 2. ПРЕДМЕТЫ ───────────────────────────────────── */}
              <div>
                {шаг(2, d.quickStartStepSubjects)}
                {активные.length === 0 ? (
                  <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {d.quickStartCatalogEmpty}
                  </p>
                ) : (
                  <ВыборГалочками
                    title={d.quickStartFromCatalog.replace("{n}", String(picked.size))}
                    items={активные.map((c) => ({ id: c.id, label: c.name }))}
                    picked={picked}
                    onToggle={(id) => {
                      const копия = new Set(picked);
                      if (копия.has(id)) копия.delete(id); else копия.add(id);
                      setPicked(копия);
                      setResult(null);
                    }}
                    onAll={() => { setPicked(new Set(активные.map((c) => c.id))); setResult(null); }}
                    onNone={() => { setPicked(new Set()); setResult(null); }}
                    allLabel={d.assignmentsBulkSelectAll}
                    noneLabel={d.assignmentsBulkClear}
                  />
                )}

                <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {d.quickStartNewSubjects}
                </label>
                <textarea
                  value={newNames}
                  onChange={(e) => { setNewNames(e.target.value); setResult(null); }}
                  rows={3}
                  placeholder={d.quickStartNewSubjectsPlaceholder}
                  className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                />
                <p className="mt-1 text-xs text-gray-400">{d.quickStartNewHint}</p>
                {/* Двойник по регистру не заводится, и человеку об этом
                    говорят заранее — иначе он увидит в списке два предмета и
                    не поймёт, какой выбирать. */}
                {ужеЕсть.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    {d.quickStartAlreadyInCatalog
                      .replace("{n}", String(ужеЕсть.length))
                      .replace("{names}", ужеЕсть.join(", "))}
                  </p>
                )}
              </div>

              {/* ── ШАГ 3. УЧИТЕЛЬ ────────────────────────────────────── */}
              <div>
                {шаг(3, d.quickStartStepTeacher)}
                <select
                  value={teacherId}
                  onChange={(e) => { setTeacherId(e.target.value); setResult(null); }}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
                >
                  <option value="">{d.subjectsNotAssigned}</option>
                  {данные.teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">{d.quickStartTeacherHint}</p>
              </div>

              {/* ── ЧТО ПРОИЗОЙДЁТ ───────────────────────────────────── */}
              {groupName.trim() && !имяЗанято && !result && (
                <div className="space-y-1 rounded-xl border border-violet-100 bg-violet-50/50 p-3 text-xs">
                  <p className="font-semibold text-violet-900">{d.quickStartPlanTitle}</p>
                  <p className="text-gray-700">
                    {d.quickStartPlanGroup.replace("{name}", groupName.trim())}
                  </p>
                  {назначений === 0 ? (
                    <p className="text-amber-700">{d.quickStartPlanNoSubjects}</p>
                  ) : (
                    <>
                      {действительноНовые.length > 0 && (
                        <p className="text-gray-700">
                          {d.quickStartPlanSubjectsNew.replace("{n}", String(действительноНовые.length))}
                        </p>
                      )}
                      <p className="text-gray-700">
                        {d.quickStartPlanAssignments.replace("{n}", String(назначений))}
                      </p>
                    </>
                  )}
                  <p className="text-gray-500">{d.quickStartPlanThreads}</p>
                </div>
              )}

              {/* ── ЧТО ПОЛУЧИЛОСЬ ───────────────────────────────────── */}
              {result && (
                <div className="space-y-1.5 rounded-xl bg-emerald-50 p-3 text-xs">
                  <p className="font-semibold text-emerald-800">
                    {d.quickStartDone
                      .replace("{name}", result.groupName)
                      .replace("{subjects}", String(result.subjectsCreated))
                      .replace("{assignments}", String(result.assignments.created + result.assignments.assigned))}
                  </p>
                  {result.subjectsFailed.length > 0 && (
                    <p className="text-red-600">
                      {d.quickStartFailedSubjects
                        .replace("{n}", String(result.subjectsFailed.length))
                        .replace("{names}", result.subjectsFailed.map((f) => f.name).join(", "))}
                    </p>
                  )}
                  {result.assignments.failed.length > 0 && (
                    <div>
                      <p className="font-semibold text-red-700">
                        {d.quickStartFailedAssignments.replace("{n}", String(result.assignments.failed.length))}
                      </p>
                      <ul className="mt-0.5 max-h-24 space-y-0.5 overflow-y-auto">
                        {result.assignments.failed.map((f, i) => (
                          <li key={i} className="text-red-600">{f.subjectName} · {f.groupName}: {f.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Link
                    href="/admin/subject-assignments"
                    className="inline-block font-semibold text-violet-700 hover:underline"
                  >
                    {d.quickStartOpenGroup}
                  </Link>
                </div>
              )}

              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {result ? d.quickStartClose : d.cancelBtn}
          </button>
          {!result && (
            <button
              type="button"
              onClick={создать}
              disabled={!можно}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {busy ? d.quickStartCreating : d.quickStartCreate}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Кнопка входа. Живёт в «Быстрых действиях» дашборда — точке входа, которая
 *  до сих пор пустовала. */
export function QuickStartButton({ schoolId }: { schoolId?: string } = {}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).admin;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-violet-700"
      >
        <Sparkles className="h-4 w-4" /> {d.quickStart}
      </button>
      {open && <QuickStartModal onClose={() => setOpen(false)} schoolId={schoolId} />}
    </>
  );
}

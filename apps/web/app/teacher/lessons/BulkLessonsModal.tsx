"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, CalendarRange, Check, AlertTriangle } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale, SubjectWithGroup } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Массовое создание уроков: правило «эти дни недели, это время, с такого числа
 * по такое» вместо сотни отдельных нажатий.
 *
 * ДВА ШАГА, И ВТОРОЙ НЕОБРАТИМ ТОЛЬКО ПОСЛЕ СОГЛАСИЯ. Сначала окно показывает
 * раскладку: сколько уроков, на какие даты, какая тема куда встанет, что
 * пропущено. Создание идёт отдельным нажатием. Считает раскладку сервер — тем
 * же кодом, что потом создаёт, — поэтому показанное и созданное не могут
 * разойтись.
 *
 * ПОЧЕМУ РАСКЛАДКА НЕ СЧИТАЕТСЯ ЗДЕСЬ. Занятость слота видно только по урокам
 * группы, а их браузеру никто не отдаст целиком. Да и правило «не в прошлом»
 * зависит от школьного времени, которое живёт на сервере.
 */

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

type PlannedLesson = {
  date: string;
  time: string;
  occupied: boolean;
  topicId: string | null;
  topicTitle: string | null;
};

type PreviewResult = {
  lessons: PlannedLesson[];
  willCreate: number;
  occupied: number;
  lessonsWithoutTopic: number;
  topicsLeftOver: number;
  topicsAvailable: number;
  planTitle: string | null;
};

const inputCls =
  "rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#1D1D1F] outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</label>
      {children}
    </div>
  );
}

export function BulkLessonsModal({
  groups,
  teacherSubjects,
  onClose,
  onCreated,
}: {
  groups: Array<{ id: string; name: string }>;
  teacherSubjects: SubjectWithGroup[];
  onClose: () => void;
  /** Создано — родитель перечитывает месяц. */
  onCreated: (count: number) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.teacher;

  const wdLabel: Record<number, string> = {
    1: t.wdMon, 2: t.wdTue, 3: t.wdWed, 4: t.wdThu, 5: t.wdFri, 6: t.wdSat, 7: t.wdSun,
  };

  // Только те группы, где у учителя есть предмет: без предмета урок всё равно
  // не создать, и предлагать такую группу значит вести в тупик.
  const usableGroups = useMemo(
    () => groups.filter((g) => teacherSubjects.some((s) => s.group_id === g.id)),
    [groups, teacherSubjects],
  );

  const [groupId, setGroupId] = useState(usableGroups[0]?.id ?? "");
  const subjectsOfGroup = useMemo(
    () => teacherSubjects.filter((s) => s.group_id === groupId),
    [teacherSubjects, groupId],
  );
  const [subjectId, setSubjectId] = useState(subjectsOfGroup[0]?.id ?? "");
  useEffect(() => { setSubjectId(subjectsOfGroup[0]?.id ?? ""); }, [subjectsOfGroup]);

  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("09:00");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [room, setRoom] = useState("");
  const [useTopics, setUseTopics] = useState(true);

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);

  function toggleWeekday(n: number) {
    setPreview(null);
    setWeekdays((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort()));
  }

  function payload(isPreview: boolean) {
    return {
      groupId, subjectId, weekdays, time, from, to,
      useTopics,
      // Длительность не шлём: с 01.09.2026 (миграция 246) её задаёт школа
      // одним числом, роут читает его сам. Здесь было поле — третий источник.
      room: room.trim() || undefined,
      preview: isPreview,
    };
  }

  async function run(isPreview: boolean) {
    setError(null);
    if (weekdays.length === 0) { setError(t.bulkPickWeekday); return; }
    if (!from || !to) { setError(t.bulkBadPeriod); return; }
    if (to < from) { setError(t.bulkBadPeriod); return; }

    setBusy(true);
    try {
      const res = await fetch("/api/lessons/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(isPreview)),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Не получилось"); return; }
      if (isPreview) setPreview(json as PreviewResult);
      else { setDoneCount(json.created as number); onCreated(json.created as number); }
    } catch {
      setError("Ошибка сети");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-base font-bold text-[#1D1D1F]">{t.bulkTitle}</h2>
              <p className="text-xs text-gray-400">{t.bulkSubtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {doneCount !== null ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
                <Check className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-[#1D1D1F]">{t.bulkDone.replace("{n}", String(doneCount))}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label={t.bulkGroup}>
                  <select
                    value={groupId}
                    onChange={(e) => { setGroupId(e.target.value); setPreview(null); }}
                    className={inputCls}
                  >
                    {usableGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </Field>
                <Field label={t.bulkSubject}>
                  <select
                    value={subjectId}
                    onChange={(e) => { setSubjectId(e.target.value); setPreview(null); }}
                    className={inputCls}
                  >
                    {subjectsOfGroup.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              </div>

              <Field label={t.bulkWeekdays}>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((n) => {
                    const on = weekdays.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleWeekday(n)}
                        className={`h-9 w-11 rounded-lg text-xs font-bold transition-colors ${
                          on ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {wdLabel[n]}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Поля длительности здесь больше нет (01.09.2026, миграция 246):
                  одно число на школу задаёт суперадмин в её карточке. */}
              <div className="grid grid-cols-3 gap-4">
                <Field label={t.bulkTime}>
                  <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setPreview(null); }} className={inputCls} />
                </Field>
                <Field label={t.bulkFrom}>
                  <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} className={inputCls} />
                </Field>
                <Field label={t.bulkTo}>
                  <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} className={inputCls} />
                </Field>
              </div>

              <Field label={t.bulkRoom}>
                <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Кабинет 101" className={inputCls} />
              </Field>

              <label className="flex items-start gap-2.5 rounded-xl bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={useTopics}
                  onChange={(e) => { setUseTopics(e.target.checked); setPreview(null); }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {t.bulkTopics}
                  {preview && useTopics && (
                    <span className="mt-0.5 block text-[11px] text-gray-400">
                      {preview.planTitle
                        ? t.bulkTopicsHint.replace("{n}", String(preview.topicsAvailable))
                        : t.bulkTopicsNone}
                    </span>
                  )}
                </span>
              </label>

              {error && (
                <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              {/* ── Предпросмотр ────────────────────────────────────────── */}
              {preview && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-blue-700">{t.bulkPreviewTitle}</p>
                  <ul className="mb-2.5 space-y-0.5 text-sm text-gray-700">
                    <li className="font-semibold">{t.bulkWillCreate.replace("{n}", String(preview.willCreate))}</li>
                    {preview.occupied > 0 && <li>{t.bulkOccupied.replace("{n}", String(preview.occupied))}</li>}
                    {preview.lessonsWithoutTopic > 0 && <li>{t.bulkNoTopic.replace("{n}", String(preview.lessonsWithoutTopic))}</li>}
                    {preview.topicsLeftOver > 0 && <li>{t.bulkTopicsLeft.replace("{n}", String(preview.topicsLeftOver))}</li>}
                  </ul>

                  {preview.lessons.length === 0 ? (
                    <p className="text-sm text-gray-500">{t.bulkNothing}</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-blue-100 bg-white">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-gray-50">
                          {preview.lessons.map((l, i) => (
                            <tr key={`${l.date}-${i}`} className={l.occupied ? "text-gray-400" : "text-gray-700"}>
                              <td className="whitespace-nowrap px-2.5 py-1.5 font-semibold">{l.date}</td>
                              <td className="whitespace-nowrap px-2.5 py-1.5">{l.time}</td>
                              <td className="px-2.5 py-1.5">
                                {l.occupied
                                  ? <span className="italic">{t.bulkOccupiedRow}</span>
                                  : l.topicTitle ?? <span className="italic text-gray-400">{t.bulkNoTopicRow}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {doneCount === null && (
          <div className="flex shrink-0 gap-3 border-t border-gray-100 px-5 py-4">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              {d.common.cancel}
            </button>
            {preview ? (
              <>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  {t.bulkBack}
                </button>
                <button
                  onClick={() => run(false)}
                  disabled={busy || preview.willCreate === 0}
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {busy ? t.bulkCreating : t.bulkCreateBtn}
                </button>
              </>
            ) : (
              <button
                onClick={() => run(true)}
                disabled={busy || !groupId || !subjectId}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {busy ? t.bulkPreviewLoading : t.bulkPreviewBtn}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

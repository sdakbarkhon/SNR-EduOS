"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, AlertTriangle, BookOpen, ArrowRight } from "lucide-react";
import { getDictionary, tashkentDayKey } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { useSchoolNowSnapshot } from "@/components/SchoolTimeProvider";
import { addDaysUTC } from "@/lib/curriculum-lesson-planner";
import { HolidayCalendar, useHolidays, датыВыходных } from "@/components/teacher/HolidayCalendar";

/**
 * Массовое создание уроков: правило «эти дни недели, это время, начиная с
 * такого числа» вместо сотни отдельных нажатий.
 *
 * ═══ 03.09.2026 — ЭТО БОЛЬШЕ НЕ ОКНО, А БЛОК ВНУТРИ ОКНА УРОКА ════════════
 *
 * Отдельной кнопки «массовое создание» снаружи больше нет: заказчик просил
 * один вход в создание уроков с переключателем внутри. Группа, предмет и
 * кабинет стали общими и живут наверху окна — их значения приходят свойствами.
 *
 * ═══ 04.09.2026 — ТЕМЫ ТОЛЬКО ИЗ УЧЕБНОГО ПЛАНА ═══════════════════════════
 *
 * Галочки «брать темы из плана» больше нет, и второго режима тоже: пачка
 * уроков всегда идёт по темам плана, по одному уроку на тему, по порядку.
 *
 * ПОЧЕМУ ГАЛОЧКА УШЛА. Снятая, она создавала уроки без темы — а урок без темы
 * потом дозаполняют руками, и это ровно та работа, ради отказа от которой сюда
 * приходят. Плана нет — создавать нечего, и отказ ведёт туда, где план
 * заводят, а не просто говорит «нельзя».
 *
 * ПЕРИОД СЧИТАЕТСЯ САМ. Учитель называет день начала, а конец берётся с
 * запасом от числа свободных тем, и лишние дни отрезает сервер доводом
 * `onlyWithTopic` — тот же приём, что на шаге 1 учебного плана. Поля «по какое
 * число» нет намеренно: уроков ровно столько, сколько тем, и второе число
 * могло с этим только разойтись.
 *
 * ДВА ШАГА, И ВТОРОЙ НЕОБРАТИМ ТОЛЬКО ПОСЛЕ СОГЛАСИЯ. Сначала показывается
 * раскладка: сколько уроков, на какие даты, какая тема куда встанет. Создание
 * идёт отдельным нажатием. Считает раскладку сервер — тем же кодом, что потом
 * создаёт, — поэтому показанное и созданное не могут разойтись.
 *
 * ПОЧЕМУ РАСКЛАДКА НЕ СЧИТАЕТСЯ ЗДЕСЬ. Занятость слота видно только по урокам
 * группы, а их браузеру никто не отдаст целиком. Да и правило «не в прошлом»
 * зависит от школьного времени, которое живёт на сервере.
 */

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * ЗАПАС ПЕРИОДА В НЕДЕЛЯХ. Слот может оказаться занятым чужим уроком, и тогда
 * тема уходит следующему дню — период должен это пережить. Праздники считаются
 * отдельно: каждый убирает ровно один слот, поэтому их число прибавляется к
 * числу тем, а не гадается.
 */
const ЗАПАС_НЕДЕЛЬ = 4;

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
  /** Слоты, где урок уже стоит. Тему такой слот НЕ съедает — она достаётся
   *  следующему дню; это два разных числа, и показываются они порознь. */
  occupied: number;
  topicsLeftOver: number;
  topicsAvailable: number;
  /** Темы, по которым урок уже создан: в раздачу они не идут. */
  topicsAlreadyUsed: Array<{ id: string; title: string; lessons: number }>;
  planTitle: string | null;
};

/** Что известно про учебный план пары «группа + предмет». */
export type PlanState =
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "error" }
  | { kind: "ok"; freeTopics: number };

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

export function BulkLessonsFields({
  groupId,
  subjectId,
  room,
  groupName,
  subjectName,
  teacherId,
  plan,
  onCreated,
}: {
  /** Общие поля приходят сверху: они одни и те же у обоих режимов, и второй
   *  их набор внутри блока означал бы, что переключение теряет введённое. */
  groupId: string;
  subjectId: string;
  room: string;
  /** Названия — только для отказа: человеку надо видеть, для какой пары
   *  плана нет, иначе он пойдёт заводить не тот. */
  groupName: string;
  subjectName: string;
  /** Ключ памяти праздников. Тот же, что у учебного плана: праздники в стране
   *  одни, и отмеченные там должны подхватиться здесь. */
  teacherId: string;
  plan: PlanState;
  /** Создано — родитель перечитывает месяц и закрывает окно. */
  onCreated: (count: number) => void;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const t = d.teacher;
  const tc = d.curriculum;
  const schoolNowMs = useSchoolNowSnapshot();

  const wdLabel: Record<number, string> = {
    1: t.wdMon, 2: t.wdTue, 3: t.wdWed, 4: t.wdThu, 5: t.wdFri, 6: t.wdSat, 7: t.wdSun,
  };

  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [time, setTime] = useState("09:00");
  /**
   * ВРЕМЯ ПО КАЖДОМУ ДНЮ ОТДЕЛЬНО (02.09.2026, пункт 11).
   *
   * Выключено по умолчанию, и это главное: не тронул — все выбранные дни идут
   * в одно время, ровно как было. Семь полей ради одного урока никто
   * заполнять не должен.
   *
   * Включил — под днями появляется по строке на КАЖДЫЙ ВЫБРАННЫЙ день, каждая
   * заполнена общим временем. Меняет он только те, которым нужно своё.
   */
  const [perDay, setPerDay] = useState(false);
  const [timeByWeekday, setTimeByWeekday] = useState<Record<number, string>>({});

  /** Время дня недели: своё, если задано, иначе общее. Одно правило на показ и
   *  на отправку — второй копии счёта здесь нет. */
  const timeOf = (n: number) => timeByWeekday[n] ?? time;

  // Умолчание — школьное ЗАВТРА, как на шаге 1 учебного плана: если школьное
  // сейчас уже за полдень, утренние слоты сегодня в прошлом, а создание урока
  // прошлое отвергает — умолчание врало бы.
  const [from, setFrom] = useState(() => tashkentDayKey(schoolNowMs() + 24 * 60 * 60 * 1000));

  const выходные = useHolidays(teacherId, schoolNowMs());

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState<number | null>(null);

  // Сменили группу или предмет — раскладка стала не про них. Показывать её
  // дальше значило бы предложить создать чужие уроки.
  useEffect(() => { setPreview(null); setError(null); }, [groupId, subjectId]);

  function toggleWeekday(n: number) {
    setPreview(null);
    setWeekdays((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort()));
    // Сняли день — забываем его время. Иначе снятый день тихо хранил бы своё
    // значение и «оживал» при повторном включении не тем временем, которое
    // человек видит сейчас.
    setTimeByWeekday((cur) => {
      if (!(n in cur)) return cur;
      const копия = { ...cur };
      delete копия[n];
      return копия;
    });
  }

  function setDayTime(n: number, value: string) {
    setPreview(null);
    setTimeByWeekday((cur) => ({ ...cur, [n]: value }));
  }

  const свободныхТем = plan.kind === "ok" ? plan.freeTopics : 0;
  const праздники = датыВыходных(выходные.дни);

  /**
   * Конец периода. Считается от числа тем, а не спрашивается: уроков будет
   * ровно столько, сколько свободных тем, лишние дни отрежет сервер.
   * Праздник убирает ровно один слот — поэтому их число прибавляется к темам,
   * а не покрывается на глазок.
   */
  function конецПериода(): string {
    const слотов = свободныхТем + праздники.length;
    const недель = Math.ceil(слотов / Math.max(weekdays.length, 1)) + ЗАПАС_НЕДЕЛЬ;
    return addDaysUTC(from, недель * 7);
  }

  function payload(isPreview: boolean) {
    return {
      groupId, subjectId, weekdays, time,
      from, to: конецПериода(),
      // Своё время по дням шлём только когда режим включён. Выключен — поля
      // нет в запросе вовсе, и сервер работает как до пункта 11.
      timeByWeekday: perDay
        ? Object.fromEntries(weekdays.map((n) => [String(n), timeOf(n)]))
        : undefined,
      // Темы — всегда, другого режима больше нет. onlyWithTopic режет период
      // по числу тем: день без темы в раскладку не попадает вовсе.
      useTopics: true,
      onlyWithTopic: true,
      // Слот в праздник не рождается — и урок сдвигается на следующий рабочий
      // день сам, потому что темы садятся на слоты по порядку. Причина
      // праздника сюда не едет: серверу нужны только даты.
      holidays: праздники,
      // Длительность не шлём: с 01.09.2026 (миграция 246) её задаёт школа
      // одним числом, роут читает его сам. Здесь было поле — третий источник.
      room: room.trim() || undefined,
      preview: isPreview,
    };
  }

  async function run(isPreview: boolean) {
    setError(null);
    if (weekdays.length === 0) { setError(t.bulkPickWeekday); return; }
    if (!from) { setError(t.bulkBadPeriod); return; }
    if (свободныхТем === 0) { setError(tc.step1NoTopics); return; }

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

  // ── Плана нет: создавать нечего, но отказ говорит, что делать ─────────────
  //
  // Ссылка ведёт на экран планов и открывает загрузку с уже выбранной парой:
  // «сходите куда-нибудь и разберитесь» — это не ответ.
  if (plan.kind === "none") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex items-start gap-2.5">
          <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">{t.bulkNoPlanTitle}</p>
            <p className="mt-1 text-[13px] leading-snug text-amber-800">
              {t.bulkNoPlanWhat.replace("{group}", groupName || "—").replace("{subject}", subjectName || "—")}
            </p>
            <Link
              href={`/teacher/curriculum?group=${encodeURIComponent(groupId)}&subject=${encodeURIComponent(subjectId)}`}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-amber-700"
            >
              {t.bulkNoPlanLink}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (plan.kind === "loading") {
    return <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-500">{t.bulkPlanChecking}</p>;
  }

  if (plan.kind === "error") {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        {tc.networkError}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {doneCount !== null ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="text-sm font-bold text-[#1D1D1F]">{t.bulkDone.replace("{n}", String(doneCount))}</p>
          </div>
        ) : (
          <>
            {/* Темы — не выбор, а устройство: сказать об этом один раз проще,
                чем оставлять галочку, которой нет. */}
            <p className="rounded-xl bg-blue-50/60 px-3 py-2.5 text-[13px] leading-snug text-blue-900">
              {t.bulkFromPlan.replace("{n}", String(свободныхТем))}
            </p>

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
            {/* Общее время — оно же умолчание для режима «по дням».
                Поля «по какое число» нет: конец периода считается от числа
                тем, см. конецПериода(). */}
            <div className="grid grid-cols-2 gap-4">
              <Field label={t.bulkTime}>
                <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setPreview(null); }} className={inputCls} />
              </Field>
              <Field label={t.bulkFrom}>
                <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} className={inputCls} />
              </Field>
            </div>

            {/* ── Своё время по дням (пункт 11) ──────────────────────── */}
            <div className="rounded-xl bg-gray-50 p-3">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={perDay}
                  onChange={(e) => {
                    setPerDay(e.target.checked);
                    setPreview(null);
                    // Включили — заполняем каждый выбранный день общим
                    // временем: человек видит, от чего отталкивается, и
                    // правит только нужные строки.
                    if (e.target.checked) {
                      setTimeByWeekday(Object.fromEntries(weekdays.map((n) => [n, timeOf(n)])));
                    }
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {t.bulkPerDayTime}
                  <span className="mt-0.5 block text-[11px] text-gray-400">
                    {perDay ? t.bulkPerDayTimeHint : t.bulkTimeSame}
                  </span>
                </span>
              </label>

              {perDay && weekdays.length > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[...weekdays].sort((a, b) => a - b).map((n) => (
                    <label key={n} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5">
                      <span className="w-8 shrink-0 text-[11px] font-bold uppercase text-gray-400">{wdLabel[n]}</span>
                      <input
                        type="time"
                        value={timeOf(n)}
                        onChange={(e) => setDayTime(n, e.target.value)}
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-500"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* ── Выходные и праздники ─────────────────────────────────
                Тот же календарь, что в учебном плане: он вынесен в общий
                компонент, второй копии правил нет. */}
            <HolidayCalendar
              дни={выходные.дни}
              изПамяти={выходные.изПамяти}
              месяцПоУмолчанию={выходные.месяцПоУмолчанию}
              onChange={(следующие) => { выходные.изменить(следующие); setPreview(null); }}
            />

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
                  {/* ДВА РАЗНЫХ ЧИСЛА, И ПУТАТЬ ИХ НЕЛЬЗЯ.
                      «Занято слотов» — день, где урок уже стоит: слот съеден,
                      тема цела и достанется следующему дню.
                      «Пропущено тем» — тема, по которой урок уже создан: её в
                      раздаче нет вовсе. Одно про календарь, другое про план. */}
                  {preview.occupied > 0 && <li>{t.bulkSlotsBusy.replace("{n}", String(preview.occupied))}</li>}
                  {preview.topicsAlreadyUsed.length > 0 && (
                    <li>{t.bulkTopicsSkipped.replace("{n}", String(preview.topicsAlreadyUsed.length))}</li>
                  )}
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
        <div className="flex gap-3 border-t border-gray-100 pt-4">
          {preview ? (
            <>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                {t.bulkBack}
              </button>
              <button
                type="button"
                onClick={() => run(false)}
                disabled={busy || preview.willCreate === 0}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {busy ? t.bulkCreating : t.bulkCreateBtn}
              </button>
            </>
          ) : (
            <button
              type="button"
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
  );
}

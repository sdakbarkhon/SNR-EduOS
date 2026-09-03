"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, XCircle } from "lucide-react";
import { getDictionary, tashkentDayKey, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";

/**
 * ВЫХОДНЫЕ И ПРАЗДНИКИ: календарь месяца, щелчок по дню, причина словами.
 *
 * ═══ ОТКУДА ВЗЯЛСЯ ════════════════════════════════════════════════════════
 *
 * 03.09.2026 сделан в учебном плане (коммит 0526ecc9), 04.09 понадобился и
 * массовому созданию уроков. Второй копии не завели — вынесли сюда, тем же
 * ходом, что `CheckboxPicker`: вынос компонента поведения не меняет, а копии
 * в этом проекте расходились семь раз.
 *
 * У учебного плана от переезда меняется вызов — правила его не тронуты.
 *
 * ═══ ЧТО ЗДЕСЬ ЕСТЬ, А ЧЕГО НЕТ ═══════════════════════════════════════════
 *
 * ЕСТЬ: календарь, память в браузере, причина у дня.
 * НЕТ: сдвига урока. Сдвиг живёт в раскладке (`lib/curriculum-lesson-planner`)
 * и получается сам: день из списка не рождает слота, а темы садятся на слоты
 * по порядку — значит убранный слот двигает всё за ним на один вперёд.
 *
 * ═══ ПРИЧИНА ДАЛЬШЕ НЕ УХОДИТ ═════════════════════════════════════════════
 *
 * Ни в раскладку, ни в базу: там нужны только даты. Причина живёт в форме и в
 * памяти браузера — она для человека, чтобы через месяц он понимал, почему
 * двенадцатое ноября отмечено.
 *
 * ═══ ПАМЯТЬ В БРАУЗЕРЕ ════════════════════════════════════════════════════
 *
 * Праздники в стране одни, а планов и пачек у учителя несколько: вводить их
 * заново каждый раз — ровно тот труд, на котором ошибаются. Ключ на учителя:
 * за одним браузером могут сидеть двое.
 *
 * Границы названы человеку чипом «Запомнено с прошлого раза»: это память
 * ОДНОГО браузера, а не календарь школы. Понадобится общий — отдельное
 * решение и миграция.
 *
 * СТАРЫЙ ФОРМАТ ЧИТАЕТСЯ ТОЖЕ. До 04.09 в памяти лежал просто список дат
 * (`["2026-11-12", …]`); теперь список пар «дата + причина». Не прочитать
 * старое значило бы стереть то, что учитель уже отметил.
 */

export type Выходной = { date: string; note?: string };

/** Только даты — это всё, что нужно раскладке. */
export function датыВыходных(дни: Выходной[]): string[] {
  return дни.map((д) => д.date);
}

const ДАТА = /^\d{4}-\d{2}-\d{2}$/;

/** Разбор памяти: и новый формат, и старый список строк. */
function прочитатьПамять(сырое: string | null): Выходной[] {
  if (!сырое) return [];
  try {
    const разобрано: unknown = JSON.parse(сырое);
    if (!Array.isArray(разобрано)) return [];
    const из: Выходной[] = [];
    for (const э of разобрано) {
      // Старый формат: просто строка с датой.
      if (typeof э === "string" && ДАТА.test(э)) { из.push({ date: э }); continue; }
      // Новый: объект с датой и, может быть, причиной.
      if (э && typeof э === "object") {
        const d = (э as { date?: unknown }).date;
        const n = (э as { note?: unknown }).note;
        if (typeof d === "string" && ДАТА.test(d)) {
          из.push(typeof n === "string" && n.trim() ? { date: d, note: n } : { date: d });
        }
      }
    }
    return из.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

/** Правило хуков разбирает имя латиницей — отсюда `use` в имени при
 *  кириллице внутри. */
export function useHolidays(ключНаУчителя: string, nowMs: number) {
  const ключ = `snr-holidays-${ключНаУчителя}`;
  const [дни, setДни] = useState<Выходной[]>([]);
  const [изПамяти, setИзПамяти] = useState(false);

  useEffect(() => {
    try {
      const было = прочитатьПамять(window.localStorage.getItem(ключ));
      if (было.length === 0) return;
      setДни(было);
      setИзПамяти(true);
    } catch {
      // Хранилище может быть закрыто настройками браузера или приватным
      // окном. Праздники — удобство, а не право: работаем без памяти.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function запомнить(следующие: Выходной[]) {
    try {
      if (следующие.length === 0) window.localStorage.removeItem(ключ);
      else window.localStorage.setItem(ключ, JSON.stringify(следующие));
    } catch { /* см. выше */ }
  }

  function изменить(следующие: Выходной[]) {
    setДни(следующие);
    setИзПамяти(false);
    запомнить(следующие);
  }

  const месяцПоУмолчанию = useMemo(() => tashkentDayKey(nowMs).slice(0, 7), [nowMs]);
  return { дни, изПамяти, изменить, месяцПоУмолчанию };
}

/**
 * Календарь месяца со щелчком по дню и чипами выбранного.
 *
 * Поле «даты через запятую» было бы втрое дешевле, но по нему промахиваются, а
 * промах здесь означает урок в выходной.
 */
export function HolidayCalendar({
  дни,
  изПамяти,
  onChange,
  месяцПоУмолчанию,
}: {
  дни: Выходной[];
  изПамяти: boolean;
  onChange: (следующие: Выходной[]) => void;
  месяцПоУмолчанию: string;
}) {
  const { locale } = useLocale();
  const tc = getDictionary(locale as Locale).curriculum;

  const [месяц, setМесяц] = useState(месяцПоУмолчанию);
  /** У какого дня открыто поле причины. */
  const [правим, setПравим] = useState<string | null>(null);

  const wd = getDictionary(locale as Locale).teacher;
  const подписиДней = [wd.wdMon, wd.wdTue, wd.wdWed, wd.wdThu, wd.wdFri, wd.wdSat, wd.wdSun];

  /** «2026-07» ± N месяцев. Счёт по UTC: у месяца часового пояса нет. */
  function сдвиг(на: number): string {
    const [y, m] = месяц.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1 + на, 1)).toISOString().slice(0, 7);
  }

  const подписьМесяца = (() => {
    const [y, m] = месяц.split("-").map(Number);
    return new Date(Date.UTC(y!, (m ?? 1) - 1, 1)).toLocaleDateString(
      locale === "en" ? "en-US" : locale === "uz" ? "uz-UZ" : "ru-RU",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );
  })();

  /** Дни месяца, выровненные по понедельнику. null — пустая клетка. */
  function сетка(): Array<string | null> {
    const [y, m] = месяц.split("-").map(Number);
    const первое = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
    // getUTCDay: 0 — воскресенье. Нужен отступ от понедельника.
    const отступ = (первое.getUTCDay() + 6) % 7;
    const всего = new Date(Date.UTC(y!, m ?? 1, 0)).getUTCDate();
    const клетки: Array<string | null> = Array.from({ length: отступ }, () => null);
    for (let d = 1; d <= всего; d++) клетки.push(`${месяц}-${String(d).padStart(2, "0")}`);
    return клетки;
  }

  const естьЛи = (день: string) => дни.some((д) => д.date === день);

  function переключить(день: string) {
    if (естьЛи(день)) {
      onChange(дни.filter((д) => д.date !== день));
      if (правим === день) setПравим(null);
      return;
    }
    onChange([...дни, { date: день }].sort((a, b) => a.date.localeCompare(b.date)));
    // Отметил день — сразу открываем причину: писать её потом никто не пойдёт.
    setПравим(день);
  }

  function причина(день: string, текст: string) {
    onChange(дни.map((д) => (д.date === день ? (текст.trim() ? { date: д.date, note: текст } : { date: д.date }) : д)));
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CalendarRange className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="text-xs font-bold text-slate-800">{tc.holidaysTitle}</span>
        {изПамяти && дни.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            {tc.holidaysRemembered}
          </span>
        )}
        {дни.length > 0 && (
          <button
            type="button"
            onClick={() => { onChange([]); setПравим(null); }}
            className="ml-auto rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
          >
            {tc.holidaysClear}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{tc.holidaysHint}</p>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setМесяц(сдвиг(-1))}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          ‹
        </button>
        <span className="text-xs font-bold text-slate-700">{подписьМесяца}</span>
        <button
          type="button"
          onClick={() => setМесяц(сдвиг(1))}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          ›
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {подписиДней.map((п, i) => (
          <span key={i} className="text-center text-[10px] font-bold uppercase text-gray-400">{п}</span>
        ))}
        {сетка().map((день, i) => {
          if (!день) return <span key={`п${i}`} />;
          const отмечен = естьЛи(день);
          return (
            <button
              key={день}
              type="button"
              onClick={() => переключить(день)}
              className={
                "rounded-lg py-1 text-[11px] font-semibold transition-colors "
                + (отмечен ? "bg-red-500 text-white" : "bg-white text-slate-600 hover:bg-slate-100")
              }
            >
              {Number(день.slice(8, 10))}
            </button>
          );
        })}
      </div>

      {дни.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-400">{tc.holidaysNone}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {дни.map((д) => (
            <li key={д.date} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => переключить(д.date)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 hover:bg-red-200"
              >
                {д.date.slice(8, 10)}.{д.date.slice(5, 7)}
                <XCircle className="h-3 w-3" />
              </button>
              {/* Причина не обязательна: отметил день без пояснения — тоже
                  годится. Поле открыто только у того дня, который сейчас
                  правят, чтобы список не превращался в простыню полей. */}
              {правим === д.date ? (
                <input
                  autoFocus
                  value={д.note ?? ""}
                  onChange={(e) => причина(д.date, e.target.value)}
                  onBlur={() => setПравим(null)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setПравим(null); }}
                  placeholder={tc.holidayNotePlaceholder}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] outline-none focus:border-blue-400"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setПравим(д.date)}
                  className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-500 hover:text-slate-800"
                >
                  {д.note?.trim() || tc.holidayNoteAdd}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

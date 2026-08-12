"use client";

/**
 * Даты веб-родителя на языке пользователя.
 *
 * Язык живёт в клиенте (LocaleProvider → localStorage), поэтому саму строку
 * даты собирает клиент — ровно там же и тем же способом, что и весь остальной
 * текст раздела. Серверные страницы больше НЕ форматируют даты: они передают
 * вниз сырой ISO или ключ дня «YYYY-MM-DD», а подпись рисуется здесь.
 *
 * Два входа, оба поверх одного и того же чистого форматчика `./format`:
 *  • `useDates()` — хук для клиентских экранов (*View.tsx): отдаёт функции,
 *    уже привязанные к текущему языку;
 *  • `<DateText/>` — компонент для СЕРВЕРНЫХ страниц, которым нужна одна
 *    подпись посреди серверной разметки (переводить всю страницу в клиент
 *    ради одной даты — дороже).
 *
 * Своей логики форматирования здесь нет ни строки: это только доставка языка.
 */

import { useMemo } from "react";
import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import * as F from "./format";

export interface Dates {
  /** Язык, которым всё считается — на случай прямого вызова функций `format`. */
  locale: Locale;
  /** «14:32» */
  time: (iso: string) => string;
  /** «21 июля 2026» */
  long: (iso: string) => string;
  /** «21 июл.» */
  short: (iso: string) => string;
  /** «21 июля 2026, 14:32» */
  dateTime: (iso: string) => string;
  /** «21 июля» по ключу дня «YYYY-MM-DD» */
  dayMonth: (key: string) => string;
  /** «Июль 2026» */
  monthYear: (year: number, month: number) => string;
  /** «Июль» — месяц отдельным словом (1..12) */
  month: (month: number) => string;
  /** «июл» — ось графика (1..12) */
  monthShort: (month: number) => string;
  /** «июне» — форма для фразы «…чем в {month}» */
  monthIn: (month: number) => string;
  /** «Пн» */
  weekdayShort: (index: number) => string;
  /** «Понедельник» */
  weekdayFull: (index: number) => string;
  /** «Пн…Вс» одной лентой */
  weekdaysShort: () => string[];
  /** сегодня → «14:32», вчера → «Вчера», иначе «21 июл.» */
  stamp: (iso: string, today: string) => string;
  /** «Сегодня, 23 июля» — разделитель дней в переписке */
  divider: (iso: string, today: string) => string;
  /** «Сегодня, 3 августа» / «Вчера, 2 августа» / «1 августа» по ключу дня */
  dayLabel: (key: string, today: string) => string;
  /** «завтра» / «3 августа»; для сегодняшнего дня — null */
  relativeDay: (key: string, today: string) => string | null;
  /** «Сегодня» / «Вчера» / «Завтра» — сами слова из словаря */
  words: { today: string; yesterday: string; tomorrow: string };
}

/** Собрать набор функций, привязанных к языку. Вынесено из хука, чтобы тем же
 *  кодом пользовался и `<DateText/>`, и будущие вызовы вне React. */
export function datesFor(locale: Locale): Dates {
  const words = getDictionary(locale).parentApp.date;
  return {
    locale,
    time: (iso) => F.formatTime(iso),
    long: (iso) => F.formatDateLong(iso, locale),
    short: (iso) => F.formatDateShort(iso, locale),
    dateTime: (iso) => F.formatDateTime(iso, locale),
    dayMonth: (key) => F.dayMonthOfKey(key, locale),
    monthYear: (year, month) => F.monthYearLabel(year, month, locale),
    month: (month) => F.monthName(month, locale),
    monthShort: (month) => F.monthNameShort(month, locale),
    monthIn: (month) => F.monthNameIn(month, locale),
    weekdayShort: (index) => F.weekdayShort(index, locale),
    weekdayFull: (index) => F.weekdayFull(index, locale),
    weekdaysShort: () => F.weekdaysShort(locale),
    stamp: (iso, today) => F.relativeStamp(iso, today, F.previousDay(today), locale),
    divider: (iso, today) => F.dayDivider(iso, today, F.previousDay(today), locale),
    dayLabel: (key, today) => F.dayLabelOfKey(key, today, F.previousDay(today), locale),
    relativeDay: (key, today) => F.relativeDayOfKey(key, today, locale),
    words: { today: words.today, yesterday: words.yesterday, tomorrow: words.tomorrow },
  };
}

/** Даты на текущем языке — для клиентских экранов родителя. */
export function useDates(): Dates {
  const { locale } = useLocale();
  return useMemo(() => datesFor(locale), [locale]);
}

type DateTextProps =
  | { kind: "time" | "long" | "short" | "dateTime"; iso: string }
  /** Дата-время или «Без срока», если срока нет: подпись целиком из словаря. */
  | { kind: "dateTimeOrNone"; iso: string | null }
  | { kind: "stamp" | "divider"; iso: string; today: string }
  | { kind: "dayMonth"; dateKey: string }
  /** «Понедельник, 30 июля» — заголовок дня. */
  | { kind: "weekdayDay"; dateKey: string }
  | { kind: "dayLabel"; dateKey: string; today: string };

/**
 * Одна подпись даты внутри серверной разметки. Клиентская граница нужна
 * только ради языка: сервер отдаёт сырой ISO, строку собирает браузер.
 */
export function DateText(props: DateTextProps) {
  const d = useDates();
  switch (props.kind) {
    case "time":
      return <>{d.time(props.iso)}</>;
    case "long":
      return <>{d.long(props.iso)}</>;
    case "short":
      return <>{d.short(props.iso)}</>;
    case "dateTime":
      return <>{d.dateTime(props.iso)}</>;
    case "dateTimeOrNone":
      return (
        <>
          {props.iso
            ? d.dateTime(props.iso)
            : getDictionary(d.locale).parentMobile.hwDetailNoDeadline}
        </>
      );
    case "stamp":
      return <>{d.stamp(props.iso, props.today)}</>;
    case "divider":
      return <>{d.divider(props.iso, props.today)}</>;
    case "dayMonth":
      return <>{d.dayMonth(props.dateKey)}</>;
    case "weekdayDay":
      return (
        <>{`${d.weekdayFull(F.weekdayIndexOfKey(props.dateKey))}, ${d.dayMonth(props.dateKey)}`}</>
      );
    case "dayLabel":
      return <>{d.dayLabel(props.dateKey, props.today)}</>;
  }
}

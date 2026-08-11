"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isSchoolFrozen, schoolNow, schoolNowMs } from "@/lib/school-time";

/**
 * Школа текущего пользователя и её заморозка — на клиенте. Z.3, заход 1.
 *
 * ЗАЧЕМ. На сервере школа известна почти бесплатно: `getMyStudent()` и
 * `getMyTeacher()` уже делают `select("*")`, то есть `school_id` приходит
 * вместе с профилем. На клиенте её не было НИ ОДНОГО канала — провайдеров
 * четыре (язык, тема, уведомления, полноэкранный урок), и школу не несёт ни
 * один. Отсюда этот провайдер: layout берёт школу на сервере и кладёт сюда.
 *
 * ЧТО СЮДА НЕЛЬЗЯ КЛАСТЬ. Признак демо-сессии (кука `snr-demo-session`),
 * `is_demo` и всё, что описывает СПОСОБ ВХОДА, а не принадлежность. У
 * демо-школы есть настоящий ученик `sherzod_10`, который входит обычным
 * логином без всякой аренды: по куке он выглядел бы «не демо» и получил бы
 * настоящее время посреди демонстрации. Здесь только `school_id` и
 * `frozen_date` этой школы.
 *
 * ПОКА НИКТО НЕ ЧИТАЕТ. Заход 1 доводит данные до клиента; перевод 47
 * клиентских вызовов `getDemoNow()` — заход 3.
 */

export type SchoolTimeValue = {
  /** Школа текущего пользователя. null — профиль не найден (гость, сбой). */
  schoolId: string | null;
  /** `schools.frozen_date`: «2026-07-29» или null у обычной школы. */
  frozenDate: string | null;
};

const SchoolTimeContext = createContext<SchoolTimeValue>({ schoolId: null, frozenDate: null });

export function SchoolTimeProvider({
  schoolId,
  frozenDate,
  children,
}: SchoolTimeValue & { children: ReactNode }) {
  return (
    <SchoolTimeContext.Provider value={{ schoolId, frozenDate }}>
      {children}
    </SchoolTimeContext.Provider>
  );
}

/** Школа и её заморозка. */
export function useSchoolTime(): SchoolTimeValue {
  return useContext(SchoolTimeContext);
}

/**
 * «Сейчас» текущей школы.
 *
 * У ЗАМОРОЖЕННОЙ школы значение неподвижно и таймер НЕ ЗАВОДИТСЯ вовсе.
 * Это не оптимизация, а защита от известных граблей: расписание обновляет
 * «сейчас» раз в 30 секунд, и подсветка «Сейчас» держится неподвижной ровно
 * потому, что значение константа. Если бы хук тикал и в замороженной школе,
 * подсветка поехала бы через полминуты после открытия — прямо на показе.
 *
 * У обычной школы значение обновляется раз в `tickMs`.
 *
 * Для ИЗМЕРЕНИЯ ИНТЕРВАЛОВ этот хук не годится — там нужны настоящие часы
 * (`Date.now()`), см. шапку `lib/school-time.ts`.
 */
export function useSchoolNow(tickMs = 30_000): Date {
  const { frozenDate } = useSchoolTime();
  const [now, setNow] = useState<Date>(() => schoolNow(frozenDate));

  useEffect(() => {
    if (isSchoolFrozen(frozenDate)) {
      // Заморожено: выставляем один раз и не тикаем.
      setNow(schoolNow(frozenDate));
      return;
    }
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [frozenDate, tickMs]);

  return now;
}

/** То же в миллисекундах, без пересоздания Date у вызывающего. */
export function useSchoolNowMs(tickMs = 30_000): number {
  return useSchoolNow(tickMs).getTime();
}

/** Разовое значение без подписки на тик — для обработчиков событий. */
export function useSchoolNowSnapshot(): () => number {
  const { frozenDate } = useSchoolTime();
  return () => schoolNowMs(frozenDate);
}

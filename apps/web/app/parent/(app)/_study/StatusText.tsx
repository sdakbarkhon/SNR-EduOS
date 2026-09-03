"use client";

/**
 * Подпись состояния домашнего задания на языке пользователя.
 *
 * Тот же приём, что у `<DateText/>` в `_ui/dates.tsx`, и по той же причине:
 * язык живёт в клиенте (LocaleProvider → localStorage), а страницы раздела
 * серверные. Сервер отдаёт вниз КЛЮЧ состояния и оценку, слово собирается
 * здесь.
 *
 * До 03.09.2026 подписи были зашиты русским прямо в `homework-status.ts` —
 * экран не менялся с языком, хотя языков в проекте три.
 *
 * Своей логики состояний здесь нет ни строки: только доставка языка.
 */

import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { statusLabel, type HomeworkStatusKind } from "./homework-status";

/** Набор из трёх слов для текущего языка. Клиентские экраны зовут его сами и
 *  дальше собирают строку через statusLabel. */
export function useStatusWords() {
  const { locale } = useLocale();
  return getDictionary(locale).parentApp.status;
}

/** Одна подпись состояния внутри серверной разметки. */
export function StatusText({
  kind,
  grade,
}: {
  kind: HomeworkStatusKind;
  grade: string | null;
}) {
  return <>{statusLabel(kind, grade, useStatusWords())}</>;
}

/**
 * «Работа отправлена · Оценено · 5» — целиком из словаря.
 *
 * Отдельным компонентом, а не склейкой на месте: половина фразы была зашита
 * русским прямо в разметке, и при смене языка получалось полпредложения на
 * одном языке, полпредложения на другом. Ключ `sentPrefix` в словаре уже был
 * и уже переведён на три языка — заводить новый незачем.
 */
export function SentWithStatus({
  kind,
  grade,
}: {
  kind: HomeworkStatusKind;
  grade: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale).parentApp;
  return <>{d.hw.sentPrefix.replace("{status}", statusLabel(kind, grade, d.status))}</>;
}

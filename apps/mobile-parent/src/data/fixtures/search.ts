/**
 * Поиск: SEARCH_D + SEARCH_POP (строки 3406–3425 макета), недавние запросы
 * (initial state srchRec). Значения — из макета; два расхождения макета
 * устранены по указанию менеджера (связанные данные сходятся между экранами):
 * - чек в поиске указывает на реальный RCP-2026-07-018 из RECEIPTS
 *   (в макете был несуществующий RCP-2026-07-183);
 * - Дилдора Касымова — классный руководитель 3-А (куратор Азиза по
 *   CHILD_INFO; классрук 7-А везде — Гульнора Юсупова).
 */
import type { SearchResultRow } from "../types";



/** Фильтры-чипы экрана поиска. */
export const SEARCH_FILTERS = ["Всё", "Сообщения", "Материалы", "Задания", "Оплаты", "Сервисы"] as const;

/**
 * Поиск по сервисам (da6) — дословно из макета: `SEARCH_D` (строки 3406–3424)
 * и `SEARCH_POP` (3425). Разметка экрана — 2300–2353.
 *
 * Поле ввода на экране ПОКАЗА не набирается: витрина рисует, как выглядит
 * найденное, а не работает поиском. Поэтому «недавние» и «популярные»
 * запросы — просто списки, а результаты показываются все, с фильтром по
 * разделу, как в макете при пустом запросе.
 */
export const SEARCH_RECENT = ["дроби", "расписание", "счёт", "эссе"] as const;

export const SEARCH_POPULAR = ["математика", "питание", "счёт за август", "расписание", "эссе"] as const;

/** Разделы результатов; ключ совпадает с чипом фильтра. */
export type SearchGroupKey = "msgs" | "mats" | "hw" | "pays" | "svc";

export interface SearchResultShowcaseRow {
  group: SearchGroupKey;
  name: string;
  subtitle: string;
  tail: string;
  /** Маршрут макета. «mat:N» — материал библиотеки, ведём в саму библиотеку. */
  go: string;
}

export const SEARCH_RESULTS: SearchResultShowcaseRow[] = [
  { group: "msgs", name: "Гульнора Юсупова", subtitle: "Математика · последнее сообщение 2 ч назад", tail: "чат", go: "d25" },
  { group: "msgs", name: "Дилдора Касымова", subtitle: "Классный руководитель 7-А", tail: "чат", go: "d25" },
  { group: "msgs", name: "Администрация школы", subtitle: "Ваше заявление на справку готово", tail: "чат", go: "d27" },
  { group: "mats", name: "Сборник задач: дроби", subtitle: "Г. Юсупова · Математика", tail: "PDF", go: "dlib" },
  { group: "mats", name: "Python для школьников", subtitle: "А. Петров · Программирование", tail: "PDF", go: "dlib" },
  { group: "mats", name: "English Grammar in Use", subtitle: "R. Murphy · Английский язык", tail: "PDF", go: "dlib" },
  { group: "mats", name: "Геометрия: 7 класс", subtitle: "Г. Юсупова · Математика", tail: "PDF", go: "dlib" },
  { group: "hw", name: "Эссе «My Summer»", subtitle: "Английский язык · срок завтра", tail: "23 июля", go: "d13" },
  { group: "hw", name: "Задачи: дроби и проценты", subtitle: "Математика · выполнено", tail: "22 июля", go: "d12" },
  { group: "hw", name: "Отчёт «Датчики»", subtitle: "Робототехника · на проверке", tail: "21 июля", go: "d12" },
  { group: "pays", name: "Счёт «Обучение · август»", subtitle: "4 500 000 сум · до 5 августа", tail: "счёт", go: "d18" },
  { group: "pays", name: "Чек № RCP-2026-07-183", subtitle: "Обучение · июль · 4 500 000 сум", tail: "чек", go: "d21" },
  { group: "pays", name: "Автоплатёж", subtitle: "1-го числа · Uzcard ····8341", tail: "настройка", go: "p17" },
  { group: "svc", name: "Расписание", subtitle: "Уроки, кабинеты и перемены", tail: "раздел", go: "d15" },
  { group: "svc", name: "Посещаемость", subtitle: "Календарь и статистика", tail: "раздел", go: "d14" },
  { group: "svc", name: "Медкарта", subtitle: "Показатели, прививки, справки", tail: "раздел", go: "dmed" },
  { group: "svc", name: "Транспорт", subtitle: "Маршрут № 3 · школьный автобус", tail: "раздел", go: "dtrans" },
];

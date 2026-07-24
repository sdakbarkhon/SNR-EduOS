/**
 * Поиск: SEARCH_D + SEARCH_POP (строки 3406–3425 макета), недавние запросы
 * (initial state srchRec). Все значения — ДОСЛОВНО из макета.
 * «Чек № RCP-2026-07-183» отсутствует в RECEIPTS — аномалия №2 макета,
 * перенесена как есть.
 */
import type { SearchResultRow } from "../types";

export const SEARCH_RESULTS: SearchResultRow[] = [
  { filter: "msgs", header: "СООБЩЕНИЯ", name: "Гульнора Юсупова", subtitle: "Математика · последнее сообщение 2 ч назад", detail_label: "чат", go: "d25" },
  { filter: "msgs", header: "СООБЩЕНИЯ", name: "Дилдора Касымова", subtitle: "Классный руководитель 7-А", detail_label: "чат", go: "d25" },
  { filter: "msgs", header: "СООБЩЕНИЯ", name: "Администрация школы", subtitle: "Ваше заявление на справку готово", detail_label: "чат", go: "d27" },
  { filter: "mats", header: "МАТЕРИАЛЫ", name: "Сборник задач: дроби", subtitle: "Г. Юсупова · Математика", detail_label: "PDF", go: "mat:1" },
  { filter: "mats", header: "МАТЕРИАЛЫ", name: "Python для школьников", subtitle: "А. Петров · Программирование", detail_label: "PDF", go: "mat:0" },
  { filter: "mats", header: "МАТЕРИАЛЫ", name: "English Grammar in Use", subtitle: "R. Murphy · Английский язык", detail_label: "PDF", go: "mat:2" },
  { filter: "mats", header: "МАТЕРИАЛЫ", name: "Геометрия: 7 класс", subtitle: "Г. Юсупова · Математика", detail_label: "PDF", go: "mat:4" },
  { filter: "hw", header: "ЗАДАНИЯ", name: "Эссе «My Summer»", subtitle: "Английский язык · срок завтра", detail_label: "23 июля", go: "d13" },
  { filter: "hw", header: "ЗАДАНИЯ", name: "Задачи: дроби и проценты", subtitle: "Математика · выполнено", detail_label: "22 июля", go: "d12" },
  { filter: "hw", header: "ЗАДАНИЯ", name: "Отчёт «Датчики»", subtitle: "Робототехника · на проверке", detail_label: "21 июля", go: "d12" },
  { filter: "pays", header: "ОПЛАТЫ", name: "Счёт «Обучение · август»", subtitle: "4 500 000 сум · до 5 августа", detail_label: "счёт", go: "d18" },
  { filter: "pays", header: "ОПЛАТЫ", name: "Чек № RCP-2026-07-183", subtitle: "Обучение · июль · 4 500 000 сум", detail_label: "чек", go: "d21" },
  { filter: "pays", header: "ОПЛАТЫ", name: "Автоплатёж", subtitle: "1-го числа · Uzcard ····8341", detail_label: "настройка", go: "p17" },
  { filter: "svc", header: "СЕРВИСЫ", name: "Расписание", subtitle: "Уроки, кабинеты и перемены", detail_label: "раздел", go: "d15" },
  { filter: "svc", header: "СЕРВИСЫ", name: "Посещаемость", subtitle: "Календарь и статистика", detail_label: "раздел", go: "d14" },
  { filter: "svc", header: "СЕРВИСЫ", name: "Медкарта", subtitle: "Показатели, прививки, справки", detail_label: "раздел", go: "dmed" },
  { filter: "svc", header: "СЕРВИСЫ", name: "Транспорт", subtitle: "Маршрут № 3 · школьный автобус", detail_label: "раздел", go: "dtrans" },
];

export const SEARCH_POPULAR = ["математика", "питание", "счёт за август", "расписание", "эссе"] as const;

export const SEARCH_RECENT = ["оценки по математике", "счёт за август", "гульнора юсупова", "расписание на неделю"] as const;

/** Фильтры-чипы экрана поиска. */
export const SEARCH_FILTERS = ["Всё", "Сообщения", "Материалы", "Задания", "Оплаты", "Сервисы"] as const;

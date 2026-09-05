import type { Locale } from "../i18n/types";
import { tashkentDayOfYear } from "./date";

const TIPS: Record<Locale, string[]> = {
  ru: [
    "Разбивай большие задания на маленькие части — так проще начать.",
    "Делай самое сложное задание первым, пока голова свежая.",
    "Поставь таймер на 25 минут и сосредоточься — это метод Помодоро.",
    "Переписывай конспект своими словами: так материал лучше запоминается.",
    "Объясни тему вслух сам себе — если можешь объяснить, значит понял.",
  ],
  uz: [
    "Katta topshiriqlarni kichik qismlarga bo'ling — boshlash osonroq bo'ladi.",
    "Eng qiyin topshiriqni birinchi qiling, bosh hali yangi bo'lganda.",
    "25 daqiqaga taymer o'rnating va diqqat qiling — bu Pomodoro usuli.",
    "Konspektni o'z so'zlaringiz bilan qayta yozing: material yaxshiroq esda qoladi.",
    "Mavzuni o'zingizga ovoz chiqarib tushuntiring — tushuntirsangiz, tushundingiz demak.",
  ],
  en: [
    "Break big tasks into small parts — it's easier to start.",
    "Do the hardest task first while your mind is fresh.",
    "Set a 25-minute timer and focus — that's the Pomodoro method.",
    "Rewrite your notes in your own words: material sticks better.",
    "Explain the topic out loud to yourself — if you can explain it, you understand it.",
  ],
};

// 26.08.2026: день года считается по Ташкенту, а не в поясе среды. Совет дня
// менялся на границе суток на пять часов раньше положенного.
function getDayOfYear(): number {
  return tashkentDayOfYear(Date.now());
}

export function getDailyTip(locale: Locale = "ru"): string {
  const pool = TIPS[locale] ?? TIPS.ru;
  return pool[getDayOfYear() % pool.length] ?? pool[0] ?? "";
}

/**
 * СДАНО ИЛИ НЕТ — ОДНО ПРАВИЛО НА ВСЕ ЭКРАНЫ УЧЕНИКА. 06.09.2026.
 *
 * ═══ ЧТО БЫЛО ═════════════════════════════════════════════════════════════
 *
 * Правил было два, и они расходились. Значок в меню и плитка «Мои задания»
 * считали сданным только то, по чему есть строка в `homework_submissions`.
 * Пончик «Мой прогресс» считал сданным и то, что ушло через `test_submissions`
 * — тест сдаётся другой таблицей.
 *
 * Замер 06.09.2026: значок показывал 151 несданное на всю школу, тогда как на
 * самом деле не сдано 30. Завышено на 121, и задето ВСЕ 31 ученик — у типичного
 * значок говорил «5», а не сдано у него одно. Ребёнок видит красный кружок над
 * задачами, которые сдал и за которые уже получил оценку.
 *
 * ═══ ПОЧЕМУ ЗДЕСЬ ═════════════════════════════════════════════════════════
 *
 * Чтобы правило было ОДНО. Три экрана спрашивают одну и ту же вещь — «сдал ли
 * ученик это задание», — и разъехались ровно потому, что каждый отвечал сам.
 * Второй копии в проекте быть не должно.
 *
 * У ученика нет состояния «на проверке»: он сдаёт, проверяет учитель. Поэтому
 * правило простое — есть сдача любого вида, значит сделано.
 */
export function сданныеЗадания(
  submissions: Array<{ homework_id: string }>,
  testSubmissions: Array<{ homework_id: string }>,
): Set<string> {
  return new Set<string>([
    ...submissions.map((s) => s.homework_id),
    ...testSubmissions.map((t) => t.homework_id),
  ]);
}

/** Задания, которые ученик ещё не сдал ни одним из двух способов. */
export function несданныеЗадания<T extends { id: string }>(
  homework: T[],
  submissions: Array<{ homework_id: string }>,
  testSubmissions: Array<{ homework_id: string }>,
): T[] {
  const сдано = сданныеЗадания(submissions, testSubmissions);
  return homework.filter((h) => !сдано.has(h.id));
}

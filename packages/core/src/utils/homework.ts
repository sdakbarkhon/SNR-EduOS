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

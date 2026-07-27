import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { tashkentToday } from "../lib/tashkent";

/**
 * Долги, проход 2 — «сегодня» (Ташкент) больше не застывает на дате
 * монтирования. HomeScreen/AttendanceScreen раньше делали
 * useMemo(() => tashkentToday(), []) — если приложение висит открытым через
 * полночь, todayKey (а с ним подсветка "сегодня" в календаре, сегодняшние
 * Home-плитки, "сегодня/вчера" в списках) оставался на вчера до перезапуска.
 * Пересчёт — на возврат приложения на передний план (AppState 'active'), без
 * поллинга; setTodayKey вызывается только если календарная дата реально
 * сменилась, чтобы не плодить лишние ре-рендеры на каждый foreground.
 */
export function useTashkentToday(): string {
  const [todayKey, setTodayKey] = useState(() => tashkentToday());

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const next = tashkentToday();
      setTodayKey((prev) => (prev === next ? prev : next));
    });
    return () => sub.remove();
  }, []);

  return todayKey;
}

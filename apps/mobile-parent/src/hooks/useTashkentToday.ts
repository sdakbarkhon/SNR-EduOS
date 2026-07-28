import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { tashkentToday } from "../lib/tashkent";

/**
 * Долги, проход 2 — «сегодня» (Ташкент) больше не застывает на дате
 * монтирования. HomeScreen/AttendanceScreen раньше делали
 * useMemo(() => tashkentToday(), []) — если приложение висит открытым через
 * полночь, todayKey (а с ним подсветка "сегодня" в календаре, сегодняшние
 * Home-плитки, "сегодня/вчера" в списках) оставался на вчера до перезапуска.
 *
 * Два независимых триггера пересчёта:
 *  1. Возврат приложения на передний план (AppState 'active') — без поллинга.
 *  2. Таймер точно на следующую полночь по Ташкенту (setTimeout, не
 *     setInterval, самопланирующийся) — покрывает случай, когда приложение
 *     всё это время остаётся на переднем плане: тогда AppState 'change' не
 *     всплывает вовсе, и без таймера экран мог бы просидеть на вчерашней
 *     дате сколько угодно.
 * Оба пути идут через один и тот же дедуп (setTodayKey только если дата
 * реально сменилась), чтобы не плодить лишние ре-рендеры.
 */
export function useTashkentToday(): string {
  const [todayKey, setTodayKey] = useState(() => tashkentToday());

  useEffect(() => {
    function recompute() {
      const next = tashkentToday();
      setTodayKey((prev) => (prev === next ? prev : next));
    }

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      recompute();
    });

    let timeoutId: ReturnType<typeof setTimeout>;
    function scheduleMidnightTick() {
      timeoutId = setTimeout(() => {
        recompute();
        scheduleMidnightTick();
      }, msUntilNextTashkentMidnight());
    }
    scheduleMidnightTick();

    return () => {
      sub.remove();
      clearTimeout(timeoutId);
    };
  }, []);

  return todayKey;
}

/** Ташкент — фиксированный UTC+5 без перехода на летнее время (то же
 *  допущение, что уже неявно делают addDays/mondayOfWeek в lib/tashkent.ts,
 *  где Y-M-D трактуется обычной UTC-арифметикой). +500мс запаса, чтобы
 *  таймер сработал точно ПОСЛЕ полуночи, а не впритык к границе. */
function msUntilNextTashkentMidnight(): number {
  const [y, m, d] = tashkentToday().split("-").map(Number);
  const nextMidnightUtcMs = Date.UTC(y, m - 1, d + 1) - 5 * 3600000;
  return Math.max(1000, nextMidnightUtcMs - Date.now() + 500);
}

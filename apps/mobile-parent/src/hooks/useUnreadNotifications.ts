import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getUnreadCount } from "@snr/core";
import { getUnreadShowcaseCount } from "../data";
import { useDemoSession } from "../context/DemoSessionContext";
import { getSupabase } from "../lib/supabase";
import { useAsyncData } from "./useAsyncData";

/**
 * Число непрочитанных уведомлений для бэйджа колокольчика.
 *
 * ЗАЧЕМ ПОНАДОБИЛСЯ. Экран «Уведомления» перешёл на таблицу `notifications`
 * (заход 2 переноса), а бэйдж на трёх вкладках продолжал считать фикстуру и
 * показывал «3» над экраном, где непрочитанных пять. Расхождение видно с
 * первого взгляда, поэтому счётчик переехал на тот же источник.
 *
 * `getUnreadCount` — тот же запрос, что у веба (parentUnreadCount): считает
 * внутри базы точным счётчиком, строк не тянет. При ошибке core сам вернёт 0
 * — бэйдж просто не покажется, и это верное поведение: врать числом хуже,
 * чем промолчать.
 */

/**
 * 18.08.2026 — счётчик не уменьшался после прочтения. Причин было ДВЕ, и
 * закрыты обе.
 *
 * Первая — здесь: useAsyncData с пустым списком зависимостей читает один раз
 * при монтировании. Таб-бар живёт всю сессию и не размонтируется, поэтому
 * число, посчитанное при входе в приложение, так и висело до перезапуска.
 * Теперь запрос повторяется каждый раз, когда экран получает фокус, — то есть
 * при любом возврате из списка уведомлений.
 *
 * Вторая — в самом списке: он не помечал ничего прочитанным (см.
 * NotificationsScreen).
 */
/**
 * 30.08.2026 — БЭЙДЖ В ПОКАЗЕ. Заход 2 отложил его сознательно: ленты
 * уведомлений тогда не было, и поставить сюда тройку значило бы завести
 * второй источник правды рядом с будущим списком. Лента появилась заходом
 * 6 — число считается по ней (getUnreadShowcaseCount), и по данным макета
 * выходит ровно та же тройка, что на его колокольчике.
 *
 * В базу в показе не ходим: запрос остался бы без сессии и вернул ноль.
 */
export function useUnreadNotifications(): number {
  const { isDemo } = useDemoSession();
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => { setTick((n) => n + 1); }, []));
  const state = useAsyncData(
    () => (isDemo ? Promise.resolve(0) : getUnreadCount(getSupabase())),
    [tick, isDemo],
  );
  if (isDemo) return getUnreadShowcaseCount();
  return state.data ?? 0;
}

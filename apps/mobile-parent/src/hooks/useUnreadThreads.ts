import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getUnreadThreadCount } from "@snr/core";
import { getSupabase } from "../lib/supabase";
import { useAsyncData } from "./useAsyncData";

/**
 * Число тредов переписки с непрочитанными сообщениями — для бейджа вкладки
 * «Сообщения».
 *
 * ЗАЧЕМ ПОНАДОБИЛСЯ. Бейдж считался фикстурой `getUnreadMessageThreadsCount`
 * из src/data: она фильтровала выдуманный список тредов по выдуманному полю
 * `badge`. Родитель видел над вкладкой число, которого в базе нет ни в каком
 * виде. Тот же разрыв уже чинили у колокольчика уведомлений — здесь он
 * закрывается тем же приёмом и тем же запросом, что у веба.
 *
 * `getUnreadThreadCount` — из ядра, считает по `chat_read_state` против
 * `chat_messages` (см. getMyThreadSummaries). Второй копии запроса не заводим.
 * При ошибке хук вернёт 0 — бейдж просто не покажется: промолчать честнее,
 * чем показать неверное число.
 */
/** Перечитывается при получении фокуса — см. разбор в useUnreadNotifications:
 *  таб-бар не размонтируется, и разовый запрос при монтировании держал число
 *  неизменным всю сессию. */
export function useUnreadThreads(): number {
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => { setTick((n) => n + 1); }, []));
  const state = useAsyncData(() => getUnreadThreadCount(getSupabase()), [tick]);
  return state.data ?? 0;
}

import { getUnreadCount } from "@snr/core";
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
export function useUnreadNotifications(): number {
  const state = useAsyncData(() => getUnreadCount(getSupabase()), []);
  return state.data ?? 0;
}

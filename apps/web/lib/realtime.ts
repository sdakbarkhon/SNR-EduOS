"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RealtimePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  old: Record<string, any>;
};

/**
 * Subscribe to Supabase Realtime postgres_changes for a single table and run a
 * callback on every change. Pass `channelName = null` to disable the subscription
 * (e.g. when the lesson is not in the right status). The channel is torn down on
 * unmount or when the name/filter changes, so no duplicate channels accumulate.
 *
 * The callback receives the raw payload (eventType + new/old rows). Callers that
 * only need "something changed" can ignore the argument.
 *
 * NOTE: for UPDATE/DELETE events to reach a subscriber whose RLS policy references
 * non-PK columns, the table must have `REPLICA IDENTITY FULL` (see migration 37 for
 * `lessons`). Otherwise the realtime authorizer can't evaluate the policy and the
 * event is silently dropped.
 *
 * ═══ 04.09.2026 — ПОДПИСКА БОЛЬШЕ НЕ УМИРАЕТ МОЛЧА ═════════════════════════
 *
 * БЕДА. `.subscribe()` вызывался БЕЗ обратного вызова состояния. Канал мог
 * встать в CHANNEL_ERROR, отвалиться по таймауту или закрыться вместе с
 * уснувшим ноутбуком — и об этом не узнавал никто: ни лога, ни попытки
 * подняться. Экран продолжал показывать урок идущим, хотя тот давно закрылся:
 * заказчик сидел на нём и был вынужден перезагружать страницу руками.
 *
 * ЧТО ТЕПЕРЬ. Три вещи, и все три — про одно: канал обязан ожить сам.
 *
 * 1. СОСТОЯНИЕ КАНАЛА ЧИТАЕТСЯ. `subscribe((status) => …)`: на CHANNEL_ERROR,
 *    TIMED_OUT и CLOSED мы пересоздаём канал через нарастающую паузу
 *    (1 → 2 → 4 → 8 → 15 секунд), а на SUBSCRIBED сбрасываем счётчик.
 *
 * 2. ВОЗВРАТ ВКЛАДКИ. Ноутбук закрыли и открыли, вкладку свернули на час —
 *    сокет к этому времени мёртв, но события «ошибка» может и не прийти.
 *    На `visibilitychange` со скрытого на видимое канал переподнимается.
 *
 * 3. ВОЗВРАТ СЕТИ. То же на `online`.
 *
 * ПОЧЕМУ НЕ ПОЛАГАЕМСЯ НА БИБЛИОТЕКУ. У самого realtime-js есть свой
 * переподъём сокета, и он работает — но канал, ушедший в errored, поднимается
 * только вместе с сокетом. Случая «сокет жив, канал мёртв» его собственные
 * таймеры не покрывают, а именно он и даёт «экран замер, а страница живая».
 *
 * ЭТО НЕ ЗАМЕНА ОПРОСУ. Там, где промах недопустим (статус урока у ученика и
 * учителя), рядом стоит сторожевой опрос — он остаётся как был.
 */

/** Пауза перед повторной попыткой, секунды по номеру попытки. */
const ПАУЗЫ_МС = [1000, 2000, 4000, 8000, 15000];

export function useRealtimeChannel(
  channelName: string | null,
  table: string,
  filter: string | undefined,
  onChange: (payload: RealtimePayload) => void,
) {
  const cbRef = useRef(onChange);
  useEffect(() => { cbRef.current = onChange; });

  useEffect(() => {
    if (!channelName) return;
    const db = createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;
    let попытка = 0;
    let таймер: ReturnType<typeof setTimeout> | null = null;
    let снято = false;

    function поднять() {
      if (снято) return;
      if (channel) { db.removeChannel(channel); channel = null; }

      channel = db
        .channel(channelName as string)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (payload: any) => cbRef.current(payload as RealtimePayload),
        )
        .subscribe((status: string) => {
          if (снято) return;
          if (status === "SUBSCRIBED") { попытка = 0; return; }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            перезапустить();
          }
        });
    }

    function перезапустить() {
      if (снято || таймер) return;
      const пауза = ПАУЗЫ_МС[Math.min(попытка, ПАУЗЫ_МС.length - 1)]!;
      попытка += 1;
      таймер = setTimeout(() => { таймер = null; поднять(); }, пауза);
    }

    /** Вкладка вернулась или сеть поднялась — канал мог умереть незаметно. */
    function оживить() {
      if (снято) return;
      if (document.visibilityState !== "visible") return;
      if (таймер) { clearTimeout(таймер); таймер = null; }
      попытка = 0;
      поднять();
    }

    поднять();
    document.addEventListener("visibilitychange", оживить);
    window.addEventListener("online", оживить);

    return () => {
      снято = true;
      if (таймер) clearTimeout(таймер);
      document.removeEventListener("visibilitychange", оживить);
      window.removeEventListener("online", оживить);
      if (channel) db.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter]);
}

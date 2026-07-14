import { useEffect, useRef } from "react";
import type { Db } from "@snr/core";

/** Supabase Realtime (postgres_changes) — тот же паттерн, что apps/web/lib/
 *  realtime.ts's useRealtimeChannel (те же channelName/table/filter приводят
 *  к тем же событиям, поскольку это один и тот же @supabase/supabase-js
 *  клиент). Пересоздаёт подписку при смене channelName/table/filter,
 *  отписывается на unmount. */
export function useRealtimeChannel(
  db: Db,
  channelName: string,
  table: string,
  filter: string | undefined,
  onChange: (payload: unknown) => void,
): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = db as any;
    const channel = sb
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        (payload: unknown) => onChangeRef.current(payload),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, channelName, table, filter]);
}

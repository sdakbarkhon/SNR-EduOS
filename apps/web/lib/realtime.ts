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
 */
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
    const channel = db
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => cbRef.current(payload as RealtimePayload),
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter]);
}

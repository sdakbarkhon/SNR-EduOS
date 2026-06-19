"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe to Supabase Realtime postgres_changes for a single table and run a
 * callback on every change. Pass `channelName = null` to disable the subscription
 * (e.g. when the lesson is not in the right status). The channel is torn down on
 * unmount or when the name/filter changes, so no duplicate channels accumulate.
 */
export function useRealtimeChannel(
  channelName: string | null,
  table: string,
  filter: string | undefined,
  onChange: () => void,
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
        () => cbRef.current(),
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter]);
}

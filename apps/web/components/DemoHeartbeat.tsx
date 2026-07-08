"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// БОЛЬШОЕ ОБНОВЛЕНИЕ Этап 4.3 — keeps a claimed demo account's
// demo_sessions.last_activity fresh so reset_expired_demo_sessions()
// (migration 99, cron every 30 min) doesn't reclaim it out from under an
// actively-used session. Fires once on mount (covers short visits) and then
// every 5 minutes for as long as the tab stays open.
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function DemoHeartbeat({ isDemo }: { isDemo: boolean }) {
  useEffect(() => {
    if (!isDemo) return;
    const sb = createClient();
    const touch = () => { void sb.rpc("touch_demo_session"); };
    touch();
    const interval = setInterval(touch, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isDemo]);

  return null;
}

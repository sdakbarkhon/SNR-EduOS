"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// PROMT 3 single-session: heartbeat держит user_sessions.last_activity
// (и demo_sessions.last_activity для пула демо-учеников) свежими, чтобы
// reset_expired_demo_sessions() (крон каждые 30 мин, миграция 110) не
// зачистил активную демо-сессию. Fires once on mount (covers short visits)
// and then every 5 minutes for as long as the tab stays open.
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function DemoHeartbeat({ isDemo }: { isDemo: boolean }) {
  useEffect(() => {
    if (!isDemo) return;
    const sb = createClient();
    const touch = () => { void sb.rpc("touch_user_session"); };
    touch();
    const interval = setInterval(touch, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isDemo]);

  return null;
}

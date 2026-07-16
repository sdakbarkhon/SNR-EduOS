"use client";

import { useEffect } from "react";

// P2 heartbeat: держит demo_leases.last_activity_at свежим (15 мин
// timeout, миграция 133). Дёргает POST /api/demo/heartbeat — на сервере
// читается snr-demo-session cookie, делается RPC heartbeat_demo_slot.
// Если lease протух — сервер снимает cookie, и следующий рендер layout
// не покажет баннер.
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function DemoHeartbeat({ isDemo }: { isDemo: boolean }) {
  useEffect(() => {
    if (!isDemo) return;
    const touch = () => {
      void fetch("/api/demo/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      });
    };
    touch();
    const interval = setInterval(touch, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isDemo]);

  return null;
}

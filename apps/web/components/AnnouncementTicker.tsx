"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { getActiveTickerAnnouncements, type Announcement } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

const DISPLAY_MS = 5000;
const FADE_MS = 400;

export function AnnouncementTicker() {
  const db = createClient();
  const [uid, setUid] = useState<string | null>(null);
  const [tickers, setTickers] = useState<Announcement[]>([]);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const reloadRef = useRef<() => void>(() => {});

  async function reload() {
    const list = await getActiveTickerAnnouncements(db).catch(() => []);
    setTickers(list);
    setIdx(0);
    setVisible(true);
  }
  reloadRef.current = reload;

  // Initial load + auth uid
  useEffect(() => {
    reload();
    db.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: refresh when announcements change
  useEffect(() => {
    if (!uid) return;
    const channel = db
      .channel(`ticker-${uid}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "*", schema: "public", table: "announcements",
      }, () => { reloadRef.current(); })
      .subscribe();
    return () => { db.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Cycle through tickers: DISPLAY_MS visible, fade out, advance, fade in
  useEffect(() => {
    if (tickers.length <= 1) return;
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % tickers.length);
        setVisible(true);
      }, FADE_MS);
    }, DISPLAY_MS);
    return () => clearInterval(t);
  }, [tickers]);

  if (tickers.length === 0) return null;

  const current = tickers[idx];
  if (!current) return null;

  return (
    <div
      className="flex items-center gap-2 overflow-hidden rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-1.5 text-xs text-amber-800 backdrop-blur-md"
      style={{
        maxWidth: "min(520px, 44vw)",
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      <span className="truncate font-medium">{current.title}</span>
      {tickers.length > 1 && (
        <span className="ml-auto shrink-0 text-[10px] text-amber-500/70">
          {idx + 1}/{tickers.length}
        </span>
      )}
    </div>
  );
}

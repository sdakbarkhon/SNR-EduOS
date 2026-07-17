"use client";

import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
import { getUnreadTickerAnnouncements, markTickerAnnouncementsRead, type Announcement } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

export function AnnouncementTicker({
  onlyFromAdmins = false,
  stretch = false,
}: {
  onlyFromAdmins?: boolean;
  /** Пачка 4, Задача C — растянуть на всю доступную ширину родителя
      (студенческий Topbar, flex-1 слот) вместо фиксированного
      maxWidth. По умолчанию false — TeacherTopbar (fixed-width
      кластер справа с колокольчиком) остаётся без изменений. */
  stretch?: boolean;
}) {
  const dbRef = useRef<ReturnType<typeof createClient> | null>(null);
  const uidRef = useRef<string | null>(null);
  const [tickers, setTickers] = useState<Announcement[]>([]);
  const [idx, setIdx] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const reloadRef = useRef<() => void>(() => {});

  async function reload() {
    const db = dbRef.current;
    const uid = uidRef.current;
    if (!db || !uid) return;
    const list = await getUnreadTickerAnnouncements(db, uid, { onlyFromAdmins }).catch(() => [] as Announcement[]);
    setTickers(list);
    setIdx(0);
    setAnimKey((k) => k + 1);
  }
  reloadRef.current = reload;

  useEffect(() => {
    try {
      const db = createClient();
      dbRef.current = db;
      db.auth.getUser().then(({ data }) => {
        if (!data.user?.id) return;
        uidRef.current = data.user.id;
        reloadRef.current();
      }).catch(() => null);
    } catch {
      // hide ticker on init error
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime: refresh when announcements change
  useEffect(() => {
    const db = dbRef.current;
    if (!db) return;
    let channel: ReturnType<typeof db.channel> | null = null;
    db.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      channel = db
        .channel(`ticker-${uid}`)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .on("postgres_changes" as any, {
          event: "*", schema: "public", table: "announcements",
        }, () => { reloadRef.current(); })
        .subscribe();
    }).catch(() => null);
    return () => { if (channel) db.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when the marquee animation ends — mark current as read, advance
  function handleAnimEnd() {
    const db = dbRef.current;
    const uid = uidRef.current;
    const cur = tickers[idx];
    if (db && uid && cur) {
      markTickerAnnouncementsRead(db, uid, [cur.id]);
    }
    const next = idx + 1;
    if (next >= tickers.length) {
      setTickers([]);
    } else {
      setIdx(next);
      setAnimKey((k) => k + 1);
    }
  }

  if (tickers.length === 0) return null;
  const current = tickers[idx];
  if (!current) return null;

  return (
    <div
      className={`flex items-center gap-2 overflow-hidden rounded-xl border border-amber-200/60 bg-amber-50/80 px-3 py-1.5 text-xs text-amber-800 backdrop-blur-md ${stretch ? "w-full" : ""}`}
      style={stretch ? undefined : { maxWidth: "min(520px, 44vw)" }}
    >
      <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      <span
        key={animKey}
        className="animate-marquee whitespace-nowrap font-medium"
        onAnimationEnd={handleAnimEnd}
        style={{ display: "inline-block", willChange: "transform" }}
      >
        {current.title}
      </span>
      {tickers.length > 1 && (
        <span className="ml-auto shrink-0 text-[10px] text-amber-500/70">
          {idx + 1}/{tickers.length}
        </span>
      )}
    </div>
  );
}

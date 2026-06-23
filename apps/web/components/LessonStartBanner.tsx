"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";

type BannerState = { lessonId: string; title: string } | null;

export function LessonStartBanner() {
  const { locale } = useLocale();
  const dl = getDictionary(locale as Locale).lesson;
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [banner, setBanner] = useState<BannerState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback ref so the Realtime handler never goes stale
  const onStartRef = useRef<(id: string, title: string) => void>(() => {});
  onStartRef.current = (lessonId: string, title: string) => {
    try {
      if (sessionStorage.getItem(`banner-dismissed-${lessonId}`)) return;
    } catch { /* blocked */ }
    setBanner({ lessonId, title });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setBanner(null), 30_000);
  };

  useEffect(() => {
    setMounted(true);
    const db = createClient();
    const channel = db
      .channel("lesson-start-banner")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on("postgres_changes" as any, {
        event: "UPDATE",
        schema: "public",
        table: "lessons",
        filter: "status=eq.in_progress",
      }, (payload: { new: { id: string; status: string; title: string | null } }) => {
        const row = payload.new;
        if (row?.status === "in_progress") {
          onStartRef.current(row.id, row.title ?? "");
        }
      })
      .subscribe();
    return () => {
      db.removeChannel(channel);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function dismiss() {
    if (banner) {
      try {
        sessionStorage.setItem(`banner-dismissed-${banner.lessonId}`, "1");
      } catch { /* blocked */ }
    }
    setBanner(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  if (!mounted || !banner || pathname === `/lessons/${banner.lessonId}`) return null;

  return createPortal(
    <div
      role="alert"
      className="fixed left-0 right-0 top-0 z-[9998] flex items-center justify-between gap-4 px-4 py-3"
      style={{
        background: "linear-gradient(90deg, #0891b2 0%, #2563eb 100%)",
        boxShadow: "0 4px 24px rgba(8,145,178,0.35)",
      }}
    >
      <div className="flex items-center gap-3 text-white">
        <span className="text-lg leading-none">🟢</span>
        <span className="text-sm font-bold">
          {dl.bannerStarted}{banner.title ? ` ${banner.title}` : ""}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => { const id = banner.lessonId; dismiss(); router.push(`/lessons/${id}`); }}
          className="rounded-lg bg-white/20 px-3 py-1 text-xs font-bold text-white transition-colors hover:bg-white/30"
        >
          {dl.bannerGo}
        </button>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

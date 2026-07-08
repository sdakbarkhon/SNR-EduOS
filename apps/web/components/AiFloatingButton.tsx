"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { AiFloatingChat } from "./AiFloatingChat";

// sessionStorage (not localStorage): the welcome bubble should reappear on a
// genuinely new browser session, but not every time the student navigates
// between pages within the same one (УЧ.11 Part 2).
const WELCOME_SHOWN_KEY = "ai_fab_welcomed";
const WELCOME_VISIBLE_MS = 5000;
const IDLE_INTERVAL_MS = 15000;
const IDLE_VISIBLE_MS = 4000;

// non-null: only ever called with the fixed, non-empty welcome/idle arrays.
function pickRandom(phrases: string[]): string {
  return phrases[Math.floor(Math.random() * phrases.length)]!;
}

export function AiFloatingButton() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [open, setOpen] = useState(false);
  // Once opened, the panel stays mounted (just visually hidden/scaled out)
  // so AiFloatingChat's sessionStorage-backed history survives toggling the
  // panel closed and open again, not just full page navigation.
  const [everOpened, setEverOpened] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);
  const [hovering, setHovering] = useState(false);

  function toggleOpen() {
    setEverOpened(true);
    setOpen((prev) => !prev);
  }

  // Welcome bubble once per session on first landing after login, then
  // regular slogans cycling every 15s elsewhere — paused entirely while the
  // modal is open (Part 2.3/D). Self-scheduling setTimeout (not setInterval)
  // so the idle cycle reliably starts AFTER the welcome bubble hides in the
  // same effect run, instead of only on a second effect execution that may
  // never happen if the user never opens the modal (open is this effect's
  // only dependency).
  useEffect(() => {
    if (open) {
      setBubble(null);
      return;
    }

    const { welcome, idle } = d.ai.fab;
    let hideTimer: ReturnType<typeof setTimeout>;
    let cycleTimer: ReturnType<typeof setTimeout>;

    function scheduleIdleCycle(delayMs: number) {
      cycleTimer = setTimeout(() => {
        setBubble(pickRandom(idle));
        hideTimer = setTimeout(() => setBubble(null), IDLE_VISIBLE_MS);
        scheduleIdleCycle(IDLE_INTERVAL_MS);
      }, delayMs);
    }

    if (sessionStorage.getItem(WELCOME_SHOWN_KEY) !== "1") {
      sessionStorage.setItem(WELCOME_SHOWN_KEY, "1");
      setBubble(pickRandom(welcome));
      hideTimer = setTimeout(() => setBubble(null), WELCOME_VISIBLE_MS);
      scheduleIdleCycle(WELCOME_VISIBLE_MS + IDLE_INTERVAL_MS);
    } else {
      scheduleIdleCycle(IDLE_INTERVAL_MS);
    }

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(cycleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const showBubble = bubble != null && !hovering && !open;

  return (
    <>
      {showBubble && (
        <div className="fixed bottom-40 right-4 z-40 max-w-[260px] rounded-xl bg-white px-4 py-3 text-[13px] font-medium leading-snug text-slate-800 shadow-xl animate-scale-in md:bottom-24">
          {bubble}
          <span className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 bg-white" />
        </div>
      )}

      {/* bottom-20/right-4 on mobile clears the BottomNav (md:hidden, ~56px
          tall) below it; bottom-4/right-4 on md+ (where BottomNav is hidden)
          is the strict corner the spec asks for. Compact ~52px circle (§6.1),
          bank-widget scale rather than the previous 56px. */}
      <button
        onClick={toggleOpen}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        title={d.nav.aiAssistant}
        aria-label={d.nav.aiAssistant}
        className="fixed bottom-20 right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-400 to-yellow-400 shadow-lg transition-transform hover:scale-105 hover:shadow-xl md:bottom-4"
      >
        <Sparkles className="h-6 w-6 text-white" strokeWidth={2} />
      </button>

      {/* Плавающее окно чата (§6.2) — НЕ модалка: без затемняющего фона,
          страница за окном остаётся видимой и рабочей. Заякорено над
          кнопкой в правом нижнем углу, ~400×600px. */}
      {everOpened && (
        <div
          className={
            open
              ? "fixed bottom-36 right-4 z-50 w-[calc(100vw-2rem)] max-w-[400px] origin-bottom-right transition-all duration-200 md:bottom-20"
              : "pointer-events-none fixed bottom-36 right-4 z-50 w-[calc(100vw-2rem)] max-w-[400px] origin-bottom-right scale-95 opacity-0 transition-all duration-200 md:bottom-20"
          }
          style={{ height: "min(600px, calc(100vh - 180px))" }}
        >
          <div className="h-full w-full rounded-[20px] shadow-2xl ring-1 ring-black/5">
            <AiFloatingChat onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { AiAssistantView } from "@/app/(app)/ai-assistant/AiAssistantView";

export function AiFloatingButton() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);

  const [open, setOpen] = useState(false);
  // Once opened, the modal stays mounted (just visually hidden) so the chat
  // — a plain useState inside AiAssistantView — keeps its messages for the
  // rest of the session instead of resetting every time the dialog closes.
  const [everOpened, setEverOpened] = useState(false);

  function handleOpen() {
    setEverOpened(true);
    setOpen(true);
  }

  return (
    <>
      {/* bottom-24 (not bottom-6): the dashboard page has its own SOS/leave/
          support speed-dial FAB at bottom-6 right-6 z-50 — stacking here
          avoids covering/being covered by it on that specific page. */}
      <button
        onClick={handleOpen}
        title={d.nav.aiAssistant}
        aria-label={d.nav.aiAssistant}
        className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-orange-400 to-yellow-400 shadow-lg transition-transform hover:scale-105 hover:shadow-xl"
      >
        <Sparkles className="h-7 w-7 text-white" strokeWidth={2} />
      </button>

      {everOpened && (
        <div
          className={
            open
              ? "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              : "hidden"
          }
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-[75vw] max-w-[1400px] flex-col rounded-[24px] bg-white shadow-2xl"
            style={{ height: "80vh", maxHeight: 900 }}
          >
            <button
              onClick={() => setOpen(false)}
              title="Закрыть"
              aria-label="Закрыть"
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-400 shadow-sm hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <AiAssistantView />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

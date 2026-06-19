"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CalendarX, Headphones, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

type ActionKey = "sos" | "leave" | "support";

const ACTIONS: Record<
  ActionKey,
  { icon: React.ReactNode; label: string; bg: string; title: string; body: string }
> = {
  sos: {
    icon: <AlertCircle className="h-5 w-5" />,
    label: "SOS",
    bg: "bg-red-500",
    title: "SOS",
    body: "Функция экстренной связи находится в разработке. Скоро ты сможешь быстро связаться со школьной службой поддержки.",
  },
  leave: {
    icon: <CalendarX className="h-5 w-5" />,
    label: "Отпроситься",
    bg: "bg-amber-500",
    title: "Отпроситься с урока",
    body: "Функция в разработке. Скоро ты сможешь уведомить учителя о невозможности присутствовать на уроке прямо отсюда.",
  },
  support: {
    icon: <Headphones className="h-5 w-5" />,
    label: "Поддержка",
    bg: "bg-emerald-500",
    title: "Поддержка",
    body: "Школьная поддержка скоро будет доступна. Здесь ты сможешь обратиться к классному руководителю или администрации.",
  },
};

const ACTION_ORDER: ActionKey[] = ["sos", "leave", "support"];
const OFFSETS = [72, 132, 192];

export function FloatingActionButton() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ActionKey | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setModal(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        {ACTION_ORDER.map((key, i) => {
          const a = ACTIONS[key];
          return (
            <div
              key={key}
              className="absolute right-0 flex items-center gap-2"
              style={{
                bottom: OFFSETS[i],
                transition: "opacity 200ms, transform 200ms",
                transitionDelay: open
                  ? `${i * 60}ms`
                  : `${(ACTION_ORDER.length - 1 - i) * 60}ms`,
                opacity: open ? 1 : 0,
                transform: open ? "translateY(0)" : "translateY(16px)",
                pointerEvents: open ? "auto" : "none",
              }}
            >
              <span className="rounded-full bg-slate-800/80 px-3 py-1.5 text-[11px] font-semibold text-white shadow backdrop-blur-sm whitespace-nowrap">
                {a.label}
              </span>
              <button
                type="button"
                title={a.label}
                onClick={(e) => { e.stopPropagation(); setModal(key); setOpen(false); }}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-110",
                  a.bg,
                )}
              >
                {a.icon}
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
        >
          <Plus
            className="h-6 w-6 transition-transform duration-200"
            style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn(
              "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full text-white",
              ACTIONS[modal].bg,
            )}>
              {ACTIONS[modal].icon}
            </div>
            <h2 className="mb-3 text-center text-xl font-bold text-slate-800">
              {ACTIONS[modal].title}
            </h2>
            <p className="mb-6 text-center text-sm leading-relaxed text-slate-600">
              {ACTIONS[modal].body}
            </p>
            <button
              type="button"
              onClick={() => setModal(null)}
              className="w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  );
}

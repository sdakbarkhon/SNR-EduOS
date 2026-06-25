"use client";

// iOS-style wheel time picker (hours 0–23, minutes in steps of 5).
// Self-written (~no deps) for full control over styling + the "no past time"
// rule. Works with mouse-wheel, touch-swipe and tap. When the chosen date is
// today (passed via `minDate`), hours/minutes already in the past are dimmed
// and unselectable; scrolling onto them snaps back to the nearest valid value.

import { useEffect, useMemo, useRef, useState } from "react";

const ITEM_H = 40;        // px per row
const VISIBLE = 5;        // rows shown (2 above, centre, 2 below)
const PAD = (VISIBLE - 1) / 2;

const APP_TZ = "Asia/Tashkent";

/** Current date + clock in the app's fixed timezone (Asia/Tashkent, UTC+5). */
function nowInTashkent(): { dateStr: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0; // some runtimes render midnight as 24
  return {
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
    hour,
    minute: parseInt(get("minute"), 10),
  };
}

type Item = { v: number; label: string; disabled: boolean };

function Wheel({
  items, value, onChange, ariaLabel,
}: {
  items: Item[];
  value: number;
  onChange: (v: number) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);
  const [centerIdx, setCenterIdx] = useState(() => Math.max(0, items.findIndex((it) => it.v === value)));

  const idxOf = (v: number) => items.findIndex((it) => it.v === v);

  function nearestEnabled(i: number): number {
    if (items[i] && !items[i]!.disabled) return i;
    for (let d = 1; d < items.length; d++) {
      const lo = items[i - d];
      if (lo && !lo.disabled) return i - d;
      const hi = items[i + d];
      if (hi && !hi.disabled) return i + d;
    }
    return i;
  }

  // Re-centre when the selected value (or the list) changes externally.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const i = idxOf(value);
    if (i < 0) return;
    programmatic.current = true;
    el.scrollTo({ top: i * ITEM_H, behavior: "auto" });
    setCenterIdx(i);
    const t = setTimeout(() => { programmatic.current = false; }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items.length]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    const c = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
    setCenterIdx(c);
    if (programmatic.current) return;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      const cur = ref.current;
      if (!cur) return;
      let i = Math.round(cur.scrollTop / ITEM_H);
      i = Math.max(0, Math.min(items.length - 1, i));
      i = nearestEnabled(i);
      programmatic.current = true;
      cur.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
      setCenterIdx(i);
      setTimeout(() => { programmatic.current = false; }, 220);
      const picked = items[i];
      if (picked && picked.v !== value) onChange(picked.v);
    }, 110);
  }

  function tap(it: Item) {
    if (it.disabled) return;
    onChange(it.v);
  }

  return (
    <div className="relative flex-1 select-none" style={{ height: ITEM_H * VISIBLE }} role="listbox" aria-label={ariaLabel}>
      {/* Centre highlight band */}
      <div
        className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-xl border-y-2 border-blue-200 bg-blue-50/50"
        style={{ height: ITEM_H }}
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="ios-wheel-scroll h-full overflow-y-auto overflow-x-hidden"
        style={{ scrollSnapType: "none", touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ height: ITEM_H * PAD }} />
        {items.map((it, i) => {
          const dist = Math.abs(i - centerIdx);
          const cls = it.disabled
            ? "text-slate-300/60"
            : dist === 0
            ? "text-2xl font-extrabold text-slate-900"
            : dist === 1
            ? "text-lg font-semibold text-slate-500"
            : "text-base text-slate-400";
          return (
            <div
              key={it.v}
              onClick={() => tap(it)}
              className={`flex items-center justify-center tabular-nums transition-all ${cls} ${it.disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              style={{
                height: ITEM_H,
                opacity: it.disabled ? 0.35 : dist === 0 ? 1 : dist === 1 ? 0.6 : 0.3,
              }}
              aria-disabled={it.disabled}
              aria-selected={dist === 0}
              role="option"
            >
              {it.label}
            </div>
          );
        })}
        <div style={{ height: ITEM_H * PAD }} />
      </div>
    </div>
  );
}

export function IosTimePicker({
  value, onChange, minDate,
}: {
  value: string;
  onChange: (v: string) => void;
  minDate?: string;
}) {
  const now = useMemo(() => nowInTashkent(), []);
  const isToday = !!minDate && minDate === now.dateStr;

  const parts = value ? value.split(":") : [];
  const hhStr = parts[0] ?? "";
  const mmStr = parts[1] ?? "";
  const selHour = hhStr !== "" ? parseInt(hhStr, 10) : (isToday ? now.hour : 9);
  const selMin = mmStr !== "" ? parseInt(mmStr, 10) : 0;

  const hourDisabled = (h: number) => isToday && h < now.hour;
  const minDisabledFor = (h: number, m: number) => isToday && h === now.hour && m < now.minute;

  const hourItems: Item[] = useMemo(
    () => Array.from({ length: 24 }, (_, h) => ({
      v: h, label: String(h).padStart(2, "0"), disabled: hourDisabled(h),
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isToday, now.hour],
  );

  const minuteItems: Item[] = useMemo(() => {
    const vals = Array.from({ length: 12 }, (_, i) => i * 5);
    if (!vals.includes(selMin)) { vals.push(selMin); vals.sort((a, b) => a - b); }
    return vals.map((m) => ({ v: m, label: String(m).padStart(2, "0"), disabled: minDisabledFor(selHour, m) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selHour, selMin, isToday, now.hour, now.minute]);

  const emit = (h: number, m: number) =>
    onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);

  // Initialise an empty value, and correct any now-invalid combo when the
  // chosen date flips to "today".
  useEffect(() => {
    let h = selHour;
    if (hourDisabled(h)) {
      const fh = hourItems.find((it) => !it.disabled);
      h = fh ? fh.v : 0;
    }
    let m = selMin;
    if (minDisabledFor(h, m)) {
      const fm = [...Array(12).keys()].map((i) => i * 5).find((x) => x >= now.minute);
      m = fm ?? 55;
    }
    const next = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    if (next !== value) emit(h, m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate]);

  function onHour(h: number) {
    let m = selMin;
    if (minDisabledFor(h, m)) {
      const fm = minuteItems.find((it) => it.v >= now.minute && !minDisabledFor(h, it.v));
      m = fm ? fm.v : (minuteItems.find((it) => !minDisabledFor(h, it.v))?.v ?? m);
    }
    emit(h, m);
  }

  function onMin(m: number) {
    emit(selHour, m);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <style>{`.ios-wheel-scroll{scrollbar-width:none;-ms-overflow-style:none}.ios-wheel-scroll::-webkit-scrollbar{display:none}`}</style>
      <div className="flex items-stretch gap-2">
        <Wheel items={hourItems} value={selHour} onChange={onHour} ariaLabel="Часы" />
        <div className="flex items-center text-2xl font-bold text-slate-300">:</div>
        <Wheel items={minuteItems} value={selMin} onChange={onMin} ariaLabel="Минуты" />
      </div>
      <div className="mt-1 flex gap-2">
        <div className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">часы</div>
        <div className="w-4" />
        <div className="flex-1 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">минуты</div>
      </div>
    </div>
  );
}

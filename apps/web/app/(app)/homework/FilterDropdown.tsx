"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function FilterDropdown<T extends string>({
  icon,
  label,
  options,
  value,
  onChange,
  align = "left",
}: {
  icon?: ReactNode;
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center justify-between gap-3 min-w-[150px] px-4 py-2.5 rounded-[13px] text-sm font-semibold text-slate-700 bg-white border whitespace-nowrap transition-colors",
          open ? "border-violet-300" : "border-slate-100 hover:border-slate-200",
        )}
      >
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-[calc(100%+8px)] min-w-[190px] bg-white border border-slate-100 rounded-2xl shadow-[0_16px_40px_rgba(24,20,50,0.14)] p-1.5 z-50 flex flex-col gap-0.5",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                "text-left px-3 py-2.5 rounded-[10px] text-sm font-semibold transition-colors",
                opt.value === value
                  ? "bg-violet-50 text-violet-600"
                  : "text-slate-600 hover:bg-slate-50 hover:text-violet-600",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

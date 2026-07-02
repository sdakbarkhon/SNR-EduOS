"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Local copy of the homework FilterDropdown pattern, scoped to /grades so this
 * page's commit doesn't touch files under app/(app)/homework/. */
export function GradeFilterDropdown<T extends string>({
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
          "inline-flex min-w-[150px] items-center justify-between gap-3 whitespace-nowrap rounded-[13px] border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors",
          open ? "border-violet-300" : "border-slate-100 hover:border-slate-200",
        )}
      >
        <span className="inline-flex items-center gap-2">
          {icon}
          {label}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-[calc(100%+8px)] z-50 flex min-w-[190px] flex-col gap-0.5 rounded-2xl border border-slate-100 bg-white p-1.5 shadow-[0_16px_40px_rgba(24,20,50,0.14)]",
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
                "rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                opt.value === value ? "bg-violet-50 text-violet-600" : "text-slate-600 hover:bg-slate-50 hover:text-violet-600",
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

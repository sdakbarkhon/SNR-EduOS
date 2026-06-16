"use client";

import { cn } from "@/lib/cn";

export interface TabItem {
  key: string;
  label: string;
}

export function SegmentedTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex gap-1 rounded-chip bg-bg-app p-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "rounded-chip px-4 py-1.5 text-sm font-medium transition",
            value === t.key
              ? "bg-bg-card text-text-primary shadow-card"
              : "text-text-muted",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { useLocale } from "./LocaleProvider";
import { SELECTED_CHILD_COOKIE, type ParentChild } from "@/lib/parent-child";
import { LogoutButton } from "./LogoutButton";

const CHILD_PATH_RE = /^(\/parent\/child\/)[^/]+(\/.*)?$/;

export function ParentTopbar({
  parentName,
  kids,
  selectedChildId,
}: {
  parentName: string;
  kids: ParentChild[];
  selectedChildId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale);
  const dp = d.parent;
  const [open, setOpen] = useState(false);

  const selected = kids.find((k) => k.id === selectedChildId) ?? kids[0] ?? null;

  function selectChild(newId: string) {
    setOpen(false);
    if (typeof document !== "undefined") {
      document.cookie = `${SELECTED_CHILD_COOKIE}=${newId}; path=/; max-age=${60 * 60 * 24 * 365}`;
    }
    const childMatch = pathname.match(CHILD_PATH_RE);
    if (childMatch) {
      router.push(`${childMatch[1]}${newId}${childMatch[2] ?? ""}`);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("child", newId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-pink-100/60 bg-white/70 px-6 backdrop-blur-md">
      <div className="relative">
        {kids.length === 0 ? (
          <span className="text-sm text-gray-400">{dp.noChildren}</span>
        ) : kids.length === 1 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">{kids[0]?.full_name}</span>
            {kids[0]?.className && (
              <span className="rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-600">
                {kids[0].className}
              </span>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border border-pink-100 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-pink-50"
            >
              <span>{selected?.full_name ?? dp.selectChild}</span>
              {selected?.className && (
                <span className="rounded-full bg-pink-50 px-2 py-0.5 text-xs font-medium text-pink-600">
                  {selected.className}
                </span>
              )}
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-pink-100 bg-white py-1 shadow-lg">
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {dp.selectChild}
                  </div>
                  {kids.map((k) => (
                    <button
                      key={k.id}
                      onClick={() => selectChild(k.id)}
                      className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition hover:bg-pink-50 ${
                        k.id === selected?.id ? "bg-pink-50 font-semibold text-pink-700" : "text-gray-700"
                      }`}
                    >
                      <span>{k.full_name}</span>
                      {k.className && <span className="text-xs text-gray-400">{k.className}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm font-medium text-gray-600 sm:inline">{parentName}</span>
        <LogoutButton />
      </div>
    </header>
  );
}

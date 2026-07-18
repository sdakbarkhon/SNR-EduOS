"use client";

import { AlertCircle, LogOut } from "lucide-react";
import { defaultLocale, getDictionary } from "@snr/core";
import { useLogout, LogoutOverlay } from "./LogoutOverlay";

/**
 * `isDemo` is computed server-side (PROMT 3: from the `snr-demo-session`
 * cookie set by the demoLogin server action — session-scoped, not
 * account-scoped) and passed down as a prop — avoids a second client-side
 * auth round trip and the flash-of-no-banner that a `useEffect` +
 * `getUser()` here would cause.
 */
export function DemoBanner({ isDemo }: { isDemo: boolean }) {
  const d = getDictionary(defaultLocale).demoMode;
  const { loggingOut, logout } = useLogout();

  if (!isDemo) return null;

  return (
    <>
      {/* Reserves the banner's height in normal flow so fixed positioning
          below doesn't cover the first row of page content. */}
      <div className="h-10" />

      <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-between gap-3 border-b border-yellow-500 bg-yellow-400 px-4 py-2 shadow-md">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-yellow-900" />
          <span className="text-sm font-medium text-yellow-900">{d.bannerText}</span>
        </div>
        <button
          onClick={logout}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-yellow-900 px-3 py-1 text-xs font-medium text-yellow-100 hover:bg-yellow-950"
        >
          <LogOut className="h-3.5 w-3.5" />
          {d.bannerLogout}
        </button>
      </div>
      {loggingOut && <LogoutOverlay />}
    </>
  );
}

"use client";

import { AlertCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { defaultLocale, getDictionary } from "@snr/core";
import { createClient } from "@/lib/supabase/client";

/**
 * `isDemo` is computed server-side (from the already-fetched user's
 * `user_metadata.is_demo`, set by migration 65's demo accounts) and passed
 * down as a prop — avoids a second client-side auth round trip and the
 * flash-of-no-banner that a `useEffect` + `getUser()` here would cause.
 */
export function DemoBanner({ isDemo }: { isDemo: boolean }) {
  const d = getDictionary(defaultLocale).demoMode;
  const router = useRouter();

  if (!isDemo) return null;

  async function handleLogout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-yellow-500 bg-yellow-400 px-4 py-2">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-yellow-900" />
        <span className="text-sm font-medium text-yellow-900">{d.bannerText}</span>
      </div>
      <button
        onClick={handleLogout}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-yellow-900 px-3 py-1 text-xs font-medium text-yellow-100 hover:bg-yellow-950"
      >
        <LogOut className="h-3.5 w-3.5" />
        {d.bannerLogout}
      </button>
    </div>
  );
}

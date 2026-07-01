"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { defaultLocale, getDictionary } from "@snr/core";

/**
 * Shown once per demo login (both via the DemoRoleModal cards and a direct
 * username/password form login into demo_teacher/demo_student), gated by a
 * sessionStorage flag the login flow sets right before redirecting — so it
 * survives the redirect but doesn't reappear on every subsequent page load.
 */
export function DemoWelcomeModal() {
  const d = getDictionary(defaultLocale).demoMode;
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sessionStorage.getItem("show-demo-welcome") === "true") {
      setShow(true);
      sessionStorage.removeItem("show-demo-welcome");
    }
  }, []);

  if (!mounted || !show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Info className="h-8 w-8 text-amber-600" />
          </div>

          <h2 className="mb-3 text-2xl font-bold text-slate-900">{d.welcomeTitle}</h2>
          <p className="mb-8 text-slate-600">{d.welcomeText}</p>

          <button
            onClick={() => setShow(false)}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-6 py-3 font-semibold text-white transition hover:shadow-lg"
          >
            {d.welcomeOk}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

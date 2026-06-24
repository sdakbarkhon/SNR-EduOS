"use client";

import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/AdminSidebar";

export function AdminShell({ adminName, children }: { adminName: string; children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen overflow-hidden"
      style={{ background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)" }}
    >
      <AdminSidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Subtle top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-violet-100/60 bg-white/60 px-6 backdrop-blur-md">
          <span className="text-[14px] font-semibold text-gray-700">SNR EduOS — Admin</span>
          <span className="text-[13px] text-gray-500">{adminName}</span>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-8 pt-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

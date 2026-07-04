"use client";

import type { ReactNode } from "react";
import { SuperAdminSidebar } from "@/components/SuperAdminSidebar";

export function SuperAdminShell({
  adminName,
  children,
}: {
  adminName: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen"
      style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)" }}
    >
      <SuperAdminSidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200/60 bg-white/60 px-6 backdrop-blur-md">
          <span className="text-[14px] font-semibold text-gray-700">SNR EduOS — Super Admin</span>
          <span className="text-[13px] text-gray-500">{adminName}</span>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-8 pt-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

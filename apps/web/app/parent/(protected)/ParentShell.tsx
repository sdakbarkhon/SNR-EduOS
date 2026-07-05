"use client";

import type { ReactNode } from "react";
import { ParentSidebar } from "@/components/ParentSidebar";

export function ParentShell({
  parentName,
  children,
}: {
  parentName: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen"
      style={{ background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)" }}
    >
      <ParentSidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-pink-100/60 bg-white/60 px-6 backdrop-blur-md">
          <span className="text-[14px] font-semibold text-gray-700">SNR EduOS — Родитель</span>
          <span className="text-[13px] text-gray-500">{parentName}</span>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-8 pt-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

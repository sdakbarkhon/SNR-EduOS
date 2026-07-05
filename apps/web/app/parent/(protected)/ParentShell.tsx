"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ParentSidebar } from "@/components/ParentSidebar";
import { ParentTopbar } from "@/components/ParentTopbar";
import { ToastProvider } from "@/components/Toast";
import type { ParentChild } from "@/lib/parent-child";

const CHILD_PATH_RE = /^\/parent\/child\/([^/]+)/;

export function ParentShell({
  parentName,
  kids,
  defaultChildId,
  children,
}: {
  parentName: string;
  kids: ParentChild[];
  defaultChildId: string | null;
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      <div
        className="flex min-h-screen"
        style={{ background: "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)" }}
      >
        <Suspense fallback={null}>
          <ShellBody parentName={parentName} kids={kids} defaultChildId={defaultChildId}>
            {children}
          </ShellBody>
        </Suspense>
      </div>
    </ToastProvider>
  );
}

function ShellBody({
  parentName,
  kids,
  defaultChildId,
  children,
}: {
  parentName: string;
  kids: ParentChild[];
  defaultChildId: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const childMatch = pathname.match(CHILD_PATH_RE);
  const selectedChildId = childMatch?.[1] ?? searchParams.get("child") ?? defaultChildId;

  return (
    <>
      <ParentSidebar selectedChildId={selectedChildId} />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <ParentTopbar parentName={parentName} kids={kids} selectedChildId={selectedChildId} />
        <main className="flex-1 overflow-y-auto px-4 pb-8 pt-6 md:px-8">
          {children}
        </main>
      </div>
    </>
  );
}

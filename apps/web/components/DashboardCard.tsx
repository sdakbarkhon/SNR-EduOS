"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

interface DashboardCardProps {
  title: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  href?: string;
  className?: string;
}

export function DashboardCard({
  title,
  icon,
  headerRight,
  children,
  href,
  className,
}: DashboardCardProps) {
  const inner = (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm p-5 h-full flex flex-col",
        href && "transition-all group-hover:shadow-md group-hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          <span className="text-[13px] font-semibold text-gray-500">{title}</span>
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        {inner}
      </Link>
    );
  }
  return inner;
}

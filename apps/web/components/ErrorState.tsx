import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

/** Показывается вместо EmptyState, когда запрос РЕАЛЬНО упал (не просто
 *  "данных пока нет") — Промт 6, аудит silent-fail. */
export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card bg-bg-card p-8 text-center text-red-600 shadow-card dark:text-red-400">
      <AlertTriangle className="h-6 w-6" />
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

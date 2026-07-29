import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Общий контейнер контента страницы — w-full + горизонтальный паддинг.
 * Ширина больше не капается здесь: ScaleWrapper.tsx оборачивает весь каркас
 * в логический холст 1920px и масштабирует его CSS transform под физический
 * монитор (см. ScaleWrapper.tsx) — дублировать max-w на уровне отдельной
 * страницы не нужно, этот контейнер просто наследует ширину от холста.
 * Не для ВСЕХ экранов — там, где узкая читаемая колонка нужна специально
 * (например текстовые описания), max-w подбирается локально, без этого
 * компонента.
 */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

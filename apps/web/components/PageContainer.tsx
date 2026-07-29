import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Общий контейнер контента страницы — w-full + горизонтальный паддинг.
 * Ширина больше не капается здесь: TeacherShell.tsx/AppShell.tsx оборачивают
 * весь каркас в фиксированные 1920px на viewport>=1920 (по решению
 * пользователя — фиксация пикселей 1:1 с 1920×1080, не адаптивное
 * растягивание), так что дублировать max-w на уровне отдельной страницы
 * больше не нужно — этот контейнер просто наследует ширину от каркаса.
 * Не для ВСЕХ экранов — там, где узкая читаемая колонка нужна специально
 * (например текстовые описания), max-w подбирается локально, без этого
 * компонента.
 */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Общий контейнер контента страницы — max-w-[1600px] (тот же предел, что
 * даёт сам каркас TeacherShell/AppShell выше 1440px) + центрирование +
 * горизонтальный паддинг. Раньше почти каждый экран заново изобретал свой
 * max-w (3xl/5xl/6xl/7xl) — контент не дотягивал до ширины, которую уже
 * разрешает каркас, оставляя пустые поля на 1920+/2560+/3440+ (Адаптив,
 * заход 2). Не для ВСЕХ экранов — там, где узкая читаемая колонка нужна
 * специально (например текстовые описания), max-w подбирается локально,
 * без этого компонента.
 */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

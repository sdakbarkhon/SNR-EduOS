import type { ReactNode } from "react";
import { ScaleWrapper } from "@/components/ScaleWrapper";

// /login не имел ScaleWrapper — на широких мониторах (>1920) страница
// рендерилась 1:1 с логическим 1920-холстом без масштабирования, как на
// /(app) и /teacher до его подключения там. FullscreenLessonProvider не
// нужен: useIsFullscreenLesson() внутри ScaleWrapper падает на false без
// Provider (см. fullscreen-lesson-context.tsx) — на /login fullscreen-урока
// не бывает.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <ScaleWrapper>{children}</ScaleWrapper>;
}

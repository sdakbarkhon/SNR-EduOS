import type { ReactNode } from "react";
import { ScaleWrapper } from "@/components/ScaleWrapper";

// /login имеет собственную адаптивную вёрстку с fixed/absolute элементами
// (LanguageSelector, BottomBar) и min-h-screen — fitHeight=false: ширина
// масштабируется под широкие мониторы, высота обёртки НЕ фиксируется
// (растёт по контенту, обычный скролл при необходимости). См. комментарий
// в ScaleWrapper.tsx — fitHeight=true (дефолт для /(app) и /teacher) здесь
// уже один раз ломал вёрстку (форма съезжала, футер наезжал).
// FullscreenLessonProvider не нужен: useIsFullscreenLesson() внутри
// ScaleWrapper падает на false без Provider — на /login fullscreen-урока
// не бывает.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return <ScaleWrapper fitHeight={false}>{children}</ScaleWrapper>;
}

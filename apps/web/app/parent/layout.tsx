import type { ReactNode } from "react";
import { GlassBackground } from "@/components/parent/glass/GlassBackground";

/**
 * Мобильная рамка для всего /parent/** (вход + защищённые табы) — узкая
 * колонка под телефон, без десктоп/планшет-адаптива (Заход 1, решение
 * согласовано). Оборачивает и публичный /parent (вход), и защищённую
 * группу (app)/**.
 */
export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full">
      <GlassBackground />
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">{children}</div>
    </div>
  );
}

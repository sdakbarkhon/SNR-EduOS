import type { ReactNode } from "react";
import { GlassBackground } from "@/components/parent/glass/GlassBackground";
import { ViewportGate } from "@/components/parent/ViewportGate";

/**
 * Мобильная рамка для всего /parent/** (вход + защищённые табы) — узкая
 * колонка под телефон, без десктоп/планшет-адаптива. На широких экранах
 * (десктоп/ноутбук/планшет, ≥640px) ViewportGate подменяет контент на
 * QR-гейт вместо мобильного интерфейса (Часть A, отдельная задача).
 */
export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full">
      <GlassBackground />
      <ViewportGate>{children}</ViewportGate>
    </div>
  );
}

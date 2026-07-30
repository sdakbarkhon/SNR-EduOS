import type { ReactNode } from "react";
import { Manrope, Unbounded } from "next/font/google";
import { GlassBackground } from "@/components/parent/glass/GlassBackground";
import { ViewportGate } from "@/components/parent/ViewportGate";
import { ParentThemeSync } from "./ParentThemeSync";
// Значения обеих схем (--p-*). Импорт именно здесь, на уровне /parent: CSS
// уедет в <head> только для роутов /parent/**, ученика и учителя не заденет.
import "./parent-theme.css";

/**
 * Блок 7.1 — шрифты макета v2 подключены здесь, на уровне /parent, и
 * НИГДЕ БОЛЬШЕ: макет «SNR EduOS v2 Light.dc.html» держится на Manrope
 * (400–800, основной текст) + Unbounded (500–700, акцидентные заголовки).
 * Локальность важна — остальное приложение (ученик/учитель) на свою
 * типографику не завязано и не должно поехать от этой правки.
 */
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const unbounded = Unbounded({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-unbounded",
  display: "swap",
});

/**
 * Мобильная рамка для всего /parent/** (вход + защищённые табы) — узкая
 * колонка под телефон, без десктоп/планшет-адаптива. На широких экранах
 * (десктоп/ноутбук/планшет, ≥640px) ViewportGate подменяет контент на
 * QR-гейт вместо мобильного интерфейса (Часть A, отдельная задача).
 */
export default function ParentLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${manrope.variable} ${unbounded.variable} relative min-h-dvh w-full`}
      style={{ fontFamily: "var(--font-manrope), 'Segoe UI', sans-serif" }}
    >
      <ParentThemeSync />
      <GlassBackground />
      <ViewportGate>{children}</ViewportGate>
    </div>
  );
}

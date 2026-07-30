/**
 * Блок 7.1 — фон страницы v2 для веба.
 *
 * Перенос 1:1 из apps/mobile-parent/src/theme/AppBackground.tsx (ветка
 * feat/mobile-parent-redesign), который сам перенесён из макета
 * «SNR EduOS v2 Light.dc.html» строки 212–216: линейный градиент bg-page 165°
 * + 4 радиальных блоба radial-gradient(closest-side, цвет, transparent 70%).
 *
 * В мобилке блобы пришлось рисовать через react-native-svg (RN не умеет
 * radial-gradient), здесь возвращаемся к ИСХОДНОЙ форме макета — обычный
 * CSS radial-gradient. Геометрия блобов (размер/смещения) сохранена
 * дословно и рассчитана на кадр 390×844.
 */
import type { ReactNode } from "react";
import { bgPage, blobs } from "./tokens";

export function AppBackground({ children }: { children?: ReactNode }) {
  return (
    <div className="relative isolate min-h-full w-full overflow-hidden" style={{ background: bgPage }}>
      {/* Блобы — строго под контентом, кликов не перехватывают. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {blobs.map((b, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              width: b.size,
              height: b.size,
              top: "top" in b ? b.top : undefined,
              bottom: "bottom" in b ? b.bottom : undefined,
              left: "left" in b ? b.left : undefined,
              right: "right" in b ? b.right : undefined,
              background: `radial-gradient(closest-side, ${b.color}, transparent 70%)`,
            }}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

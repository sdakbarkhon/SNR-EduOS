"use client";

/**
 * Блок 7.1 — плавающий стеклянный таб-бар v2 для веба.
 *
 * Перенос 1:1 из apps/mobile-parent/src/ui/FloatingTabBar.tsx (ветка
 * feat/mobile-parent-redesign) → макет «SNR EduOS v2 Light.dc.html»:
 *   контейнер (строка 4231): left/right 16, bottom 14, padding 7, r28,
 *     градиент 160° W78→W55 + blur(26), border 1px W85, тень shFloat
 *     (0 20 48 rgba(78,66,190,.3)) + inset-блик W95;
 *   пункт (строки 3506–3510): flex 1, колонка, gap 3, padding 8 0;
 *     активный — r21, accent-градиент 135°, тень 0 8 20 rgba(124,58,237,.4),
 *     цвет #fff; неактивный — rgba(26,19,74,.55);
 *   разметка (строки 2648–2652): иконка 20 stroke 1.9, подпись 9.5/800;
 *     бейдж «Сообщений» absolute top 2 right 14, 15px r8.
 *
 * Отличия от мобильной версии (платформенные):
 *   * safe-area снизу — в RN брался useSafeAreaInsets(), здесь
 *     env(safe-area-inset-bottom) в CSS (тот же смысл: поднять бар над
 *     домашним индикатором, но не ниже макетных 14px);
 *   * inset-блик — настоящий inset box-shadow вместо линии-вьюхи;
 *   * иконки — lucide-react вместо @expo/vector-icons.
 * Только светлая тема.
 */

import type { ReactNode } from "react";
import { accentGrad, glassInset, shFloat } from "./tokens";

const BAR_GLASS = "linear-gradient(160deg, rgba(255,255,255,0.78), rgba(255,255,255,0.55))";
const BAR_BORDER = "rgba(255,255,255,0.85)";
const ITEM_INACTIVE = "rgba(26,19,74,0.55)";
const PILL_SHADOW = "0 8px 20px rgba(124,58,237,0.4)";

export interface FloatingTabItem {
  key: string;
  label: string;
  /** Иконка 20px stroke 1.9 — функция от цвета текущего пункта. */
  icon: (color: string) => ReactNode;
  badge?: number;
}

export function FloatingTabBar({
  items,
  activeKey,
  onSelect,
}: {
  items: FloatingTabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center"
      style={{ bottom: "max(env(safe-area-inset-bottom), 14px)" }}
    >
      <div
        className="pointer-events-auto mx-4 w-full"
        style={{ maxWidth: 430 - 32, borderRadius: 28, boxShadow: shFloat }}
      >
        <div
          className="flex items-center overflow-hidden"
          style={{
            borderRadius: 28,
            padding: 7,
            background: BAR_GLASS,
            border: `1px solid ${BAR_BORDER}`,
            backdropFilter: "blur(26px)",
            WebkitBackdropFilter: "blur(26px)",
            boxShadow: glassInset,
          }}
        >
          {items.map((item) => {
            const active = item.key === activeKey;
            const color = active ? "#FFFFFF" : ITEM_INACTIVE;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                className="relative flex flex-1 flex-col items-center py-2 transition-transform active:scale-95"
                style={{
                  gap: 3,
                  borderRadius: active ? 21 : undefined,
                  background: active ? accentGrad : undefined,
                  boxShadow: active ? PILL_SHADOW : undefined,
                }}
              >
                {item.icon(color)}
                <span style={{ fontSize: 9.5, fontWeight: 800, color, lineHeight: 1 }}>
                  {item.label}
                </span>
                {item.badge ? (
                  <span
                    className="absolute flex items-center justify-center font-extrabold text-white"
                    style={{
                      top: 2,
                      right: 14,
                      minWidth: 15,
                      height: 15,
                      borderRadius: 8,
                      background: "#EF4444",
                      fontSize: 9,
                      paddingInline: 3,
                    }}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

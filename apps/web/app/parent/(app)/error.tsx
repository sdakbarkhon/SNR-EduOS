"use client";

/**
 * Корневой error boundary сегмента /parent/(app).
 *
 * Зачем он вообще появился: до него в сегменте не было НИ ОДНОЙ границы выше
 * уровня отдельных маршрутов, поэтому любое исключение в серверном рендере
 * (типичный случай — `.single()` в packages/core бросает на PGRST116 «0 строк»,
 * когда RLS не отдала запись) роняло весь экран в дефолтную страницу Next.js
 * с текстом «An error occurred in the Server Components render».
 *
 * Здесь родитель видит только дружелюбное сообщение и кнопку «Повторить»
 * (reset() перерисовывает сегмент). Сырое `error.message` / digest НЕ
 * показываем: для родителя это шум, а в проде Next всё равно отдаёт
 * обезличенный текст. Реальная ошибка уходит в консоль — это штатный способ
 * диагностики из документации Next.
 *
 * Граница живёт внутри layout.tsx сегмента, поэтому фон v2 и таб-бар
 * (ParentAppShell) остаются на месте — родитель не «выпадает» из приложения.
 */

import { useEffect } from "react";
import { GlassCard } from "./v2/GlassCard";
import { accentGrad, fontDisplay, ink1, ink2 } from "./v2/tokens";

export default function ParentSegmentError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[parent] сбой рендера сегмента:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center" style={{ padding: 18, paddingTop: 80 }}>
      <GlassCard radius={20}>
        <div className="flex flex-col items-center text-center" style={{ padding: 22, gap: 10 }}>
          <span
            className="flex items-center justify-center rounded-full"
            style={{
              width: 46,
              height: 46,
              background: "rgba(124,58,237,0.10)",
              border: "1px solid rgba(124,58,237,0.22)",
            }}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              /* stroke — стилем: var() в SVG-атрибуте браузеры не разрешают. */
              style={{ stroke: ink2 }}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
              <path d="M12 8v5" />
              <path d="M12 16.5h.01" />
            </svg>
          </span>

          <span style={{ fontFamily: fontDisplay, fontSize: 14, fontWeight: 700, color: ink1 }}>
            Не удалось загрузить данные
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, lineHeight: "17px", color: ink2 }}>
            Похоже, соединение со школьной базой прервалось. Попробуйте ещё раз —
            обычно помогает с первого нажатия.
          </span>

          <button
            type="button"
            onClick={reset}
            className="transition-transform active:scale-95"
            style={{
              marginTop: 4,
              paddingBlock: 10,
              paddingInline: 20,
              borderRadius: 12,
              background: accentGrad,
              boxShadow: "0 10px 24px rgba(124,58,237,0.34)",
              fontSize: 12,
              fontWeight: 800,
              color: "#FFFFFF",
            }}
          >
            Повторить
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

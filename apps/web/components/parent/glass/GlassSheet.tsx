"use client";

import type { ReactNode } from "react";
import { glass1Css, glassBorder, radius } from "@/lib/parent/glass-tokens";

/** Bottom-sheet: overlay (клик закрывает) + grip-хендл + контент, glass-поверхность. */
export function GlassSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative z-10 mx-auto w-full max-w-[430px] pb-2 pt-2.5"
        style={{
          ...glass1Css,
          borderTopLeftRadius: radius.card,
          borderTopRightRadius: radius.card,
          border: `1px solid ${glassBorder}`,
          borderBottom: "none",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="mx-auto mb-2 block h-[5px] w-11 rounded-full bg-black/15"
        />
        {children}
      </div>
    </div>
  );
}

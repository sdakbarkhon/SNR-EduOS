"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { glass1Css, glassBorder, radius } from "@/lib/parent/glass-tokens";
import { Z_MODAL, Z_MODAL_PANEL } from "@/app/parent/(app)/v2/ModalPortal";

/** Bottom-sheet: overlay (клик закрывает) + grip-хендл + контент, glass-поверхность.
 *
 *  Портал в document.body + слой выше таб-бара — тот же фикс, что у модалки
 *  выхода на /parent/profile. Здесь это профилактика: сейчас шторку зовут
 *  только экраны входа (AuthHelpSheet/FeaturesSheet/LangButton), где
 *  FloatingTabBar ещё нет, но прежние `fixed inset-0 z-50` в точности
 *  повторяли конфликт — при первом же использовании внутри (app) шторка
 *  ушла бы под навигацию. Шкала z-index — в v2/ModalPortal.tsx. */
export function GlassSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!visible || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: Z_MODAL }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative mx-auto w-full max-w-[430px] pb-2 pt-2.5"
        style={{
          ...glass1Css,
          zIndex: Z_MODAL_PANEL,
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
          className="mx-auto mb-2 block h-[5px] w-11 rounded-full"
          style={{ background: "var(--p-control-off, rgba(23,18,67,0.14))" }}
        />
        {children}
      </div>
    </div>,
    document.body,
  );
}

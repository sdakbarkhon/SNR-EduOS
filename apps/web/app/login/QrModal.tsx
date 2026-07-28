"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getDictionary, type Locale } from "@snr/core";
import { ink1, ink2, glassBorder, glass1Css, radius, shCardCss } from "@/lib/parent/glass-tokens";

/**
 * Модалка поверх /login (адрес в браузере не меняется) — клик по кнопке
 * Google Play/App Store на широком экране открывает эту модалку вместо
 * перехода на /parent. QR кодирует АБСОЛЮТНЫЙ URL /parent на текущем
 * домене (не текущую страницу — на /login это /login, нужен именно
 * /parent). Esc и клик по фону закрывают.
 */
export function QrModal({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const d = getDictionary(locale).parentApp;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(`${window.location.origin}/parent`);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 flex w-full flex-col items-center gap-5 p-8 text-center"
        style={{ ...glass1Css, border: `1px solid ${glassBorder}`, borderRadius: radius.card, boxShadow: shCardCss, maxWidth: 380 }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={d.common.close}
          title={d.common.close}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.5)", border: `1px solid ${glassBorder}` }}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={ink1} strokeWidth={2} strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="rounded-2xl bg-white p-4">
          {url ? <QRCodeSVG value={url} size={200} /> : <div style={{ width: 200, height: 200 }} />}
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: ink1 }}>
            {d.qrGate.title}
          </h2>
          <p className="mt-2 text-sm" style={{ color: ink2 }}>
            {d.qrGate.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

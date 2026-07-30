"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getDictionary, type Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { ink1, ink2, glassBorder, glass1Css, radius, shCardCss } from "@/lib/parent/glass-tokens";

/**
 * Показывается вместо /parent на широких экранах (десктоп/ноутбук/
 * планшет) — QR-код на ТЕКУЩИЙ URL (window.location.href), чтобы
 * сканирование открыло ровно ту же страницу /parent/**, на которой был
 * пользователь. Без кнопок «всё равно открыть» — намеренно (задача).
 */
export function QrGatePage() {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp.qrGate;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-6">
      <div
        className="flex flex-col items-center gap-5 p-8 text-center"
        style={{ ...glass1Css, border: `1px solid ${glassBorder}`, borderRadius: radius.card, boxShadow: shCardCss, maxWidth: 380 }}
      >
        {/* Подложка QR — ЖЁСТКИЙ белый в обеих темах, и намеренно инлайном.
            Раньше здесь был Tailwind-класс `bg-white`, но app/globals.css
            держит голое правило `.dark .bg-white { background:#131a30 }` для
            ученических экранов. С появлением тёмной темы у родителя класс
            `dark` доезжает и до /parent — подложка стала бы тёмной, чёрные
            модули QR слились бы с ней, и код перестал бы сканироваться.
            Инлайн-стиль этот оверрайд перебить не может. Модули (fgColor)
            остаются дефолтно-чёрными: контраст задаёт сама подложка. */}
        <div className="rounded-2xl p-4" style={{ background: "#FFFFFF" }}>
          {url ? <QRCodeSVG value={url} size={200} /> : <div style={{ width: 200, height: 200 }} />}
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: ink1 }}>
            {d.title}
          </h1>
          <p className="mt-2 text-sm" style={{ color: ink2 }}>
            {d.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

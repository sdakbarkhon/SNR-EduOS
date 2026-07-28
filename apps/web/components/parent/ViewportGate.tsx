"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QrGatePage } from "./QrGatePage";

// Мобильный брейкпоинт (~640px, Tailwind sm) — уже ширины показываем
// обычный /parent, шире — QR-гейт вместо интерфейса.
const LARGE_SCREEN_QUERY = "(min-width: 640px)";

/**
 * Клиентский гейт для всего /parent/** — определяет ширину viewport через
 * matchMedia (НЕ user-agent, см. задачу) и на широких экранах подменяет
 * контент на QrGatePage. isLarge стартует с null и на сервере, и на
 * первом клиентском рендере (ширина неизвестна серверу) — оба рендерят
 * ОДИНАКОВУЮ пустую разметку, поэтому hydration mismatch не возникает;
 * реальное значение проставляется в useEffect уже после гидратации.
 */
export function ViewportGate({ children }: { children: ReactNode }) {
  const [isLarge, setIsLarge] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(LARGE_SCREEN_QUERY);
    setIsLarge(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (isLarge === null) {
    return <div className="min-h-dvh w-full" />;
  }

  if (isLarge) {
    return <QrGatePage />;
  }

  return <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">{children}</div>;
}

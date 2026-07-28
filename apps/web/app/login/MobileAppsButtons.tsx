"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { QrModal } from "./QrModal";

/**
 * Бейджи стора — правая часть футера (BottomBar), на месте, где раньше
 * стоял LanguageSelector (он переехал в правый верхний угол страницы, см.
 * page.tsx). Заход 1 (веб-родитель): обе ссылки больше не ведут на Expo
 * Go в сторах — родитель теперь может пройти вход прямо в браузере на
 * /parent (узкая мобильная вёрстка, вход по номеру телефона).
 *
 * Заход «QR в модалке»: на широком экране (≥640px, тот же брейкпоинт, что
 * у QR-гейта ViewportGate) клик по кнопке больше НЕ переходит на /parent
 * (там всё равно показался бы full-page QR-гейт — адрес /login терялся
 * бы без пользы) — вместо перехода открывается модалка с QR прямо поверх
 * /login, адрес не меняется. На узком экране (<640px) — обычный переход
 * на /parent, как раньше.
 *
 * Размер — h-9 (36px) на sm..xl, h-[54px] (×1.5) на xl+ (1280px), НЕ
 * единый размер. footer — общая строка с центрированной copyright-пилюлей
 * (BottomBar.tsx, "© 2026 SNR EduOS..."), абсолютно спозиционированной по
 * центру ВСЕЙ ширины бара — измерено (getBoundingClientRect), при ×1.5
 * ряд бейджей наезжает на пилюлю на всём диапазоне от sm (одна колонка,
 * right-aligned) до ~1216px внутри lg+ (двухколоночная раскладка) —
 * lg (1024px) само по себе НЕ safe-порог, наезд там ещё ~48px. Первая
 * безопасная стандартная точка — xl (1280px): чистый зазор ~32px. До
 * xl бейджи остаются в исходном размере (не увеличены) — не наезжают,
 * т.к. равны текущему прод-состоянию. Полноценное решение (×1.5 на всех
 * ширинах) требует менять позиционирование пилюли в BottomBar.tsx — вне
 * скоупа этой правки (только размер бейджей).
 */
const PARENT_WEB_HREF = "/parent";
const LARGE_SCREEN_QUERY = "(min-width: 640px)";

export function MobileAppsButtons({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth.mobileApps;
  const [isLarge, setIsLarge] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(LARGE_SCREEN_QUERY);
    setIsLarge(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLarge(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Разметка одинакова на сервере и на клиенте (тот же <Link>+<Image> и до,
  // и после гидратации) — только onClick-поведение меняется по isLarge,
  // поэтому hydration mismatch тут не возникает (в отличие от ViewportGate,
  // где сама разметка ветвится).
  function handleClick(e: React.MouseEvent) {
    if (isLarge) {
      e.preventDefault();
      setModalOpen(true);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href={PARENT_WEB_HREF}
        onClick={handleClick}
        title={t.android}
        aria-label={t.android}
        className="shrink-0 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <Image
          src="/google-play-badge.png"
          alt={t.android}
          width={827}
          height={270}
          className="h-9 w-auto xl:h-[54px]"
          priority={false}
        />
      </Link>
      <Link
        href={PARENT_WEB_HREF}
        onClick={handleClick}
        title={t.ios}
        aria-label={t.ios}
        className="shrink-0 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <Image
          src="/app-store-badge.png"
          alt={t.ios}
          width={827}
          height={271}
          className="h-9 w-auto xl:h-[54px]"
          priority={false}
        />
      </Link>

      {modalOpen && <QrModal locale={locale} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

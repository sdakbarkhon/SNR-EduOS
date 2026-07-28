import Image from "next/image";
import Link from "next/link";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";

/**
 * Бейджи стора — правая часть футера (BottomBar), на месте, где раньше
 * стоял LanguageSelector (он переехал в правый верхний угол страницы, см.
 * page.tsx). Заход 1 (веб-родитель): обе ссылки больше не ведут на Expo
 * Go в сторах — родитель теперь может пройти вход прямо в браузере на
 * /parent (узкая мобильная вёрстка, вход по номеру телефона), это и есть
 * целевой сценарий для этих кнопок, пока нет собственных листингов в
 * Google Play / App Store.
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

export function MobileAppsButtons({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth.mobileApps;

  return (
    <div className="flex items-center gap-3">
      <Link
        href={PARENT_WEB_HREF}
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
    </div>
  );
}

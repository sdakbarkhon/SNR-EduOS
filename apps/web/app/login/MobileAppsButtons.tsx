import Image from "next/image";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";

/**
 * Бейджи стора — правая часть футера (BottomBar), на месте, где раньше
 * стоял LanguageSelector (он переехал в правый верхний угол страницы, см.
 * page.tsx). Собственных листингов в сторах ещё нет — родительское
 * приложение сейчас раздаётся через Expo Go (OTA-канал preview, см.
 * apps/mobile-parent/AGENTS.md), поэтому обе ссылки временно ведут на
 * страницы Expo Go в Google Play / App Store; заменить на прямые ссылки
 * на приложение, когда появятся собственные листинги. footer — общая строка с
 * центрированной copyright-пилюлей (BottomBar.tsx), поэтому бейджи всегда
 * компактные (h-9) — на lg+ ширины ровно двух полноразмерных бейджей уже
 * не хватает без наезда на неё, см. коммит, добавивший эту компоновку.
 */
const STORE_LINKS = {
  android: "https://play.google.com/store/apps/details?id=host.exp.exponent",
  ios: "https://apps.apple.com/app/expo-go/id982107779",
} as const;

export function MobileAppsButtons({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth.mobileApps;

  return (
    <div className="flex items-center gap-3">
      <a
        href={STORE_LINKS.android}
        target="_blank"
        rel="noopener noreferrer"
        title={t.android}
        aria-label={t.android}
        className="shrink-0 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <Image
          src="/google-play-badge.png"
          alt={t.android}
          width={827}
          height={270}
          className="h-9 w-auto"
          priority={false}
        />
      </a>
      <a
        href={STORE_LINKS.ios}
        target="_blank"
        rel="noopener noreferrer"
        title={t.ios}
        aria-label={t.ios}
        className="shrink-0 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      >
        <Image
          src="/app-store-badge.png"
          alt={t.ios}
          width={827}
          height={271}
          className="h-9 w-auto"
          priority={false}
        />
      </a>
    </div>
  );
}

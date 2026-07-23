import { Shield } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { MobileAppsButtons } from "./MobileAppsButtons";

/**
 * Mirrors the main content grid's columns (lg:px-16 on the left, p-6/lg:p-12
 * + max-w-md on the right) so the security card lines up under the branding
 * column's left edge ("Учись") and the mobile-app buttons' right edge lines
 * up with the login card's right edge, instead of both just hugging the
 * viewport edges independently. Переключатель языка живёт теперь отдельно,
 * в правом верхнем углу страницы (page.tsx) — здесь на его прежнем месте
 * компактные кнопки установки приложения.
 *
 * Две РАЗНЫЕ раскладки по ширине, а не единая с адаптивными отступами:
 * на узких телефонах (<sm) копирайт-пилюля сама по себе (длинный текст,
 * whitespace-nowrap) занимает почти всю ширину экрана — рядом с кнопками
 * в один ряд её физически не уместить ни при каком выравнивании. Поэтому
 * <sm — простой вертикальный стек в обычном потоке документа (кнопки над
 * копирайтом, высота бара просто складывается). sm+ — прежняя раскладка:
 * грид + абсолютно центрированная на всю ширину бара копирайт-пилюля,
 * там места уже достаточно (проверено на 768 и 1280 — кнопки прижаты к
 * правому краю, до пилюли остаётся зазор).
 */
export function BottomBar({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30">
      <div className="flex flex-col items-end gap-2 px-4 pb-1 sm:hidden">
        <div className="pointer-events-auto">
          <MobileAppsButtons locale={locale} />
        </div>
        <p className="pointer-events-auto whitespace-nowrap rounded-full border border-white/60 bg-white/50 px-4 py-2 text-center text-sm font-medium text-slate-700 backdrop-blur-xl">
          © 2026 SNR EduOS. {t.rightsReserved}
        </p>
      </div>

      <div className="hidden sm:grid sm:grid-cols-1 sm:items-center lg:grid-cols-2">
        <div className="hidden lg:flex lg:px-16">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-white/60 bg-white/50 px-4 py-3 shadow-lg backdrop-blur-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80">
              <Shield className="h-5 w-5 text-blue-500" fill="#dbeafe" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{t.security.title}</p>
              <p className="text-xs text-slate-600">{t.security.subtitle}</p>
            </div>
          </div>
        </div>

        {/* justify-end (не justify-center): на одноколоночной раскладке
            (sm..lg) центрированный max-w-md блок заходил бы в зону
            абсолютно центрированной копирайт-пилюли — прижимаем кнопки к
            реальному правому краю экрана. На lg+ карточка логина уже даёт
            достаточный зазор, там выравнивание "как у карточки". */}
        <div className="flex justify-end p-6 lg:justify-center lg:p-12">
          <div className="pointer-events-auto flex w-full max-w-md justify-end">
            <MobileAppsButtons locale={locale} />
          </div>
        </div>

        {/* Independently centered on the page — not part of either column.
            col-span-2 so its grid area spans the full row: an absolutely
            positioned grid item resolves left/top percentages against its own
            grid area, not the whole container, unless it spans everything. */}
        <p className="pointer-events-auto absolute left-1/2 top-1/2 col-span-2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-white/60 bg-white/50 px-4 py-2 text-center text-sm font-medium text-slate-700 backdrop-blur-xl">
          © 2026 SNR EduOS. {t.rightsReserved}
        </p>
      </div>
    </div>
  );
}

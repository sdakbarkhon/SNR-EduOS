import { Shield } from "lucide-react";
import { getDictionary } from "@snr/core";
import type { Locale } from "@snr/core";
import { MobileAppsButtons } from "./MobileAppsButtons";

/**
 * Нижняя зона экрана входа: карточка «Безопасно», копирайт, кнопки установки
 * приложения. Переключатель языка живёт отдельно, в верхней зоне (page.tsx).
 *
 * 07.08.2026 — бар БОЛЬШЕ НЕ `fixed`. Раньше он висел `fixed inset-x-0
 * bottom-4`, а копирайт внутри — ещё и `absolute left-1/2 top-1/2`. Ни бар,
 * ни копирайт не занимали места в раскладке, поэтому места им никто и не
 * оставлял: на экранах меньшей высоты карточка входа доезжала до нижней
 * кромки и кнопки сторов наезжали на блок «Или войдите через», а копирайт
 * пересекался с «Безопасно» слева и кнопками справа, как только ширины
 * переставало хватать. Теперь бар — обычная `shrink-0` строка нижней зоны
 * (см. page.tsx), а три блока внутри — обычные flex-элементы с
 * `justify-between` и gap между ними, так что наложение невозможно в
 * принципе, а не «подобрано отступами».
 *
 * Две РАЗНЫЕ раскладки по ширине сохранены: на узких телефонах (<sm)
 * копирайт-пилюля сама по себе (длинный текст, whitespace-nowrap) занимает
 * почти всю ширину экрана — рядом с кнопками в один ряд её физически не
 * уместить. Поэтому <sm — вертикальный стек, sm+ — строка из трёх зон.
 * Пустой flex-1 слева на sm..lg держит копирайт по центру строки, пока
 * карточка «Безопасно» ещё скрыта (она появляется с lg).
 */
export function BottomBar({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).auth;

  return (
    <div className="relative z-30 shrink-0 px-4 pb-4 [@media(max-height:760px)]:pb-2 sm:px-6 lg:px-16">
      <div className="flex flex-col items-center gap-2 sm:hidden">
        <MobileAppsButtons locale={locale} />
        <p className="whitespace-nowrap rounded-full border border-white/60 bg-white/50 px-4 py-2 text-center text-sm font-medium text-slate-700 backdrop-blur-xl">
          © 2026 SNR EduOS. {t.rightsReserved}
        </p>
      </div>

      {/* sm+ — три зоны одной строкой через justify-between. Раньше это был
          грид, в котором копирайт лежал `absolute left-1/2 top-1/2`: он не
          занимал места в раскладке и потому пересекался и с карточкой
          «Безопасно» слева, и с кнопками сторов справа, как только ширины
          переставало хватать. Теперь все три блока — обычные flex-элементы,
          между ними всегда есть gap, и наложение невозможно в принципе.
          Пустой <div/> слева на sm..lg держит копирайт по центру строки,
          пока карточка «Безопасно» ещё скрыта. */}
      <div className="hidden items-center justify-between gap-4 sm:flex">
        <div className="flex min-w-0 flex-1 justify-start">
          <div className="hidden items-center gap-3 rounded-2xl border border-white/60 bg-white/50 px-4 py-3 [@media(max-height:760px)]:py-2 shadow-lg backdrop-blur-xl lg:flex">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80">
              <Shield className="h-5 w-5 text-blue-500" fill="#dbeafe" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{t.security.title}</p>
              <p className="text-xs text-slate-600">{t.security.subtitle}</p>
            </div>
          </div>
        </div>

        <p className="shrink-0 whitespace-nowrap rounded-full border border-white/60 bg-white/50 px-4 py-2 text-center text-sm font-medium text-slate-700 backdrop-blur-xl">
          © 2026 SNR EduOS. {t.rightsReserved}
        </p>

        <div className="flex min-w-0 flex-1 justify-end">
          <MobileAppsButtons locale={locale} />
        </div>
      </div>
    </div>
  );
}

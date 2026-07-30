"use client";

/**
 * Экран #34 «Язык и безопасность» — веб-порт
 * apps/mobile-parent/src/screens/profile/LangSecurityScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1295–1332).
 *
 * Что реально работает: выбор языка. Он идёт через тот же LocaleProvider, что
 * и весь остальной веб (`localStorage: snr-locale`), поэтому переключение
 * мгновенно меняет подписи табов и всё, что читает словарь.
 *
 * Чего в веб-версии нет и почему:
 *  • секции «Оформление» (светлая/тёмная/системная) — веб-родитель намеренно
 *    только светлый, тёмных токенов в `v2/tokens.ts` не существует вовсе;
 *  • биометрии — это возможность устройства, у веба её нет;
 *  • «Активных сессий» и «Автовыхода» — управляются single-session-механикой
 *    на бэкенде, экрана управления ими у родителя нет;
 *  • «Удалить аккаунт» — требование Apple к мобильному приложению, а не к
 *    вебу; безопасного серверного пути удаления в проекте нет, и рисовать
 *    кнопку, которая ничего не делает, хуже, чем её не рисовать.
 * Всё перечисленное вынесено в отчёт как «не сделано».
 */

import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "../v2/GlassCard";
import { CardRow, CheckDot, ICON, IconTile, SectionCap } from "../_ui/screen-kit";
import { ink1, ink2, ink3 } from "../v2/tokens";

const LANGUAGES: { value: Locale; autonym: string }[] = [
  { value: "ru", autonym: "Русский" },
  { value: "uz", autonym: "Oʻzbekcha" },
  { value: "en", autonym: "English" },
];

const APP_VERSION = "1.0.0";

export function LangSecurityView() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <SectionCap label="Язык приложения" />
      <GlassCard radius={20} className="px-[14px] py-1">
        {LANGUAGES.map((l, i) => (
          <CardRow key={l.value} divider={i > 0} onClick={() => setLocale(l.value)} paddingY={10}>
            <span className="min-w-0 flex-1">
              <span className="block" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                {l.autonym}
              </span>
              <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                {l.value.toUpperCase()}
              </span>
            </span>
            <CheckDot active={locale === l.value} />
          </CardRow>
        ))}
      </GlassCard>

      <SectionCap label="Безопасность" />
      <GlassCard radius={20} className="px-[14px] py-1">
        <CardRow divider={false} paddingY={10}>
          <IconTile gradient={["#a78bfa", "#7c3aed"]} paths={ICON.lock} size={36} glyphSize={15} />
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
              Пароль
            </span>
            <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
              Меняет администрация школы — обратитесь в поддержку
            </span>
          </span>
        </CardRow>
        <CardRow divider paddingY={10}>
          <IconTile gradient={["#60a5fa", "#2563eb"]} paths={ICON.user} size={36} glyphSize={15} />
          <span className="min-w-0 flex-1">
            <span className="block" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
              Один вход одновременно
            </span>
            <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
              Вход с нового устройства завершает предыдущий сеанс
            </span>
          </span>
        </CardRow>
      </GlassCard>

      <SectionCap label="О приложении" />
      <GlassCard radius={20} className="px-[14px] py-1">
        <div className="flex items-center justify-between" style={{ paddingBlock: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>Версия приложения</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: ink2 }}>{APP_VERSION}</span>
        </div>
      </GlassCard>

      <span style={{ fontSize: 9, fontWeight: 600, lineHeight: "14px", color: ink3, textAlign: "center" }}>
        Выбранный язык сохраняется в этом браузере.
      </span>
    </div>
  );
}

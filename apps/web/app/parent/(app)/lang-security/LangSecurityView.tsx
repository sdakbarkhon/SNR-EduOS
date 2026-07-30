"use client";

/**
 * Экран #34 «Язык и безопасность» — веб-порт
 * apps/mobile-parent/src/screens/profile/LangSecurityScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1295–1332).
 *
 * ЯЗЫК. Словари `/parent` существуют только на русском: `uz` и `en` в вебе
 * не переведены, и реальное переключение на них дало бы наполовину русский
 * экран. Поэтому:
 *  • «Русский» переключает по-настоящему — через тот же LocaleProvider, что и
 *    весь остальной веб (`localStorage: snr-locale`);
 *  • «Oʻzbekcha» и «English» остаются кликабельными (не disabled), помечены
 *    серым бейджем «Скоро», а тап по ним НЕ трогает локаль — вместо этого
 *    показывается плашка «Скоро будет доступно на этом языке».
 * Как только словари появятся, достаточно убрать `soon: true` у строки.
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

import { useEffect, useState } from "react";
import type { Locale } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "../v2/GlassCard";
import { CardRow, CheckDot, Glyph, ICON, IconTile, SectionCap, StatusChip } from "../_ui/screen-kit";
import { chip, ink1, ink2, ink3, radius, status } from "../v2/tokens";

interface LanguageOption {
  value: Locale;
  autonym: string;
  /** true — словарей ещё нет, тап показывает плашку вместо переключения. */
  soon: boolean;
}

const LANGUAGES: LanguageOption[] = [
  { value: "ru", autonym: "Русский", soon: false },
  { value: "uz", autonym: "Oʻzbekcha", soon: true },
  { value: "en", autonym: "English", soon: true },
];

const SOON_TEXT = "Скоро будет доступно на этом языке";
/** Сколько плашка висит после тапа. */
const SOON_MS = 3200;

const APP_VERSION = "1.0.0";

export function LangSecurityView() {
  const { locale, setLocale } = useLocale();
  /**
   * Счётчик тапов по недоступному языку: 0 — плашка скрыта, любое другое
   * значение — показана. Счётчик, а не boolean, потому что повторный тап
   * обязан перезапустить таймер автоскрытия, а `true → true` эффект не будит.
   */
  const [soonTick, setSoonTick] = useState(0);

  useEffect(() => {
    if (soonTick === 0) return;
    const timer = window.setTimeout(() => setSoonTick(0), SOON_MS);
    return () => window.clearTimeout(timer);
  }, [soonTick]);

  function pick(option: LanguageOption) {
    if (option.soon) {
      setSoonTick((n) => n + 1);
      return;
    }
    setSoonTick(0);
    setLocale(option.value);
  }

  const soonChip = chip(status.gray.rgb);
  /**
   * Радиогруппа обязана иметь ровно одну отметку. Недоступные языки её не
   * получают никогда, а если в `snr-locale` лежит `uz`/`en` (могли выставить
   * на другой странице веба), для этого экрана действующим считается `ru` —
   * `/parent` в любом случае рисуется по-русски.
   */
  const effectiveLocale: Locale = LANGUAGES.some((l) => l.value === locale && !l.soon) ? locale : "ru";

  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <SectionCap label="Язык приложения" />
      <GlassCard radius={20} className="px-[14px] py-1">
        {LANGUAGES.map((l, i) => (
          <CardRow key={l.value} divider={i > 0} onClick={() => pick(l)} paddingY={10}>
            <span className="min-w-0 flex-1">
              <span className="flex items-center" style={{ gap: 7 }}>
                <span className="truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                  {l.autonym}
                </span>
                {l.soon ? <StatusChip label="Скоро" family="gray" /> : null}
              </span>
              <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                {l.value.toUpperCase()}
              </span>
            </span>
            <CheckDot active={effectiveLocale === l.value} />
          </CardRow>
        ))}
      </GlassCard>

      <div aria-live="polite">
        {soonTick > 0 ? (
          <div
            className="flex items-center"
            style={{
              gap: 9,
              padding: "10px 12px",
              borderRadius: radius.tile,
              background: soonChip.background,
              border: `1px solid ${soonChip.borderColor}`,
            }}
          >
            <Glyph paths={ICON.info} size={15} color={status.gray.text} strokeWidth={1.9} />
            <span style={{ fontSize: 11, fontWeight: 700, lineHeight: "15px", color: status.gray.text }}>
              {SOON_TEXT}
            </span>
          </div>
        ) : null}
      </div>

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

/**
 * Детали, общие для платёжных экранов мобильного приложения.
 *
 * Ровно те же три штуки, что у веб-родителя (`_demo` + `payments/parts.tsx`):
 * плашка «это пример», строка «пока не работает» и бренд-плитка платёжной
 * системы. Держим в одном месте, чтобы объяснение выглядело одинаково на всех
 * экранах раздела — родитель не должен гадать, где кнопка работает, а где нет.
 *
 * 15.08.2026 (заглушки). Плашки понадобились и вне оплат — питанию, транспорту,
 * медкарте, документам, портфолио, заявлениям. Сами компоненты переехали в
 * `src/ui/notices.tsx`, здесь остаётся перевыдача: платёжные экраны и их
 * импорты не трогаем, второй копии кода не заводим.
 */
import { Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { fonts, gradPoints } from "../../theme";
import type { Gradient } from "../../data";

export { DemoBanner, SoonNote, SoonAction, NoticeBanner } from "../../ui/notices";

/* ── Бренд-плитка платёжной системы ───────────────────────────────────────── */

export function BrandChip({ gradient, label }: { gradient: Gradient; label: string }) {
  return (
    <LinearGradient
      colors={gradient}
      {...gradPoints(135)}
      style={{ width: 40, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 7, letterSpacing: 0.28, color: "#FFFFFF" }}>
        {label}
      </Text>
    </LinearGradient>
  );
}

/** Глиф щита — «платежи защищены». */
export const SHIELD_PATHS = ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"];

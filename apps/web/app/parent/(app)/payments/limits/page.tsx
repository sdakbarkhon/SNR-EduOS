import { WALLET_LIMITS } from "../../_demo/demo-data";
import { LimitsView } from "./LimitsView";

/**
 * «Лимиты расходов» — веб-порт
 * apps/mobile-parent/src/screens/payments/LimitsScreen.tsx.
 *
 * Таблицы лимитов в схеме нет, хранить выбор негде — поэтому экран
 * ПОКАЗЫВАЕТ настройку, но не сохраняет её: переключатели и пресеты меняются
 * на глазах (иначе экран выглядел бы сломанным), а кнопка «Сохранить»
 * честно объясняет, почему сохранения пока не происходит.
 */
export default function ParentLimitsPage() {
  return <LimitsView limits={WALLET_LIMITS} />;
}

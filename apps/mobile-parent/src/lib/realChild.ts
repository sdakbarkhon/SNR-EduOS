import type { ParentChildSummary } from "@snr/core";
import type { ChildRow, Gradient } from "../data/types";

/**
 * Заход 2, шаг 1 — вынесено из LoginChildPickerScreen.tsx (было там локально
 * с Захода 1), чтобы HomeScreen/ChildProfileScreen могли переиспользовать
 * тот же маппинг реального ребёнка в ChildRow, не дублируя палитру и
 * заглушки-презентационных полей ещё в двух местах.
 *
 * Реальных gradient/ring/status в Supabase нет (презентационные поля, не
 * колонки) — крутим по индексу так же, как уже сделано во множестве других
 * мест приложения.
 */
export const REAL_CHILD_PALETTE: [Gradient, string][] = [
  [["#22d3ee", "#3b82f6"], "#0891b2"],
  [["#8b5cf6", "#ec4899"], "#8b5cf6"],
  [["#34d399", "#0ea5e9"], "#059669"],
];

/** Реальная строка из getParentContext() → форма ChildRow, которую уже умеет
 *  рисовать существующая (фикстурная) вёрстка. first_name_gen/is_female/
 *  status_chip — грубые заглушки (грамматика падежей и статус "в школе/дома"
 *  появятся вместе с реальными data-экранами в следующих заходах, не сейчас:
 *  status_chip оставлен пустым намеренно — вызывающая сторона должна не
 *  рендерить статус-чип вовсе, а не показывать пустую пилюлю). */
export function toChildRow(c: ParentChildSummary, index: number): ChildRow {
  const firstName = c.fullName.split(" ")[0] ?? c.fullName;
  const [gradient, ring] = REAL_CHILD_PALETTE[index % REAL_CHILD_PALETTE.length];
  return {
    id: c.id,
    full_name: c.fullName,
    first_name: firstName,
    first_name_gen: firstName,
    is_female: false,
    class_name: c.className ?? "—",
    group_id: c.groupId ?? "",
    status_chip: "",
    avatar_gradient: gradient,
    avatar_ring: ring,
  };
}

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
 *  рисовать существующая (фикстурная) вёрстка.
 *
 *  first_name_gen здесь больше нет: поле обещало родительный падеж, а сюда
 *  клалось имя как есть, и экраны показывали «Кошелёк Sherzod». Фразы
 *  переписаны без падежа, поле удалено из ChildRow целиком.
 *
 *  is_female/status_chip — по-прежнему заглушки: пола в схеме нет, статус
 *  "в школе/дома" не считается. status_chip оставлен пустым намеренно —
 *  вызывающая сторона должна не рендерить чип вовсе, а не показывать пустую
 *  пилюлю. is_female читает только выдуманный текст помощника на ДЕМО-ветке
 *  экрана прогресса (getAssistantTexts) — настоящего родителя он не
 *  касается. */
/**
 * Группы в базе названы «10-А класс» — слово «класс» уже внутри названия.
 * Экраны при этом дописывают его ещё раз («{класс} {слово}»), и подпись
 * читалась как «10-А класс класс». Найдено сквозной сверкой 23.08.2026.
 *
 * Убираем слово из значения, а не из десяти мест сборки подписи: тогда
 * подпись собирается на языке интерфейса («10-А класс» / «10-А sinf» /
 * «10-A class»), а там, где класс показывают без слова, остаётся «10-А».
 */
function stripClassWord(name: string | null | undefined): string {
  const clean = (name ?? "").replace(/s*(класс|sinf|class)s*$/i, "").trim();
  return clean || name || "—";
}

export function toChildRow(c: ParentChildSummary, index: number): ChildRow {
  const firstName = c.fullName.split(" ")[0] ?? c.fullName;
  const [gradient, ring] = REAL_CHILD_PALETTE[index % REAL_CHILD_PALETTE.length];
  return {
    id: c.id,
    full_name: c.fullName,
    first_name: firstName,
    is_female: false,
    class_name: stripClassWord(c.className),
    group_id: c.groupId ?? "",
    status_chip: "",
    avatar_gradient: gradient,
    avatar_ring: ring,
  };
}

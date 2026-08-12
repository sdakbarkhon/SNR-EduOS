import { childSkills, getSelectedChild } from "@/lib/parent-queries";
import { SkillsView } from "./SkillsView";

/**
 * «Навыки и развитие» — веб-порт вкладки «Навыки» мобильного приложения
 * (apps/mobile-parent/src/screens/study/SkillsScreen.tsx).
 *
 * ВАЖНОЕ ОТЛИЧИЕ ОТ МОБИЛКИ: там четыре плитки и радар нарисованы фикстурой
 * (Знания 92, Мышление 88, Творчество 85, Коммуникация 90 — числа из макета).
 * Здесь ни одной выдуманной цифры: уровни считаются из оценок ребёнка,
 * посещаемости и сданных работ, формула написана внизу самого экрана.
 *
 * «Творчество» из макета не переносится: оценивать творчество в проекте
 * нечем — ни одна таблица о нём ничего не знает, и любое число было бы
 * выдумкой. Вместо него — «Дисциплина», у которой источник есть.
 */
export default async function ParentSkillsPage() {
  const [skills, child] = await Promise.all([childSkills(), getSelectedChild()]);
  return <SkillsView data={skills} childName={child?.full_name ?? null} />;
}

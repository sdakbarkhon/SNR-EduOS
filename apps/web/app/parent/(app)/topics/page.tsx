import { childTopicMastery, getSelectedChild } from "@/lib/parent-queries";
import { TopicsView } from "./TopicsView";

/**
 * «Освоение тем» — веб-порт
 * apps/mobile-parent/src/screens/study/TopicMasteryScreen.tsx.
 *
 * ЧТО ЗДЕСЬ СЧИТАЕТСЯ ПРОГРЕССОМ. Тема — это тема проведённого урока
 * (`lessons.topic`), а освоение темы — средний балл ребёнка за уроки этой
 * темы, приведённый к процентам. Ровно так же считает уже существующий
 * `getChildSubjectDetail` для одного предмета; здесь снято ограничение на
 * один предмет, формула та же.
 *
 * ЧЕМ ЭТО НЕ ЯВЛЯЕТСЯ. В базе есть вторая, непохожая величина —
 * `lesson_stage_progress`: отметки о прохождении ЭТАПОВ урока. У выбранного
 * ребёнка их ноль (при 257 этапах в уроках его класса), потому что этапы
 * проходит сам ученик в своём приложении, а этот демо-ученик их не проходил.
 * Строить экран на ней значило бы показать честный ноль там, где у ребёнка на
 * самом деле есть 19 оценок. Подробности — в отчёте.
 */
export default async function ParentTopicsPage() {
  const [topics, child] = await Promise.all([childTopicMastery(), getSelectedChild()]);
  return <TopicsView topics={topics} childName={child?.full_name ?? null} />;
}

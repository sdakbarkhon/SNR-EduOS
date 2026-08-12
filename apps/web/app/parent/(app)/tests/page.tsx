import { childTests, getSelectedChild, parentToday } from "@/lib/parent-queries";
import { TestsView } from "./TestsView";

/**
 * «Тесты» — веб-порт apps/mobile-parent/src/screens/study/TestsScreen.tsx.
 *
 * Данные НАСТОЯЩИЕ: `test_submissions` ребёнка (у Шерзода их 4), заголовок и
 * предмет подтягиваются из связанного `homework`. Мобильный экран рисует то же
 * самое из фикстуры — здесь фикстур нет вовсе.
 *
 * Разбора ответов (мобильный «testReview») нет: в `test_submissions` хранятся
 * только итоги — score/max_score/grade, самих ответов ученика в таблице нет.
 * Рисовать пустой разбор было бы обманом, поэтому строка ведёт никуда.
 *
 * Данные тянутся на сервере, разметка — в клиентском View: строки берутся из
 * словаря (`parentApp.more`), а он доступен только через LocaleProvider.
 */
export default async function ParentTestsPage() {
  const [tests, child, today] = await Promise.all([childTests(), getSelectedChild(), parentToday()]);
  return <TestsView tests={tests} childName={child?.full_name ?? null} today={today} />;
}

import { childDiaryWeek, parentToday, parentWeekMonday } from "@/lib/parent-queries";
import { addDaysKey } from "../_ui/format";
import { DiaryView } from "./DiaryView";

/**
 * «Дневник» — веб-порт apps/mobile-parent/src/screens/study/DiaryScreen.tsx.
 *
 * Отдельной сущности «дневник» в базе нет, и заводить её не надо: это вид
 * поверх готового — уроки класса за неделю плюс оценки ребёнка за эти уроки.
 * Мобильный экран рисует то же самое из двухнедельной фикстуры; здесь неделя
 * настоящая и листается в обе стороны.
 *
 * Неделя приходит параметром `?w=YYYY-MM-DD` (понедельник). Так лист остаётся
 * серверным: каждая неделя — свой запрос, и переход по стрелке не тащит в
 * браузер расписание всех недель сразу.
 *
 * Чего нет по сравнению с макетом: строки «Д/З» под уроком. В базе связь
 * задания с уроком (`homework.lesson_id`) не заполнена ни у одной из 20 работ
 * класса, и приписать задание к уроку можно было бы только на глаз — это
 * ровно та выдумка, от которой уходим. Сданные работы посчитаны в шапке
 * недели, где они честные.
 */
export default async function ParentDiaryPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const monday = await parentWeekMonday();
  // Параметр берём только в виде «YYYY-MM-DD»: всё остальное — текущая неделя.
  const weekStart = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? w : monday;

  const [week, today] = await Promise.all([childDiaryWeek(weekStart), parentToday()]);

  return (
    <DiaryView
      week={week}
      today={today}
      prevHref={`/parent/diary?w=${addDaysKey(weekStart, -7)}`}
      nextHref={`/parent/diary?w=${addDaysKey(weekStart, 7)}`}
    />
  );
}

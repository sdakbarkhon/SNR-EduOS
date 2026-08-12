import { childSubjectTeachers, getSelectedChild } from "@/lib/parent-queries";
import { TeachersView } from "./TeachersView";

/**
 * «Учителя» — веб-порт apps/mobile-parent/src/screens/study/TeachersScreen.tsx.
 *
 * Данные НАСТОЯЩИЕ: предметы группы ребёнка со своими учителями
 * (`getGroupSubjectTeachers`, тот же запрос, что питает блок «Предметы и
 * учителя» в профиле ребёнка). Мобильный экран рисует пятерых из фикстуры —
 * здесь столько, сколько у класса есть на самом деле.
 *
 * Учителя схлопываются по id: один человек нередко ведёт у класса два
 * предмета, и без склейки он попал бы в список дважды.
 *
 * Чего нет: рейтинга, стажа, «онлайн» и кнопки «Написать». Рейтинга и стажа в
 * `teachers` нет вовсе; чат с учителем у родителя ведётся общим экраном
 * «Сообщения», отдельной кнопки отсюда не заводим, чтобы не плодить второй
 * путь в ту же переписку.
 */
export default async function ParentTeachersPage() {
  const [subjects, child] = await Promise.all([childSubjectTeachers(), getSelectedChild()]);

  const byTeacher = new Map<string, { id: string; fullName: string; subjectNames: string[] }>();
  for (const s of subjects) {
    if (!s.teacherId || !s.teacherName) continue;
    const cur = byTeacher.get(s.teacherId);
    if (cur) {
      if (!cur.subjectNames.includes(s.subjectName)) cur.subjectNames.push(s.subjectName);
    } else {
      byTeacher.set(s.teacherId, { id: s.teacherId, fullName: s.teacherName, subjectNames: [s.subjectName] });
    }
  }

  return (
    <TeachersView
      teachers={[...byTeacher.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"))}
      childName={child?.full_name ?? null}
    />
  );
}

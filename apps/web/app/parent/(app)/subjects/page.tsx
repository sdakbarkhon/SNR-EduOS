import { childGradesSummary, childSubjectTeachers, getSelectedChild } from "@/lib/parent-queries";
import { SubjectsView, type SubjectRowVM } from "./SubjectsView";
import { subjectColor, subjectGlyph } from "../_study/util";

/**
 * Экран «Все предметы» — веб-порт apps/mobile-parent/src/screens/study/
 * AllSubjectsScreen.tsx (ветка feat/mobile-parent-redesign).
 *
 * Данные РЕАЛЬНЫЕ и из ДВУХ источников, потому что ни один не полон сам по себе:
 *   childSubjectTeachers() — ВСЕ активные предметы класса ребёнка с учителями
 *     (предмет без единой оценки тоже должен быть виден);
 *   childGradesSummary()   — средний балл и число оценок, но только по тем
 *     предметам, где оценки уже есть.
 * Мержим по subjectId: список берём из первого, цифры — из второго.
 * Оба запроса скоупятся выбранным ребёнком (без studentId RLS вернул бы
 * объединение по всем детям родителя).
 *
 * Ничего не выдумываем: у предмета без оценок показывается «—» и пустая
 * полоса прогресса, а не нарисованный средний балл.
 */
export default async function ParentSubjectsPage() {
  const [child, teachers, summary] = await Promise.all([
    getSelectedChild(),
    childSubjectTeachers(),
    childGradesSummary(),
  ]);

  const gradesById = new Map(summary.subjects.map((s) => [s.subjectId, s]));

  const rows: SubjectRowVM[] = teachers.map((t) => {
    const g = gradesById.get(t.subjectId);
    return {
      subjectId: t.subjectId,
      name: t.subjectName,
      glyph: subjectGlyph(t.subjectName),
      color: subjectColor(t.color ?? g?.color),
      teacherName: t.teacherName,
      average: g ? Number(g.average.toFixed(1)) : null,
      gradeCount: g?.count ?? 0,
    };
  });

  // Предметы, по которым оценки есть, но которых нет в списке класса
  // (напр. предмет деактивировали после выставления оценок) — не теряем.
  for (const s of summary.subjects) {
    if (rows.some((r) => r.subjectId === s.subjectId)) continue;
    rows.push({
      subjectId: s.subjectId,
      name: s.subjectName,
      glyph: subjectGlyph(s.subjectName),
      color: subjectColor(s.color),
      teacherName: null,
      average: Number(s.average.toFixed(1)),
      gradeCount: s.count,
    });
  }

  return (
    <SubjectsView
      childName={child?.full_name ?? "Ребёнок"}
      childClass={child?.className ?? null}
      rows={rows}
      overallAverage={summary.average != null ? Number(summary.average.toFixed(1)) : null}
      strengths={summary.strengths}
      growthAreas={summary.growthAreas}
    />
  );
}

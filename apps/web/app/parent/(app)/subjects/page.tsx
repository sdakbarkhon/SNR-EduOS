import { childSubjectTeachers, getSelectedChild } from "@/lib/parent-queries";
import { safeQuery } from "@/lib/safe-query";
import { GlassCard } from "../v2/GlassCard";
import { Avatar, CardRow, ChevronRight, EmptyState, InnerHeader, RowText, ScreenScroll, SectionCap } from "../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { ICON } from "../_ui/screen-tokens";
import { avatarGradient, givenNameLetter } from "../_ui/format";
import { ink1, ink2 } from "../v2/tokens";

/**
 * Экран «Все предметы» — УПРОЩЁН по прямому требованию заказчика.
 *
 * Было: две выборки (childSubjectTeachers + childGradesSummary), средние баллы,
 * полосы прогресса, блок «Сильные стороны / зоны роста». Стало: голый список
 * предметов ребёнка, одно поле — НАЗВАНИЕ, клик ведёт на /parent/subject/[id].
 *
 * Почему заодно поменялась устойчивость. Обе прежние выборки идут через
 * packages/core, а тот делает `.single()` и бросает на ЛЮБОЙ ошибке — включая
 * PGRST116 «0 строк», который под RLS родителя абсолютно штатен. Исключение из
 * серверного компонента роняло весь рендер. Теперь единственный запрос обёрнут
 * в safeQuery: ошибка логируется (диагностируемо), а экран показывает честное
 * пустое состояние вместо падения.
 */
export default async function ParentSubjectsPage() {
  const child = await getSelectedChild();

  // Единственный запрос экрана. Фолбэк [] + лог внутри safeQuery — падать
  // из-за списка предметов эта страница больше не имеет права.
  const { data: subjectTeachers, failed } = await safeQuery(
    childSubjectTeachers(),
    [],
    "parent/subjects childSubjectTeachers",
  );

  // Дедуп по subjectId: у предмета может быть несколько строк-учителей, а на
  // экране название обязано встретиться ровно один раз.
  const seen = new Set<string>();
  const rows: { id: string; name: string }[] = [];
  for (const st of subjectTeachers) {
    if (seen.has(st.subjectId)) continue;
    seen.add(st.subjectId);
    rows.push({ id: st.subjectId, name: st.subjectName });
  }

  const childName = child?.full_name ?? null;
  const childClass = child?.className ?? null;

  return (
    <>
      <InnerHeader title="Все предметы" backHref="/parent/progress" />

      <ScreenScroll>
        {childName ? (
          <GlassCard radius={20}>
            <div className="flex items-center" style={{ gap: 11, padding: 12 }}>
              <Avatar
                size={38}
                initials={givenNameLetter(childName)}
                gradient={avatarGradient(child?.id ?? childName)}
                fontSize={14}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 800, color: ink1 }}>
                  {childName}
                </span>
                {childClass ? (
                  <span className="block truncate" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                    {childClass}
                  </span>
                ) : null}
              </span>
            </div>
          </GlassCard>
        ) : null}

        <SectionCap label="Предметы" />

        <GlassCard radius={20} className="px-[14px] py-1">
          {rows.length === 0 ? (
            <EmptyState
              title={failed ? "Список пока недоступен" : "Предметы не найдены"}
              text={
                failed
                  ? "Не удалось получить предметы класса. Откройте экран ещё раз чуть позже."
                  : "Как только класс получит расписание, здесь появятся предметы."
              }
              paths={ICON.doc}
            />
          ) : (
            rows.map((row, i) => (
              <CardRow key={row.id} href={`/parent/subject/${row.id}`} divider={i > 0} paddingY={12}>
                <RowText title={row.name} />
                <ChevronRight />
              </CardRow>
            ))
          )}
        </GlassCard>
      </ScreenScroll>
    </>
  );
}

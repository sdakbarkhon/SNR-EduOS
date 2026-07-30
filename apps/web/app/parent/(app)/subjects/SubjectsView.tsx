/**
 * Экран «Все предметы», вёрстка — перенос RN-экрана study/AllSubjectsScreen.tsx
 * (feat/mobile-parent-redesign) → макет «SNR EduOS v2 Light.dc.html»
 * строки 1364–1382:
 *   1365–1369 шапка: back + «Все предметы» + стеклянная кнопка справа;
 *   1370      скролл: gap 12, padding 4/18/118;
 *   1371      компактная карточка ребёнка;
 *   1372      summary-полоса «N предметов» / «Средний балл X ★»;
 *   1373–1379 карточки предметов: плитка 42 r14 + название + учитель +
 *             чип оценки; полоса прогресса в цвете предмета; мета-строка.
 * Плюс блок «Сильные стороны / зоны роста» — он есть в реальных данных
 * (getChildGradesSummary) и на «Успехах» макета (строки 320–325).
 *
 * Серверный компонент: на экране нет ни одного состояния, только ссылки.
 */

import Link from "next/link";
import { InnerHeader, GlassCircle } from "../_study/InnerHeader";
import {
  COL_DIVIDER,
  ChildCard,
  EmptyCard,
  GlassPanel,
  IconChevronRight,
  IconFilter,
  IconStar,
  ProgressBar,
  ScreenBody,
  SectionCaps,
  SubjectSquare,
} from "../_study/parts";
import { chip, ink1, ink2, ink3, status } from "../v2/tokens";
import { hexToRgbCsv } from "../_study/util";

export type SubjectRowVM = {
  subjectId: string;
  name: string;
  glyph: string;
  color: string;
  teacherName: string | null;
  average: number | null;
  gradeCount: number;
};

function SubjectCard({ row }: { row: SubjectRowVM }) {
  const rgb = hexToRgbCsv(row.color);
  // Полоса — доля от максимума 5.0; без оценок полоса пустая, а не выдуманная.
  const pct = row.average != null ? (row.average / 5) * 100 : 0;

  return (
    <GlassPanel radius={20}>
      <Link
        href={`/parent/subject/${row.subjectId}`}
        className="flex flex-col transition-transform active:scale-[0.99]"
        style={{ padding: 14, gap: 9 }}
      >
        <span className="flex items-center" style={{ gap: 11 }}>
          <SubjectSquare color={row.color} glyph={row.glyph} size={42} radius={14} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate" style={{ fontSize: 13, fontWeight: 800, color: ink1 }}>
              {row.name}
            </span>
            <span className="truncate" style={{ fontSize: 9.5, fontWeight: 600, color: ink2 }}>
              {row.teacherName ?? "Учитель не назначен"}
            </span>
          </span>
          <span
            className="flex shrink-0 items-center"
            style={{
              gap: 3,
              paddingBlock: 4,
              paddingInline: 9,
              borderRadius: 8,
              background: `rgba(${rgb},0.13)`,
              border: `1px solid rgba(${rgb},0.33)`,
              fontSize: 11,
              fontWeight: 800,
              color: row.color,
            }}
          >
            {row.average != null ? row.average.toFixed(1) : "—"}
            <IconStar size={10} color={row.color} />
          </span>
          <IconChevronRight size={14} color="rgba(26,19,74,0.4)" strokeWidth={2.2} />
        </span>

        <span className="flex items-center" style={{ gap: 8 }}>
          <span className="flex-1">
            <ProgressBar pct={pct} fill={`linear-gradient(90deg, ${row.color}CC, ${row.color})`} />
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, color: ink3 }}>
            {row.average != null ? `${Math.round(pct)}%` : "—"}
          </span>
        </span>

        <span style={{ fontSize: 9.5, fontWeight: 600, color: ink3 }}>
          {row.gradeCount > 0 ? `${row.gradeCount} оценок за всё время` : "Оценок пока нет"}
        </span>
      </Link>
    </GlassPanel>
  );
}

function ChipList({ items, tone }: { items: string[]; tone: "green" | "orange" }) {
  const st = status[tone];
  const c = chip(st.rgb);
  return (
    <span className="flex flex-wrap" style={{ gap: 6 }}>
      {items.map((label) => (
        <span
          key={label}
          style={{
            paddingBlock: 4,
            paddingInline: 9,
            borderRadius: 999,
            background: c.background,
            border: `1px solid ${c.borderColor}`,
            fontSize: 10,
            fontWeight: 800,
            color: st.text,
          }}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

export function SubjectsView({
  childName,
  childClass,
  rows,
  overallAverage,
  strengths,
  growthAreas,
}: {
  childName: string;
  childClass: string | null;
  rows: SubjectRowVM[];
  overallAverage: number | null;
  strengths: string[];
  growthAreas: string[];
}) {
  return (
    <>
      <InnerHeader
        title="Все предметы"
        backHref="/parent/progress"
        right={
          <GlassCircle label="Домашние задания" href="/parent/homework">
            <IconFilter size={16} color={ink1} strokeWidth={1.8} />
          </GlassCircle>
        }
      />

      <ScreenBody>
        <ChildCard name={childName} className={childClass} />

        {/* Summary-полоса (макет 1372). */}
        <GlassPanel radius={18}>
          <div className="flex items-center justify-between" style={{ paddingBlock: 11, paddingInline: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: ink2 }}>
              {rows.length} предметов
            </span>
            <span className="flex items-center" style={{ gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: ink1 }}>
                Средний балл {overallAverage != null ? overallAverage.toFixed(1) : "—"}
              </span>
              <IconStar />
            </span>
          </div>
        </GlassPanel>

        {rows.length === 0 ? (
          <EmptyCard>У класса пока не заведено ни одного предмета</EmptyCard>
        ) : (
          rows.map((row) => <SubjectCard key={row.subjectId} row={row} />)
        )}

        {/* «Сильные стороны / Зоны роста» — из реального getChildGradesSummary. */}
        {(strengths.length > 0 || growthAreas.length > 0) && (
          <>
            <SectionCaps>Сильные стороны и зоны роста</SectionCaps>
            <GlassPanel radius={20}>
              <div className="flex flex-col" style={{ padding: 14, gap: 10 }}>
                {strengths.length > 0 && (
                  <div className="flex flex-col" style={{ gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: status.green.text }}>
                      Сильные стороны
                    </span>
                    <ChipList items={strengths} tone="green" />
                  </div>
                )}
                {strengths.length > 0 && growthAreas.length > 0 && (
                  <span style={{ height: 1, background: COL_DIVIDER }} aria-hidden />
                )}
                {growthAreas.length > 0 && (
                  <div className="flex flex-col" style={{ gap: 6 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: status.orange.text }}>
                      Зоны роста
                    </span>
                    <ChipList items={growthAreas} tone="orange" />
                  </div>
                )}
              </div>
            </GlassPanel>
          </>
        )}
      </ScreenBody>
    </>
  );
}

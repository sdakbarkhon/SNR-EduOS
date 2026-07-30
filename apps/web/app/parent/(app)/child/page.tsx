import { getParentContext } from "@/lib/parent-context";
import { getSelectedChild } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import { Avatar, EmptyState, Glyph, IconTile, InnerHeader, ScreenScroll, SectionCap, StatusChip } from "../_ui/screen-kit";
// Чистые значения — из screen-tokens, а НЕ из screen-kit: файл серверный,
// а screen-kit помечен "use client" (см. шапку screen-tokens.ts).
import { DIVIDER, ICON, WHITE } from "../_ui/screen-tokens";
import { avatarGradient, givenNameLetter, initialsOf } from "../_ui/format";
// grad135 — строго из tokens, а не из screen-kit: страница серверная, а
// screen-kit помечен "use client", и вызов его функции роняет пререндер.
import { grad135, ink1, ink2, ink3, subjects } from "../v2/tokens";

/**
 * Экран «Профиль ребёнка» — ПЕРЕПИСАН по прямому требованию заказчика на
 * простой экран, который физически не может упасть.
 *
 * Было: childProfile() + childSubjectTeachers(), обе через getStudentById() из
 * packages/core, а он делает `.single()` и бросает на ЛЮБОЙ ошибке — в том
 * числе на PGRST116 «0 строк», который под RLS родителя штатен. Исключение из
 * серверного компонента роняло весь рендер экрана.
 *
 * Стало: источники данных — только getSelectedChild() и getParentContext().
 * Ни один из них не бросает (см. lib/parent-context.ts: все ошибки
 * логируются, наружу идёт null), а второй к тому же уже вызван внутри
 * первого — см. комментарий в теле компонента. Пути к throw у страницы нет.
 *
 * ВСЁ ОСТАЛЬНОЕ НА ЭКРАНЕ — МОКИ (см. константы ниже, каждая помечена).
 * Реальных колонок под нагрузку/достижения/медкарту в БД нет; когда они
 * появятся, менять нужно только эти константы, а не разметку.
 */

/* ── МОК: учебная нагрузка. В БД нет ни часов, ни учебного плана. ────────── */
const WORKLOAD_MOCK: readonly { name: string; hours: number; key: keyof typeof subjects }[] = [
  { name: "Математика", hours: 8, key: "math" },
  { name: "Программирование", hours: 6, key: "prog" },
  { name: "Английский язык", hours: 6, key: "eng" },
  { name: "Робототехника", hours: 6, key: "robo" },
  { name: "Русский язык", hours: 4, key: "rus" },
];

const WORKLOAD_TOTAL_MOCK = WORKLOAD_MOCK.reduce((sum, s) => sum + s.hours, 0);

/* ── МОК: достижения. Таблицы бейджей/наград в БД пока нет. ──────────────── */
const ACHIEVEMENTS_MOCK: readonly {
  title: string;
  subtitle: string;
  gradient: readonly [string, string];
  paths: readonly string[];
}[] = [
  {
    title: "Отличник четверти",
    subtitle: "За стабильно высокие результаты",
    gradient: ["#FACC15", "#CA8A04"],
    paths: ICON.check,
  },
  {
    title: "Без пропусков",
    subtitle: "Полная посещаемость месяца",
    gradient: ["#34D399", "#059669"],
    paths: ICON.checkSquare,
  },
  {
    title: "Победитель олимпиады",
    subtitle: "Математика, школьный этап",
    gradient: ["#A78BFA", "#7C3AED"],
    paths: ICON.shield,
  },
];

/* ── МОК: куратор. Взять его из БД дёшево и безопасно нельзя — единственный
      путь идёт через бросающий getStudentById().

      ФИО дословно как в БД (migration 97_full_reset_new_accounts.sql:
      teachers.full_name = 'Karim Alisher Botirov'). Раньше здесь стояло
      усечённое «Karim Alisher», и один и тот же человек выглядел как два
      разных: в чатах и объявлениях родитель видит полное имя. ────────────── */
const CURATOR_NAME_MOCK = "Karim Alisher Botirov";

/* ── Фолбэки, если контекст не приехал. Порядок слов — как в БД
      («Фамилия Имя», см. initialsOf/givenNameLetter в _ui/format.ts). ────── */
const PARENT_NAME_FALLBACK = "Ismailov Bakhtiyor";
const CHILD_NAME_FALLBACK = "Ismailov Sherzod";
const CHILD_CLASS_FALLBACK = "10-А класс";

export default async function ParentChildPage() {
  const child = await getSelectedChild();
  // ПОЧЕМУ ЭТО НЕ ЛОМАЕТ ГАРАНТИЮ «страница не может упасть».
  // getParentContext() — та же самая cache()-функция, которую getSelectedChild()
  // уже дождался ВНУТРИ себя первой строкой (lib/parent-queries.ts:104). Раз мы
  // дошли сюда, её промис уже успешно зарезолвился, а cache() отдаёт ровно его
  // же — новых сетевых запросов и новых путей к throw не появляется. Сама
  // функция тоже не бросает: все три запроса читают { data, error } и при
  // ошибке отдают null/[] (lib/parent-context.ts).
  // Поэтому — строго ПОСЛЕ await getSelectedChild(), не в Promise.all.
  const ctx = await getParentContext();

  const childName = child?.full_name ?? CHILD_NAME_FALLBACK;
  const classLabel = child?.className ?? CHILD_CLASS_FALLBACK;
  const gradient = avatarGradient(child?.id ?? childName);

  // Имя родителя — из БД, а не из константы: на соседнем /parent/profile
  // (откуда сюда и приходят) оно берётся из того же ctx.parentName.
  const parentName = ctx?.parentName?.trim() || PARENT_NAME_FALLBACK;
  // Сид аватара — тот же, что в profile/page.tsx, чтобы цвет совпадал.
  const parentGradient = avatarGradient(ctx?.parentId ?? parentName);

  return (
    <>
      <InnerHeader title="Профиль ребёнка" backHref="/parent/profile" />

      <ScreenScroll>
        {/* Hero — градиент со звёздочками (макет «SNR EduOS v2 Light», 1174–1179). */}
        <div
          className="relative flex items-center overflow-hidden"
          style={{
            gap: 12,
            padding: 15,
            borderRadius: 22,
            minHeight: 86,
            background: grad135(gradient),
            boxShadow: `0 16px 36px ${gradient[1]}55`,
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0"
            style={{ height: 1.5, background: "rgba(255,255,255,0.35)" }}
          />
          <span aria-hidden className="pointer-events-none absolute" style={{ top: 10, right: 14, opacity: 0.5 }}>
            <Glyph paths={["M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z"]} size={16} fill={WHITE} />
          </span>
          <span aria-hidden className="pointer-events-none absolute" style={{ bottom: 14, right: 44, opacity: 0.35 }}>
            <Glyph paths={["M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z"]} size={10} fill={WHITE} />
          </span>

          <span
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 56,
              height: 56,
              background: "rgba(255,255,255,0.22)",
              border: "2px solid rgba(255,255,255,0.6)",
              fontSize: 19,
              fontWeight: 800,
              color: WHITE,
            }}
          >
            {givenNameLetter(childName)}
          </span>

          <span className="flex min-w-0 flex-1 flex-col" style={{ gap: 3 }}>
            <span className="truncate" style={{ fontSize: 15, fontWeight: 800, color: WHITE }}>
              {childName}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
              {classLabel}
            </span>
            <span
              className="self-start rounded-full"
              style={{
                padding: "3px 8px",
                background: "rgba(255,255,255,0.22)",
                border: "1px solid rgba(255,255,255,0.4)",
                fontSize: 8.5,
                fontWeight: 800,
                color: WHITE,
              }}
            >
              Учится
            </span>
          </span>
        </div>

        {/* Учебная нагрузка (мок). */}
        <SectionCap label="Учебная нагрузка" />
        <GlassCard radius={20} className="px-[14px] py-1">
          {WORKLOAD_MOCK.map((s, i) => (
            <div
              key={s.name}
              className="flex items-center"
              style={{ gap: 11, paddingBlock: 10, borderTop: i > 0 ? `1px solid ${DIVIDER}` : undefined }}
            >
              <Avatar
                size={32}
                initials={s.name.slice(0, 1)}
                gradient={subjects[s.key].grad}
                fontSize={12}
              />
              <span className="min-w-0 flex-1 truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                {s.name}
              </span>
              <span className="shrink-0" style={{ fontSize: 11, fontWeight: 800, color: ink2 }}>
                {s.hours} ч/нед
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between" style={{ paddingBlock: 10, borderTop: `1px solid ${DIVIDER}` }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: ink2 }}>Всего в неделю</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>{WORKLOAD_TOTAL_MOCK} часов</span>
          </div>
        </GlassCard>

        {/* Достижения (мок). */}
        <SectionCap label="Достижения" />
        <GlassCard radius={20} className="px-[14px] py-1">
          {ACHIEVEMENTS_MOCK.map((a, i) => (
            <div
              key={a.title}
              className="flex items-center"
              style={{ gap: 11, paddingBlock: 10, borderTop: i > 0 ? `1px solid ${DIVIDER}` : undefined }}
            >
              <IconTile gradient={a.gradient} paths={a.paths} size={34} glyphSize={15} />
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                  {a.title}
                </span>
                <span className="block truncate" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                  {a.subtitle}
                </span>
              </span>
            </div>
          ))}
        </GlassCard>

        {/* Куратор и родитель (мок). */}
        <SectionCap label="Контакты" />
        <GlassCard radius={20} className="px-[14px] py-1">
          <div className="flex items-center" style={{ gap: 11, paddingBlock: 10 }}>
            <Avatar
              size={34}
              initials={initialsOf(CURATOR_NAME_MOCK)}
              gradient={avatarGradient(CURATOR_NAME_MOCK)}
              fontSize={12}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                {CURATOR_NAME_MOCK}
              </span>
              <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                Классный руководитель
              </span>
            </span>
            <StatusChip label="Куратор" family="violet" fontSize={8.5} />
          </div>

          <div className="flex items-center" style={{ gap: 11, paddingBlock: 10, borderTop: `1px solid ${DIVIDER}` }}>
            <Avatar
              size={34}
              initials={initialsOf(parentName)}
              gradient={parentGradient}
              fontSize={12}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                {parentName}
              </span>
              <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                Родитель
              </span>
            </span>
            <StatusChip label="Вы" family="blue" fontSize={8.5} />
          </div>
        </GlassCard>

        {/* Медицинская информация — раздела в БД нет, честная заглушка. */}
        <SectionCap label="Медицинская информация" />
        <GlassCard radius={20}>
          <EmptyState
            title="Функция появится скоро"
            text="Здесь будут медицинские особенности и аллергии ученика, когда школа начнёт вести эти данные."
            paths={ICON.shield}
          />
        </GlassCard>

        <span style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center" }}>
          Данные ученика ведёт администрация школы
        </span>
      </ScreenScroll>
    </>
  );
}

import Link from "next/link";
import { childProfile, childSubjectTeachers, getSelectedChild } from "@/lib/parent-queries";
import { GlassCard } from "../v2/GlassCard";
import {
  Avatar,
  ChevronRight,
  DIVIDER,
  EmptyState,
  Glyph,
  GlassCircleButton,
  ICON,
  InnerHeader,
  ScreenScroll,
  SectionCap,
  StatusChip,
  grad135,
  WHITE,
} from "../_ui/screen-kit";
import { avatarGradient, formatDateLong, givenNameLetter } from "../_ui/format";
import { ink1, ink2, ink3 } from "../v2/tokens";

/**
 * Экран d29 «Профиль ребёнка» — веб-порт
 * apps/mobile-parent/src/screens/profile/ChildProfileScreen.tsx (макет
 * «SNR EduOS v2 Light.dc.html», строки 1166–1207), на реальных данных
 * `students` (+ куратор и группы через getStudentById).
 *
 * Осталось от макета: hero-карточка с градиентом и звёздочками, ряд табов-
 * ссылок, секции «Общая информация» / «Предметы и учителя».
 *
 * Убрано и почему:
 *  • ChildSwitcherCard «Сменить ›» — переключать не на кого, ребёнок один;
 *  • «ID ученика · {student_code}», «Номер личного дела», «Аллергия»,
 *    «Медицинские особенности» — таких колонок в БД нет, в мобилке это была
 *    фикстура; выдумывать их на реальном экране нельзя;
 *  • контакты школы (телефон/почта/адрес) были захардкожены в макете и
 *    относятся к школе, а не к ребёнку — перенесены в /parent/about.
 * Вместо них добавлена реальная секция «Предметы и учителя»
 * (getGroupSubjectTeachers по группе ребёнка).
 */
export default async function ParentChildPage() {
  const child = await getSelectedChild();

  if (!child) {
    return (
      <div className="mx-auto w-full max-w-[430px]">
        <InnerHeader title="Профиль ребёнка" backHref="/parent/profile" />
        <ScreenScroll>
          <GlassCard>
            <EmptyState
              title="Ребёнок не выбран"
              text="К вашему аккаунту пока не привязан ученик. Обратитесь к администрации школы."
              paths={ICON.user}
            />
          </GlassCard>
        </ScreenScroll>
      </div>
    );
  }

  const [profile, subjectTeachers] = await Promise.all([childProfile(), childSubjectTeachers()]);

  const gradient = avatarGradient(child.id);
  const classLabel = child.className ?? "Класс не указан";
  const curator = profile?.curator ?? null;

  const infoRows: { label: string; value: string }[] = [
    { label: "Класс", value: classLabel },
    ...(profile?.birth_date
      ? [{ label: "Дата рождения", value: formatDateLong(profile.birth_date) }]
      : []),
    { label: "Классный руководитель", value: curator?.full_name ?? "Не назначен" },
    { label: "Школа", value: "SNR International School" },
  ];

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader
        title="Профиль ребёнка"
        backHref="/parent/profile"
        right={
          <GlassCircleButton href="/parent/documents" ariaLabel="Документы">
            <Glyph paths={ICON.doc} size={16} color={ink1} strokeWidth={1.9} />
          </GlassCircleButton>
        }
      />

      <ScreenScroll>
        {/* Hero — градиент со звёздочками (макет 1174–1179). */}
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
            {givenNameLetter(child.full_name)}
          </span>

          <div className="min-w-0 flex-1" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="truncate" style={{ fontSize: 15, fontWeight: 800, color: WHITE }}>
              {child.full_name}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
              {classLabel}
            </span>
            {profile?.status ? (
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
                {profile.status === "active" ? "Учится" : profile.status}
              </span>
            ) : null}
          </div>
        </div>

        {/* Ряд быстрых переходов (в макете — 4 pill-таба). */}
        <div className="flex gap-[7px]">
          <TabLink href="/parent/progress" label="Успехи" />
          <TabLink href="/parent/home" label="День" />
          <TabLink href="/parent/documents" label="Документы" />
        </div>

        {/* Общая информация. */}
        <SectionCap label="Общая информация" />
        <GlassCard radius={20} className="px-[14px] py-1">
          {infoRows.map((r, i) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3"
              style={{ paddingBlock: 9, borderTop: i > 0 ? `1px solid ${DIVIDER}` : undefined }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: ink2 }}>{r.label}</span>
              <span className="shrink text-right" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                {r.value}
              </span>
            </div>
          ))}
        </GlassCard>

        {/* Предметы и учителя — реальные группы ребёнка. */}
        <SectionCap label="Предметы и учителя" />
        <GlassCard radius={20} className="px-[14px] py-1">
          {subjectTeachers.length === 0 ? (
            <EmptyState
              title="Предметы не назначены"
              text="Как только класс получит расписание, здесь появятся предметы и учителя."
              paths={ICON.doc}
            />
          ) : (
            subjectTeachers.map((st, i) => (
              <div
                key={`${st.subjectId}-${st.subjectName}`}
                className="flex items-center gap-[11px]"
                style={{ paddingBlock: 10, borderTop: i > 0 ? `1px solid ${DIVIDER}` : undefined }}
              >
                <Avatar
                  size={34}
                  initials={(st.teacherName ?? st.subjectName).slice(0, 1).toUpperCase()}
                  gradient={avatarGradient(st.subjectId)}
                  fontSize={12}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                    {st.subjectName}
                  </span>
                  <span className="block truncate" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                    {st.teacherName ?? "Учитель не назначен"}
                  </span>
                </span>
              </div>
            ))
          )}
        </GlassCard>

        {curator ? (
          <>
            <SectionCap label="Связь" />
            <GlassCard radius={20} className="px-[14px] py-1">
              <div className="flex items-center gap-[11px]" style={{ paddingBlock: 10 }}>
                <Avatar
                  size={34}
                  initials={curator.full_name.slice(0, 1).toUpperCase()}
                  gradient={avatarGradient(curator.id)}
                  fontSize={12}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 12, fontWeight: 800, color: ink1 }}>
                    {curator.full_name}
                  </span>
                  <span className="block" style={{ fontSize: 9.5, fontWeight: 600, color: ink2, marginTop: 2 }}>
                    Классный руководитель
                  </span>
                </span>
                <StatusChip label="Куратор" family="violet" fontSize={8.5} />
              </div>
            </GlassCard>
          </>
        ) : null}

        <span style={{ fontSize: 9, fontWeight: 600, color: ink3, textAlign: "center" }}>
          Данные ученика ведёт администрация школы
        </span>
      </ScreenScroll>
    </div>
  );
}

/** Пилюля-ссылка ряда быстрых переходов (неактивный стиль SegmentPills). */
function TabLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-1 items-center justify-center rounded-full py-[9px] text-[10.5px]"
      style={{
        background: "linear-gradient(160deg, rgba(255,255,255,0.6), rgba(255,255,255,0.4))",
        border: "1px solid rgba(255,255,255,0.75)",
        color: "rgba(26,19,74,0.66)",
        fontWeight: 700,
      }}
    >
      {label}
      <span className="ml-1 inline-flex">
        <ChevronRight />
      </span>
    </Link>
  );
}

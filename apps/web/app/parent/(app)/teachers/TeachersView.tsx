"use client";

/** Разметка списка учителей. Клиентский компонент ради словаря (см. TestsView). */

import type { Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import { GlassCard } from "../v2/GlassCard";
import {
  Avatar,
  CardRow,
  ChevronRight,
  EmptyState,
  ICON,
  InnerHeader,
  RowText,
  ScreenScroll,
  SectionCap,
} from "../_ui/screen-kit";
import { avatarGradient, initialsOf } from "../_ui/format";

export type TeacherListItem = { id: string; fullName: string; subjectNames: string[] };

export function TeachersView({
  teachers,
  childName,
}: {
  teachers: TeacherListItem[];
  childName: string | null;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more;

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.teachers} backHref="/parent/services" />

      <ScreenScroll>
        {teachers.length === 0 ? (
          <GlassCard radius={22}>
            <EmptyState
              title={m.teachersEmptyTitle}
              text={m.teachersEmptyText.replace("{name}", childName ?? "")}
              paths={ICON.user}
            />
          </GlassCard>
        ) : (
          <>
            <SectionCap label={m.teachersCount.replace("{n}", String(teachers.length))} />

            <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
              {teachers.map((t, idx) => (
                <CardRow key={t.id} href={`/parent/teachers/${t.id}`} divider={idx > 0}>
                  <Avatar size={38} initials={initialsOf(t.fullName)} gradient={avatarGradient(t.fullName)} />
                  <RowText title={t.fullName} subtitle={t.subjectNames.join(" · ")} />
                  <ChevronRight />
                </CardRow>
              ))}
            </GlassCard>
          </>
        )}
      </ScreenScroll>
    </div>
  );
}

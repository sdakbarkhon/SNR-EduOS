"use client";

/** Разметка профиля учителя. Клиентский компонент ради словаря (см. TestsView). */

import type { ChildTeacherReview, Locale } from "@snr/core";
import { getDictionary } from "@snr/core";
import { useLocale } from "@/components/LocaleProvider";
import type { ChildTeacherProfile } from "@/lib/parent-queries";
import { GlassCard } from "../../v2/GlassCard";
import { Avatar, InnerHeader, ScreenScroll, SectionCap } from "../../_ui/screen-kit";
import { DIVIDER } from "../../_ui/screen-tokens";
import { avatarGradient, initialsOf, previousDay, relativeStamp } from "../../_ui/format";
import { ink1, ink2, ink3 } from "../../v2/tokens";

export function TeacherProfileView({
  profile,
  reviews,
  today,
}: {
  profile: ChildTeacherProfile;
  reviews: ChildTeacherReview[];
  today: string;
}) {
  const { locale } = useLocale();
  const d = getDictionary(locale as Locale).parentApp;
  const m = d.more;
  const yesterday = previousDay(today);

  const facts: Array<[string, string]> = [
    [m.teacherSubject, profile.subjectNames.join(" · ") || "—"],
    [m.teacherClasses, profile.groupNames.join(" · ") || "—"],
    [m.teacherLessons, String(profile.lessonCount)],
  ];

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <InnerHeader title={d.scr.teacherProfile} backHref="/parent/teachers" />

      <ScreenScroll>
        <GlassCard radius={22} style={{ padding: 16 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <Avatar
              size={54}
              initials={initialsOf(profile.fullName)}
              gradient={avatarGradient(profile.fullName)}
            />
            <div className="flex min-w-0 flex-1 flex-col" style={{ gap: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: ink1 }}>{profile.fullName}</span>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: ink2 }}>
                {profile.subjectNames.join(" · ") || "—"}
              </span>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            {facts.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline"
                style={{
                  gap: 10,
                  paddingTop: 9,
                  paddingBottom: 9,
                  /* Разделитель и над первой строкой: он отбивает факты от
                     блока с аватаром, а не только строки друг от друга. */
                  borderTop: `1px solid ${DIVIDER}`,
                }}
              >
                <span className="flex-1" style={{ fontSize: 11, fontWeight: 600, color: ink2 }}>
                  {label}
                </span>
                <span
                  className="text-right"
                  style={{ fontSize: 11.5, fontWeight: 800, color: ink1, maxWidth: "62%" }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        <SectionCap label={m.teacherReviewsTitle} />

        <GlassCard radius={22} style={{ paddingLeft: 14, paddingRight: 14 }}>
          {reviews.length === 0 ? (
            <p style={{ fontSize: 11, fontWeight: 600, color: ink2, paddingBlock: 16, textAlign: "center" }}>
              {m.teacherNoReviews}
            </p>
          ) : (
            reviews.map((r, idx) => (
              <div
                key={r.id}
                style={{
                  paddingTop: 13,
                  paddingBottom: 13,
                  borderTop: idx > 0 ? `1px solid ${DIVIDER}` : undefined,
                }}
              >
                <div className="flex items-baseline" style={{ gap: 8 }}>
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: 11.5, fontWeight: 800, color: ink1 }}>
                    {r.subjectName ?? ""}
                  </span>
                  <span className="shrink-0" style={{ fontSize: 10, fontWeight: 700, color: ink3 }}>
                    {relativeStamp(r.gradedAt, today, yesterday)}
                  </span>
                </div>
                <p style={{ fontSize: 11, fontWeight: 600, lineHeight: "17px", color: ink2, marginTop: 4 }}>
                  {r.comment}
                </p>
              </div>
            ))
          )}
        </GlassCard>
      </ScreenScroll>
    </div>
  );
}

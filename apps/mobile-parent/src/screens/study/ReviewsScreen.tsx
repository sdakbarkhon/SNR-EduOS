/**
 * drev «Отзывы учителей» — НАСТОЯЩИЕ ДАННЫЕ.
 *
 * БЫЛО: экран-заглушка «Скоро» с текстом «такой формы обратной связи в школе
 * пока нет». Первая половина фразы была верна — отдельной таблицы отзывов
 * действительно нет, — а вторая половина сама же подсказывала, где отзывы
 * лежат: «настоящие комментарии учителей приходят вместе с оценками».
 *
 * СТАЛО: `getChildTeacherReviews` из @snr/core — тот же запрос, которым живёт
 * блок отзывов в профиле учителя и на вебе. Отзыв — это комментарий учителя к
 * оценке (`lesson_grades.comment`, непустой), вместе с самой оценкой,
 * предметом, датой и именем учителя. У выбранного ребёнка таких 19.
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. Ни рейтингов учителя, ни ответа родителя, ни
 * «прочитано» — под это в базе нет ни колонки. Экран показывает ровно то, что
 * школа действительно записала.
 */
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { formatDate, getChildTeacherReviews, type ChildTeacherReview } from "@snr/core";
import { AppBackground, fonts, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  InnerHeader,
  LoadingBlock,
} from "../../ui";
import { useChildQuery } from "../../hooks/useChildScope";
import { useShowcaseChild } from "../../hooks/useShowcaseChild";
import { getSubject, getTeacherReviews } from "../../data";
import { useAppLocale } from "../../i18n";

/** Цвет предмета из справочника; если его нет — нейтральный акцент. */
function subjectTint(color: string | null, fallback: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

export function ReviewsScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp.reviewsScreen;
  const pa = d.parentApp;
  const sc = d.parentApp.showcase;
  const { showcase, childId, realChildId, child, pickerItems, selectChild, loading: childLoading } =
    useShowcaseChild();
  const [sheetOpen, setSheetOpen] = useState(false);

  const state = useChildQuery<ChildTeacherReview[]>(
    realChildId,
    (db, id) => getChildTeacherReviews(db, id),
  );

  // Витрина: три группы макета (сегодня / на этой неделе / ранее). Порядок
  // и состав — из заготовки, она снята с REVS макета построчно.
  const витрина = getTeacherReviews(locale);
  const группы = [
    { key: "t" as const, title: sc.groupToday },
    { key: "w" as const, title: sc.groupThisWeek },
    { key: "e" as const, title: sc.groupEarlier },
  ]
    .map((g) => ({ ...g, rows: витрина.filter((r) => r.group === g.key) }))
    .filter((g) => g.rows.length > 0);

  const rows = state.data ?? [];

  return (
    <AppBackground>
      <InnerHeader title={t.title} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {child ? (
          <ChildSwitcherCard
            variant="compact"
            avatar={{ initials: child.first_name.slice(0, 1), gradient: child.avatar_gradient, ringColor: child.avatar_ring }}
            name={child.full_name}
            classLabel={`${child.class_name} ${pa.grades.class}`}
            onPress={() => setSheetOpen(true)}
          />
        ) : null}

        {showcase ? null : (
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 16, color: tokens.ink3, paddingHorizontal: 2 }}>
            {t.hint}
          </Text>
        )}

        {showcase ? (
          группы.map((g) => (
            <View key={g.key} style={{ gap: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10.5,
                  letterSpacing: 10.5 * 0.08,
                  color: tokens.ink3,
                  paddingHorizontal: 2,
                }}
              >
                {g.title}
              </Text>
              {g.rows.map((r, i) => {
                const sb = getSubject(r.subject_id);
                const инициалы = r.teacher_name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w.charAt(0).toUpperCase())
                  .join("");
                return (
                  <GlassCard key={`${g.key}-${i}`} radius={18} contentStyle={{ padding: 14, gap: 9 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: sb.color,
                        }}
                      >
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: "#FFFFFF" }}>
                          {инициалы}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                          {r.teacher_name}
                        </Text>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 10, color: sb.text_color }}>
                          {sb.name}
                        </Text>
                      </View>
                      <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
                        {r.time_label}
                      </Text>
                    </View>

                    <Text style={{ fontFamily: fonts.manrope600, fontSize: 12, lineHeight: 18, color: tokens.ink1 }}>
                      {r.text}
                    </Text>

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink3 }}>
                        {`♥ ${r.likes}`}
                      </Text>
                      <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.accent }}>
                        {sc.reply}
                      </Text>
                    </View>
                  </GlassCard>
                );
              })}
            </View>
          ))
        ) : childLoading || state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={pa.more4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : rows.length === 0 ? (
          <EmptyBlock title={t.emptyTitle} text={t.emptyText} />
        ) : (
          rows.map((r) => {
            const tint = subjectTint(r.subjectColor, tokens.accent);
            return (
              <GlassCard key={r.id} radius={18} contentStyle={{ padding: 14, gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: tint }} />
                  <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }} numberOfLines={1}>
                    {r.subjectName ?? t.noSubject}
                  </Text>
                  <View
                    style={{
                      minWidth: 26,
                      paddingHorizontal: 7,
                      paddingVertical: 3,
                      borderRadius: 9,
                      alignItems: "center",
                      backgroundColor: tint,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.unbounded600, fontSize: 12, color: "#FFFFFF" }}>{r.grade}</Text>
                  </View>
                </View>

                <Text style={{ fontFamily: fonts.manrope600, fontSize: 12, lineHeight: 18, color: tokens.ink1 }}>
                  {r.comment}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink2 }} numberOfLines={1}>
                    {r.teacherName ?? t.noTeacher}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3 }}>
                    {formatDate(r.gradedAt, locale)}
                  </Text>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={pa.auth.chooseChild}
          items={pickerItems}
          selectedId={childId ?? undefined}
          onSelect={(id: string) => { selectChild(id); setSheetOpen(false); }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}

export default ReviewsScreen;

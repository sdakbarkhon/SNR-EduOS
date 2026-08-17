/**
 * d11 «Карточка предмета» — НАСТОЯЩИЕ ДАННЫЕ.
 *
 * БЫЛО: экран-заглушка «Скоро» с оговоркой «успеваемость, темы и комментарий
 * учителя здесь выдуманы».
 *
 * СТАЛО: `getChildSubjectDetail` из @snr/core — тот же запрос, что питает
 * карточку предмета у веб-родителя: средний балл и число оценок, освоение тем
 * по проведённым урокам, последняя оценённая работа и последний комментарий
 * учителя. Второй копии не заводим.
 *
 * ПРО ПАРАМЕТР. Маршрут d11 раньше объявлялся без параметров, и открыть
 * карточку было физически нечем — поэтому и стояла заглушка. Теперь он
 * принимает `subjectId`; без параметра экран честно говорит, что предмет не
 * выбран, и отправляет в список предметов, а не показывает случайный.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { formatDate, getChildSubjectDetail, type ChildSubjectDetail } from "@snr/core";
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
  ProgressBar,
} from "../../ui";
import { useChildQuery, useChildScope } from "../../hooks/useChildScope";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, "d11">;

/** Средний балл в проценты — та же шкала, что на «Освоении тем»: 5 = 100%. */
function pctOf(average: number): number {
  return Math.max(0, Math.min(100, Math.round((average / 5) * 100)));
}

export function SubjectDetailScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp.subjectDetailScreen;
  const pa = d.parentApp;
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const subjectId = route.params?.subjectId ?? null;
  const { childId, child, pickerItems, selectChild, loading: childLoading } = useChildScope();
  const [sheetOpen, setSheetOpen] = useState(false);

  const state = useChildQuery<ChildSubjectDetail | null>(
    subjectId ? childId : null,
    (db, id) => getChildSubjectDetail(db, id, subjectId as string),
    [subjectId],
  );
  const s = state.data;

  return (
    <AppBackground>
      <InnerHeader title={s?.subjectName ?? t.title} />
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

        {!subjectId ? (
          <>
            <EmptyBlock title={t.noSubjectTitle} text={t.noSubjectText} />
            <Pressable onPress={() => navigation.navigate("dallsubj")} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <GlassCard radius={16} contentStyle={{ padding: 13, alignItems: "center" }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.accent }}>{t.toSubjects}</Text>
              </GlassCard>
            </Pressable>
          </>
        ) : childLoading || state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={pa.more4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : !s ? (
          <EmptyBlock title={t.notFoundTitle} text={t.notFoundText} />
        ) : (
          <>
            {/* Средний балл и число оценок — прямо из журнала. */}
            <GlassCard radius={18} contentStyle={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <Text style={{ fontFamily: fonts.unbounded600, fontSize: 26, color: tokens.ink1 }}>
                  {s.average != null ? s.average.toFixed(1) : "—"}
                </Text>
                <Text style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3, paddingBottom: 5 }}>
                  {s.gradeCount > 0 ? t.gradeCount.replace("{n}", String(s.gradeCount)) : t.noGrades}
                </Text>
              </View>
              {s.teacherName ? (
                <Pressable
                  onPress={s.teacherId ? () => navigation.navigate("dteach", { teacherId: s.teacherId as string }) : undefined}
                  disabled={!s.teacherId}
                  style={({ pressed }) => ({ opacity: pressed && s.teacherId ? 0.7 : 1 })}
                >
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: s.teacherId ? tokens.accent : tokens.ink2 }}>
                    {s.teacherName}
                  </Text>
                </Pressable>
              ) : null}
            </GlassCard>

            {/* Освоение тем — средний балл по темам проведённых уроков. */}
            {s.topics.length > 0 ? (
              <GlassCard radius={18} contentStyle={{ padding: 14, gap: 10 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>{t.topics}</Text>
                {s.topics.map((tp) => (
                  <View key={tp.topic} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Text style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }} numberOfLines={1}>
                        {tp.topic}
                      </Text>
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}>{pctOf(tp.average)}%</Text>
                    </View>
                    <ProgressBar value={pctOf(tp.average)} />
                  </View>
                ))}
              </GlassCard>
            ) : null}

            {/* Последний комментарий учителя по этому предмету. */}
            {s.lastTeacherComment ? (
              <GlassCard radius={18} contentStyle={{ padding: 14, gap: 6 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>{t.lastComment}</Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 12, lineHeight: 18, color: tokens.ink1 }}>
                  {s.lastTeacherComment.comment}
                </Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
                  {formatDate(s.lastTeacherComment.gradedAt, locale)}
                </Text>
              </GlassCard>
            ) : null}

            {/* Последняя оценённая работа. */}
            {s.lastGradedHomework ? (
              <GlassCard radius={18} contentStyle={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }} numberOfLines={2}>
                    {s.lastGradedHomework.title}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
                    {s.lastGradedHomework.gradedAt ? formatDate(s.lastGradedHomework.gradedAt, locale) : t.lastWork}
                  </Text>
                </View>
                {s.lastGradedHomework.grade != null ? (
                  <Text style={{ fontFamily: fonts.unbounded600, fontSize: 17, color: tokens.accent }}>
                    {s.lastGradedHomework.grade}
                  </Text>
                ) : null}
              </GlassCard>
            ) : null}

            <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 15, color: tokens.ink3, paddingHorizontal: 2 }}>
              {t.footnote}
            </Text>
          </>
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

export default SubjectDetailScreen;

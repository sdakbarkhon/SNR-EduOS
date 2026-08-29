/**
 * dallsubj «Предметы» — НАСТОЯЩИЕ ДАННЫЕ.
 *
 * БЫЛО: экран-заглушка «Скоро» с честной оговоркой «сводка по предметам ещё не
 * собрана из журнала».
 *
 * СТАЛО: `getGroupSubjectTeachers` из @snr/core — тот же запрос, что питает
 * блок «Предметы и учителя» в профиле ребёнка и список учителей класса. Группа
 * ребёнка берётся так же, как в TeacherProfileScreen: `getStudentById` →
 * первая группа из `student_groups`. У выбранного ребёнка 5 предметов.
 *
 * ВИТРИНА (29.08.2026). В показе базы нет, и экран рисуется по макету
 * (строки 1364–1382): шапка «5 предметов · Средний балл 4.6» и карточки с
 * оценкой, изменением за месяц и счётчиком уроков. Настоящая ветка ниже
 * не тронута — она по-прежнему намеренно скупа, и вот почему:
 *
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. Ни среднего балла по предмету, ни процентов, ни
 * «пройдено тем» — эти числа считаются по журналу отдельным расчётом, и он
 * живёт на своих экранах: оценки по предметам — в «Успехах», освоение тем — в
 * «Освоении тем». Дублировать их здесь, да ещё и своим способом подсчёта,
 * значило бы завести второй источник правды. Карточка ведёт к учителю
 * предмета — это настоящая связь из справочника.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { format, getGroupSubjectTeachers, getStudentById, type GroupSubjectTeacher } from "@snr/core";
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
import { getAllSubjects, getSubject } from "../../data";
import { ProgressBar } from "../../ui/charts";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

function tintOf(color: string | null, fallback: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

export function SubjectsScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp.subjectsScreen;
  const pa = d.parentApp;
  const sc = d.parentApp.showcase;
  const navigation = useNavigation<Nav>();
  const { showcase, childId, realChildId, child, pickerItems, selectChild, loading: childLoading } =
    useShowcaseChild();
  const [sheetOpen, setSheetOpen] = useState(false);
  const витрина = getAllSubjects(locale);

  const state = useChildQuery<GroupSubjectTeacher[]>(realChildId, async (db, id) => {
    const profile = await getStudentById(db, id);
    const groupId = profile.student_groups.find((sg) => sg.groups)?.groups?.id ?? null;
    if (!groupId) return [];
    return getGroupSubjectTeachers(db, groupId);
  });

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
          <>
            {/* Шапка макета: сколько предметов и средний балл. Оба числа
                считаются по строкам ниже — см. getAllSubjects. */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                {format(sc.subjectsCount, { n: String(витрина.count) })}
              </Text>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink3 }}>·</Text>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink2 }}>
                {format(sc.avgGrade, { avg: витрина.average_label })}
              </Text>
            </View>
            {витрина.rows.map((r) => {
              const sb = getSubject(r.subject_id);
              return (
                <GlassCard key={r.subject_id} radius={18} contentStyle={{ padding: 14, gap: 9 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: sb.color,
                      }}
                    >
                      <Text style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: "#FFFFFF" }}>
                        {sb.name.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                        {sb.name}
                      </Text>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2 }}>
                        {sb.teacher_name}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
                          {r.grade_label}
                        </Text>
                        <Text style={{ fontSize: 11, color: "#facc15" }}>★</Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: fonts.manrope700,
                          fontSize: 10,
                          color: r.is_up ? tokens.status.green.text : tokens.status.red.text,
                        }}
                      >
                        {r.delta_label}
                      </Text>
                    </View>
                  </View>
                  <ProgressBar pct={r.pct / 100} height={4} fillGradient={sb.gradient} />
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                    {r.meta_label}
                  </Text>
                </GlassCard>
              );
            })}
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
        ) : rows.length === 0 ? (
          <EmptyBlock title={t.emptyTitle} text={t.emptyText} />
        ) : (
          rows.map((s) => {
            const tint = tintOf(s.color, tokens.accent);
            // Нажатие на карточку ведёт в карточку предмета; отдельная
            // подпись справа — к учителю, если он назначен.
            const openSubject = () => navigation.navigate("d11", { subjectId: s.subjectId });
            const openTeacher = s.teacherId
              ? () => navigation.navigate("dteach", { teacherId: s.teacherId as string })
              : undefined;
            return (
              <Pressable
                key={s.subjectId}
                onPress={openSubject}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <GlassCard radius={18} contentStyle={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 13,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tint,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: "#FFFFFF" }}>
                      {s.subjectName.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }} numberOfLines={1}>
                      {s.subjectName}
                    </Text>
                    <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2 }} numberOfLines={1}>
                      {s.teacherName ?? t.noTeacher}
                    </Text>
                  </View>
                  {openTeacher ? (
                    <Pressable onPress={openTeacher} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                      <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.accent }}>{t.openTeacher}</Text>
                    </Pressable>
                  ) : null}
                </GlassCard>
              </Pressable>
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

export default SubjectsScreen;

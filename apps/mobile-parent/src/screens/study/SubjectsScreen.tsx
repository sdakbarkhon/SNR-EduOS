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
import { getGroupSubjectTeachers, getStudentById, type GroupSubjectTeacher } from "@snr/core";
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
import { useChildQuery, useChildScope } from "../../hooks/useChildScope";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

function tintOf(color: string | null, fallback: string): string {
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

export function SubjectsScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp.subjectsScreen;
  const pa = d.parentApp;
  const navigation = useNavigation<Nav>();
  const { childId, child, pickerItems, selectChild, loading: childLoading } = useChildScope();
  const [sheetOpen, setSheetOpen] = useState(false);

  const state = useChildQuery<GroupSubjectTeacher[]>(childId, async (db, id) => {
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

        <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 16, color: tokens.ink3, paddingHorizontal: 2 }}>
          {t.hint}
        </Text>

        {childLoading || state.loading ? (
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

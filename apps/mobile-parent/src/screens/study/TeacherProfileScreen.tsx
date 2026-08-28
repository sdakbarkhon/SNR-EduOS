/**
 * dteach «Профиль учителя» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: один учитель из фикстуры `TEACHER_PROFILE` со стажем, образованием,
 * пилюлей «Онлайн», расписанием «Кабинет 101 · 45 минут» и двумя отзывами,
 * отобранными по совпадению ФИО. Ни стажа, ни образования, ни «онлайн» в
 * базе нет ни в каком виде.
 *
 * СТАЛО: два режима одного экрана.
 *  • без параметра — список учителей класса ребёнка
 *    (`getGroupSubjectTeachers`, тот же запрос, что питает блок «Предметы и
 *    учителя» в профиле ребёнка). Именно сюда ведут все прежние переходы:
 *    они шли на dteach без указания, о ком речь, и показывать наугад одного
 *    учителя было бы выдумкой.
 *  • с `teacherId` — профиль конкретного учителя: `getChildTeacherProfile`
 *    (предметы у класса, классы, число уроков в расписании) и его отзывы об
 *    этом ребёнке из `lesson_grades.comment`. Отбор отзывов идёт по
 *    `graded_by`, а не по совпадению имени.
 *
 * Кнопка «Написать сообщение» убрана: переписка родителя с учителем живёт на
 * общем экране «Сообщения», и второй путь в ту же переписку только
 * запутывал бы. «Позвонить в школу» ушла вместе с ней — номера учителя
 * родителю не показываем.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  format,
  getChildTeacherProfile,
  getChildTeacherReviews,
  getGroupSubjectTeachers,
  getStudentById,
  LOCALE_TAG,
} from "@snr/core";
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
  SectionHeader,
} from "../../ui";
import { useChildQuery, useChildScope } from "../../hooks/useChildScope";
import { fullDate } from "../../lib/dateLabels";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;
type Route = RouteProp<MainStackParamList, "dteach">;

/** «Elena Sokolova» → «ES». */
function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

/** Цвет аватара — детерминированно от имени, чтобы у одного учителя он был
 *  один и тот же на всех экранах. Своего цвета у учителя в базе нет. */
const AVATAR_COLORS: [string, string][] = [
  ["#38BDF8", "#0284C7"],
  ["#2DD4BF", "#0D9488"],
  ["#FACC15", "#CA8A04"],
  ["#F472B6", "#DB2777"],
  ["#A78BFA", "#7C3AED"],
];

function avatarColors(name: string): [string, string] {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum = (sum + name.charCodeAt(i)) % 997;
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function Avatar({ name, size }: { name: string; size: number }) {
  const [, deep] = avatarColors(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: deep,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: size * 0.34, color: "#FFFFFF" }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

function ChevronRight({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export default function TeacherProfileScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const m = t.more;
  const m4 = t.more4;
  const localeTag = LOCALE_TAG[locale];
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const teacherId = route.params?.teacherId ?? null;

  const { childId, child, pickerItems, selectChild, loading: childLoading } = useChildScope();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Режим списка: предметы класса ребёнка со своими учителями, схлопнутые по
  // человеку (один учитель нередко ведёт у класса два предмета).
  const listState = useChildQuery(
    teacherId ? null : childId,
    async (db, id) => {
      const profile = await getStudentById(db, id);
      const groupId = profile.student_groups.find((sg) => sg.groups)?.groups?.id ?? null;
      if (!groupId) return [];
      const subjects = await getGroupSubjectTeachers(db, groupId);
      const byTeacher = new Map<string, { id: string; fullName: string; subjectNames: string[] }>();
      for (const s of subjects) {
        if (!s.teacherId || !s.teacherName) continue;
        const cur = byTeacher.get(s.teacherId);
        if (cur) {
          if (!cur.subjectNames.includes(s.subjectName)) cur.subjectNames.push(s.subjectName);
        } else {
          byTeacher.set(s.teacherId, { id: s.teacherId, fullName: s.teacherName, subjectNames: [s.subjectName] });
        }
      }
      // Порядок задаётся при отрисовке (см. teachers ниже), а не здесь:
      // запрос не перезапускается при смене языка, и порядок застревал бы
      // на том, что был при загрузке.
      return [...byTeacher.values()];
    },
  );

  // Режим профиля: карточка учителя + его отзывы об этом ребёнке.
  const profileState = useChildQuery(
    teacherId ? childId : null,
    async (db, id) => {
      const [profile, reviews] = await Promise.all([
        getChildTeacherProfile(db, id, teacherId as string),
        getChildTeacherReviews(db, id),
      ]);
      return { profile, reviews: reviews.filter((r) => r.teacherId === teacherId) };
    },
    [teacherId],
  );

  const state = teacherId ? profileState : listState;
  // Сортировка по правилам ЯЗЫКА ИНТЕРФЕЙСА. Раньше стояло localeCompare(…,
  // "ru") — на узбекском и английском список шёл чужим алфавитом.
  const teachers = teacherId
    ? []
    : [...(listState.data ?? [])].sort((a, b) => a.fullName.localeCompare(b.fullName, localeTag));
  const profile = teacherId ? profileState.data?.profile ?? null : null;
  const reviews = teacherId ? profileState.data?.reviews ?? [] : [];

  const facts: Array<[string, string]> = profile
    ? [
        [m.teacherSubject, profile.subjectNames.join(" · ") || "—"],
        [m.teacherClasses, profile.groupNames.join(" · ") || "—"],
        [m.teacherLessons, String(profile.lessonCount)],
      ]
    : [];

  return (
    <AppBackground>
      <InnerHeader
        title={teacherId ? t.scr.teacherProfile : m4.teachersTitle}
        titleSize={15}
        onBackPress={() => {
          if (navigation.canGoBack()) navigation.goBack();
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 12 }}
      >
        {child && !teacherId ? (
          <ChildSwitcherCard
            variant="compact"
            avatar={{ initials: child.first_name.slice(0, 1), gradient: child.avatar_gradient, ringColor: child.avatar_ring }}
            name={child.full_name}
            classLabel={`${child.class_name} ${t.grades.class}`}
            onPress={() => setSheetOpen(true)}
          />
        ) : null}

        {childLoading || state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={m4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : teacherId && !profile ? (
          <EmptyBlock title={m.teacherNotFound} />
        ) : teacherId && profile ? (
          <>
            <GlassCard radius={22} contentStyle={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Avatar name={profile.fullName} size={54} />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1 }}>
                    {profile.fullName}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2 }}>
                    {profile.subjectNames.join(" · ") || "—"}
                  </Text>
                </View>
              </View>

              <View style={{ marginTop: 14 }}>
                {facts.map(([label, value]) => (
                  <View
                    key={label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      paddingVertical: 9,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(23,18,67,0.07)",
                    }}
                  >
                    <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink2 }}>{label}</Text>
                    <Text
                      style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1, textAlign: "right", flexShrink: 1, marginLeft: 12 }}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>

            <SectionHeader title={m.teacherReviewsTitle} />

            {reviews.length === 0 ? (
              <EmptyBlock title={m.teacherNoReviews} />
            ) : (
              reviews.map((r) => (
                <GlassCard key={r.id} radius={18} contentStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                      {r.subjectName ?? profile.fullName}
                    </Text>
                    <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>
                      {fullDate(r.gradedAt, localeTag)}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 11 * 1.5, color: tokens.ink2 }}>
                    {r.comment}
                  </Text>
                </GlassCard>
              ))
            )}
          </>
        ) : teachers.length === 0 ? (
          <EmptyBlock
            title={m.teachersEmptyTitle}
            text={format(m.teachersEmptyText, { name: child?.first_name ?? "" })}
          />
        ) : (
          <>
            <SectionHeader title={format(m.teachersCount, { n: String(teachers.length) })} />
            <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, lineHeight: 10.5 * 1.5, color: tokens.ink3, marginTop: -6 }}>
              {m4.teachersPick}
            </Text>
            <GlassCard radius={20} contentStyle={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {teachers.map((row, i) => (
                <Pressable
                  key={row.id}
                  // push, а не navigate: navigate на тот же маршрут только
                  // подменил бы параметры, и «назад» ушло бы мимо списка.
                  onPress={() => navigation.push("dteach", { teacherId: row.id })}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 11,
                    paddingVertical: 11,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: "rgba(23,18,67,0.07)",
                  }}
                >
                  <Avatar name={row.fullName} size={38} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                      {row.fullName}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}>
                      {row.subjectNames.join(" · ")}
                    </Text>
                  </View>
                  <ChevronRight color={tokens.ink3} />
                </Pressable>
              ))}
            </GlassCard>
          </>
        )}
      </ScrollView>

      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={childId ?? undefined}
          onSelect={(id) => {
            selectChild(id);
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}

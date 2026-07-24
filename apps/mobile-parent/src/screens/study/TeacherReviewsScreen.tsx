/**
 * dRev «Отзывы учителей» — Заход 5 (block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 1383–1408).
 *
 * Порядок блоков (сверху вниз, дословно):
 *  1. InnerHeader (46/18/8): back-глиф ← + заголовок Unbounded 15/600
 *     `t.scrTeacherReviews` + правая glass-кнопка 38 с иконкой из 3
 *     горизонтальных линий (M3 6h18 / M7 12h10 / M10 18h4, filter/menu).
 *  2. Child switcher — ChildSwitcherCard variant=compact без status/switchLabel:
 *     glass r18, padding 10/12, аватар 44, ФИО 13.5/800, класс + шеврон-вниз.
 *     onPress → open BottomSheet выбора ребёнка.
 *  3. Горизонтальный ряд чипов revChips (hint 6): «Все» + 5 предметов,
 *     активный (id === filter) — залит цветом предмета, остальные — glass.
 *  4. Section header «СЕГОДНЯ» (revHdrT, 10/800, uppercase, letter-spacing .1em).
 *     Показывается только если после фильтра остались записи group='t'.
 *  5. Список отзывов TODAY (revRowsT): glass-карточка r22,
 *     header-row (Avatar 38 subject-grad + имя 12/800 + subjChip)
 *     + текст 11/600 line-height 1.5
 *     + разделитель + likes (SVG thumbs-up 13) + «Ответить» 10/800 #6d28d9 → goMsgs.
 *  6. Section header «НА ЭТОЙ НЕДЕЛЕ» + список group='w' (тот же шаблон).
 *  7. Section header «РАНЕЕ» + список group='e' (тот же шаблон).
 *
 * Ничего лишнего (опозданий/оценок/расписания/радаров — не тут).
 *
 * Данные — только через аксессоры src/data:
 *   getChildren, getSelectedChildContext, getTeacherReviews, getSubject.
 * Тексты — через useAppLocale().d.parentApp.*.
 * Обе темы — через useTheme(). iOS safe-area — из InnerHeader.
 * Скролл — paddingBottom 118 под FloatingTabBar (см. макет строка 1389).
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, useTheme } from "../../theme";
import {
  Avatar,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  type ChildPickerItem,
} from "../../ui";
import {
  DEFAULT_CHILD_INDEX,
  getChildren,
  getSelectedChildContext,
  getSubject,
  getTeacherReviews,
} from "../../data";
import type { BaseSubjectKey, TeacherReviewRow } from "../../data";
import { useAppLocale } from "../../i18n";
import { useAuthSession } from "../../context/AuthSessionContext";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Инициалы учителя: первые буквы имени и фамилии (макет: «ГЮ», «НА»…). */
function teacherInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}

/** Иконка filter/menu — 3 горизонтальные линии разной длины (строка 1387). */
function FilterLinesIcon({ color }: { color: string }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M3 6h18" />
      <Path d="M7 12h10" />
      <Path d="M10 18h4" />
    </Svg>
  );
}

/** Thumbs-up (палец вверх) 13px stroke 1.9, макет строка 1396. */
function ThumbsUpIcon({ color }: { color: string }) {
  return (
    <Svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M7 10v12" />
      <Path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </Svg>
  );
}

/** Section header uppercase 10/800 letter-spacing .08em (revHdrT/W/E). */
function GroupHeader({ label, color }: { label: string; color: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10,
        letterSpacing: 10 * 0.08,
        textTransform: "uppercase",
        color,
        marginTop: 4,
      }}
    >
      {label}
    </Text>
  );
}

/** Пилл-фильтр: активный — залит цветом предмета, обычный — glass. */
function FilterChip({
  label,
  active,
  activeColor,
  onPress,
}: {
  label: string;
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 7,
        paddingHorizontal: 13,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? activeColor : tokens.glassBorder,
        backgroundColor: active ? activeColor : "rgba(255,255,255,0.55)",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 11,
          color: active ? "#FFFFFF" : tokens.ink1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Карточка одного отзыва (макет строки 1396/1400/1404 — идентичный шаблон). */
function ReviewCard({
  review,
  onReply,
}: {
  review: TeacherReviewRow;
  onReply: () => void;
}) {
  const { tokens } = useTheme();
  const subject = getSubject(review.subject_id);

  return (
    <GlassCard radius={22} contentStyle={{ padding: 14, gap: 10 }}>
      {/* Header-row: avatar + name/subject-chip + time */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <Avatar
          initials={teacherInitials(review.teacher_name)}
          gradient={subject.gradient as [string, string]}
          size={38}
          variant="ring"
        />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 12,
              color: tokens.ink1,
            }}
          >
            {review.teacher_name}
          </Text>
          <View style={{ flexDirection: "row" }}>
            <View
              style={{
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: subject.chip_bg,
                borderWidth: 1,
                borderColor: subject.chip_border,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 9.5,
                  color: subject.text_color,
                }}
              >
                {subject.name}
              </Text>
            </View>
          </View>
        </View>
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 9,
            color: tokens.ink3,
          }}
        >
          {review.time_label}
        </Text>
      </View>

      {/* Body: текст отзыва 11/600 line-height 1.5 */}
      <Text
        style={{
          fontFamily: fonts.manrope600,
          fontSize: 11,
          lineHeight: 11 * 1.5,
          color: tokens.ink2,
        }}
      >
        {review.text}
      </Text>

      {/* Footer: разделитель + likes + «Ответить» */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingTop: 7,
          borderTopWidth: 1,
          borderTopColor: "rgba(23,18,67,0.07)",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <ThumbsUpIcon color={tokens.ink2} />
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 10,
              color: tokens.ink2,
            }}
          >
            {review.likes}
          </Text>
        </View>
        <Pressable onPress={onReply}>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 10,
              color: tokens.status.violet.text,
            }}
          >
            Ответить
          </Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

/** subject filter id: 'all' | BaseSubjectKey */
type FilterId = "all" | BaseSubjectKey;

export default function TeacherReviewsScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const auth = useAuthSession();

  const children = getChildren();
  const initialChildId = auth.currentChildId ?? children[DEFAULT_CHILD_INDEX].id;
  const [childId, setChildId] = useState<string>(initialChildId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

  const reviewsAll = getTeacherReviews();

  // Уникальные предметы, встречающиеся в отзывах — для чипов-фильтров.
  const subjectIds = useMemo<BaseSubjectKey[]>(() => {
    const seen: BaseSubjectKey[] = [];
    for (const r of reviewsAll) {
      if (!seen.includes(r.subject_id)) seen.push(r.subject_id);
    }
    return seen;
  }, [reviewsAll]);

  // Применяем фильтр по предмету (или показываем всё).
  const reviews = useMemo(
    () =>
      filter === "all" ? reviewsAll : reviewsAll.filter((r) => r.subject_id === filter),
    [reviewsAll, filter],
  );

  const today = reviews.filter((r) => r.group === "t");
  const week = reviews.filter((r) => r.group === "w");
  const earlier = reviews.filter((r) => r.group === "e");

  const goMsgs = () => navigation.navigate("d24");

  const pickerItems: ChildPickerItem[] = children.map((k) => ({
    id: k.id,
    initials: k.first_name.slice(0, 1),
    gradient: k.avatar_gradient,
    ringColor: k.avatar_ring,
    name: k.full_name,
    classLabel: `${k.class_name} ${d.parentApp.grades.class}`,
    statusLabel: k.status_chip,
    statusTone: k.status_chip === "В школе" ? "green" : "gray",
  }));

  return (
    <AppBackground>
      {/* 1. Header: back + title + filter/menu (glass 38). */}
      <InnerHeader
        title={d.parentApp.scr.teacherReviews}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => setFilter("all")}>
            <FilterLinesIcon color={tokens.ink1} />
          </GlassCircleButton>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* 2. Child switcher (без статуса/switchLabel — по макету 1390). */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${d.parentApp.grades.class}`}
          onPress={() => setSheetOpen(true)}
        />

        {/* 3. Горизонтальный ряд filter-chips (revChips). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
        >
          <FilterChip
            label="Все"
            active={filter === "all"}
            activeColor={tokens.accent}
            onPress={() => setFilter("all")}
          />
          {subjectIds.map((sid) => {
            const s = getSubject(sid);
            return (
              <FilterChip
                key={sid}
                label={s.name}
                active={filter === sid}
                activeColor={s.color}
                onPress={() => setFilter(sid)}
              />
            );
          })}
        </ScrollView>

        {/* 4–5. СЕГОДНЯ. */}
        {today.length > 0 ? (
          <>
            <GroupHeader label="СЕГОДНЯ" color={tokens.ink3} />
            {today.map((r, i) => (
              <ReviewCard key={`t-${i}`} review={r} onReply={goMsgs} />
            ))}
          </>
        ) : null}

        {/* 6–7. НА ЭТОЙ НЕДЕЛЕ. */}
        {week.length > 0 ? (
          <>
            <GroupHeader label="НА ЭТОЙ НЕДЕЛЕ" color={tokens.ink3} />
            {week.map((r, i) => (
              <ReviewCard key={`w-${i}`} review={r} onReply={goMsgs} />
            ))}
          </>
        ) : null}

        {/* 8–9. РАНЕЕ. */}
        {earlier.length > 0 ? (
          <>
            <GroupHeader label="РАНЕЕ" color={tokens.ink3} />
            {earlier.map((r, i) => (
              <ReviewCard key={`e-${i}`} review={r} onReply={goMsgs} />
            ))}
          </>
        ) : null}
      </ScrollView>

      {/* Sheet выбора ребёнка (openSheet макета 1390). */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={d.parentApp.auth.chooseChild}
          items={pickerItems}
          selectedId={childId}
          onSelect={(id) => {
            setChildId(id);
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}

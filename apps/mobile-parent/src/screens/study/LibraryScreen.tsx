/**
 * dlib «Библиотека» — заход block-by-block из макета
 * «SNR EduOS v2 Light.dc.html» (блок data-screen-label="Библиотека").
 *
 * Block-list (сверху вниз, дословно):
 *  1. HeaderBar — back-glass 38 + title t.svc.library (Unbounded 15/600) +
 *     right search-glass 38 (магнифир r7 + ручка m20 20-3.5-3.5) → da6.
 *  2. ChildSwitcherCard compact row — аватар 44 + ФИО + «{class} класс ⌄» +
 *     «Сменить ›»; клик открывает шторку выбора ребёнка (шаблон 1:1 из
 *     ChildProfileScreen.tsx, Блок 2 + шторка в конце файла).
 *  3. Горизонтальный ряд фильтр-чипов libChips — «Все» + один чип на
 *     каждый уникальный subject_id, встречающийся в LIBRARY; активный —
 *     залит цветом предмета, обычный — glass (шаблон FilterChip 1:1 из
 *     TeacherReviewsScreen.tsx, «тесто-табы»).
 *  4. SectionLabel «НЕДАВНО ОТКРЫТЫЕ» (10.5/800 uppercase tracking .08em,
 *     цвет ink dimmed).
 *  5. Горизонтальный ряд libRecents (3 карточки = LIBRARY.filter(recommended)):
 *     карточка ~130px, glass r16, обложка 60×60 (subject.gradient + book-глиф),
 *     название (10.5/800, line-height ×1.3, numberOfLines 2), pill предмета
 *     ниже (цвета из subject.chip_bg/chip_border/text_color).
 *  6. SectionLabel «ВСЕ МАТЕРИАЛЫ».
 *  7. Grid 2 колонки libRows (LIBRARY, отфильтрованные по выбранному чипу):
 *     карточка glass r16 padding ~10, обложка-плашка (subject.gradient +
 *     book-глиф), название (10.5/800, numberOfLines 2), автор (9/600
 *     dimmed), нижняя строка: meta_label (8.5/700) + pill предмета (small).
 *     Клик по карточке → da2 (просмотр материала).
 *  8. InfoBanner (оранжевая плашка, rgba(249,115,22,.1)/.3, иконка-лампочка,
 *     текст про то, что материалы добавляют учителя по своим предметам).
 *
 * Данные — только getLibrary()/getSubjects() из "../../data" (фикстуры уже
 * готовы, не трогаем). Тексты — d.parentApp.* (t.svc.library, t.grades.class,
 * t.auth.chooseChild); литералы чипов/заголовков секций/банера — дословно из
 * макета (нет соответствующих i18n-ключей — устоявшееся правило проекта).
 * Обе темы — useTheme(). iOS safe-area — через InnerHeader/ChildSwitcherCard.
 * paddingBottom 118 (мокап "padding:4px 18px 118px" → literal 118, совпадает
 * с дефолтом стек-экранов).
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassBlur, glassSurface } from "../../ui/glass";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCircleButton,
  InnerHeader,
  type ChildPickerItem,
} from "../../ui";
import {
  getChildren,
  getLibrary,
  getSelectedChildContext,
  getSubjects,
} from "../../data";
import type { BaseSubjectKey, LibraryBookRow, SubjectRow } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import { ICONS } from "../../navigation/routes";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** ID фильтра: 'all' | конкретный предмет. */
type FilterId = "all" | BaseSubjectKey;

/** Иконка поиска (лупа) — правый слот шапки (макет: r7 + ручка m20 20-3.5-3.5). */
function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      {ICONS.search.map((p, i) => (
        <Path key={i} d={p} />
      ))}
    </Svg>
  );
}

/** Книжный глиф (обложка) — белый stroke-контур, из ICONS.book. */
function BookGlyph({ size, strokeWidth = 1.9 }: { size: number; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {ICONS.book.map((p, i) => (
        <Path key={i} d={p} />
      ))}
    </Svg>
  );
}

/** Иконка-лампочка (идея/подсказка) — InfoBanner, макет: 17px stroke #c2410c 1.9. */
function BulbIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 14c.2-1 .7-1.7 1.5-2.5A5.5 5.5 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <Path d="M9 18h6" />
      <Path d="M10 22h4" />
    </Svg>
  );
}

/**
 * FilterChip — пилл-фильтр (Блок 3), шаблон 1:1 из TeacherReviewsScreen.tsx:
 * активный — залит цветом предмета/акцентом, обычный — glass.
 */
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
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: active ? "#FFFFFF" : tokens.ink1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Uppercase-заголовок секции 10.5/800 tracking .08em (Блок 4, 6). */
function SectionCap({ children }: { children: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        textTransform: "uppercase",
        color: tokens.ink3,
      }}
    >
      {children}
    </Text>
  );
}

/** Pill предмета — цвета напрямую из SubjectRow.chip_bg/chip_border/text_color. */
function SubjectPill({ subject, small }: { subject: SubjectRow; small?: boolean }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: small ? 3 : 4,
        paddingHorizontal: small ? 7 : 9,
        borderRadius: 999,
        backgroundColor: subject.chip_bg,
        borderWidth: 1,
        borderColor: subject.chip_border,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.manrope800, fontSize: small ? 8.5 : 9.5, color: subject.text_color }}
      >
        {subject.name}
      </Text>
    </View>
  );
}

/** Обёртка-стекло карточки (glass1 r16) — общая для карточек recents/grid. */
function LibCardSurface({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: object;
}) {
  const { tokens, scheme } = useTheme();
  const surface = glassSurface({ ...tokens.glass1, blur: 20 }, scheme);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        shadowStyle(scheme === "dark" ? tokens.shCard : { x: 0, y: 10, blur: 22, color: "rgba(99,86,214,0.12)" }),
        { borderRadius: 16 },
        style,
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <View
        style={{
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
          padding: 10,
          gap: 6,
        }}
      >
        {surface.mode === "blur" ? (
          <>
            <GlassBlur intensity={surface.intensity} tint={surface.tint} style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={surface.colors as [string, string, ...string[]]}
              locations={surface.locations as [number, number, ...number[]] | undefined}
              {...gradPoints(surface.angle)}
              style={StyleSheet.absoluteFill}
            />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: surface.color }]} />
        )}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: tokens.glassInset.y,
            backgroundColor: tokens.glassInset.color,
          }}
        />
        {children}
      </View>
    </Pressable>
  );
}

/** Обложка-плашка: subject.gradient (135°) + book-глиф по центру. */
function CoverPlaque({ subject, size }: { subject: SubjectRow; size: number }) {
  const shadowRgbFromHex = (hex: string) => {
    const m = hex.replace("#", "");
    const r = parseInt(m.slice(0, 2), 16);
    const g = parseInt(m.slice(2, 4), 16);
    const b = parseInt(m.slice(4, 6), 16);
    return `${r},${g},${b}`;
  };
  return (
    <LinearGradient
      colors={subject.gradient}
      {...gradPoints(135)}
      style={[
        {
          width: size,
          height: size,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          alignSelf: size <= 60 ? "flex-start" : "stretch",
        },
        shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${shadowRgbFromHex(subject.color)},0.3)` }),
      ]}
    >
      <BookGlyph size={size <= 60 ? 24 : 26} />
    </LinearGradient>
  );
}

/** Карточка «недавно открытого» (Блок 5) — ширина ~130, глиф 60×60. */
function RecentCard({ book, subject, onPress }: { book: LibraryBookRow; subject: SubjectRow; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <LibCardSurface onPress={onPress} style={{ width: 130 }}>
      <CoverPlaque subject={subject} size={60} />
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.manrope800, fontSize: 10.5, lineHeight: 10.5 * 1.3, color: tokens.ink1 }}
      >
        {book.name}
      </Text>
      <SubjectPill subject={subject} />
    </LibCardSurface>
  );
}

/** Карточка «всех материалов» (Блок 7) — 2-колоночный grid. */
function LibraryGridCard({ book, subject, onPress }: { book: LibraryBookRow; subject: SubjectRow; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <LibCardSurface onPress={onPress}>
      <CoverPlaque subject={subject} size={72} />
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.manrope800, fontSize: 10.5, lineHeight: 10.5 * 1.3, color: tokens.ink1 }}
      >
        {book.name}
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9, color: tokens.ink3 }}>
        {book.author}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.manrope700, fontSize: 8.5, color: tokens.ink3 }}>
          {book.meta_label}
        </Text>
        <SubjectPill subject={subject} small />
      </View>
    </LibCardSurface>
  );
}

export default function LibraryScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const auth = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(() => auth.currentChildId ?? children[0].id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<FilterId>("all");

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

  const subjects = getSubjects();
  const library = getLibrary();

  // Блок 3: уникальные предметы, встречающиеся в библиотеке — для чипов.
  const subjectIds = useMemo<BaseSubjectKey[]>(() => {
    const seen: BaseSubjectKey[] = [];
    for (const b of library) {
      if (!seen.includes(b.subject_id)) seen.push(b.subject_id);
    }
    return seen;
  }, [library]);

  // Блок 5: 3 рекомендованных материала.
  const recents = useMemo(() => library.filter((b) => b.recommended), [library]);

  // Блок 7: всё либо отфильтрованное по выбранному предмету.
  const rows = useMemo(
    () => (filter === "all" ? library : library.filter((b) => b.subject_id === filter)),
    [library, filter],
  );

  const bannerText = scheme === "light" ? "rgba(26,19,74,0.7)" : "rgba(255,255,255,0.75)";

  const pickerItems: ChildPickerItem[] = children.map((k) => ({
    id: k.id,
    initials: k.first_name.slice(0, 1),
    gradient: k.avatar_gradient,
    ringColor: k.avatar_ring,
    name: k.full_name,
    classLabel: `${k.class_name} ${t.grades.class}`,
    statusLabel: k.status_chip,
    statusTone: k.status_chip === "В школе" ? "green" : "gray",
  }));

  const goMaterial = () => navigation.navigate("da2");
  const goSearch = () => navigation.navigate("da6");

  return (
    <AppBackground>
      {/* Блок 1: HeaderBar. */}
      <InnerHeader
        title={t.svc.library}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={goSearch}>
            <SearchIcon color={tokens.ink1} />
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
        {/* Блок 2: ChildSwitcherCard compact. */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${t.grades.class}`}
          switchLabel="Сменить ›"
          onPress={() => setSheetOpen(true)}
        />

        {/* Блок 3: горизонтальный ряд фильтр-чипов libChips. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
        >
          <FilterChip label="Все" active={filter === "all"} activeColor={tokens.accent} onPress={() => setFilter("all")} />
          {subjectIds.map((sid) => {
            const s = subjects[sid];
            return (
              <FilterChip key={sid} label={s.name} active={filter === sid} activeColor={s.color} onPress={() => setFilter(sid)} />
            );
          })}
        </ScrollView>

        {/* Блок 4: SectionLabel «НЕДАВНО ОТКРЫТЫЕ». */}
        <SectionCap>НЕДАВНО ОТКРЫТЫЕ</SectionCap>

        {/* Блок 5: горизонтальный ряд libRecents. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 9, paddingBottom: 3 }}
        >
          {recents.map((b, i) => (
            <RecentCard key={`rec-${i}`} book={b} subject={subjects[b.subject_id]} onPress={goMaterial} />
          ))}
        </ScrollView>

        {/* Блок 6: SectionLabel «ВСЕ МАТЕРИАЛЫ». */}
        <SectionCap>ВСЕ МАТЕРИАЛЫ</SectionCap>

        {/* Блок 7: grid 2 колонки libRows. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5, rowGap: 9 }}>
          {rows.map((b, i) => (
            <View key={`row-${i}`} style={{ width: "50%", paddingHorizontal: 4.5 }}>
              <LibraryGridCard book={b} subject={subjects[b.subject_id]} onPress={goMaterial} />
            </View>
          ))}
        </View>

        {/* Блок 8: InfoBanner. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: "rgba(249,115,22,0.1)",
            borderWidth: 1,
            borderColor: "rgba(249,115,22,0.3)",
          }}
        >
          <BulbIcon color="#C2410C" size={17} />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: bannerText,
            }}
          >
            Материалы добавляют учителя по своим предметам. Любой файл можно открыть в приложении или скачать на устройство.
          </Text>
        </View>
      </ScrollView>

      {/* Шторка выбора ребёнка. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
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

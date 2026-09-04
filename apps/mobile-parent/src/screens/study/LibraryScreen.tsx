/**
 * dlib «Библиотека» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: массив `LIBRARY` из фикстуры, чипы предметов из фикстурной палитры,
 * секция «Недавно открытые» по выдуманному флагу `recommended`, тап по
 * карточке вёл на экран-заглушку «Просмотр материала».
 *
 * СТАЛО: `getLibraryBooks` из @snr/core — таблица `books` плюс отметки
 * `book_favorites` выбранного ребёнка, тот же запрос, что питает
 * «Библиотеку» на вебе. Тап по книге открывает файл: подписанная ссылка
 * берётся тем же `getBookSignedUrl`, которым книгу открывают ученик и
 * учитель, и отдаётся системе через `Linking` (новых зависимостей не
 * появляется — Linking входит в React Native).
 *
 * ЧТО ЗАМЕНИЛОСЬ ЧЕСТНЫМ:
 *  • «Недавно открытые» → «В избранном у ребёнка». Истории открытий в базе
 *    нет ни у кого; избранное — есть и принадлежит именно этому ребёнку.
 *    Секция скрывается, когда избранного нет.
 *  • чипы предметов строятся по колонке `books.subject` — по тем предметам,
 *    которые в библиотеке реально встречаются.
 *  • «файл не приложен» — не украшение: у книги может не быть ни файла, ни
 *    внешней ссылки, и тогда открывать нечего.
 */
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { format, getBookSignedUrl, getLibraryBooks, resolveSubject, type LibraryBookItem } from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassBlur, glassSurface } from "../../ui/glass";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  EmptyBlock,
  GlassCard,
  ErrorBlock,
  GlassCircleButton,
  InnerHeader,
  LoadingBlock,
} from "../../ui";
import { useChildQuery } from "../../hooks/useChildScope";
import { useShowcaseChild } from "../../hooks/useShowcaseChild";
import { getLibrary, getSubject } from "../../data";
import type { BaseSubjectKey } from "../../data";
import { getSupabase } from "../../lib/supabase";
import { hexToRgbCsv } from "../../lib/dateLabels";
import { useAppLocale } from "../../i18n";
import { ICONS } from "../../navigation/routes";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/**
 * Цвет обложки по предмету книги.
 *
 * `books.subject` — свободная строка («programming», «math»…), своей палитры
 * у книги в базе нет. Цвет берём детерминированно от самой строки, чтобы у
 * одного предмета обложки всегда совпадали, а новый предмет не остался без
 * цвета. Список — та же палитра предметов, что и в остальном приложении.
 */
const COVER_COLORS: [string, string][] = [
  ["#38BDF8", "#0284C7"],
  ["#2DD4BF", "#0D9488"],
  ["#FACC15", "#CA8A04"],
  ["#F472B6", "#DB2777"],
  ["#E879F9", "#A21CAF"],
  ["#A78BFA", "#7C3AED"],
];

function coverGradient(subject: string): [string, string] {
  let sum = 0;
  for (let i = 0; i < subject.length; i += 1) sum = (sum + subject.charCodeAt(i)) % 997;
  return COVER_COLORS[sum % COVER_COLORS.length];
}

/**
 * ВИД КНИГИ — ИЗ СПРАВОЧНИКА ШКОЛЫ. 06.09.2026.
 *
 * `books.subject` — устаревшая строка, и в ней лежит СЛАГ: родитель видел на
 * чипе «programming», а не «Программирование». С миграции 254 у книги есть
 * ссылка на справочник, и подпись с цветом берутся оттуда — тем же
 * резолвером, что и в вебе.
 *
 * Пары в справочнике нет — остаётся прежний вид: подпись строкой и цвет,
 * посчитанный от неё. Это ровно то, что было до сегодняшнего дня.
 */
function darken(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `#${[16, 8, 0]
    .map((сдвиг) => Math.round(((n >> сдвиг) & 0xff) * 0.62))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function bookLook(book: LibraryBookItem): { label: string; colors: [string, string] } {
  const s = resolveSubject({ catalog: book.catalog, slug: book.subject });
  return {
    label: s.label,
    colors: s.source === "catalog" ? [s.color, darken(s.color)] : coverGradient(book.subject),
  };
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      {ICONS.search.map((p, i) => (
        <Path key={i} d={p} />
      ))}
    </Svg>
  );
}

function BookGlyph({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {ICONS.book.map((p, i) => (
        <Path key={i} d={p} />
      ))}
    </Svg>
  );
}

function BulbIcon({ color, size }: { color: string; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 14c.2-1 .7-1.7 1.5-2.5A5.5 5.5 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <Path d="M9 18h6" />
      <Path d="M10 22h4" />
    </Svg>
  );
}

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

function SubjectPill({ label, colors, small }: { label: string; colors: [string, string]; small?: boolean }) {
  const deep = colors[1];
  const rgb = hexToRgbCsv(deep);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: small ? 3 : 4,
        paddingHorizontal: small ? 7 : 9,
        borderRadius: 999,
        backgroundColor: `rgba(${rgb},0.12)`,
        borderWidth: 1,
        borderColor: `rgba(${rgb},0.3)`,
      }}
    >
      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: small ? 8.5 : 9.5, color: deep }}>
        {label}
      </Text>
    </View>
  );
}

/** Стеклянная обёртка карточки — общая для «избранного» и общей сетки. */
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

function CoverPlaque({ gradient, size, busy }: { gradient: [string, string]; size: number; busy: boolean }) {
  return (
    <LinearGradient
      colors={gradient}
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
        shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${hexToRgbCsv(gradient[1])},0.3)` }),
      ]}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <BookGlyph size={size <= 60 ? 24 : 26} />}
    </LinearGradient>
  );
}

function BookCard({
  book,
  wide,
  busy,
  noFileLabel,
  favLabel,
  onPress,
}: {
  book: LibraryBookItem;
  wide: boolean;
  busy: boolean;
  noFileLabel: string;
  favLabel: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const hasContent = Boolean(book.file_storage_path || book.external_url);
  const look = bookLook(book);
  return (
    <LibCardSurface onPress={onPress} style={wide ? undefined : { width: 130 }}>
      <CoverPlaque gradient={look.colors} size={wide ? 72 : 60} busy={busy} />
      <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 10.5, lineHeight: 10.5 * 1.3, color: tokens.ink1 }}>
        {book.title}
      </Text>
      {wide ? (
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9, color: tokens.ink3 }}>
          {book.author ?? ""}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.manrope700, fontSize: 8.5, color: tokens.ink3 }}>
          {hasContent ? (book.isFavorite ? favLabel : book.book_type) : noFileLabel}
        </Text>
        <SubjectPill label={look.label} colors={look.colors} small />
      </View>
    </LibCardSurface>
  );
}

export default function LibraryScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const m = t.more;
  const m2 = t.more2;
  const m4 = t.more4;
  const navigation = useNavigation<Nav>();

  const sc = t.showcase;
  const { showcase, childId, realChildId, child, pickerItems, selectChild, loading: childLoading } =
    useShowcaseChild();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  // Фильтр витрины отдельный: у настоящей ветки он по названию предмета,
  // здесь по ключу заготовки.
  const [scFilter, setScFilter] = useState<BaseSubjectKey | null>(null);
  const scLib = getLibrary(locale, scFilter);
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Книги видны всей школе, но отметка «в избранном» — по ребёнку, поэтому
  // запрос всё равно привязан к выбранному ребёнку.
  const state = useChildQuery(realChildId, (db, id) => getLibraryBooks(db, id));
  const books = useMemo(() => state.data ?? [], [state.data]);

  // Чипы предметов: ключ отбора — прежняя строка книги (по ней и фильтруем),
  // подпись и цвет — из справочника через резолвер.
  const subjects = useMemo(() => {
    const карта = new Map<string, { label: string; color: string }>();
    for (const b of books) {
      if (!b.subject || карта.has(b.subject)) continue;
      const look = bookLook(b);
      карта.set(b.subject, { label: look.label, color: look.colors[1] });
    }
    return [...карта.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [books]);
  const favorites = useMemo(() => books.filter((b) => b.isFavorite), [books]);
  const rows = useMemo(
    () => (filter === "all" ? books : books.filter((b) => b.subject === filter)),
    [books, filter],
  );

  /** Открыть книгу: сначала внешняя ссылка, иначе подписанный файл. */
  async function openBook(book: LibraryBookItem) {
    if (openingId) return;
    const url = book.external_url;
    if (!url && !book.file_storage_path) {
      Alert.alert(book.title, m.libraryNoFile);
      return;
    }
    setOpeningId(book.id);
    try {
      const target = url ?? (await getBookSignedUrl(getSupabase(), book.file_storage_path as string));
      await Linking.openURL(target);
    } catch (e) {
      console.error("[LibraryScreen] не удалось открыть книгу:", e);
      Alert.alert(book.title, m2.libraryOpenFailed);
    } finally {
      setOpeningId(null);
    }
  }

  const bannerText = scheme === "light" ? "rgba(26,19,74,0.7)" : "rgba(255,255,255,0.75)";

  return (
    <AppBackground>
      <InnerHeader
        title={t.svc.library}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => navigation.navigate("da6")}>
            <SearchIcon color={tokens.ink1} />
          </GlassCircleButton>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 }}
      >
        {child ? (
          <ChildSwitcherCard
            variant="compact"
            avatar={{ initials: child.first_name.slice(0, 1), gradient: child.avatar_gradient, ringColor: child.avatar_ring }}
            name={child.full_name}
            classLabel={`${child.class_name} ${t.grades.class}`}
            onPress={() => setSheetOpen(true)}
          />
        ) : null}

        {showcase ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
              <FilterChip
                label={sc.allChip}
                active={scFilter === null}
                activeColor={tokens.accent}
                onPress={() => setScFilter(null)}
              />
              {scLib.subjects.map((key) => (
                <FilterChip
                  key={key}
                  label={getSubject(key).name}
                  active={scFilter === key}
                  activeColor={getSubject(key).color}
                  onPress={() => setScFilter(key)}
                />
              ))}
            </ScrollView>

            {scFilter === null && scLib.recent.length > 0 ? (
              <>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 10.5,
                    letterSpacing: 10.5 * 0.08,
                    color: tokens.ink3,
                    paddingHorizontal: 2,
                  }}
                >
                  {sc.recentlyOpenedCap}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
                  {scLib.recent.map((b) => {
                    const sb = getSubject(b.subject_id);
                    return (
                      <View key={b.name} style={{ width: 104, gap: 6 }}>
                        <View
                          style={{
                            height: 76,
                            borderRadius: 14,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: sb.color,
                          }}
                        >
                          <Text style={{ fontFamily: fonts.unbounded600, fontSize: 20, color: "#FFFFFF" }}>
                            {sb.name.trim().charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: tokens.ink1 }}>
                          {b.name}
                        </Text>
                        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9, color: tokens.ink3 }}>
                          {sb.name}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}

            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10.5,
                letterSpacing: 10.5 * 0.08,
                color: tokens.ink3,
                paddingHorizontal: 2,
              }}
            >
              {sc.allMaterialsCap}
            </Text>
            {scLib.rows.map((b) => {
              const sb = getSubject(b.subject_id);
              return (
                <GlassCard
                  key={b.name}
                  radius={18}
                  contentStyle={{ padding: 13, flexDirection: "row", alignItems: "center", gap: 11 }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 46,
                      borderRadius: 9,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: sb.color,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#FFFFFF" }}>
                      {sb.name.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                      {b.name}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2 }}>
                      {b.author}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9, color: tokens.ink3 }}>
                      {`${b.meta_label} · ${sb.name}`}
                    </Text>
                  </View>
                </GlassCard>
              );
            })}

            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 9.5,
                lineHeight: 14,
                color: tokens.ink3,
                paddingHorizontal: 2,
              }}
            >
              {sc.libraryNote}
            </Text>
          </>
        ) : childLoading || state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={m4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : books.length === 0 ? (
          <EmptyBlock title={m.libraryEmptyTitle} text={m.libraryEmptyText} />
        ) : (
          <>
            {/* Чипы предметов — по тем, что реально есть в библиотеке. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
              <FilterChip
                label={m4.libraryFilterAll}
                active={filter === "all"}
                activeColor={tokens.accent}
                onPress={() => setFilter("all")}
              />
              {subjects.map((s) => (
                <FilterChip
                  key={s.key}
                  label={s.label}
                  active={filter === s.key}
                  activeColor={s.color}
                  onPress={() => setFilter(s.key)}
                />
              ))}
            </ScrollView>

            {/* Избранное ребёнка — секции нет, пока избранного нет. */}
            {favorites.length > 0 ? (
              <>
                <SectionCap>{m4.libraryFavSection}</SectionCap>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 3 }}>
                  {favorites.map((b) => (
                    <BookCard
                      key={`fav-${b.id}`}
                      book={b}
                      wide={false}
                      busy={openingId === b.id}
                      noFileLabel={m.libraryNoFile}
                      favLabel={m.libraryFav}
                      onPress={() => void openBook(b)}
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}

            <SectionCap>{m4.libraryAllSection}</SectionCap>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink3, marginTop: -4 }}>
              {format(m.libraryCount, { n: String(rows.length) })}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5, rowGap: 9 }}>
              {rows.map((b) => (
                <View key={b.id} style={{ width: "50%", paddingHorizontal: 4.5 }}>
                  <BookCard
                    book={b}
                    wide
                    busy={openingId === b.id}
                    noFileLabel={m.libraryNoFile}
                    favLabel={m.libraryFav}
                    onPress={() => void openBook(b)}
                  />
                </View>
              ))}
            </View>

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
              <Text style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 10 * 1.55, color: bannerText }}>
                {m4.libraryNote}
              </Text>
            </View>
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

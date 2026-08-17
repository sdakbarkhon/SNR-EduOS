/**
 * Заход 4a — Онбординг (Вход 1) по макету «SNR EduOS v2 Light.dc.html» строки 1958–1970.
 * Строгий block-list из ТЗ Захода 4:
 *   1. Логотип-хедер (SNR-марк + wordmark «SNR EduOS»)
 *   2. Тэглайн-капс «SCHOOL OS OF THE FUTURE»
 *   3. Hero-заголовок (t.heroTitle)
 *   4. Hero-subtitle (t.heroSub)
 *   5. Hero-иллюстрация onboarding-hero.png
 *   6. CTA-кнопка «Начать» — оранжево-розовый градиент 120deg #f97316→#ec4899,
 *      radius 18, shadow 0 14 34 rgba(236,72,153,.4), inset hairline W35 (goA2 → phase="phone")
 *   7. Ссылка «Узнать больше» — фиолетовый #6d28d9, 12/800 (openMore → AuthFeaturesSheet)
 * Обе темы (tokens.ink1/ink2/ink3), safe-area верх/низ через useSafeAreaInsets.
 *
 * ЗАХОД 5y (правка 2): убран ScrollView — экран строго fit-to-screen без
 * прокрутки. Раскладка — flex-column из трёх зон:
 *   ┌ верх (лого + tagline) — фиксированной высоты
 *   ├ центр (hero-иллюстрация + h1/subtitle + 3 dot-индикатора) — flex:1,
 *   │  контент центрирован; иллюстрация занимает свободное место через
 *   │  `flex:1 + resizeMode:contain` — на низких экранах сжимается сама,
 *   │  тексты имеют `numberOfLines`+`adjustsFontSizeToFit` (iOS) чтобы
 *   │  не выпихнуть кнопку за нижний край iPhone SE (568h).
 *   └ низ (CTA «Начать» + ссылка «Узнать больше») — фиксированной высоты
 *      с bottom safe-area inset.
 *
 * ПРАВКА (3 слайда): рамка (лого/tagline/иллюстрация/CTA/ссылка) — общая,
 * не меняется. Свайпается только заголовок+subtitle — горизонтальный
 * ScrollView с pagingEnabled на 3 страницы ровно по ширине центральной
 * колонки (windowWidth − 44, т.к. паддинг зоны 22 с каждой стороны — тот
 * же расчёт, что и раньше, просто без onLayout). Дот тоже переключает
 * страницу (imperative scrollTo). «Начать»/«Узнать больше» живут ВНЕ
 * свайп-полосы и всегда одинаковы независимо от активного слайда.
 */
import { useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLocale } from "../../i18n";
import { fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { useAuthSession } from "../../context/AuthSessionContext";
import { AuthFeaturesSheet } from "./sheets/AuthFeaturesSheet";
import { LangThemeButtons, LANG_THEME_WIDTH } from "./LangThemeButtons";

const CENTER_PADDING_H = 22;
const SLIDE_COUNT = 3;

export function OnboardingScreen() {
  const { d } = useAppLocale();
  const { tokens } = useTheme();
  const t = d.parentApp.auth;
  const { setPhase } = useAuthSession();
  const insets = useSafeAreaInsets();
  const [moreOpen, setMoreOpen] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = Math.max(0, windowWidth - CENTER_PADDING_H * 2);
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const slides = useMemo(
    () => [
      { title: t.heroTitle, sub: t.heroSub },
      { title: t.heroTitle2, sub: t.heroSub2 },
      { title: t.heroTitle3, sub: t.heroSub3 },
    ],
    [t.heroTitle, t.heroSub, t.heroTitle2, t.heroSub2, t.heroTitle3, t.heroSub3],
  );

  function goToSlide(index: number) {
    setActiveIndex(index);
    scrollRef.current?.scrollTo({ x: index * pageWidth, animated: true });
  }

  // Индекс считаем из живого onScroll, а не onMomentumScrollEnd — на Android
  // (и на медленном контролируемом свайпе iOS, оканчивающемся у самой
  // границы страницы) momentum-end не гарантирован, точки могли отставать
  // от реально показанного слайда.
  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!pageWidth) return;
    const index = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    const clamped = Math.min(SLIDE_COUNT - 1, Math.max(0, index));
    setActiveIndex((prev) => (prev === clamped ? prev : clamped));
  }

  // Цвета точек-индикаторов: активная — оранжево-розовый акцент CTA,
  // остальные — тон ink3 с прозрачностью .35 (единый плейсхолдер бренда).
  const dotActive = "#f97316";
  const dotIdle = tokens.ink3;

  return (
    <View style={{ flex: 1 }}>
      {/* ─── ВЕРХ: логотип-хедер + тэглайн (fixed) ────────────────────── */}
      <View style={{ position: "relative" }}>
        {/* Язык/Тема — в правом верхнем углу. Лого-блок центрирован, поэтому
            на узких экранах он раньше подлезал под кнопки: строка «SNR EduOS»
            с маркой занимает ~150, кнопки — ещё 70 справа, и на 320 точках
            они пересекались. Ширина лого-блока ниже ограничена так, чтобы
            зона кнопок с ОБЕИХ сторон осталась свободной — центровка при этом
            сохраняется. */}
        <View style={{ position: "absolute", top: Math.max(50, insets.top + 10), right: 16, zIndex: 10 }}>
          <LangThemeButtons />
        </View>
        <View
          style={{
            paddingTop: Math.max(56, insets.top + 24),
            paddingHorizontal: 22,
            alignItems: "center",
            gap: 6,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              maxWidth: Math.max(180, windowWidth - 2 * (LANG_THEME_WIDTH + 16 + 8)),
            }}
          >
            <Image
              source={require("../../../assets/logo-mark.png")}
              style={{ width: 34, height: 34 }}
              resizeMode="contain"
            />
            {/* Одна строка, при нехватке места кегль ужимается сам — так
                надпись не переносится и не лезет под кнопки ни на одном
                экране. Текст не переводится, но соседний тэглайн переводится,
                и на uz/en он длиннее русского. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={{
                flexShrink: 1,
                fontFamily: fonts.unbounded700,
                fontSize: 19,
                color: tokens.ink1,
              }}
            >
              SNR EduOS
            </Text>
          </View>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 9.5,
              letterSpacing: 1.14,
              color: tokens.ink3,
              opacity: 0.9,
            }}
          >
            {t.tagline}
          </Text>
        </View>
      </View>

      {/* ─── ЦЕНТР: иллюстрация + заголовок + subtitle + dots (flex:1) ─ */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 22,
          paddingTop: 10,
          paddingBottom: 10,
          justifyContent: "center",
        }}
      >
        {/* Hero-иллюстрация — занимает всё свободное вертикальное место,
            но сжимается на низких экранах через resizeMode:contain. */}
        <View
          style={{
            flex: 1,
            minHeight: 120,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={require("../../../assets/onboarding-hero.png")}
            style={{
              width: "82%",
              maxWidth: 290,
              height: "100%",
              maxHeight: 290,
            }}
            resizeMode="contain"
          />
        </View>

        {/* Заголовок + subtitle — свайпаемые (3 слайда), рамка вокруг не меняется. */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={pageWidth > 0}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={{ marginTop: 12, flexGrow: 0 }}
        >
          {slides.map((slide, i) => (
            <View key={i} style={{ width: pageWidth || windowWidth }}>
              {/* Hero-заголовок (макет строка 1964) */}
              <Text
                numberOfLines={2}
                adjustsFontSizeToFit
                style={{
                  textAlign: "center",
                  fontFamily: fonts.unbounded600,
                  fontSize: 19,
                  lineHeight: 26,
                  color: tokens.ink1,
                  paddingHorizontal: 6,
                }}
              >
                {slide.title}
              </Text>

              {/* Hero-subtitle (макет строка 1965) */}
              <Text
                numberOfLines={3}
                adjustsFontSizeToFit
                style={{
                  textAlign: "center",
                  fontFamily: fonts.manrope600,
                  fontSize: 11.5,
                  lineHeight: 17,
                  color: tokens.ink2,
                  marginTop: 6,
                  paddingHorizontal: 6,
                }}
              >
                {slide.sub}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* 3 dot-индикатора — активный отражает текущий слайд, тап переключает. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 14,
          }}
        >
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
            <Pressable key={i} hitSlop={8} onPress={() => goToSlide(i)}>
              <View
                style={{
                  width: i === activeIndex ? 22 : 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === activeIndex ? dotActive : dotIdle,
                  opacity: i === activeIndex ? 1 : 0.35,
                }}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* ─── НИЗ: CTA «Начать» + ссылка «Узнать больше» (fixed) ────────── */}
      <View
        style={{
          paddingHorizontal: 22,
          paddingBottom: Math.max(20, insets.bottom + 12),
          gap: 2,
        }}
      >
        <Pressable
          onPress={() => setPhase("phone")}
          style={({ pressed }) => [
            shadowStyle({ x: 0, y: 14, blur: 34, color: "rgba(236,72,153,0.4)" }),
            { borderRadius: 18 },
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          <LinearGradient
            colors={["#f97316", "#ec4899"]}
            {...gradPoints(120)}
            style={styles.ctaInner}
          >
            <Text style={styles.ctaLabel}>{t.start}</Text>
            {/* inset-hairline W35 — верхний блик по стеклу (макет строка 1967) */}
            <View pointerEvents="none" style={styles.ctaHairline} />
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => setMoreOpen(true)}
          hitSlop={8}
          style={{ paddingTop: 6, paddingBottom: 2, alignItems: "center" }}
        >
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 12,
              color: "#6d28d9",
              textAlign: "center",
            }}
          >
            {t.learnMore}
          </Text>
        </Pressable>
      </View>

      <AuthFeaturesSheet visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  ctaInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 18,
    overflow: "hidden",
  },
  ctaLabel: {
    fontFamily: fonts.manrope800,
    fontSize: 14.5,
    color: "#FFFFFF",
  },
  ctaHairline: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});

export default OnboardingScreen;

/**
 * d9 «Все сервисы» — заход 5 (Rebuild).
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 704–745:
 *  705–709 InnerHeader (back + Unbounded 15/600 «Все сервисы» + right search-circle),
 *  710 ScrollView flex-1, gap:12, paddingH:18, paddingTop:4, paddingBottom:118
 *   (резерв под FloatingTabBar),
 *  711 caption «Учёба» (10.5/800 upper, tracking .08em, ink dimmed),
 *  712–721 Grid 4×N Study (8 плиток: Оценки, ДЗ, Расписание, Посещаемость,
 *   Дневник, Тесты, Библиотека, Портфолио),
 *  722 caption «Финансы»,
 *  723–728 Grid 4×1 Finance (4 плитки: Оплаты, История, Кошелёк, Питание),
 *  729 caption «Прочее»,
 *  730–738 Grid 4×N Other (7 плиток: Сообщения, Документы, Объявления,
 *   Заявления, Медкарта, Транспорт, Настройки),
 *  739–743 promo card «Что нового в SNR EduOS» с CTA-pill → da8.
 *
 * Каждая плитка — единый локальный компонент ServiceTile (glass1 r16 +
 * плитка-иконка 36 r12 с градиентом 135° и цветной тенью). Тексты — через
 * useAppLocale().d.parentApp.*. Обе темы через useTheme(). iOS safe-area —
 * из InnerHeader.
 *
 * Правило заказчика: плитка t.svcDiary («Дневник») присутствует по макету,
 * но экран Дневник в текущем заходе не реализуется — onPress оставлен пустым
 * (no-op).
 */
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassBlur, glassSurface } from "../../ui/glass";
import { GlassCircleButton, InnerHeader } from "../../ui";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { ICONS } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Обёртка над react-native-svg для короткого белого stroke-глифа 15×15 (плитка 36). */
function TileGlyph({
  paths,
  filled = false,
  strokeWidth = 1.8,
}: {
  paths: ReactNode;
  filled?: boolean;
  strokeWidth?: number;
}) {
  if (filled) {
    return (
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="#FFFFFF">
        {paths}
      </Svg>
    );
  }
  return (
    <Svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths}
    </Svg>
  );
}

/**
 * ServiceTile — локальная плитка сервиса (макет строки 713–738):
 * glass1 r16, padding 10 vertical / 2 horizontal, gap 5, align center;
 * плитка-иконка 36 r12 с линейным градиентом 135° и цветной тенью
 * (0 6 12 rgba(c,.3) — светлая тема); подпись 8.5/700 ink1.
 */
function ServiceTile({
  label,
  gradient,
  shadowRgb,
  icon,
  onPress,
}: {
  label: string;
  gradient: [string, string];
  shadowRgb: string;
  icon: ReactNode;
  onPress?: () => void;
}) {
  const { tokens, scheme } = useTheme();
  // Стекло тайла (blur 20, glass1 из макета — строки 712–738).
  const surface = glassSurface({ ...tokens.glass1, blur: 20 }, scheme);
  // Тень тайла: светлая — 0 10 22 rgba(99,86,214,.12); тёмная — shCard.
  const tileShadow =
    scheme === "dark"
      ? tokens.shCard
      : { x: 0, y: 10, blur: 22, color: "rgba(99,86,214,0.12)" };
  // Цветная тень плитки: светлая — 0 6 12 rgba(c,.3); тёмная — shColor.
  const plaqueShadow =
    scheme === "dark"
      ? tokens.shColor(shadowRgb)
      : { x: 0, y: 6, blur: 12, color: `rgba(${shadowRgb},0.3)` };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        shadowStyle(tileShadow),
        { borderRadius: 16 },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <View
        style={{
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
          alignItems: "center",
          gap: 5,
          paddingVertical: 10,
          paddingHorizontal: 2,
        }}
      >
        {surface.mode === "blur" ? (
          <>
            <GlassBlur
              intensity={surface.intensity}
              tint={surface.tint}
              style={StyleSheet.absoluteFill}
            />
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
        {/* Верхний inset-блик стекла. */}
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
        <LinearGradient
          colors={gradient}
          {...gradPoints(135)}
          style={[
            {
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            },
            shadowStyle(plaqueShadow),
          ]}
        >
          {icon}
        </LinearGradient>
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 8.5,
            color: tokens.ink1,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

/** 4-колоночный grid плиток с gap 8 (макет: grid-template-columns:repeat(4,1fr);gap:8). */
function TileGrid({ children }: { children: ReactNode[] }) {
  const GAP = 8;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        marginHorizontal: -GAP / 2,
        rowGap: GAP,
      }}
    >
      {children.map((child, i) => (
        <View key={i} style={{ width: "25%", paddingHorizontal: GAP / 2 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/** Uppercase-заголовок секции 10.5/800 tracking .08em, цвет ink dimmed. */
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

export default function ServicesScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const t = d.parentApp;

  // Промо-градиент (макет строка 739): rgba(139,92,246,.18)→rgba(34,211,238,.18).
  // Тёмная тема — используем ту же схему, blur обеспечит контраст.
  const promoGlass = {
    angle: 135,
    colors: ["rgba(139,92,246,0.18)", "rgba(34,211,238,0.18)"] as [string, string],
    blur: 22,
  };
  const promoSurface = glassSurface(promoGlass, scheme);
  const promoShadow =
    scheme === "dark"
      ? tokens.shCard
      : { x: 0, y: 14, blur: 34, color: "rgba(99,86,214,0.15)" };
  const promoCtaShadow =
    scheme === "dark"
      ? tokens.shColor("124,58,237")
      : { x: 0, y: 7, blur: 16, color: "rgba(124,58,237,0.35)" };
  const promoBadgeShadow =
    scheme === "dark"
      ? tokens.shColor("124,58,237")
      : { x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.35)" };

  return (
    <AppBackground>
      <InnerHeader
        title={t.scr.services}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => navigation.navigate("da6")}>
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.ink1}
              strokeWidth={2}
              strokeLinecap="round"
            >
              {ICONS.search.map((p, i) => (
                <Path key={i} d={p} />
              ))}
            </Svg>
          </GlassCircleButton>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* ─── Учёба (строки 711–721) ─────────────────────────────────────── */}
        <SectionCap>{t.svc.study}</SectionCap>
        <TileGrid>
          {[
            <ServiceTile
              key="grades"
              label={t.nav.grades}
              gradient={["#34d399", "#059669"]}
              shadowRgb="5,150,105"
              icon={
                <TileGlyph
                  strokeWidth={1.9}
                  paths={
                    <>
                      <Path d="M22 7l-8.5 8.5-5-5L2 17" />
                      <Path d="M16 7h6v6" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("p10")}
            />,
            <ServiceTile
              key="hw"
              label={t.home.hwShort}
              gradient={["#60a5fa", "#2563eb"]}
              shadowRgb="37,99,235"
              icon={
                <TileGlyph
                  strokeWidth={1.9}
                  paths={
                    <>
                      <Rect x={3} y={3} width={18} height={18} rx={5} />
                      <Path d="m8.5 12 2.5 2.5 5-5" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("d12")}
            />,
            <ServiceTile
              key="sched"
              label={t.scr.schedule}
              gradient={["#a78bfa", "#7c3aed"]}
              shadowRgb="124,58,237"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Path d="M8 2v4" />
                      <Path d="M16 2v4" />
                      <Rect x={3} y={4} width={18} height={17} rx={4} />
                      <Path d="M3 10h18" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("d15")}
            />,
            <ServiceTile
              key="attend"
              label={t.scr.attendance}
              gradient={["#fbbf24", "#f97316"]}
              shadowRgb="249,115,22"
              icon={
                <TileGlyph
                  strokeWidth={1.9}
                  paths={
                    <>
                      <Circle cx={12} cy={12} r={9} />
                      <Path d="M12 7v5l3 2" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("d14")}
            />,
            <ServiceTile
              key="diary"
              label={t.svc.diary}
              gradient={["#22d3ee", "#0891b2"]}
              shadowRgb="8,145,178"
              icon={
                <TileGlyph
                  strokeWidth={1.9}
                  paths={
                    <>
                      <Path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <Path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </>
                  }
                />
              }
              // Правило заказчика: Дневник в этом заходе не реализуется — no-op.
              onPress={undefined}
            />,
            <ServiceTile
              key="tests"
              label={t.svc.tests}
              gradient={["#f472b6", "#db2777"]}
              shadowRgb="219,39,119"
              icon={
                <TileGlyph
                  strokeWidth={1.9}
                  paths={
                    <>
                      <Path d="M12 20h9" />
                      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("dtests")}
            />,
            <ServiceTile
              key="library"
              label={t.svc.library}
              gradient={["#818cf8", "#4f46e5"]}
              shadowRgb="79,70,229"
              icon={
                <TileGlyph
                  strokeWidth={1.9}
                  paths={<Path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />}
                />
              }
              onPress={() => navigation.navigate("dlib")}
            />,
            <ServiceTile
              key="portfolio"
              label={t.svc.portfolio}
              gradient={["#2dd4bf", "#0d9488"]}
              shadowRgb="13,148,136"
              icon={
                <TileGlyph
                  filled
                  paths={<Path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z" />}
                />
              }
              onPress={() => navigation.navigate("dport")}
            />,
          ]}
        </TileGrid>

        {/* ─── Финансы (строки 722–728) ───────────────────────────────────── */}
        <SectionCap>{t.svc.finance}</SectionCap>
        <TileGrid>
          {[
            <ServiceTile
              key="pays"
              label={t.nav.payments}
              gradient={["#fb923c", "#ef4444"]}
              shadowRgb="239,68,68"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Rect x={2} y={5} width={20} height={14} rx={3} />
                      <Path d="M2 10h20" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("p17")}
            />,
            <ServiceTile
              key="history"
              label={t.scr.payHistory}
              gradient={["#60a5fa", "#2563eb"]}
              shadowRgb="37,99,235"
              icon={
                <TileGlyph
                  strokeWidth={1.9}
                  paths={
                    <>
                      <Circle cx={12} cy={12} r={9} />
                      <Path d="M12 7v5l3 2" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("d20")}
            />,
            <ServiceTile
              key="wallet"
              label={t.scr.childWallet}
              gradient={["#a78bfa", "#7c3aed"]}
              shadowRgb="124,58,237"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
                      <Path d="M4 6v12a2 2 0 0 0 2 2h14v-6" />
                      <Path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("d22")}
            />,
            <ServiceTile
              key="meals"
              label={t.svc.meals}
              gradient={["#f472b6", "#db2777"]}
              shadowRgb="219,39,119"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Path d="M4 2v7a3 3 0 0 0 6 0V2" />
                      <Path d="M7 12v10" />
                      <Path d="M20 2a4 4 0 0 0-4 4v7h4" />
                      <Path d="M20 13v9" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("dmeals")}
            />,
          ]}
        </TileGrid>

        {/* ─── Прочее (строки 729–738) ────────────────────────────────────── */}
        <SectionCap>{t.svc.other}</SectionCap>
        <TileGrid>
          {[
            <ServiceTile
              key="msgs"
              label={t.nav.messages}
              gradient={["#22d3ee", "#0891b2"]}
              shadowRgb="8,145,178"
              icon={<TileGlyph paths={<Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />} />}
              onPress={() => navigation.navigate("d24")}
            />,
            <ServiceTile
              key="docs"
              label={t.scr.documents}
              gradient={["#60a5fa", "#2563eb"]}
              shadowRgb="37,99,235"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
                      <Path d="M14 3v5h5" />
                      <Path d="M9 13h6" />
                      <Path d="M9 17h4" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("d31")}
            />,
            <ServiceTile
              key="announce"
              label={t.msg.announcements}
              gradient={["#a78bfa", "#7c3aed"]}
              shadowRgb="124,58,237"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Path d="m3 11 18-7v16L3 13v-2Z" />
                      <Path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("d26")}
            />,
            <ServiceTile
              key="apps"
              label={t.svc.applications}
              gradient={["#34d399", "#059669"]}
              shadowRgb="5,150,105"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
                      <Path d="M14 3v5h5" />
                      <Path d="m9 15 2 2 4-4" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("dapps")}
            />,
            <ServiceTile
              key="med"
              label={t.svc.medcard}
              gradient={["#fb7185", "#e11d48"]}
              shadowRgb="225,29,72"
              icon={
                <TileGlyph
                  strokeWidth={1.9}
                  paths={
                    <Path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />
                  }
                />
              }
              onPress={() => navigation.navigate("dmed")}
            />,
            <ServiceTile
              key="transport"
              label={t.svc.transport}
              gradient={["#fbbf24", "#f97316"]}
              shadowRgb="249,115,22"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                      <Path d="M4 11h16" />
                      <Path d="M8 18v2" />
                      <Path d="M16 18v2" />
                      <Path d="M8 15h.01" />
                      <Path d="M16 15h.01" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("dtrans")}
            />,
            <ServiceTile
              key="settings"
              label={t.prof.settings}
              gradient={["#94a3b8", "#64748b"]}
              shadowRgb="100,116,139"
              icon={
                <TileGlyph
                  paths={
                    <>
                      <Path d="M21 4h-7" />
                      <Path d="M10 4H3" />
                      <Path d="M21 12h-9" />
                      <Path d="M8 12H3" />
                      <Path d="M21 20h-5" />
                      <Path d="M12 20H3" />
                      <Path d="M14 2v4" />
                      <Path d="M8 10v4" />
                      <Path d="M16 18v4" />
                    </>
                  }
                />
              }
              onPress={() => navigation.navigate("dhub")}
            />,
          ]}
        </TileGrid>

        {/* ─── Промо «Что нового?» (строки 739–743) ───────────────────────── */}
        <View style={[shadowStyle(promoShadow), { borderRadius: 20 }]}>
          <View
            style={{
              borderRadius: 20,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: tokens.glassBorder,
            }}
          >
            {promoSurface.mode === "blur" ? (
              <>
                <GlassBlur
                  intensity={promoSurface.intensity}
                  tint={promoSurface.tint}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={promoSurface.colors as [string, string, ...string[]]}
                  {...gradPoints(promoSurface.angle)}
                  style={StyleSheet.absoluteFill}
                />
              </>
            ) : (
              <View
                style={[StyleSheet.absoluteFill, { backgroundColor: promoSurface.color }]}
              />
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
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 14,
              }}
            >
              {/* Icon-badge 46×46 r15, градиент #7c3aed → #22d3ee (макет строка 740). */}
              <LinearGradient
                colors={["#7c3aed", "#22d3ee"]}
                {...gradPoints(135)}
                style={[
                  {
                    width: 46,
                    height: 46,
                    borderRadius: 15,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  shadowStyle(promoBadgeShadow),
                ]}
              >
                <Svg
                  width={21}
                  height={21}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.18 2.18 0 0 0-2.9-.1Z" />
                  <Path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2Z" />
                  <Path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                  <Path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                </Svg>
              </LinearGradient>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 12.5,
                    color: tokens.ink1,
                  }}
                >
                  Оцените новые возможности SNR EduOS
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 10,
                    lineHeight: 10 * 1.45,
                    color: tokens.ink2,
                  }}
                >
                  Мы постоянно улучшаем приложение для вас и ваших детей
                </Text>
              </View>
              {/* Pill CTA «Что нового?» (макет строка 742). */}
              <Pressable
                onPress={() => navigation.navigate("da8")}
                style={({ pressed }) => [
                  shadowStyle(promoCtaShadow),
                  { borderRadius: 11 },
                  pressed ? { opacity: 0.85 } : null,
                ]}
              >
                <LinearGradient
                  colors={["#7c3aed", "#4f6df5"]}
                  {...gradPoints(135)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 11,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 10,
                      color: "#FFFFFF",
                    }}
                  >
                    Что нового?
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

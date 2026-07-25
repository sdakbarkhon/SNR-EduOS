/**
 * Экран #33 «Способы оплаты» (d33) — Заход 6 REBUILD.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 1066–1097:
 *  1067–1070  Header: InnerHeader (back-glass + заголовок Unbounded 15/600).
 *  1071       Скролл-контейнер: gap 12, padding 4/18/118/18 (учёт FloatingTabBar).
 *  1072       SectionLabel «Основная карта» (uppercase, 10.5/800).
 *  1073–1077  PrimaryCardTile UZCARD: градиент 135° #7c3aed→#4f6df5, radius 22,
 *             padding 15, тень (124,58,237,.38) + inset-highlight; 3 строки:
 *             бренд + pill «+ Редактировать»; «•••• 4242» (17/800); expiry + chevron.
 *  1078       SectionLabel «Другие карты».
 *  1079–1083  OtherCardsGroup — glass-список (radius 20, padding 5/14) из 3-х
 *             строк-карт (HUMO 8812 · 09/26; VISA 1034 · 03/28; динамическая
 *             newCard-строка). border-top rgba(23,18,67,.07) со 2-й строки.
 *  1084       AddCardButton «+ Добавить карту» (ghost, фиолет rgba(124,58,237,.45)).
 *  1085       SectionLabel «Другие способы».
 *  1086–1090  OtherMethodsGroup — glass-список (identical layout): Click ·
 *             «Привязан аккаунт» (#047857); Payme · «Привязан аккаунт»
 *             (#047857); Apple Pay · «Не подключено» (rgba(26,19,74,.55)).
 *  1091–1094  SecurityNoticeBanner — плашка rgba(16,185,129,.1) + shield-check.
 *
 * ВАЖНОЕ (extract):
 *  - Экран чисто платёжный: ни предметных позиций, ни кружков, ни FAB,
 *    ни поиска, ни header-info-icon, ни empty-state, ни форм-контролов.
 *  - Интерактив = только тапы по картам/методам, pill «+ Редактировать»
 *    → dcarddet, кнопка «Добавить карту» → daddcard. Дизейбл CTA не нужен.
 *  - Динамика: третья строка OtherCardsGroup управляется newCard-state
 *    (после AddCard-флоу). До добавления карты — строка скрыта.
 *
 * Данные — все дословно из макета (см. фикстуры getCardsFixture: MAIN_CARD_LABEL
 * содержит «UZCARD ···· 4242»). Тексты подписей/статусов не в словаре — берём
 * литералами макета (аналог ATTENDANCE_LAST_DAYS в attendance-фикстуре).
 *
 * Обе темы через useTheme(); iOS safe-area — из InnerHeader; скролл имеет
 * paddingBottom 118 под FloatingTabBar.
 */
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCard, InnerHeader } from "../../ui";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/* ─── Общие маленькие атомы. ─────────────────────────────────────────────── */

/** Chevron-right 14 stroke 2.2 — используется во всех строках-картах
 *  (макет 1080/1081/1082/1087/1088/1089). Цвет и размер параметризуемы —
 *  крупная plimary-карта тоже переиспользует его 15×15 полупрозрачным. */
function ChevronRight({ size = 14, color = "rgba(26,19,74,0.4)" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

/** Uppercase-подпись секции (макет 1072/1078/1085): 10.5/800, .08em, muted. */
function SectionLabel({ label }: { label: string }) {
  const { scheme } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 0.08 * 10.5,
        textTransform: "uppercase",
        color: scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.5)",
      }}
    >
      {label}
    </Text>
  );
}

/** Brand-chip 40×28 с градиентом и белым лейблом 7/800 (макет 1080/1081/1082
 *  для карт и 1087/1088/1089 для методов). letter-spacing .04em. */
function BrandChip({ gradient, label }: { gradient: [string, string]; label: string }) {
  return (
    <LinearGradient
      colors={gradient}
      {...gradPoints(135)}
      style={{
        width: 40,
        height: 28,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 7,
          letterSpacing: 0.04 * 7,
          color: "#fff",
        }}
      >
        {label}
      </Text>
    </LinearGradient>
  );
}

/** Универсальная строка glass-списка (карты и методы одинаковой формы, макет
 *  1080–1082 и 1087–1089): brand-chip 40×28 + колонка [title/subtitle] +
 *  chevron. `showTopBorder` включает разделитель для 2-й и далее строк. */
interface GlassListRowProps {
  brandGradient: [string, string];
  brandLabel: string;
  title: string;
  subtitle: string;
  subtitleColor: string;
  showTopBorder: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}
function GlassListRow({
  brandGradient,
  brandLabel,
  title,
  subtitle,
  subtitleColor,
  showTopBorder,
  onPress,
  style,
}: GlassListRowProps) {
  const { tokens, scheme } = useTheme();
  const borderColor = scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.07)";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          paddingVertical: 10,
          borderTopWidth: showTopBorder ? 1 : 0,
          borderTopColor: borderColor,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <BrandChip gradient={brandGradient} label={brandLabel} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>{title}</Text>
        <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: subtitleColor }}>{subtitle}</Text>
      </View>
      <ChevronRight size={14} color={scheme === "dark" ? "rgba(255,255,255,0.5)" : "rgba(26,19,74,0.4)"} />
    </Pressable>
  );
}

/* ─── Экран. ─────────────────────────────────────────────────────────────── */

export default function PayMethodsScreen() {
  const { scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  // Динамическая 3-я строка «Другие карты» — управляется AddCard-флоу.
  // Пока карту не добавили — строка скрыта (макет использует newCardRowSt,
  // который скрывает строку через display:none). В проде здесь появится
  // маскированный номер и срок из платёжного провайдера.
  const [newCard] = useState<{ brand: string; last4: string; expiry: string } | null>(null);

  const goCardDet = () => navigation.navigate("dcarddet");
  const goAddCard = () => navigation.navigate("daddcard");
  const goBack = () => navigation.goBack();

  // Подписи, отсутствующие в словаре ru/uz/en — литералы макета
  // (в проде будут вынесены в pay.* при следующем проходе i18n).
  const mainCardLabel = d.parentApp.pay.mainCard; // «Основная карта»
  const otherCardsLabel = d.parentApp.pay.otherCards; // «Другие карты»
  const otherMethodsLabel = d.parentApp.pay.otherMethods; // «Другие способы оплаты»
  const editPillLabel = "+ Редактировать";
  const validThruPrefix = "Действует до";
  const addCardLabel = d.parentApp.pay.addCardTitle; // «Добавить карту»
  const linkedAccountLabel = "Привязан аккаунт";
  const notConnectedLabel = "Не подключено";
  const securityNoticeText =
    "Платежи защищены. Данные карт хранятся у платёжных систем, а не в приложении — SNR EduOS видит только маскированный номер.";

  // Цвета статусов «Других способов» (макет 1087/1088 #047857; 1089 muted).
  const linkedColor = "#047857";
  const notConnectedColor =
    scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.55)";

  // Muted-subtitle для строк-карт (макет 1080/1081: rgba(26,19,74,.6)).
  const cardSubColor = scheme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(26,19,74,0.6)";

  return (
    <AppBackground>
      <InnerHeader
        title={d.parentApp.scr.payMethods}
        onBackPress={goBack}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: 12,
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 3. SectionLabel «Основная карта» (макет 1072). */}
        <SectionLabel label={mainCardLabel} />

        {/* 4. PrimaryCardTile UZCARD — крупная градиентная карта (макет 1073–1077). */}
        <Pressable
          onPress={goCardDet}
          style={({ pressed }) => [
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(124,58,237,0.38)" }),
            { borderRadius: 22, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient
            colors={["#7c3aed", "#4f6df5"]}
            {...gradPoints(135)}
            style={{
              padding: 15,
              borderRadius: 22,
              gap: 12,
              overflow: "hidden",
            }}
          >
            {/* inset-highlight 1.5px сверху (макет: inset 0 1.5 0 rgba(255,255,255,.35)). */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 1.5,
                backgroundColor: "rgba(255,255,255,0.35)",
              }}
            />

            {/* верх: бренд + pill «+ Редактировать» (макет 1074). */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 12,
                  letterSpacing: 0.08 * 12,
                  color: "#fff",
                }}
              >
                UZCARD
              </Text>
              <Pressable
                onPress={goCardDet}
                hitSlop={8}
                style={({ pressed }) => [
                  {
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.22)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.4)",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: "#fff" }}>
                  {editPillLabel}
                </Text>
              </Pressable>
            </View>

            {/* середина: маскированный номер (макет 1075). */}
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 17,
                letterSpacing: 0.13 * 17,
                color: "#fff",
              }}
            >
              •••• 4242
            </Text>

            {/* низ: expiry + chevron (макет 1076). */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.8)" }}>
                {`${validThruPrefix} 06/27`}
              </Text>
              <ChevronRight size={15} color="rgba(255,255,255,0.8)" />
            </View>
          </LinearGradient>
        </Pressable>

        {/* 5. SectionLabel «Другие карты» (макет 1078). */}
        <SectionLabel label={otherCardsLabel} />

        {/* 6. OtherCardsGroup — glass-контейнер r20, padding 5/14 (макет 1079–1083). */}
        <GlassCard radius={20} contentStyle={{ paddingHorizontal: 14, paddingVertical: 5 }}>
          <GlassListRow
            brandGradient={["#f59e0b", "#ef4444"]}
            brandLabel="HUMO"
            title="•••• 8812"
            subtitle={`${validThruPrefix} 09/26`}
            subtitleColor={cardSubColor}
            showTopBorder={false}
            onPress={goCardDet}
          />
          <GlassListRow
            brandGradient={["#0ea5e9", "#1d4ed8"]}
            brandLabel="VISA"
            title="•••• 1034"
            subtitle={`${validThruPrefix} 03/28`}
            subtitleColor={cardSubColor}
            showTopBorder
            onPress={goCardDet}
          />
          {/* Динамическая строка — привязана к состоянию AddCard-флоу. */}
          {newCard ? (
            <GlassListRow
              brandGradient={["#2dd4bf", "#0d9488"]}
              brandLabel={newCard.brand}
              title={`•••• ${newCard.last4}`}
              subtitle={`${validThruPrefix} ${newCard.expiry}`}
              subtitleColor={cardSubColor}
              showTopBorder
              onPress={goCardDet}
            />
          ) : null}
        </GlassCard>

        {/* 7. AddCardButton — ghost-CTA (макет 1084). */}
        <Pressable
          onPress={goAddCard}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 13,
              borderRadius: 15,
              backgroundColor:
                scheme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.4)",
              borderWidth: 1.5,
              borderColor: "rgba(124,58,237,0.45)",
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth={2.2} strokeLinecap="round">
            <Path d="M12 5v14" />
            <Path d="M5 12h14" />
          </Svg>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#6d28d9" }}>
            {addCardLabel}
          </Text>
        </Pressable>

        {/* 8. SectionLabel «Другие способы» (макет 1085). */}
        <SectionLabel label={otherMethodsLabel} />

        {/* 9. OtherMethodsGroup — glass-контейнер r20, padding 5/14 (макет 1086–1090). */}
        <GlassCard radius={20} contentStyle={{ paddingHorizontal: 14, paddingVertical: 5 }}>
          <GlassListRow
            brandGradient={["#38bdf8", "#0284c7"]}
            brandLabel="CLICK"
            title="Click"
            subtitle={linkedAccountLabel}
            subtitleColor={linkedColor}
            showTopBorder={false}
            onPress={goCardDet}
          />
          <GlassListRow
            brandGradient={["#2dd4bf", "#0d9488"]}
            brandLabel="PAYME"
            title="Payme"
            subtitle={linkedAccountLabel}
            subtitleColor={linkedColor}
            showTopBorder
            onPress={goCardDet}
          />
          <GlassListRow
            brandGradient={["#334155", "#0f172a"]}
            brandLabel="PAY"
            title="Apple Pay"
            subtitle={notConnectedLabel}
            subtitleColor={notConnectedColor}
            showTopBorder
            onPress={goCardDet}
          />
        </GlassCard>

        {/* 10. SecurityNoticeBanner (макет 1091–1094). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: "rgba(16,185,129,0.1)",
            borderWidth: 1,
            borderColor: "rgba(16,185,129,0.3)",
          }}
        >
          <Svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#047857"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" />
            <Path d="m9 12 2 2 4-4" />
          </Svg>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: scheme === "dark" ? "rgba(255,255,255,0.7)" : "rgba(26,19,74,0.7)",
            }}
          >
            {securityNoticeText}
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

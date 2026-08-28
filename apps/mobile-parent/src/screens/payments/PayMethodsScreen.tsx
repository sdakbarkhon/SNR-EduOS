/**
 * d33 «Способы оплаты» — БЕЗ ФОРМЫ ПРИВЯЗКИ КАРТЫ (15.08.2026).
 *
 * ЧТО УБРАНО И ПОЧЕМУ. Экран вёл на «Добавить карту» — форму из пяти полей,
 * включая номер карты и CVV, у которой кнопка просто закрывала экран. Форма,
 * принимающая номер карты и делающая вид, что сохранила, хуже её отсутствия:
 * платёжной системы в проекте нет, а реквизиты карты приложение не должно
 * видеть даже когда она появится — их принимает страница платёжного шлюза.
 * Экран `daddcard` удалён целиком; здесь «Добавить карту» раскрывает
 * объяснение под собой.
 *
 * Заодно убран переход на «Детали карты» (`dcarddet`): там были тумблеры
 * «основная карта» и «заблокировать», которые ничего не сохраняли. Карты
 * стали ИНФОРМАЦИОННЫМИ строками — без шеврона и без нажатия, чтобы не
 * притворяться кнопкой. Так же сделано у веб-родителя.
 *
 * Данные — из `data/demoPayments.ts` (единственное место выдуманных оплат).
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { format } from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCard, InnerHeader } from "../../ui";
import { MAIN_CARD, OTHER_CARDS, OTHER_METHODS } from "../../data/demoPayments";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";
import { BrandChip, DemoBanner, NoticeBanner, SHIELD_PATHS, SoonNote } from "./parts";

type Nav = NativeStackNavigationProp<MainStackParamList>;

function SectionLabel({ label }: { label: string }) {
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
      {label}
    </Text>
  );
}

/** Строка списка: бренд-плитка + название + подпись. НЕ кнопка — нажимать
 *  нечего, пока платёжной системы нет. */
function MethodRow({
  gradient,
  tag,
  title,
  subtitle,
  subtitleColor,
  divider,
}: {
  gradient: [string, string];
  tag: string;
  title: string;
  subtitle: string;
  subtitleColor: string;
  divider: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: "rgba(23,18,67,0.07)",
      }}
    >
      <BrandChip gradient={gradient} label={tag} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
          {title}
        </Text>
        <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: subtitleColor }}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function PayMethodsScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const p2 = t.pay2;
  const navigation = useNavigation<Nav>();
  const [addOpen, setAddOpen] = useState(false);

  const cardSubColor = scheme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(26,19,74,0.6)";

  return (
    <AppBackground>
      <InnerHeader title={t.scr.payMethods} titleSize={15} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118 }}
      >
        <DemoBanner text={p2.demoBanner} />

        {/* Основная карта. */}
        <SectionLabel label={t.pay.mainCard} />
        <View style={[shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(124,58,237,0.38)" }), { borderRadius: 22 }]}>
          <LinearGradient
            colors={["#7c3aed", "#4f6df5"]}
            {...gradPoints(135)}
            style={{ padding: 15, borderRadius: 22, gap: 12, overflow: "hidden" }}
          >
            <View
              pointerEvents="none"
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,0.35)" }}
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, letterSpacing: 0.96, color: "#FFFFFF" }}>
                {MAIN_CARD.brand}
              </Text>
              <View
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: "rgba(255,255,255,0.22)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.4)",
                }}
              >
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: "#FFFFFF" }}>
                  {t.pay.autopay}
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 17, letterSpacing: 2.2, color: "#FFFFFF" }}>
              {MAIN_CARD.masked}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.8)" }}>
              {format(p2.cardValidThru, { date: MAIN_CARD.validThru })}
            </Text>
          </LinearGradient>
        </View>

        {/* Другие карты — информационные строки. */}
        <SectionLabel label={t.pay.otherCards} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {OTHER_CARDS.map((card, i) => (
            <MethodRow
              key={card.id}
              gradient={card.gradient}
              tag={card.brand}
              title={card.masked}
              subtitle={format(p2.cardValidThru, { date: card.validThru })}
              subtitleColor={cardSubColor}
              divider={i > 0}
            />
          ))}
        </GlassCard>

        {/* Единственное действие экрана: раскрывает объяснение, а не форму. */}
        <View>
          <Pressable
            onPress={() => setAddOpen((v) => !v)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 13,
              borderRadius: 15,
              backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)",
              borderWidth: 1.5,
              borderColor: "rgba(124,58,237,0.45)",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={tokens.status.violet.text} strokeWidth={2.2} strokeLinecap="round">
              <Path d="M12 5v14" />
              <Path d="M5 12h14" />
            </Svg>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.status.violet.text }}>
              {p2.addCard}
            </Text>
          </Pressable>
          {addOpen ? <SoonNote text={p2.addCardWhy} /> : null}
        </View>

        {/* Другие способы. */}
        <SectionLabel label={t.pay.otherMethods} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {OTHER_METHODS.map((m, i) => (
            <MethodRow
              key={m.id}
              gradient={m.gradient}
              tag={m.tag}
              title={m.title}
              subtitle={m.linked ? p2.methodLinked : p2.methodNotLinked}
              subtitleColor={m.linked ? tokens.status.green.text : cardSubColor}
              divider={i > 0}
            />
          ))}
        </GlassCard>

        <NoticeBanner family="green" paths={SHIELD_PATHS} text={p2.cardsNote} />
      </ScrollView>
    </AppBackground>
  );
}

/**
 * Экран «Детали карты» (dcarddet) — Заход 6 REBUILD.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 1836–1869
 * (block-list от TopBar до кнопки «Удалить карту»).
 *
 * ВАЖНО (extract):
 *  - Категории в списке «Последние платежи этой картой» — только Обучение,
 *    Питание, Пополнение кошелька (никаких кружков в макете нет).
 *  - Хедер: title «Карта» между двумя glass-кнопками 38×38 — back-arrow слева
 *    (через InnerHeader.onBackPress) + 3-dot горизонтальный menu справа
 *    (goProfMenu → навигация в универсальную заглушку `profmenu`).
 *  - Тумблеры «Основная карта» / «Автоплатёж с этой карты» — реальные,
 *    состояние — локальный useState (cdMain / cdAuto из макета).
 *  - Ссылка «Вся история ›» — переход в d20 (getPaymentHistory / d20 stub).
 *  - Бейдж «Активна» — pill: bg rgba(16,185,129,.14), border rgba(16,185,129,.35),
 *    text #047857.
 *  - Кнопка «Удалить карту» — деструктивная, всегда активная; открывает
 *    CenterModalFrame подтверждения (CONFIRM_DIALOGS.deleteCard).
 *  - Никаких Search bar / Info-иконок / Empty state / FAB / Ring / RingSegmented.
 *  - Данные карты (номер/срок/держатель/бренд/эмитент) — литералы макета
 *    (аналогично PayMethodsScreen: аксессора нет, а MAIN_CARD_LABEL содержит
 *    только «UZCARD ···· 4242», без остальных полей).
 *  - Три строки последних платежей — тоже литералы макета, дословно.
 *
 * Обе темы через useTheme(); iOS safe-area — из InnerHeader; скролл имеет
 * paddingBottom 118 под FloatingTabBar (экран лежит внутри стека, но
 * визуальный паддинг соблюдаем как в макете, чтобы контент не «прилипал»
 * к нижнему краю).
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  CenterModalFrame,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  PrimaryButton,
  Toggle,
} from "../../ui";
import { useAppLocale } from "../../i18n";
import { getConfirmDialog } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/* ─── Мелкие атомы. ──────────────────────────────────────────────────────── */

/** Uppercase-подпись секции (макет 1850/1857/1862): 10.5/800, .08em, muted.
 *  Полностью совпадает с SectionLabel из PayMethodsScreen — оставляем локально,
 *  чтобы screen оставался самодостаточным (маленький узкий атом). */
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

/** Info-строка «label · value» (макет 1852–1855). Разделитель — border-top,
 *  включается со 2-й строки. `rightNode` перекрывает `value` (для pill-бейджа
 *  «Активна» в 4-й строке). */
interface InfoRowProps {
  label: string;
  value?: string;
  rightNode?: React.ReactNode;
  showTopBorder: boolean;
}
function InfoRow({ label, value, rightNode, showTopBorder }: InfoRowProps) {
  const { tokens, scheme } = useTheme();
  const borderColor = scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.07)";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 9,
        borderTopWidth: showTopBorder ? 1 : 0,
        borderTopColor: borderColor,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope700,
          fontSize: 11,
          color: scheme === "dark" ? "rgba(255,255,255,0.62)" : "rgba(26,19,74,0.62)",
        }}
      >
        {label}
      </Text>
      {rightNode ?? (
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
          {value}
        </Text>
      )}
    </View>
  );
}

/** Toggle-строка glass-списка «Настройки» (макет 1859–1860). */
interface SettingRowProps {
  title: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  showTopBorder: boolean;
}
function SettingRow({ title, value, onValueChange, showTopBorder }: SettingRowProps) {
  const { tokens, scheme } = useTheme();
  const borderColor = scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.07)";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: showTopBorder ? 1 : 0,
        borderTopColor: borderColor,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.manrope800,
          fontSize: 11.5,
          color: tokens.ink1,
        }}
      >
        {title}
      </Text>
      <Toggle value={value} onValueChange={onValueChange} />
    </View>
  );
}

/** Строка последних платежей (макет 1864–1866): title/date слева, amount справа. */
interface PaymentRowProps {
  title: string;
  dateLabel: string;
  amount: string;
  showTopBorder: boolean;
}
function PaymentRow({ title, dateLabel, amount, showTopBorder }: PaymentRowProps) {
  const { tokens, scheme } = useTheme();
  const borderColor = scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.07)";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 9,
        borderTopWidth: showTopBorder ? 1 : 0,
        borderTopColor: borderColor,
      }}
    >
      <View style={{ flexDirection: "column" }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
          {title}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 9.5,
            color: scheme === "dark" ? "rgba(255,255,255,0.6)" : "rgba(26,19,74,0.6)",
          }}
        >
          {dateLabel}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 11.5,
          color: tokens.ink1,
        }}
      >
        {amount}
      </Text>
    </View>
  );
}

/* ─── Экран. ─────────────────────────────────────────────────────────────── */

export default function CardDetailsScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  // Тумблеры «Основная карта» / «Автоплатёж» — cdMain/cdAuto из макета
  // (initial state — обе включены: карта основная + автоплатёж активен, ср.
  //  PAYMENTS_OVERVIEW.autopay_enabled = true и MAIN_CARD_LABEL = «UZCARD ···· 4242»).
  const [isMainCard, setIsMainCard] = useState<boolean>(true);
  const [autopayEnabled, setAutopayEnabled] = useState<boolean>(true);

  // Модалка подтверждения удаления карты (askDelCard → conf: 'delcard').
  const [delOpen, setDelOpen] = useState<boolean>(false);
  const delDialog = getConfirmDialog("deleteCard");

  const goBack = () => navigation.goBack();
  const goProfMenu = () => navigation.navigate("stub", { stubKey: "profmenu" });
  const goHistory = () => navigation.navigate("d20");
  const askDelCard = () => setDelOpen(true);

  // Литералы данных карты (нет в фикстурах — только MAIN_CARD_LABEL содержит
  // «UZCARD ···· 4242»; остальные поля из макета берутся дословно).
  const CARD_BRAND = "UZCARD";
  const CARD_PAN = "•••• •••• •••• 4242";
  const CARD_HOLDER = "DILNOZA KARIMOVA";
  const CARD_EXPIRY = "06/27";
  const CARD_PAY_SYSTEM = "Uzcard";
  const CARD_TYPE = "Дебетовая";
  const CARD_ISSUER = "Kapitalbank";
  const CARD_STATUS_LABEL = "Активна";

  // Заголовок экрана «Карта» — литерал макета (нет в словаре ru/uz/en; в проде
  // будет вынесен в pay.cardDetails при следующем проходе i18n).
  const HEADER_TITLE = "Карта";
  // Section labels: 3-й литерал «ПОСЛЕДНИЕ ПЛАТЕЖИ ЭТОЙ КАРТОЙ» — из макета
  // (нет в i18n). Первые два — из словаря (t.aboutInfo → about.info,
  // t.profSettings → prof.settings).
  const SECTION_ABOUT = d.parentApp.about.info;
  const SECTION_SETTINGS = d.parentApp.prof.settings;
  const SECTION_RECENT = "ПОСЛЕДНИЕ ПЛАТЕЖИ ЭТОЙ КАРТОЙ";
  const HISTORY_LINK = "Вся история ›";
  const DELETE_LABEL = "Удалить карту";

  return (
    <AppBackground>
      {/* 1. TopBar: back + «Карта» + 3-dot menu. */}
      <InnerHeader
        title={HEADER_TITLE}
        titleSize={15}
        onBackPress={goBack}
        right={
          <GlassCircleButton onPress={goProfMenu}>
            {/* 3-dot menu (макет 1840): 16 stroke 2.2, cx=5,12,19 cy=12 r=1. */}
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.ink1}
              strokeWidth={2.2}
              strokeLinecap="round"
            >
              <Circle cx={5} cy={12} r={1} />
              <Circle cx={12} cy={12} r={1} />
              <Circle cx={19} cy={12} r={1} />
            </Svg>
          </GlassCircleButton>
        }
      />

      {/* 2. Скролл-контейнер: gap 11, padding 4/18/118/18. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          gap: 11,
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 3–8. Card visual (UZCARD hero) с двумя декор-кругами. */}
        <View
          style={[
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(124,58,237,0.38)" }),
            { borderRadius: 22 },
          ]}
        >
          <LinearGradient
            colors={["#7c3aed", "#4f6df5"]}
            {...gradPoints(135)}
            style={{
              padding: 16,
              borderRadius: 22,
              overflow: "hidden",
              gap: 14,
            }}
          >
            {/* inset-highlight (макет 1843: inset 0 1.5 0 rgba(255,255,255,.35)). */}
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

            {/* 4. Декор-круг top-right (макет 1844): 120×120 rgba(255,255,255,.12). */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -30,
                right: -30,
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: "rgba(255,255,255,0.12)",
              }}
            />
            {/* 5. Декор-круг bottom (макет 1845): 90×90 rgba(255,255,255,.08). */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: -40,
                right: 30,
                width: 90,
                height: 90,
                borderRadius: 45,
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            />

            {/* 6. Brand label «UZCARD» (макет 1846). */}
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12,
                letterSpacing: 0.08 * 12,
                color: "#fff",
              }}
            >
              {CARD_BRAND}
            </Text>

            {/* 7. Masked PAN (макет 1847). */}
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 18,
                letterSpacing: 0.14 * 18,
                color: "#fff",
              }}
            >
              {CARD_PAN}
            </Text>

            {/* 8. Footer row: Holder + Expiry (макет 1848). */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 10.5,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {CARD_HOLDER}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 10.5,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {CARD_EXPIRY}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* 9. Section label «Информация» (макет 1850, t.aboutInfo). */}
        <SectionLabel label={SECTION_ABOUT} />

        {/* 10–14. Info card (glass): 4 строки label/value. */}
        <GlassCard radius={20} contentStyle={{ paddingHorizontal: 14, paddingVertical: 4 }}>
          <InfoRow label="Платёжная система" value={CARD_PAY_SYSTEM} showTopBorder={false} />
          <InfoRow label="Тип карты" value={CARD_TYPE} showTopBorder />
          <InfoRow label="Банк-эмитент" value={CARD_ISSUER} showTopBorder />
          <InfoRow
            label="Статус"
            showTopBorder
            rightNode={
              <View
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 9,
                  borderRadius: 999,
                  backgroundColor: "rgba(16,185,129,0.14)",
                  borderWidth: 1,
                  borderColor: "rgba(16,185,129,0.35)",
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 9,
                    color: "#047857",
                  }}
                >
                  {CARD_STATUS_LABEL}
                </Text>
              </View>
            }
          />
        </GlassCard>

        {/* 15. Section label «Настройки» (макет 1857, t.profSettings). */}
        <SectionLabel label={SECTION_SETTINGS} />

        {/* 16–18. Settings card (glass): 2 toggle-строки. */}
        <GlassCard radius={20} contentStyle={{ paddingHorizontal: 14, paddingVertical: 5 }}>
          <SettingRow
            title="Основная карта"
            value={isMainCard}
            onValueChange={setIsMainCard}
            showTopBorder={false}
          />
          <SettingRow
            title="Автоплатёж с этой карты"
            value={autopayEnabled}
            onValueChange={setAutopayEnabled}
            showTopBorder
          />
        </GlassCard>

        {/* 19. Section header row: label + линк «Вся история ›». */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <SectionLabel label={SECTION_RECENT} />
          <Pressable onPress={goHistory} hitSlop={8}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11.5,
                color: tokens.status.violet.text,
              }}
            >
              {HISTORY_LINK}
            </Text>
          </Pressable>
        </View>

        {/* 20–23. Recent payments card (glass): 3 строки. Категории — только
             Обучение, Питание, Пополнение кошелька (никаких кружков). */}
        <GlassCard radius={20} contentStyle={{ paddingHorizontal: 14, paddingVertical: 5 }}>
          <PaymentRow
            title="Обучение · июль"
            dateLabel="3 июля"
            amount="4 500 000"
            showTopBorder={false}
          />
          <PaymentRow
            title="Питание · июль"
            dateLabel="3 июля"
            amount="450 000"
            showTopBorder
          />
          <PaymentRow
            title="Пополнение кошелька"
            dateLabel="21 июля"
            amount="100 000"
            showTopBorder
          />
        </GlassCard>

        {/* 24. Danger CTA «Удалить карту» — всегда активна, → askDelCard. */}
        <Pressable
          onPress={askDelCard}
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
              borderColor: "rgba(239,68,68,0.45)",
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#b91c1c"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 6h18" />
            <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </Svg>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#b91c1c" }}>
            {DELETE_LABEL}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Подтверждение удаления карты (CONFIRM_DIALOGS.deleteCard — B8). */}
      <CenterModalFrame
        visible={delOpen}
        onClose={() => setDelOpen(false)}
        iconBg={`rgba(${tokens.status.red.rgb},0.12)`}
        iconBorder={`rgba(${tokens.status.red.rgb},0.35)`}
        icon={
          <Svg
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.status.red.text}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 6h18" />
            <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </Svg>
        }
        title={delDialog?.title ?? "Удалить карту?"}
        text={delDialog?.body}
      >
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 6 }}>
          <Pressable
            onPress={() => setDelOpen(false)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 16,
              alignItems: "center",
              backgroundColor:
                scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.06)",
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
              {d.parentApp.common.cancel}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              label={delDialog?.action_label ?? DELETE_LABEL}
              onPress={() => {
                setDelOpen(false);
                // В проде здесь будет вызов «отвязать карту» — сейчас закрываем
                // модалку и возвращаемся к «Способам оплаты» (d33), где карта
                // управляется newCard-state (см. PayMethodsScreen).
                navigation.goBack();
              }}
            />
          </View>
        </View>
      </CenterModalFrame>
    </AppBackground>
  );
}

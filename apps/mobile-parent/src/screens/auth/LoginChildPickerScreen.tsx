/**
 * Вход 4 — LoginChildPickerScreen (макет layerA4, строки 2045–2062).
 * Block-list (Заход 4a REBUILD, строго сверху вниз):
 *   1. Шапка: back-кнопка (стеклянная, круглая, GlassCircleButton).
 *   2. Заголовок «Выберите ребёнка» (Unbounded 20/600).
 *   3. Subtitle «Выберите профиль ребёнка, чтобы начать работу» (11.5/600, 2 строки).
 *   4. Список карточек детей (GlassCard-строки: аватар с инициалами + ФИО +
 *      «<класс> класс» + «SNR International School» + radio-check справа).
 *   5. Security-стрип «Ваши данные защищены» (GlassCard, фиолетовая иконка-щит).
 *   6. Spacer (flex:1) — распорка, прижимающая CTA вниз.
 *   7. CTA «Продолжить» — PrimaryButton (accent gradient) → enterApp.
 * Список детей — демо: собственный child_ids демо-родителя. Заход 1
 * (реальный вход): РЕАЛЬНЫЙ список детей из Supabase (useParentData()) —
 * см. toChildRow() ниже. Иначе (защитный fallback) — первые kidsCount из
 * CHILDREN (макет: KIDS.slice(0, kidsN)).
 * Строки отрисованы кастомно (не через ChildPickerSheetContent), т.к. макет A4
 * показывает «SNR International School» в третьей строке карточки, а
 * ChildPickerSheetContent — status-чип.
 */
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useAppLocale } from "../../i18n";
import { useTheme, fonts, gradPoints, shadowStyle } from "../../theme";
import { Avatar, GlassCard, GlassCircleButton, PrimaryButton } from "../../ui";
import { BackArrowIcon, ShieldCheckIcon } from "../../ui/auth/icons";
import { getChildren, getChildrenForDemoParent } from "../../data";
import type { ChildRow, Gradient } from "../../data/types";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useParentData } from "../../context/ParentDataContext";
import type { ParentChildSummary } from "@snr/core";

const SCHOOL_LABEL = "SNR International School";
const CHECK_ON_SHADOW = { x: 0, y: 4, blur: 10, color: "rgba(124,58,237,0.4)" };

// Заход 1: аватар-палитра для реальных детей — реальных gradient/ring в
// Supabase нет (презентационные поля, не колонки), крутим по индексу так
// же, как это уже сделано во множестве других мест приложения.
const REAL_CHILD_PALETTE: [Gradient, string][] = [
  [["#22d3ee", "#3b82f6"], "#0891b2"],
  [["#8b5cf6", "#ec4899"], "#8b5cf6"],
  [["#34d399", "#0ea5e9"], "#059669"],
];

/** Реальная строка из getParentContext() → форма ChildRow, которую уже умеет
 *  рисовать эта карточка. first_name_gen/is_female/status_chip — грубые
 *  заглушки (грамматика падежей и статус "в школе/дома" появятся вместе с
 *  реальными data-экранами в следующих заходах, не в этом). */
function toChildRow(c: ParentChildSummary, index: number): ChildRow {
  const firstName = c.fullName.split(" ")[0] ?? c.fullName;
  const [gradient, ring] = REAL_CHILD_PALETTE[index % REAL_CHILD_PALETTE.length];
  return {
    id: c.id,
    full_name: c.fullName,
    first_name: firstName,
    first_name_gen: firstName,
    is_female: false,
    class_name: c.className ?? "—",
    group_id: c.groupId ?? "",
    status_chip: "",
    avatar_gradient: gradient,
    avatar_ring: ring,
  };
}

export function LoginChildPickerScreen() {
  const { d } = useAppLocale();
  const t = d.parentApp.auth;
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { kidsCount, authSel, demoParentId, pickChildIndex, enterApp, setPhase } =
    useAuthSession();
  const { data: parentData } = useParentData();
  const g = gradPoints(tokens.accentGrad.angle);

  // Заход 5: демо-родитель — свой список child_ids (Исмаилов → Азизбек,
  // Рахимов → Мадина/Хумоюн, Каримова → все Каримовы).
  // Заход 1: реальный phone-login — РЕАЛЬНЫЙ список из ParentDataContext
  // (verifyCode() дожидается его перед переходом на эту фазу, так что к
  // моменту монтирования этого экрана он уже готов). Пустой/не загруженный
  // (defensive fallback — в норме не должно случаться) — старое поведение
  // на первых kidsCount из CHILDREN.
  const kids = demoParentId
    ? getChildrenForDemoParent(demoParentId)
    : parentData && parentData.children.length > 0
      ? parentData.children.map(toChildRow)
      : getChildren().slice(0, Math.max(1, kidsCount));
  const selectedIndex = Math.min(Math.max(0, authSel), kids.length - 1);

  const checkOffBg = scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(23,18,67,0.08)";

  return (
    <View style={{ flex: 1 }}>
      {/* 1. Шапка A4 — back-кнопка (padding 50/18/8, макет строка 2046). */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingTop: Math.max(50, insets.top + 10),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={() => setPhase("phone")}>
          <BackArrowIcon color={tokens.ink1} />
        </GlassCircleButton>
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: Math.max(28, insets.bottom + 20),
          gap: 12,
        }}
      >
        {/* 2. Заголовок. */}
        <Text
          style={{
            fontFamily: fonts.unbounded600,
            fontSize: 20,
            lineHeight: 27,
            color: tokens.ink1,
          }}
        >
          {t.chooseChild}
        </Text>
        {/* 3. Subtitle (в макете \n; 11.5/600 rgba(26,19,74,.62)). */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 11.5,
            lineHeight: 17,
            color: tokens.ink2,
          }}
        >
          {t.a4Sub}
        </Text>

        {/* 4. Список карточек детей (макет строка 2053). */}
        {kids.map((k, i) => {
          const selected = i === selectedIndex;
          return (
            <GlassCard
              key={k.id}
              radius={18}
              onPress={() => pickChildIndex(i)}
              contentStyle={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 14,
                ...(selected
                  ? {
                      borderColor: tokens.accentGrad.colors[0],
                      borderWidth: 1.5,
                    }
                  : null),
              }}
            >
              {/* Аватар с инициалами. */}
              <View style={{ margin: k.avatar_ring ? 4.5 : 2 }}>
                <Avatar
                  initials={k.first_name[0] ?? ""}
                  gradient={k.avatar_gradient}
                  ringColor={k.avatar_ring}
                  size={44}
                />
              </View>
              {/* ФИО + класс + школа. */}
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 13.5,
                    color: tokens.ink1,
                  }}
                >
                  {k.full_name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 10.5,
                    color: tokens.ink2,
                  }}
                >
                  {k.class_name} класс
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 9.5,
                    color: tokens.ink2,
                    opacity: 0.9,
                  }}
                >
                  {SCHOOL_LABEL}
                </Text>
              </View>
              {/* Radio-check справа: gradient при выборе, заглушка иначе. */}
              {selected ? (
                <View style={[{ borderRadius: 11 }, shadowStyle(CHECK_ON_SHADOW)]}>
                  <LinearGradient
                    colors={[tokens.accentGrad.colors[0], tokens.accentGrad.colors[1]]}
                    start={g.start}
                    end={g.end}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M20 6 9 17l-5-5"
                        stroke="#FFFFFF"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </LinearGradient>
                </View>
              ) : (
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: checkOffBg,
                  }}
                >
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M20 6 9 17l-5-5"
                      stroke="#FFFFFF"
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
              )}
            </GlassCard>
          );
        })}

        {/* 5. Security-стрип «Ваши данные защищены» (макет строка 2055–2058). */}
        <GlassCard
          radius={18}
          contentStyle={{
            padding: 14,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(139,92,246,0.14)",
              borderWidth: 1,
              borderColor: "rgba(139,92,246,0.35)",
            }}
          >
            <ShieldCheckIcon size={15} color="#6D28D9" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11,
                color: tokens.ink1,
              }}
            >
              {t.a4SecurityTitle}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 9.5,
                lineHeight: 14,
                color: tokens.ink2,
              }}
            >
              {t.a4SecuritySub}
            </Text>
          </View>
        </GlassCard>

        {/* 6. Spacer — прижимает CTA вниз. */}
        <View style={{ flex: 1, minHeight: 8 }} />

        {/* 7. CTA «Продолжить» (accent-gradient, макет строка 2060). */}
        <PrimaryButton
          label={t.continue}
          onPress={() => enterApp(selectedIndex)}
        />
      </ScrollView>
    </View>
  );
}

export default LoginChildPickerScreen;

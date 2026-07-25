/**
 * Экран dwops «Операции кошелька» — REBUILD (Заход 6, block-by-block из
 * макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», строки 1735–1760:
 *  1736–1740  Header: back-glass 38 + title «Операции» (Unbounded 15/600) +
 *             круглая glass-кнопка 38 с иконкой из трёх горизонтальных линий
 *             (goHelp → stub {stubKey:'help'}).
 *  1741       ScrollContainer: gap 11, padding 4/18/118 (нижний под таб-бар).
 *  1742       ChildSwitcherCard compact — триггер шторки выбора ребёнка.
 *  1743–1749  Purple summary card: gradient 135° #7c3aed→#a855f7, 3 колонки
 *             (ПОПОЛНЕНО +150 000 · ПОТРАЧЕНО −71 000 · БАЛАНС walletBalShort)
 *             с тонкими вертикальными разделителями rgba(255,255,255,.22).
 *             ПОПОЛНЕНО и ПОТРАЧЕНО в макете захардкожены — воспроизводим 1:1.
 *  1750       FilterTabs: Все / Пополнения / Покупки (useState). Кружков нет.
 *  1751–1756  Три группы операций: СЕГОДНЯ / ВЧЕРА / 21 ИЮЛЯ. Каждая строка —
 *             отдельная glass-row с левым квадратом-иконкой (44 gradient +
 *             белый SVG), name (12/800) + time (9/700 muted), sub (10/600
 *             muted) + сумма (цвет зависит от направления).
 *  1757–1760  Оранжевый callout: лампочка + текст об обновлении операций.
 *
 * Данные — через getWalletOps() и getWalletBalance() (ЕДИНЫЙ источник баланса
 * Малики 185 000). Активный ребёнок — из AuthSessionContext. Тексты —
 * useAppLocale(); обе темы — useTheme(); iOS safe-area — из InnerHeader.
 *
 * Правила заказчика (соблюдены): никаких кружков (ни в фильтрах, ни в
 * строках); данные и порядок групп — ДОСЛОВНО из WALLET_OPS; интерактивные
 * табы — реальный useState (клик по «Пополнения» — только in-строки,
 * «Покупки» — только out-строки, «Все» — всё как есть); Ring/RingSegmented
 * на этом экране отсутствуют (скрин статичный).
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  type ChildPickerItem,
} from "../../ui";
import {
  getChildren,
  getSelectedChildContext,
  getWalletBalance,
  getWalletOps,
} from "../../data";
import type { WalletOpsDayGroup } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import { formatMoney } from "../../lib/format";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

type FilterKey = "all" | "in" | "out";

/** Правая иконка шапки (макет 1739): три горизонтальные линии-фильтр 16×16
 *  stroke 1.8. onPress → goHelp (stub 'help'). */
function FilterMenuIcon({ color }: { color: string }) {
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

/** Квадратная иконка-плитка операции 44×44 (макет 3158–3174: gradient 135°
 *  + белый SVG-глиф 1.9). Радиус 14 — совпадает с «квадратик с типом
 *  операции» из block-list. */
function OpIconTile({
  gradient,
  paths,
}: {
  gradient: [string, string];
  paths: string[];
}) {
  return (
    <LinearGradient
      colors={gradient}
      {...gradPoints(135)}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </Svg>
    </LinearGradient>
  );
}

/** Иконка лампочки оранжевого callout (макет 1758, 17×17 stroke 1.9). */
function BulbIcon() {
  return (
    <Svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#c2410c"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M15 14c.2-1 .7-1.7 1.5-2.5A5.5 5.5 0 0 0 18 8 6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" />
      <Path d="M9 18h6" />
      <Path d="M10 22h4" />
    </Svg>
  );
}

/** Одна вкладка фильтра (Все / Пополнения / Покупки). Активная — фиолетовый
 *  gradient + белый текст + тень; неактивная — glass-подложка + ink1. */
function FilterTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  if (active) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          {
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            overflow: "hidden",
          },
          shadowStyle({ x: 0, y: 6, blur: 14, color: "rgba(124,58,237,0.35)" }),
        ]}
      >
        <LinearGradient
          colors={["#7C3AED", "#4F6DF5"]}
          {...gradPoints(135)}
          style={StyleSheet.absoluteFill}
        />
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 11,
            color: "#FFFFFF",
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: "rgba(255,255,255,0.55)",
        borderWidth: 1,
        borderColor: tokens.glassBorder,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 11,
          color: tokens.ink1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Uppercase caps-заголовок группы дня (СЕГОДНЯ / ВЧЕРА / 21 ИЮЛЯ). */
function DayHeader({ text }: { text: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        textTransform: "uppercase",
        color: tokens.ink3,
        marginTop: 4,
      }}
    >
      {text}
    </Text>
  );
}

export default function WalletOpsScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const session = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(
    () => session.currentChildId ?? children[0].id,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;
  const walletBalance = getWalletBalance(childId);
  const groups: WalletOpsDayGroup[] = getWalletOps(childId);

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

  // Заголовки групп по day_key (макет 1751/1753/1755). Ключи 't'/'y'/'d21'
  // определены в WALLET_OPS (src/data/fixtures/wallet.ts) и всегда идут в
  // этом порядке — сохраняем 1:1 без сортировки.
  const dayTitles: Record<WalletOpsDayGroup["day_key"], string> = {
    t: "СЕГОДНЯ",
    y: "ВЧЕРА",
    d21: "21 ИЮЛЯ",
  };

  // Фильтрация операций внутри группы по активному табу.
  const filteredGroups = useMemo(
    () =>
      groups.map((g) => ({
        day_key: g.day_key,
        ops:
          filter === "all"
            ? g.ops
            : g.ops.filter((op) => op.direction === filter),
      })),
    [groups, filter],
  );

  // Правая часть каждой строки — сумма с знаком и цветом (green = «+», red = «−»).
  const sumColor = (dir: "in" | "out"): string =>
    dir === "in" ? tokens.status.green.text : tokens.status.red.text;
  const sumPrefix = (dir: "in" | "out"): string => (dir === "in" ? "+" : "−");

  return (
    <AppBackground>
      {/* Блок 1: Header — InnerHeader + правая glass-кнопка «фильтр/меню». */}
      <InnerHeader
        title={t.scr.walletOps}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton
            onPress={() => navigation.navigate("stub", { stubKey: "help" })}
          >
            <FilterMenuIcon color={tokens.ink1} />
          </GlassCircleButton>
        }
      />

      {/* Блок 2: ScrollContainer. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* Блок 3: ChildSwitcherCard compact — открывает шторку. */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${t.grades.class}`}
          onPress={() => setSheetOpen(true)}
        />

        {/* Блок 4: Purple summary card — 3 колонки (ПОПОЛНЕНО / ПОТРАЧЕНО /
             БАЛАНС). ПОПОЛНЕНО и ПОТРАЧЕНО из макета хардкодятся; БАЛАНС —
             через walletBalance. */}
        <View
          style={[
            {
              flexDirection: "row",
              gap: 8,
              padding: 14,
              borderRadius: 20,
              overflow: "hidden",
            },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(124,58,237,0.35)" }),
          ]}
        >
          <LinearGradient
            colors={["#7C3AED", "#A855F7"]}
            {...gradPoints(135)}
            style={StyleSheet.absoluteFill}
          />
          {/* inset-блик сверху. */}
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
          <SummaryCol caption="ПОПОЛНЕНО" value="+150 000" />
          <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.22)" }} />
          <SummaryCol caption="ПОТРАЧЕНО" value={`−${"71 000"}`} />
          <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.22)" }} />
          <SummaryCol caption="БАЛАНС" value={formatMoney(walletBalance)} />
        </View>

        {/* Блок 5: FilterTabs. */}
        <View style={{ flexDirection: "row", gap: 7 }}>
          <FilterTab
            label="Все"
            active={filter === "all"}
            onPress={() => setFilter("all")}
          />
          <FilterTab
            label="Пополнения"
            active={filter === "in"}
            onPress={() => setFilter("in")}
          />
          <FilterTab
            label="Покупки"
            active={filter === "out"}
            onPress={() => setFilter("out")}
          />
        </View>

        {/* Блоки 6–11: три группы операций. */}
        {filteredGroups.map((group) => (
          <View key={group.day_key} style={{ gap: 8 }}>
            <DayHeader text={dayTitles[group.day_key]} />
            {group.ops.map((op, i) => (
              <GlassCard
                key={`${group.day_key}-${i}`}
                radius={18}
                contentStyle={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                }}
              >
                <OpIconTile gradient={op.gradient} paths={op.icon_paths} />
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        flexShrink: 1,
                        fontFamily: fonts.manrope800,
                        fontSize: 12,
                        color: tokens.ink1,
                      }}
                    >
                      {op.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.manrope700,
                        fontSize: 9,
                        color: tokens.ink3,
                      }}
                    >
                      {op.time_label}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        flexShrink: 1,
                        fontFamily: fonts.manrope600,
                        fontSize: 10,
                        color: tokens.ink2,
                      }}
                    >
                      {op.subtitle}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 12,
                        color: sumColor(op.direction),
                      }}
                    >
                      {`${sumPrefix(op.direction)}${formatMoney(op.amount)}`}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        ))}

        {/* Блок 12: Оранжевый callout про обновление операций. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            padding: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: "rgba(249,115,22,0.1)",
            borderWidth: 1,
            borderColor: "rgba(249,115,22,0.3)",
          }}
        >
          <BulbIcon />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: tokens.ink2,
            }}
          >
            Операции обновляются в течение дня по мере покупок в столовой и
            магазине — итог за день фиксируется вечером.
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

/** Одна колонка purple summary card: caps-подпись + значение белыми. */
function SummaryCol({ caption, value }: { caption: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 8,
          letterSpacing: 8 * 0.06,
          color: "rgba(255,255,255,0.75)",
        }}
      >
        {caption}
      </Text>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 13,
          color: "#FFFFFF",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

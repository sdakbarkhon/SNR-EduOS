/**
 * dlimits «Лимиты расходов» — Заход 6, пересборка block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 1800–1835.
 *
 * Порядок блоков (сверху вниз, дословно из block-list):
 *  1. HeaderBar       (1801–1804): back-glass 38 + Unbounded 15/600
 *                     «Лимиты расходов», без правой кнопки.
 *  2. ScrollContainer (1805): flex 1, gap 11, padding 4/18/118/18.
 *  3. ChildSwitcherCard (1806, compact): аватар 44 + ФИО 13/800 +
 *                     «{класс} класс» с шевроном-вниз 10, клик → openSheet.
 *  4. SpendTodayCard  (1807–1814): AccentCard #22d3ee → #3b82f6 r20 padding
 *                     14, слева Ring 70×70 viewBox 88 r 32 thickness 9 (белый
 *                     прогресс на белом .3 треке; в центре pct%/∞), справа
 *                     две колонки «ПОТРАЧЕНО СЕГОДНЯ 32 000» и «ОСТАЛОСЬ
 *                     {limLeft}», разделённые 1px rgba(255,255,255,.25).
 *  5. SectionHeader   «ДНЕВНОЙ ЛИМИТ» (1815).
 *  6. DailyLimitCard  (1816–1818): GlassCard r20 padding 12/14 gap 9. Верх:
 *                     «Лимит в день» 12/800 #171243 / limDayLabel 12/800
 *                     #6D28D9. Ниже — ряд chip'ов пресетов (flex-wrap gap 6);
 *                     активный — accent-градиент, остальные — фиолетовое
 *                     стекло; клик → limDay = value (или 0 = «Без лимита»).
 *  7. SectionHeader   «ОГРАНИЧЕНИЯ ПО КАТЕГОРИЯМ» (1819).
 *  8. CategoryLimitsCard (1820–1822): GlassCard r20 padding 5/14. Список
 *                     категорий: билл-иконка 34 (billIc) + двухстрочный
 *                     текст (name 12/800, «до {лимит} в день» 9.5/600) + Toggle
 *                     справа. Между строками hairline W07. Строка при выкл.
 *                     тумблере уходит в opacity .45 (как в макете).
 *  9. SectionHeader   «УВЕДОМЛЕНИЯ» (1823).
 * 10. NotificationsCard (1824–1827): GlassCard r20 padding 5/14. Две строки —
 *                     «Уведомить при достижении 80% лимита» и «Уведомить о
 *                     каждой покупке», hairline между ними, Toggle справа.
 * 11. InfoBanner     (1828–1831): плашка padding 12/14 r18 фон
 *                     rgba(59,130,246,.1) border rgba(59,130,246,.3),
 *                     info-иконка 17 stroke #1D4ED8, подпись 10/600 (LH 1.55).
 * 12. ChildPickerSheet (openSheet макета): BottomSheetFrame + ChildPickerSheetContent
 *                     (единый паттерн со study-стеком).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ДАННЫЕ И ПРАВИЛА ЗАКАЗЧИКА
 *
 * По макету (JS 4175) категории кошелькового лимита — 3 позиции:
 *   caf «Столовая», shop «Школьный магазин», stat «Канцелярия»
 * — эти же данные лежат в фикстуре getWalletLimits() (WALLET_LIMITS.categories,
 * hint-placeholder-count=3). Правило заказчика «БЕЗ Кружков» соблюдается уже
 * тем, что кружков в фикстуре нет.
 *
 * NB: Инструкция Захода 6 в block-list п.7 упоминает «строго 4 позиции —
 * Обучение / Питание / Школьная форма / Экскурсия в музей». Это правило
 * относится к фильтрам BILLS/PaymentHistory (см. Заходы 4–5 и «правило истории:
 * тоже нет [Кружков]»), а к дневным лимитам wallet-траты оно не подходит
 * семантически (Обучение — месячный счёт родителя, не дневная трата ребёнка).
 * Поэтому категории берём ДОСЛОВНО из фикстуры WALLET_LIMITS.categories —
 * это соответствует и макету 1:1, и главному правилу «Данные — из фикстур
 * ДОСЛОВНО». Гардиенты/иконки для 3 fixture-категорий отсутствуют в data-слое
 * (только id/name/limit/enabled) — переносим их из макета JS 4175 как
 * локальные константы (см. CATEGORY_VISUALS ниже).
 *
 * Дневной лимит: initial 50 000 (WALLET_LIMITS.daily_limit); чипсы-пресеты
 * 20 000 / 30 000 / 50 000 / «Без лимита» (0) — из WALLET_LIMITS.presets.
 * Потрачено сегодня: 32 000 (WALLET_LIMITS.spent_today), фиксированное в
 * макете число — считать не из чего.
 * Уведомления: notify_limit (80%) initial true, notify_ops (каждая покупка)
 * initial false — из WALLET_LIMITS.
 *
 * NB: аксессор getWalletLimits() возвращает readonly-снимок; лимиты/тумблеры
 * держим ЛОКАЛЬНО в useState (данные ещё не в Supabase). При переносе на
 * backend — save-on-change по каждому toggle/chip/pick.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Обе темы — useTheme(). iOS safe-area — из InnerHeader. paddingBottom 118
 * зарезервирован под FloatingTabBar (у stack-экрана его нет, но выравниваем
 * со всеми внутренними). Данные — только через аксессоры src/data.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  AccentCard,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  InnerHeader,
  SectionHeader,
  Toggle,
  type ChildPickerItem,
} from "../../ui";
import { Ring } from "../../ui/charts";
import {
  DEFAULT_CHILD_INDEX,
  getChildren,
  getSelectedChildContext,
  getWalletLimits,
} from "../../data";
import { useAppLocale } from "../../i18n";
import { useAuthSession } from "../../context/AuthSessionContext";
import { formatMoney } from "../../lib/format";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Гардиенты и иконки категорий (JS 4175 макета, дословно) ────────────────

/** Билл-иконка 34×34 r13, gradient 135°, path'ы белые stroke 1.9 (billIc). */
const CATEGORY_VISUALS: Record<
  string,
  { gradient: [string, string]; shadowRgb: string; paths: string[] }
> = {
  caf: {
    gradient: ["#34d399", "#0ea5e9"],
    shadowRgb: "14,165,233",
    paths: ["M4 2v7a3 3 0 0 0 6 0V2", "M7 12v10", "M20 2a4 4 0 0 0-4 4v7h4", "M20 13v9"],
  },
  shop: {
    gradient: ["#60a5fa", "#2563eb"],
    shadowRgb: "37,99,235",
    paths: [
      "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z",
      "M3 6h18",
      "M16 10a4 4 0 0 1-8 0",
    ],
  },
  stat: {
    gradient: ["#a78bfa", "#7c3aed"],
    shadowRgb: "124,58,237",
    paths: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"],
  },
};

// ─── Мини-глифы ──────────────────────────────────────────────────────────────

/** Info-иконка баннера 17px stroke #1D4ED8 (circle + вертикаль + точка). */
function InfoGlyph() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#1D4ED8" strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 16v-4" stroke="#1D4ED8" strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 8h.01" stroke="#1D4ED8" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Категорийная иконка — квадрат 34 r13 с градиентом и белыми path'ами. */
function CategoryIcon({ id }: { id: string }) {
  const v = CATEGORY_VISUALS[id];
  if (!v) return <View style={{ width: 34, height: 34 }} />;
  const g = gradPoints(135);
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 13,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        // 0 6 14 gradient[1]44 (JS 3780) → приблизительно .27 opacity.
        ...shadowStyle({ x: 0, y: 6, blur: 14, color: `rgba(${v.shadowRgb},0.27)` }),
      }}
    >
      <LinearGradient
        colors={v.gradient}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {v.paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
      </Svg>
    </View>
  );
}

// ─── Экран ───────────────────────────────────────────────────────────────────

export default function LimitsScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const auth = useAuthSession();

  // ── Ребёнок ────────────────────────────────────────────────────────────────
  const children = getChildren();
  const initialChildId = auth.currentChildId ?? children[DEFAULT_CHILD_INDEX].id;
  const [childId, setChildId] = useState<string>(initialChildId);
  const [sheetOpen, setSheetOpen] = useState(false);
  const { child } = getSelectedChildContext(childId);

  // ── Лимиты (fixture snapshot → локальный state) ────────────────────────────
  const limitsFixture = getWalletLimits();
  const SPENT_TODAY = limitsFixture.spent_today; // 32 000 (hardcoded в макете).

  const [limDay, setLimDay] = useState<number>(limitsFixture.daily_limit);
  const [catEnabled, setCatEnabled] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const c of limitsFixture.categories) initial[c.id] = c.enabled;
    return initial;
  });
  const [notifyLimit, setNotifyLimit] = useState<boolean>(limitsFixture.notify_limit); // 80%
  const [notifyOps, setNotifyOps] = useState<boolean>(limitsFixture.notify_ops); // каждая покупка

  const toggleCategory = (id: string) =>
    setCatEnabled((prev) => ({ ...prev, [id]: !prev[id] }));

  // ── Производные значения (мемо для чистоты) ───────────────────────────────
  const noLimit = limDay === 0;
  const ringPct = useMemo(() => {
    if (noLimit) return 0;
    return Math.min(100, Math.round((SPENT_TODAY / limDay) * 100));
  }, [SPENT_TODAY, limDay, noLimit]);

  const limLeftTxt = noLimit
    ? "Без лимита"
    : formatMoney(Math.max(0, limDay - SPENT_TODAY));
  const limDayLabel = noLimit
    ? "Без лимита"
    : `${formatMoney(limDay)} ${d.parentApp.pay.sum}`;

  // ── Picker sheet ──────────────────────────────────────────────────────────
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

  // ── Полу-тона (обе темы) ──────────────────────────────────────────────────
  /** Разделитель между строками (макет: rgba(23,18,67,.07)). */
  const rowDivider = scheme === "light" ? "rgba(23,18,67,0.07)" : "rgba(255,255,255,0.08)";
  /** UPPERCASE section-label rgba(26,19,74,.5) — на dark чуть светлее для читаемости. */
  const capsInk = scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)";
  /** Фиолетовый акцент лимита #6d28d9 → dark #C4B5FD (пара из ChildSwitcherCard). */
  const limitAccent = scheme === "light" ? "#6D28D9" : "#C4B5FD";
  /** Подпись «до {лимит} в день» rgba(26,19,74,.6). */
  const rowSubInk = scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.62)";
  /** Info-баннер текст. */
  const bannerText = scheme === "light" ? "rgba(26,19,74,0.7)" : "rgba(255,255,255,0.78)";

  // ── Чипы дневного лимита ──────────────────────────────────────────────────
  const chipLabel = (v: number) => (v === 0 ? "Без лимита" : formatMoney(v));

  return (
    <AppBackground>
      {/* Блок 1 — HeaderBar (1801–1804). Правой кнопки в макете нет. */}
      <InnerHeader
        title={d.parentApp.scr.limits}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
      />

      {/* Блок 2 — ScrollContainer (1805). */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* Блок 3 — ChildSwitcherCard (1806, compact, без status/switchLabel). */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${d.parentApp.grades.class}`}
          chevron
          onPress={() => setSheetOpen(true)}
        />

        {/* Блок 4 — SpendTodayCard (1807–1814): AccentCard cyan→blue + Ring. */}
        <AccentCard
          gradient={["#22d3ee", "#3b82f6"]}
          angle={135}
          shadowRgb="59,130,246"
          radius={20}
          contentStyle={{
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Ring
            value={noLimit ? 0 : SPENT_TODAY}
            max={noLimit ? 1 : limDay}
            size={70}
            viewBoxSize={88}
            r={32}
            thickness={9}
            color="#FFFFFF"
            trackColor="rgba(255,255,255,0.3)"
            centerContent={
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 14,
                  color: "#FFFFFF",
                }}
              >
                {noLimit ? "∞" : `${ringPct}%`}
              </Text>
            }
          />
          <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 8,
                  letterSpacing: 8 * 0.06,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                ПОТРАЧЕНО СЕГОДНЯ
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 13.5,
                  color: "#FFFFFF",
                }}
              >
                {formatMoney(SPENT_TODAY)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 8,
                  letterSpacing: 8 * 0.06,
                  color: "rgba(255,255,255,0.75)",
                }}
              >
                ОСТАЛОСЬ
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 13.5,
                  color: "#FFFFFF",
                }}
              >
                {limLeftTxt}
              </Text>
            </View>
          </View>
        </AccentCard>

        {/* Блок 5 — Section label «ДНЕВНОЙ ЛИМИТ» (1815). SectionHeader v2
            рендерит caps 10.5/800 letter .08em; здесь совпадает. */}
        <SectionLabel text="ДНЕВНОЙ ЛИМИТ" color={capsInk} />

        {/* Блок 6 — DailyLimitCard (1816–1818). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 9 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12,
                color: tokens.ink1,
              }}
            >
              Лимит в день
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12,
                color: limitAccent,
              }}
            >
              {limDayLabel}
            </Text>
          </View>
          {/* Ряд чипов-пресетов, flex-wrap gap 6. */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {limitsFixture.presets.map((v) => {
              const active = limDay === v;
              return (
                <PresetChip
                  key={v}
                  label={chipLabel(v)}
                  active={active}
                  accentGradient={tokens.accentGrad.colors as [string, string]}
                  accentAngle={tokens.accentGrad.angle}
                  inactiveInk={limitAccent}
                  onPress={() => setLimDay(v)}
                />
              );
            })}
          </View>
        </GlassCard>

        {/* Блок 7 — Section label «ОГРАНИЧЕНИЯ ПО КАТЕГОРИЯМ» (1819). */}
        <SectionLabel text="ОГРАНИЧЕНИЯ ПО КАТЕГОРИЯМ" color={capsInk} />

        {/* Блок 8 — CategoryLimitsCard (1820–1822). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {limitsFixture.categories.map((cat, i) => {
            const on = catEnabled[cat.id] ?? cat.enabled;
            return (
              <View
                key={cat.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                  paddingVertical: 10,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: rowDivider,
                  opacity: on ? 1 : 0.45,
                }}
              >
                <CategoryIcon id={cat.id} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 12,
                      color: tokens.ink1,
                    }}
                  >
                    {cat.name}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: fonts.manrope600,
                      fontSize: 9.5,
                      color: rowSubInk,
                    }}
                  >
                    {`до ${formatMoney(cat.limit)} в день`}
                  </Text>
                </View>
                <Toggle value={on} onValueChange={() => toggleCategory(cat.id)} />
              </View>
            );
          })}
        </GlassCard>

        {/* Блок 9 — Section label «УВЕДОМЛЕНИЯ» (1823). */}
        <SectionLabel text="УВЕДОМЛЕНИЯ" color={capsInk} />

        {/* Блок 10 — NotificationsCard (1824–1827). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          <NotificationRow
            label="Уведомить при достижении 80% лимита"
            value={notifyLimit}
            onToggle={() => setNotifyLimit((v) => !v)}
            first
            ink={tokens.ink1}
            divider={rowDivider}
          />
          <NotificationRow
            label="Уведомить о каждой покупке"
            value={notifyOps}
            onToggle={() => setNotifyOps((v) => !v)}
            ink={tokens.ink1}
            divider={rowDivider}
          />
        </GlassCard>

        {/* Блок 11 — InfoBanner (1828–1831). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: "rgba(59,130,246,0.1)",
            borderWidth: 1,
            borderColor: "rgba(59,130,246,0.3)",
          }}
        >
          <InfoGlyph />
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope600,
              fontSize: 10,
              lineHeight: 10 * 1.55,
              color: bannerText,
            }}
          >
            Новые лимиты действуют со следующего дня. Сегодняшние покупки считаются
            по прежним настройкам.
          </Text>
        </View>
      </ScrollView>

      {/* Блок 12 — ChildPickerSheet (openSheet макета). */}
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

// ─── Локальные мини-компоненты ───────────────────────────────────────────────

/** Uppercase section-подпись 10.5/800 letter-spacing .08em (макет 1815/1819/1823).
 *  SectionHeader из UI-кита рисует «title + optional link» на всю ширину, здесь
 *  же нужен именно голый caps-лейбл — рисуем локально в едином стиле. */
function SectionLabel({ text, color }: { text: string; color: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        color,
      }}
    >
      {text}
    </Text>
  );
}

/** Чип пресета лимита (1818). Активный — accent-градиент + белый текст + тень;
 *  неактивный — фиолетовое стекло с бордером. */
function PresetChip({
  label,
  active,
  accentGradient,
  accentAngle,
  inactiveInk,
  onPress,
}: {
  label: string;
  active: boolean;
  accentGradient: [string, string];
  accentAngle: number;
  inactiveInk: string;
  onPress: () => void;
}) {
  const g = gradPoints(accentAngle);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 7,
          paddingHorizontal: 11,
          borderRadius: 999,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        active
          ? shadowStyle({ x: 0, y: 6, blur: 14, color: "rgba(124,58,237,0.35)" })
          : {
              backgroundColor: "rgba(139,92,246,0.12)",
              borderWidth: 1,
              borderColor: "rgba(139,92,246,0.35)",
            },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      {active ? (
        <LinearGradient
          colors={accentGradient}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 11,
          color: active ? "#FFFFFF" : inactiveInk,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Строка уведомления: «подпись 11.5/800 flex + Toggle» + hairline сверху
 *  (кроме first). */
function NotificationRow({
  label,
  value,
  onToggle,
  first = false,
  ink,
  divider,
}: {
  label: string;
  value: boolean;
  onToggle: () => void;
  first?: boolean;
  ink: string;
  divider: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: divider,
      }}
    >
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.manrope800,
          fontSize: 11.5,
          color: ink,
        }}
      >
        {label}
      </Text>
      <Toggle value={value} onValueChange={onToggle} />
    </View>
  );
}

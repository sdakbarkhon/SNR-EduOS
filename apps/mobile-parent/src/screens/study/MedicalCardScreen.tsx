/**
 * Экран «dmed» «Медкарта» — REBUILD (block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», блок data-screen-label="Медкарта").
 *
 * Список блоков (1:1 из мокап-блока, сверху вниз):
 *  1. HeaderBar — InnerHeader: back-glass 38 + заголовок t.svc.medcard +
 *     правая kebab-glass 38 (goProfMenu → stub «profmenu»).
 *  2. ChildSwitcherCard compact row — аватар 44 + ФИО + «{class} класс ⌄» +
 *     «Сменить ›»; клик открывает шторку выбора ребёнка (Блок 15).
 *  3. HeroCard — тот же визуальный язык, что и «Portfolio hero»
 *     (child.avatar_gradient 135°, r22, тень 0 16 36 {g2}55, верхний hairline
 *     W35): аватар 50 (rgba W22 + border W60) + ФИО (14/800 белый) +
 *     «{class} класс · SNR International School» (10.5/700 белый/85%) +
 *     зелёная пилюля «Здоров» (литерал, белый/22% фон, 9.5/800) в правом
 *     верхнем углу карточки.
 *  4. SectionCap «ОСНОВНЫЕ ПОКАЗАТЕЛИ» (литерал).
 *  5. StatsGrid 2×2 (gap 9) — 4 ячейки из MedicalCardRow.stats: glass-карточка
 *     r14 + цветная плитка-иконка 30 r10 (135°, цветная тень) + колонка
 *     (label 9/800 tracking.05em uppercase dimmed / value 13/800 ink1).
 *     Иконки по позиции (рост/вес/группа крови/зрение) — декоративный выбор,
 *     см. заметку в структурированном отчёте.
 *  6. SectionCap «АЛЛЕРГИИ И ОСОБЕННОСТИ» (литерал).
 *  7. AllergiesCard — glass r20: если allergies.length===0 → одна строка
 *     getNoAllergiesText(locale) с зелёной галочкой; иначе — по строке на пару
 *     [название, примечание] с янтарной иконкой-предупреждением; подпись
 *     красится иначе, если распознаётся как врачебная рекомендация
 *     (содержит «Рекомендация»), а не как ограничение по аллергии.
 *  8. SectionCap «ПРИВИВКИ» (литерал).
 *  9. VaccinationsCard — glass r20, getVaccinations(locale): имя + дата слева,
 *     StatusChip справа («Сделана» зелёный / «Запланирована» оранжевый),
 *     hairline-разделители кроме первой строки.
 * 10. SectionCap «МЕДОСМОТРЫ» (литерал).
 * 11. CheckupsCard — glass r20, 3 ЛИТЕРАЛЬНЫЕ строки (нет во фикстурах,
 *     хардкод 1:1 из мокапа): Плановый осмотр / Офтальмолог / Стоматолог —
 *     заключение слева, дата справа.
 * 12. SectionCap «СПРАВКИ» (литерал).
 * 13. CertificatesCard — glass r20, 2 строки (без левой иконки), клик по
 *     каждой → navigation.navigate("d31") (реальный экран «Документы»).
 * 14. InfoBanner — зелёная стеклоплашка (rgba(16,185,129,.1)/.3 border),
 *     иконка shield-check (stroke #047857 / tokens.status.green.text),
 *     литеральный текст про конфиденциальность мед. данных.
 * 15. BottomSheetFrame + ChildPickerSheetContent — шторка выбора ребёнка
 *     (открывается из Блока 2).
 *
 * Данные — только через getChildren/getSelectedChildContext/getMedicalCard/
 * getNoAllergiesText/getVaccinations (../../data). Тексты — d.parentApp.*,
 * литералы мокапа оставлены как есть (прецедент ChildProfileScreen.tsx).
 * Обе темы — useTheme(). iOS safe-area — из InnerHeader.
 *
 * 15.08.2026 (заглушки). Сверху — плашка «данных нет, это пример»: прививки,
 * справки и осмотры выдуманы, медкабинет карту в системе не ведёт. Имя и
 * класс ребёнка в шапке — настоящие.
 */
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
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
  StatusChip,
  type ChildPickerItem,
} from "../../ui";
import {
  getChildren,
  getMedicalCard,
  getNoAllergiesText,
  getSelectedChildContext,
  getVaccinations,
  defaultChildId,
} from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import { LOCALE_TAG } from "@snr/core";
import { fullDate, monthYear } from "../../lib/dateLabels";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { DemoBanner } from "../../ui/notices";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Kebab (3 точки) 16 stroke 2.2 — правый слот шапки (прецедент ChildProfileScreen). */
function KebabIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Circle cx={5} cy={12} r={1} />
      <Circle cx={12} cy={12} r={1} />
      <Circle cx={19} cy={12} r={1} />
    </Svg>
  );
}

/** Шеврон › 14 stroke 2.2 — правый слот кликабельных строк (прецедент ListRow/DocRow). */
function ChevronGlyph({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="m9 18 6-6-6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Галочка (badge-check, ICONS.check) — «Не выявлено» / статус «Сделана». */
function CheckGlyph({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Z" />
      <Path d="m8.5 12 2.5 2.5 5-5" />
    </Svg>
  );
}

/** Треугольник-предупреждение (alert-triangle) — строки раздела «Аллергии». */
function AlertGlyph({ color }: { color: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <Path d="M12 9v4" />
      <Path d="M12 17h.01" />
    </Svg>
  );
}

/** Shield-check (щит с галочкой) — иконка InfoBanner (путь 1:1 из DocumentsScreen SecurityBanner). */
function ShieldCheckGlyph({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" />
      <Path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

/** Круглая/квадратная плашка-подложка под иконку строки (аллергии): tokens.chip(rgb). */
function IconTile({ rgb, children }: { rgb: string; children: ReactNode }) {
  const { tokens } = useTheme();
  const chip = tokens.chip(rgb);
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: chip.bg,
        borderWidth: 1,
        borderColor: chip.border,
      }}
    >
      {children}
    </View>
  );
}

/** Uppercase-заголовок секции 10.5/800 tracking .08em (прецедент ServicesScreen SectionCap). */
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

/**
 * MedRow — универсальная строка списка этого экрана (11.5/800 title +
 * 9.5/600 sub, опциональные left/right/chevron/divider) — отдельный локальный
 * компонент, т.к. типографика мокапа для этого экрана мельче стандартного
 * ListRow (12.5/10.5). Прецедент локальной строки: ChildProfileScreen.InfoRow.
 */
function MedRow({
  left,
  title,
  sub,
  subColor,
  right,
  chevron,
  divider,
  onPress,
}: {
  left?: ReactNode;
  title: string;
  sub?: string;
  subColor?: string;
  right?: ReactNode;
  chevron?: boolean;
  divider: boolean;
  onPress?: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  const chevronColor = scheme === "dark" ? "rgba(255,255,255,0.42)" : "rgba(26,19,74,0.40)";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          paddingVertical: 10,
          borderTopWidth: divider ? 1 : 0,
          borderTopColor: dividerColor,
        },
        pressed && onPress ? { opacity: 0.85 } : null,
      ]}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
          {title}
        </Text>
        {sub ? (
          <Text
            numberOfLines={2}
            style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: subColor ?? tokens.ink2, marginTop: 2 }}
          >
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <ChevronGlyph color={chevronColor} /> : null}
    </Pressable>
  );
}

/** Визуальные метаданные 4 ячеек статистики — позиционно: рост/вес/кровь/зрение. */
const STAT_VISUALS: { gradient: [string, string]; shadowRgb: string; icon: ReactNode }[] = [
  {
    // РОСТ — двойная стрелка вверх/вниз.
    gradient: ["#60a5fa", "#2563eb"],
    shadowRgb: "37,99,235",
    icon: (
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 3v18" />
        <Path d="m8 7 4-4 4 4" />
        <Path d="m8 17 4 4 4-4" />
      </Svg>
    ),
  },
  {
    // ВЕС — гантель.
    gradient: ["#a78bfa", "#7c3aed"],
    shadowRgb: "124,58,237",
    icon: (
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Rect x={2} y={9} width={3.5} height={6} rx={1} />
        <Rect x={18.5} y={9} width={3.5} height={6} rx={1} />
        <Path d="M5.5 12h13" />
      </Svg>
    ),
  },
  {
    // ГРУППА КРОВИ — капля (тот же тон, что и плитка «Медкарта» в ServicesScreen).
    gradient: ["#fb7185", "#e11d48"],
    shadowRgb: "225,29,72",
    icon: (
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="#FFFFFF">
        <Path d="M12 2.7s6 7.1 6 11.3a6 6 0 1 1-12 0c0-4.2 6-11.3 6-11.3Z" />
      </Svg>
    ),
  },
  {
    // ЗРЕНИЕ — глаз.
    gradient: ["#2dd4bf", "#0d9488"],
    shadowRgb: "13,148,136",
    icon: (
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <Circle cx={12} cy={12} r={3} />
      </Svg>
    ),
  },
];

/** Ячейка статистики (Блок 5): glass r14 + цветная плитка 30 r10 + колонка label/value. */
function StatCell({ label, value, visual }: { label: string; value: string; visual: (typeof STAT_VISUALS)[number] }) {
  const { tokens, scheme } = useTheme();
  const plaqueShadow =
    scheme === "dark" ? tokens.shColor(visual.shadowRgb) : { x: 0, y: 6, blur: 12, color: `rgba(${visual.shadowRgb},0.3)` };
  return (
    <GlassCard radius={14} contentStyle={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 10 }}>
      <LinearGradient
        colors={visual.gradient}
        {...gradPoints(135)}
        style={[
          { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
          shadowStyle(plaqueShadow),
        ]}
      >
        {visual.icon}
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope800, fontSize: 9, letterSpacing: 9 * 0.05, textTransform: "uppercase", color: tokens.ink3 }}
        >
          {label}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
          {value}
        </Text>
      </View>
    </GlassCard>
  );
}

export default function MedicalCardScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const localeTag = LOCALE_TAG[locale];
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const session = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string | undefined>(
    () => session.currentChildId ?? defaultChildId() ?? undefined,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const ctx = getSelectedChildContext(childId);
  // Экран закрыт demoOr — его видит ТОЛЬКО демо-гость, а у него ребёнок есть
  // всегда: настоящий из демо-школы, а при пустом списке — фикстурный
  // (см. DEMO_SHOWCASE в data/index.ts). Поэтому утверждение безопасно, и
  // витрина остаётся ровно прежней.
  const child = ctx.child!;
  const card = getMedicalCard(locale, childId);
  const noAllergies = getNoAllergiesText(locale);
  const vaccinations = getVaccinations(locale);

  const heroGradient = child.avatar_gradient;
  const heroShadowColor = `${heroGradient[1]}55`;

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

  const goProfMenu = () => navigation.navigate("stub", { stubKey: "profmenu" });
  const goDocs = () => navigation.navigate("d31");

  // Текст InfoBanner (Блок 14) — прецедент LimitsScreen.bannerText / мокап light=rgba(26,19,74,.7).
  const bannerText = scheme === "light" ? "rgba(26,19,74,0.7)" : "rgba(255,255,255,0.78)";
  const green = tokens.status.green;
  const orange = tokens.status.orange;

  return (
    <AppBackground>
      {/* Блок 1: HeaderBar. */}
      <InnerHeader
        title={t.svc.medcard}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={goProfMenu}>
            <KebabIcon color={tokens.ink1} />
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
        {/* Плашка «это пример» — раздела ещё нет в базе школы. */}
        <DemoBanner text={d.parentApp.soon.sections.medcard} />

        {/* Блок 2: ChildSwitcherCard compact — открывает шторку выбора ребёнка. */}
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

        {/* Блок 3: HeroCard — градиент child.avatar_gradient, аватар 50 + пилюля «Здоров». */}
        <View
          style={[
            { position: "relative", borderRadius: 22, overflow: "hidden", padding: 14 },
            shadowStyle({ x: 0, y: 16, blur: 36, color: heroShadowColor }),
          ]}
        >
          <LinearGradient colors={heroGradient} {...gradPoints(135)} style={StyleSheet.absoluteFill} />
          {/* inset-блик 0 1.5 0 W35 — верхняя hairline-полоска. */}
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,0.35)" }} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.22)",
                borderWidth: 2,
                borderColor: "rgba(255,255,255,0.6)",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 17, color: "#FFFFFF" }}>
                {child.first_name.slice(0, 1)}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 3, paddingRight: 62 }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                {child.full_name}
              </Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.85)" }}>
                {`${child.class_name} ${t.grades.class} · SNR International School`}
              </Text>
            </View>
          </View>

          {/* Пилюля «Здоров» — правый верхний угол карточки (литерал). */}
          <View
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingVertical: 3,
              paddingHorizontal: 8,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.22)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.4)",
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" }} />
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: "#FFFFFF" }}>Здоров</Text>
          </View>
        </View>

        {/* Блок 4: SectionCap «ОСНОВНЫЕ ПОКАЗАТЕЛИ». */}
        <SectionCap>ОСНОВНЫЕ ПОКАЗАТЕЛИ</SectionCap>

        {/* Блок 5: StatsGrid 2×2. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5, rowGap: 9 }}>
          {card.stats.map((pair, i) => (
            <View key={pair[0]} style={{ width: "50%", paddingHorizontal: 4.5 }}>
              <StatCell label={pair[0]} value={pair[1]} visual={STAT_VISUALS[i] ?? STAT_VISUALS[0]} />
            </View>
          ))}
        </View>

        {/* Блок 6: SectionCap «АЛЛЕРГИИ И ОСОБЕННОСТИ». */}
        <SectionCap>АЛЛЕРГИИ И ОСОБЕННОСТИ</SectionCap>

        {/* Блок 7: AllergiesCard. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {card.allergies.length === 0 ? (
            <MedRow
              left={
                <IconTile rgb={green.rgb}>
                  <CheckGlyph color={green.text} />
                </IconTile>
              }
              title={noAllergies.title}
              sub={noAllergies.sub}
              divider={false}
            />
          ) : (
            card.allergies.map(([name, note], i) => {
              // Признак «рекомендация врача» vs «ограничение по аллергии» —
              // декоративный выбор цвета подписи (см. отчёт), сама амбер-иконка
              // одинакова для всех строк раздела.
              const isRecommendation = note.toLowerCase().includes("рекомендация");
              return (
                <MedRow
                  key={name}
                  left={
                    <IconTile rgb={orange.rgb}>
                      <AlertGlyph color={orange.text} />
                    </IconTile>
                  }
                  title={name}
                  sub={note}
                  subColor={isRecommendation ? tokens.ink2 : orange.text}
                  divider={i > 0}
                />
              );
            })
          )}
        </GlassCard>

        {/* Блок 8: SectionCap «ПРИВИВКИ». */}
        <SectionCap>ПРИВИВКИ</SectionCap>

        {/* Блок 9: VaccinationsCard. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {vaccinations.map((v, i) => (
            <MedRow
              key={v.name}
              title={v.name}
              sub={v.date ? fullDate(v.date, localeTag) : v.month ? monthYear(v.month, localeTag) : ""}
              divider={i > 0}
              right={
                v.status === "ok" ? (
                  <StatusChip label="Сделана" family="green" />
                ) : (
                  <StatusChip label="Запланирована" family="orange" />
                )
              }
            />
          ))}
        </GlassCard>

        {/* Блок 10: SectionCap «МЕДОСМОТРЫ». */}
        <SectionCap>МЕДОСМОТРЫ</SectionCap>

        {/* Блок 11: CheckupsCard — 3 литеральные строки (мокап 1:1, нет во фикстурах). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          <MedRow
            title="Плановый осмотр"
            sub="Заключение: здоров(а), допущен(а) к занятиям"
            divider={false}
            right={
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>15 мая 2026</Text>
            }
          />
          <MedRow
            title="Офтальмолог"
            sub="Заключение: рекомендованы очки для чтения"
            divider
            right={
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>12 фев 2026</Text>
            }
          />
          <MedRow
            title="Стоматолог"
            sub="Заключение: санация проведена"
            divider
            right={
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>20 окт 2025</Text>
            }
          />
        </GlassCard>

        {/* Блок 12: SectionCap «СПРАВКИ». */}
        <SectionCap>СПРАВКИ</SectionCap>

        {/* Блок 13: CertificatesCard — обе строки → d31 (Документы). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          <MedRow
            title="Медицинская справка 086/у"
            sub="Хранится в разделе «Документы»"
            divider={false}
            chevron
            onPress={goDocs}
          />
          <MedRow
            title="Справка о прививках 063"
            sub="Хранится в разделе «Документы»"
            divider
            chevron
            onPress={goDocs}
          />
        </GlassCard>

        {/* Блок 14: InfoBanner — конфиденциальность мед. данных. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 18,
            backgroundColor: `rgba(${green.rgb},0.10)`,
            borderWidth: 1,
            borderColor: `rgba(${green.rgb},0.30)`,
          }}
        >
          <View style={{ paddingTop: 1 }}>
            <ShieldCheckGlyph color={green.text} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 10 * 1.55, color: bannerText }}>
            Медицинские данные конфиденциальны: их видят только вы и школьный врач. Учителям доступны лишь аллергии,
            критичные для безопасности.
          </Text>
        </View>
      </ScrollView>

      {/* Блок 15: Шторка выбора ребёнка. */}
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

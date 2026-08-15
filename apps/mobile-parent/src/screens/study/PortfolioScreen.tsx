/**
 * Экран dport «Портфолио» — REBUILD (заход 8, block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», строки 1589–1630:
 *  1590–1594  HeaderBar: back-glass 38 + title t.svc.portfolio (Unbounded 15/600)
 *             + right help-glass-circle 38 (иконка «3 линии» 16 stroke 1.8,
 *             как на «Тесты») → stub «help».
 *  1596       ChildSwitcherCard compact: аватар 44 + ФИО + «{class} класс ⌄»;
 *             клик открывает шторку выбора ребёнка (BottomSheetFrame +
 *             ChildPickerSheetContent — паттерн 1:1 из ChildProfileScreen.tsx).
 *  1597–1606  HeroCard (portCardSt): непрозрачный градиент child.avatar_gradient
 *             135°, r22, padding 14, box-shadow 0 16 36 {g2}55 + inset-блик
 *             0 1.5 0 W35 (та же визуальная грамматика, что и card29St в
 *             ChildProfileScreen.tsx, НО без декоративных звёздочек — в макете
 *             их на этом hero нет). Аватар 50 (rgba W22, border 2px W60,
 *             инициал 16/800 белый) + 3-колоночный сплит-ряд статистики
 *             (РАБОТ / ДОСТИЖЕНИЙ / СР. ОЦЕНКА), разделители 1px W25,
 *             лейбл 8/800 tracking .06em W75, значение 14/800 белый.
 *             Значения — вычисляемые (works.length / achievements.length /
 *             средняя оценка работ, округлённая до 1 знака), а не хардкод
 *             макета «6/5/4.7» (правило data-layer: «не хардкодится»).
 *  1607       TabsRow: 3 pill-таба «Работы»/«Достижения»/«Сертификаты» —
 *             активный градиент 135° #7c3aed→#4f6df5 (тень 0 8 18
 *             rgba(124,58,237,.35)), неактивный glass 160° W60→W40 + border W75
 *             (helper gt(), макет строка 3835 — идентичен TabsRow ChildProfileScreen.tsx).
 *  1608–1614  Таб «Работы» (по умолчанию): grid 2 колонки gap 9, 4 карточки —
 *             glass r18 (cover-градиент предмета 74/r13 + звезда белая .85 +
 *             круглый грейд-бейдж 22/r8 rgba(255,255,255,.9)), имя 10.5/800
 *             numberOfLines 2, нижний ряд: чип предмета (2×7, r999, 8/800,
 *             цвета SUBJECTS[key]) + дата 8.5/700 dimmed справа. Клик → da3.
 *  1615–1621  Таб «Достижения»: 1 glass r20 карточка, 4 строки (hairline-
 *             разделители кроме первой) — круглая 36 градиент-иконка (звезда
 *             ICONS.star, белая), имя 11.5/800 + подзаголовок 9.5/600 dimmed,
 *             дата 9/700 dimmed справа.
 *  1622–1628  Таб «Сертификаты»: 1 glass r20 карточка, 4 строки (те же
 *             hairline-разделители) — имя 11.5/800 + «{org} · {date}»
 *             9.5/600 dimmed, круглая 30×30 фиолетовая download-кнопка
 *             (rgba(139,92,246,.14)/border rgba(139,92,246,.35), стрелка
 *             #6d28d9 — литеральные цвета в обеих темах, установленный
 *             паттерн, см. ReceiptsScreen.tsx) → stub «file».
 *
 * Данные — getPortfolio() (works/achievements/certificates, по 4 каждая,
 * плоские списки без привязки к ребёнку — так задано фикстурой). Ребёнок —
 * getChildren() + getSelectedChildContext(childId). Тексты — d.parentApp.*;
 * литералы, которых нет в словаре (подписи статистики, названия табов,
 * «Здоров»-подобные надписи здесь отсутствуют) оставлены как в макете.
 * Обе темы — useTheme(). iOS safe-area — из InnerHeader.
 *
 * Стартовый таб — необязательный route-параметр initialTab (передаётся,
 * например, из ChildProfileScreen «Достижения»); читается защитно на случай,
 * если общий тип MainStackParamList["dport"] ещё не обновлён параллельным
 * процессом (на момент написания — уже обновлён, но код остаётся защитным).
 *
 * 15.08.2026 (заглушки). Сверху — плашка «данных нет, это пример»: работ,
 * достижений и сертификатов в базе школы нет. Имя и класс ребёнка —
 * настоящие, оценки и навыки живут в разделе «Успехи».
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
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
import { getChildren, getPortfolio, getSelectedChildContext, getSubject } from "../../data";
import type { AchievementRow, CertificateRow, PortfolioWorkRow } from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { ICONS } from "../../navigation/routes";
import { DemoBanner } from "../../ui/notices";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** «#ca8a04» → «202,138,4» — для цветной тени плитки предмета (см. TeacherProfileScreen.tsx). */
function hexToRgbCsv(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Иконка «справка» — 3 убывающие линии 16 stroke 1.8 (макет строка 1593, как на «Тесты»). */
function HelpIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18" />
      <Path d="M7 12h10" />
      <Path d="M10 18h4" />
    </Svg>
  );
}

/** Звезда (ICONS.star) — залив, используется и на cover работы, и в иконке достижения. */
function StarGlyph({ size, opacity = 1 }: { size: number; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" opacity={opacity}>
      <Path d={ICONS.star[0]} />
    </Svg>
  );
}

/** Стрелка загрузки 12 stroke 2 — download-кнопка сертификата (макет строка 1625). */
function DownloadIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3v12" />
      <Path d="m7 10 5 5 5-5" />
      <Path d="M5 21h14" />
    </Svg>
  );
}

/** Чип предмета в карточке работы (макет w.chip, строка 4060): 2×7, r999, 8/800. */
function SubjectPill({ subjectId }: { subjectId: PortfolioWorkRow["subject_id"] }) {
  const sb = getSubject(subjectId);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingVertical: 2,
        paddingHorizontal: 7,
        borderRadius: 999,
        backgroundColor: sb.chip_bg,
        borderWidth: 1,
        borderColor: sb.chip_border,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, color: sb.text_color }}>
        {sb.name.split(" ")[0]}
      </Text>
    </View>
  );
}

/** Карточка работы портфолио (grid 2 кол., макет строки 1610–1611, 4051–4062). */
function WorkCard({ work, onPress }: { work: PortfolioWorkRow; onPress: () => void }) {
  const { tokens, scheme } = useTheme();
  const sb = getSubject(work.subject_id);
  const rgbCsv = hexToRgbCsv(sb.color);
  const coverShadow =
    scheme === "dark" ? tokens.shColor(rgbCsv) : { x: 0, y: 6, blur: 14, color: `rgba(${rgbCsv},0.27)` };

  return (
    <GlassCard
      radius={18}
      onPress={onPress}
      contentStyle={{ padding: 10, gap: 6 }}
    >
      <View
        style={[
          {
            height: 74,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          },
          shadowStyle(coverShadow),
        ]}
      >
        <LinearGradient colors={sb.gradient} {...gradPoints(135)} style={StyleSheet.absoluteFill} />
        <StarGlyph size={26} opacity={0.85} />
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 22,
            height: 22,
            borderRadius: 8,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.9)",
          }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: sb.text_color }}>
            {String(work.grade)}
          </Text>
        </View>
      </View>
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.manrope800, fontSize: 10.5, lineHeight: 10.5 * 1.3, color: tokens.ink1 }}
      >
        {work.name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <SubjectPill subjectId={work.subject_id} />
        <Text style={{ fontFamily: fonts.manrope700, fontSize: 8.5, color: scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)" }}>
          {work.date_label}
        </Text>
      </View>
    </GlassCard>
  );
}

/** Строка достижения (макет строки 1617–1618, 4063–4067). */
function AchievementListRow({ item, divider }: { item: AchievementRow; divider: boolean }) {
  const { tokens, scheme } = useTheme();
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  const rgbCsv = hexToRgbCsv(item.gradient[1]);
  const iconShadow = scheme === "dark" ? tokens.shColor(rgbCsv) : { x: 0, y: 6, blur: 12, color: `rgba(${rgbCsv},0.27)` };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: dividerColor,
      }}
    >
      <LinearGradient
        colors={item.gradient}
        {...gradPoints(135)}
        style={[
          { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
          shadowStyle(iconShadow),
        ]}
      >
        <StarGlyph size={15} />
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
          {item.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.62)" }}
        >
          {item.subtitle}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.manrope700, fontSize: 9, color: scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)" }}
      >
        {item.date_label}
      </Text>
    </View>
  );
}

/** Строка сертификата (макет строки 1624–1625, 4069–4073). */
function CertificateListRow({
  item,
  divider,
  onDownload,
}: {
  item: CertificateRow;
  divider: boolean;
  onDownload: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 10,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: dividerColor,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
          {item.name}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: scheme === "light" ? "rgba(26,19,74,0.6)" : "rgba(255,255,255,0.62)" }}
        >
          {`${item.org} · ${item.date_label}`}
        </Text>
      </View>
      <Pressable
        onPress={onDownload}
        hitSlop={6}
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(139,92,246,0.14)",
          borderWidth: 1,
          borderColor: "rgba(139,92,246,0.35)",
        }}
      >
        <DownloadIcon color="#6d28d9" />
      </Pressable>
    </View>
  );
}

type PortfolioTabKey = "works" | "ach" | "cert";

export default function PortfolioScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, "dport">>();
  const session = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(
    () => session.currentChildId ?? children[0].id,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;

  const initialTab: PortfolioTabKey =
    (route.params as { initialTab?: PortfolioTabKey } | undefined)?.initialTab ?? "works";
  const [activeTab, setActiveTab] = useState<PortfolioTabKey>(initialTab);

  const portfolio = getPortfolio();
  const avgGrade = portfolio.works.length
    ? portfolio.works.reduce((sum, w) => sum + w.grade, 0) / portfolio.works.length
    : 0;

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

  const heroGradient = child.avatar_gradient;
  const heroShadowColor = `${heroGradient[1]}55`;

  const goHelp = () => navigation.navigate("stub", { stubKey: "help" });
  const goFile = () => navigation.navigate("stub", { stubKey: "file" });
  const goWork = () => navigation.navigate("da3");

  const tabs: { key: PortfolioTabKey; label: string }[] = [
    { key: "works", label: "Работы" },
    { key: "ach", label: "Достижения" },
    { key: "cert", label: "Сертификаты" },
  ];

  return (
    <AppBackground>
      {/* Блок 1: Header (back + title + help). */}
      <InnerHeader
        title={t.svc.portfolio}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={goHelp}>
            <HelpIcon color={tokens.ink1} />
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
        <DemoBanner text={d.parentApp.soon.sections.portfolio} />

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

        {/* Блок 3: HeroCard — градиент child.avatar_gradient + 3-колоночная статистика. */}
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 22,
              overflow: "hidden",
            },
            shadowStyle({ x: 0, y: 16, blur: 36, color: heroShadowColor }),
          ]}
        >
          <LinearGradient colors={heroGradient} {...gradPoints(135)} style={StyleSheet.absoluteFill} />
          {/* inset-блик 0 1.5 0 W35 — верхняя hairline-полоска. */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: "rgba(255,255,255,0.35)",
            }}
          />
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              flexShrink: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.22)",
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.6)",
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 16, color: "#FFFFFF" }}>
              {child.first_name.slice(0, 1)}
            </Text>
          </View>

          <View style={{ flex: 1, flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, color: "rgba(255,255,255,0.75)" }}>
                РАБОТ
              </Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                {portfolio.works.length}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, color: "rgba(255,255,255,0.75)" }}>
                ДОСТИЖЕНИЙ
              </Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                {portfolio.achievements.length}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.25)" }} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, letterSpacing: 8 * 0.06, color: "rgba(255,255,255,0.75)" }}>
                СР. ОЦЕНКА
              </Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                {avgGrade.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Блок 4: TabsRow — 3 pill-таба. */}
        <View style={{ flexDirection: "row", gap: 7 }}>
          {tabs.map((tab) => {
            const isActive = tab.key === activeTab;
            if (isActive) {
              return (
                <View
                  key={tab.key}
                  style={[
                    { flex: 1, borderRadius: 999, overflow: "hidden" },
                    shadowStyle({ x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.35)" }),
                  ]}
                >
                  <LinearGradient colors={["#7C3AED", "#4F6DF5"]} {...gradPoints(135)} style={{ paddingVertical: 9, alignItems: "center" }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: "#FFFFFF" }}>
                      {tab.label}
                    </Text>
                  </LinearGradient>
                </View>
              );
            }
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  paddingVertical: 9,
                  alignItems: "center",
                  backgroundColor: scheme === "light" ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: scheme === "light" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.14)",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.manrope700, fontSize: 11.5, color: scheme === "light" ? "rgba(26,19,74,0.66)" : "rgba(255,255,255,0.7)" }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Блок 5: Таб «Работы» — grid 2×2. */}
        {activeTab === "works" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4.5, rowGap: 9 }}>
            {portfolio.works.map((w, i) => (
              <View key={i} style={{ width: "50%", paddingHorizontal: 4.5 }}>
                <WorkCard work={w} onPress={goWork} />
              </View>
            ))}
          </View>
        ) : null}

        {/* Блок 6: Таб «Достижения» — 1 glass-карточка со списком. */}
        {activeTab === "ach" ? (
          <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
            {portfolio.achievements.map((a, i) => (
              <AchievementListRow key={i} item={a} divider={i > 0} />
            ))}
          </GlassCard>
        ) : null}

        {/* Блок 7: Таб «Сертификаты» — 1 glass-карточка со списком. */}
        {activeTab === "cert" ? (
          <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
            {portfolio.certificates.map((c, i) => (
              <CertificateListRow key={i} item={c} divider={i > 0} onDownload={goFile} />
            ))}
          </GlassCard>
        ) : null}
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

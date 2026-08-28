/**
 * Экран «Заявления» — маршрут `dapps` (REBUILD, block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», блок `layerDApps`
 * (строки ~1632–1642):
 *
 *  1. HeaderBar (InnerHeader) — back-glass 38 + заголовок «Заявления»
 *     (t.svc.applications), БЕЗ правого слота (в макете нет второй иконки
 *     у этого экрана).
 *  2. Scroll-контейнер: gap 11, padding-top 4, padding-horizontal 18,
 *     padding-bottom 168 (буквальное значение из style контейнера
 *     макета «padding:4px 18px 168px» — не общий 118, экран явно задаёт
 *     больший запас под floating-кнопку).
 *  3. ChildSwitcherCard compact — стандартный ряд «аватар 44 + ФИО +
 *     класс ⌄ + Сменить ›» под шапкой (паттерн из ChildProfileScreen.tsx,
 *     Блок 2); открывает шторку выбора ребёнка снизу.
 *  4. FilterTabsRow — 4 пилюли-таба горизонтальным скроллом (gap 6):
 *     «Все» / «На рассмотрении» / «Одобрено» / «Отклонено» (apAll/apRev/
 *     apOk/apNo). Активная — accent-градиент 135° tokens.accentGrad,
 *     белый 800, тень 0 8 18 rgba(124,58,237,.35) (стиль gt() макета,
 *     JS-строка 3835); неактивная — плоское стекло (тот же паттерн, что
 *     inactive-таб ChildProfileScreen.tsx: rgba(255,255,255,.55/.08) +
 *     border .75/.14). ПРИМЕЧАНИЕ (деталь макета): исходные inline-стили
 *     apTabAll/apTabRev/apTabOk/apTabNo в dc.html строятся через
 *     `Object.assign({...явный padding/whiteSpace...}, gt(active))` —
 *     из-за порядка ключей JS-объекта паддинг из gt() («9px 0») в итоге
 *     перекрывает явно указанный «9px 12px» для 3 из 4 пилюль, а у
 *     «Все» паддинга нет вовсе. Это несогласованность самого макета;
 *     реализовано единообразно — паддинг 9×12 у всех 4 пилюль (ближайший
 *     цельный эквивалент, см. поле deviations).
 *  5. Список заявлений (getApplications(locale), отфильтрован по activeFilter):
 *     каждая строка — ОТДЕЛЬНАЯ glass-карточка r18 (не общий список с
 *     разделителями): слева — плитка 36×36 r12 (row.gradient, 135°) с
 *     doc-глифом (ICONS.doc); по центру — name (12/800) + number_label
 *     (9.5/700, ink2) + «Подано {date_label}» (9.5/600, ink2) +
 *     ready_label (9.5/700, status.green.text) — последняя строка ТОЛЬКО
 *     когда status==="ok" && ready_label задан; справа — StatusChip
 *     (rev→orange «На рассмотрении», ok→green «Одобрено», no→red
 *     «Отклонено»). Тап по строке → da4 (детали заявления).
 *  6. FloatingCTA «Новое заявление» — position:absolute (left/right 16,
 *     bottom 96, zIndex 30), accent-градиент 135° + inset-hairline-блик,
 *     плюс-иконка 16 (ICONS.plus), тень 0 14 32 rgba(124,58,237,.45) —
 *     переиспользован PrimaryButton (тот же паттерн, что «Добавить
 *     документ» в DocumentsScreen.tsx) со style-оверрайдом абсолютного
 *     позиционирования. Тап → da5 (форма нового заявления).
 *  7. Шторка выбора ребёнка (BottomSheetFrame + ChildPickerSheetContent) —
 *     переиспользован паттерн ChildProfileScreen.tsx 1:1.
 *
 * Данные — ТОЛЬКО через getApplications(locale)/getChildren()/
 * getSelectedChildContext() из "../../data" (фикстуры уже готовы, не
 * трогаются). Тексты экрана берутся из d.parentApp.* там, где ключ есть
 * (заголовок, класс, «Сменить ›» через switchLabel-конвенцию); статусы
 * фильтров/чипов и текст «Подано …» в макете — литеральные русские
 * строки без {{t.xxx}}-биндинга → оставлены как литералы (прецедент
 * ChildProfileScreen.tsx: «Школа», «Телефон» и т.п.). Обе темы — useTheme().
 *
 * 15.08.2026 (заглушки). Сверху — плашка «данных нет, это пример»: заявлений
 * школа через приложение не принимает, список собран из фикстуры.
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
  InnerHeader,
  PrimaryButton,
  StatusChip,
  type ChildPickerItem,
  type StatusFamily,
} from "../../ui";
import {
  getApplications,
  getChildren,
  getSelectedChildContext,
  type ApplicationRow,
  type ApplicationStatus,
  defaultChildId,
} from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import { LOCALE_TAG } from "@snr/core";
import { dayMonth } from "../../lib/dateLabels";
import { ICONS } from "../../navigation/routes";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { DemoBanner } from "../../ui/notices";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Ключи фильтра табов (макет: apF state «all»/«rev»/«ok»/«no»). */
type FilterKey = "all" | ApplicationStatus;

/** Русские подписи фильтров — литеральные в макете (apAll/apRev/apOk/apNo). */
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "rev", label: "На рассмотрении" },
  { key: "ok", label: "Одобрено" },
  { key: "no", label: "Отклонено" },
];

/** Маппинг статус → семья StatusChip + русский лейбл (литерал макета). */
const STATUS_META: Record<ApplicationStatus, { family: StatusFamily; label: string }> = {
  rev: { family: "orange", label: "На рассмотрении" },
  ok: { family: "green", label: "Одобрено" },
  no: { family: "red", label: "Отклонено" },
};

/** Утилита: hex → «r,g,b» для rgba()-теней (тот же приём, что DocumentsScreen.tsx). */
function hexToRgb(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r},${g},${b}`;
}

/**
 * Блок 4: FilterTabsRow — горизонтально-скроллируемый ряд пилюль-фильтров
 * gt()-стиля (см. header-комментарий про несогласованность паддинга
 * apTab* в исходном dc.html — реализовано единообразным паддингом 9×12).
 */
function FilterTabsRow({
  activeKey,
  onChange,
}: {
  activeKey: FilterKey;
  onChange: (key: FilterKey) => void;
}) {
  const { tokens, scheme } = useTheme();
  const inactiveTextColor = scheme === "light" ? "rgba(26,19,74,0.66)" : "rgba(255,255,255,0.7)";
  const inactiveBg = scheme === "light" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.08)";
  const inactiveBorder = scheme === "light" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.14)";

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: "row", gap: 6, paddingBottom: 2 }}
    >
      {FILTERS.map((item) => {
        const active = item.key === activeKey;
        if (active) {
          return (
            <View
              key={item.key}
              style={[
                shadowStyle({ x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.35)" }),
                { borderRadius: 999 },
              ]}
            >
              <LinearGradient
                colors={tokens.accentGrad.colors as [string, string]}
                {...gradPoints(tokens.accentGrad.angle)}
                style={{ paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999 }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: "#FFFFFF" }}
                >
                  {item.label}
                </Text>
              </LinearGradient>
            </View>
          );
        }
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={{
              paddingVertical: 9,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: inactiveBg,
              borderWidth: 1,
              borderColor: inactiveBorder,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: inactiveTextColor }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * Блок 5 (одна строка списка): отдельная glass-карточка r18 — плитка +
 * name/number/date(+ready_label) + StatusChip. Тап → da4.
 */
function ApplicationCard({ row, onPress }: { row: ApplicationRow; onPress: () => void }) {
  const { tokens } = useTheme();
  const { locale } = useAppLocale();
  const localeTag = LOCALE_TAG[locale];
  const iconRgb = hexToRgb(row.gradient[0]);
  const meta = STATUS_META[row.status];
  const showReady = row.status === "ok" && !!row.ready_from;

  return (
    <GlassCard
      radius={18}
      onPress={onPress}
      contentStyle={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 12,
        paddingHorizontal: 14,
      }}
    >
      <LinearGradient
        colors={row.gradient as [string, string]}
        {...gradPoints(135)}
        style={[
          {
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          },
          shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${iconRgb},0.30)` }),
        ]}
      >
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONS.doc.map((p, i) => (
            <Path key={i} d={p} />
          ))}
        </Svg>
      </LinearGradient>

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
          {row.name}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink2 }}>
          {row.number_label}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2 }}>
          {`Подано ${dayMonth(row.date, localeTag)}`}
        </Text>
        {showReady ? (
          <Text
            numberOfLines={2}
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 9.5,
              color: tokens.status.green.text,
              marginTop: 1,
            }}
          >
            {`Готово к получению с ${dayMonth(row.ready_from as string, localeTag)}`}
          </Text>
        ) : null}
      </View>

      <StatusChip label={meta.label} family={meta.family} />
    </GlassCard>
  );
}

export default function ApplicationsScreen() {
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const session = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string | undefined>(
    () => session.currentChildId ?? defaultChildId() ?? undefined,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const ctx = getSelectedChildContext(childId);
  // Экран закрыт demoOr — его видит ТОЛЬКО демо-гость, а у него ребёнок есть
  // всегда: настоящий из демо-школы, а при пустом списке — фикстурный
  // (см. DEMO_SHOWCASE в data/index.ts). Поэтому утверждение безопасно, и
  // витрина остаётся ровно прежней.
  const child = ctx.child!;

  const rows = getApplications(locale).filter(
    (r) => activeFilter === "all" || r.status === activeFilter,
  );

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

  const openAppDetail = () => navigation.navigate("da4");
  const openNewAppSheet = () => navigation.navigate("da5");

  return (
    <AppBackground>
      {/* Блок 1: Header (back + title, без правого слота). */}
      <InnerHeader title={t.svc.applications} onBackPress={() => navigation.goBack()} />

      {/* Блок 2: Scroll-контейнер (paddingBottom 168 — литеральное значение макета). */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 168,
          gap: 11,
        }}
      >
        {/* Плашка «это пример» — раздела ещё нет в базе школы. */}
        <DemoBanner text={t.soon.sections.applications} />

        {/* Блок 3: ChildSwitcherCard compact — открывает шторку выбора ребёнка. */}
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

        {/* Блок 4: FilterTabsRow. */}
        <FilterTabsRow activeKey={activeFilter} onChange={setActiveFilter} />

        {/* Блок 5: список заявлений (отфильтрованный). */}
        {rows.map((row, i) => (
          <ApplicationCard key={`${row.number_label}-${i}`} row={row} onPress={openAppDetail} />
        ))}
      </ScrollView>

      {/* Блок 6: FloatingCTA «Новое заявление». */}
      <PrimaryButton
        label="Новое заявление"
        onPress={openNewAppSheet}
        style={{ position: "absolute", left: 16, right: 16, bottom: 96, zIndex: 30 }}
        icon={
          <Svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.2}
            strokeLinecap="round"
          >
            {ICONS.plus.map((p, i) => (
              <Path key={i} d={p} />
            ))}
          </Svg>
        }
      />

      {/* Блок 7: Шторка выбора ребёнка (паттерн ChildProfileScreen.tsx 1:1). */}
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

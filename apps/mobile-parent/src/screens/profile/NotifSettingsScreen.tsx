/**
 * Экран d32 «Настройки уведомлений» — Заход 7, REBUILD block-by-block
 * из макета «SNR EduOS v2 Light.dc.html», строки 1275–1294.
 *
 * BLOCK-LIST (сверху вниз, строго по макету):
 *   1276–1279 InnerHeader (glass-back + Unbounded 15 title)
 *   1280       ScrollView (gap 12, padding 4 18 118)
 *   1281–1285 GlassCard «Разрешить уведомления» (мастер-тумблер) —
 *              иконка-колокольчик 38×38 в градиенте #7c3aed→#4f6df5,
 *              заголовок 12.5/800, подпись 9.5/600, Toggle справа
 *   1286       SectionCap «УВЕДОМЛЕНИЯ» (10.5/800 letterSpacing .08em)
 *   1287–1291 GlassCard-список из 9 строк (grades/hw/sched/att/ann/events/
 *              pay/msg/promo), каждая — иконка 36×36 с category-градиентом,
 *              имя + подпись, Toggle справа; row divider = top-border у
 *              всех, кроме первой.
 *
 * КРИТИЧНО (правки заказчика, Заход 7):
 *  • подпись строки «Посещаемость» НЕ содержит слова «опоздания» —
 *    здесь используется формулировка «Отметки о приходе и уходе»
 *    (переопределяет фикстурное «Уведомления о пропусках уроков»,
 *    также без «опозданий», но заказчик явно попросил позитивную
 *    формулировку);
 *  • мастер-тумблер сверху при OFF отключает и визуально гасит все
 *    9 строк (`disabled` + фактическое значение false в UI);
 *  • persist состояний — session-only (React useState), backend-persist
 *    оставлен на этап данных (Supabase-миграция таблицы notification_prefs).
 *
 * Данные — только через getNotificationCategories() из фикстур. Обе темы
 * через useTheme(); iOS safe-area — из InnerHeader; нижний отступ 118 под
 * FloatingTabBar (хотя экран — стек, а не таб, — держим единый вертикальный
 * ритм с соседями Захода 6/7).
 */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCard, InnerHeader, Toggle } from "../../ui";
import { SoonNote } from "../../ui/notices";
import { getNotificationCategories } from "../../data";
import type { NotificationCategoryRow } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/**
 * Пере­определения подписей категорий (Заход 7, правка заказчика).
 * Ключ = category.id, значение = новая подпись. Всё, чего нет в этой
 * мапе, отображается из фикстуры как есть.
 *
 * `att` заменён по прямому требованию: подпись строки «Посещаемость»
 * должна нести смысл «приход/уход», без «пропуски» и без «опоздания».
 */
const SUBTITLE_OVERRIDES: Record<string, string> = {
  att: "Отметки о приходе и уходе",
};

/** Круг 38×38 (мастер) или 36×36 (строка) с градиентом и белыми path'ами. */
function CategoryIcon({
  size,
  gradient,
  paths,
  strokeWidth = 1.8,
  glyphSize,
}: {
  size: 36 | 38;
  gradient: [string, string];
  paths: string[];
  strokeWidth?: number;
  glyphSize?: number;
}) {
  const g = gradPoints(135);
  // Тень «0 6 12 g[1]xx» — hex-α 44/38 близко к макетным .3–.35.
  const shadow = { x: 0, y: 6, blur: 12, color: `${gradient[1]}44` };
  const glyph = glyphSize ?? (size === 38 ? 16 : 15);
  return (
    <View style={[shadowStyle(shadow), { borderRadius: 12 }]}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LinearGradient
          colors={gradient}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
        <Svg
          width={glyph}
          height={glyph}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths.map((d, i) => (
            <Path key={i} d={d} />
          ))}
        </Svg>
      </View>
    </View>
  );
}

/** Секционный хедер uppercase 10.5/800 letterSpacing .08em ink3
 *  (макет строка 1286 — тот же стиль, что в ntHdr). */
function SectionCap({ label }: { label: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        color: tokens.ink3,
      }}
    >
      {label}
    </Text>
  );
}

/** Одна строка категории (макет строка 1289): иконка + текст + Toggle. */
function NotifSettingsRow({
  row,
  value,
  onChange,
  disabled,
  divider,
}: {
  row: NotificationCategoryRow;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled: boolean;
  divider: boolean;
}) {
  const { tokens, scheme } = useTheme();
  const divColor = scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.07)";
  const sub = SUBTITLE_OVERRIDES[row.id] ?? row.subtitle;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 11,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: divColor,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <CategoryIcon
        size={36}
        gradient={row.gradient as [string, string]}
        paths={row.icon_paths}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}
        >
          {row.name}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 9.5,
            color: tokens.ink2,
            marginTop: 2,
          }}
        >
          {sub}
        </Text>
      </View>
      <Toggle value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

export default function NotifSettingsScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const { categories, master_default } = useMemo(() => getNotificationCategories(), []);

  // Мастер-тумблер (строка 1284). При OFF — все 9 строк disabled+false в UI.
  const [master, setMaster] = useState<boolean>(master_default);

  // Session-state значений по категориям. Persist-в-backend — этап данных
  // (Supabase таблица notification_prefs), сигнатура читалки сохранится.
  const [values, setValues] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of categories) init[c.id] = c.enabled_by_default;
    return init;
  });

  // 15.08.2026 (заглушки). Тумблеры переключаются, но сохранять их некуда:
  // push-уведомления к приложению не подключены, таблицы настроек в базе нет.
  // Молча «запоминать» настройку до первой перезагрузки — обман; при первой
  // же правке экран говорит, что значение не сохранится.
  const [notSaved, setNotSaved] = useState(false);

  const setOne = (id: string, next: boolean) => {
    setNotSaved(true);
    setValues((prev) => ({ ...prev, [id]: next }));
  };

  const setMasterExplained = (next: boolean) => {
    setNotSaved(true);
    setMaster(next);
  };

  // Иконка-колокольчик мастер-карточки (макет строка 1282).
  const bellPaths = [
    "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",
    "M10.3 21a1.94 1.94 0 0 0 3.4 0",
  ];
  const bellGradient: [string, string] = ["#7c3aed", "#4f6df5"];

  return (
    <AppBackground>
      {/* 1. InnerHeader — стрелка «назад» + заголовок «Настройки уведомлений». */}
      <InnerHeader
        title={d.parentApp.scr.notifSettings}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
      />

      {/* 2. Скролл-контейнер списка. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* 3. Мастер-тумблер «Разрешить уведомления». */}
        <GlassCard
          radius={20}
          contentStyle={{
            padding: 13,
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 11,
          }}
        >
          <CategoryIcon
            size={38}
            gradient={bellGradient}
            paths={bellPaths}
            strokeWidth={1.8}
            glyphSize={16}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}
            >
              Разрешить уведомления
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 9.5,
                color: tokens.ink2,
                marginTop: 2,
              }}
            >
              Главный переключатель всех уведомлений
            </Text>
          </View>
          <Toggle value={master} onValueChange={setMasterExplained} />
        </GlassCard>

        {/* Объяснение появляется после первой правки — не пугаем заранее. */}
        {notSaved ? <SoonNote text={d.parentApp.soon.notes.notifSave} /> : null}

        {/* 4. Секционный хедер. */}
        <SectionCap label="УВЕДОМЛЕНИЯ" />

        {/* 5. Список категорий (9 строк) в одной GlassCard. */}
        <GlassCard
          radius={20}
          contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}
        >
          {categories.map((row, i) => (
            <NotifSettingsRow
              key={row.id}
              row={row}
              value={master ? values[row.id] : false}
              onChange={(next) => setOne(row.id, next)}
              disabled={!master}
              divider={i > 0}
            />
          ))}
        </GlassCard>
      </ScrollView>
    </AppBackground>
  );
}

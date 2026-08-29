/**
 * Экран d29 «Профиль ребёнка» — REBUILD (Заход 7, block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», строки 1166–1207:
 *  1166–1171  HeaderBar: back-glass 38 + title «Профиль ребёнка» + kebab-glass 38
 *             (goProfMenu → stub «profmenu»).
 *  1173       ChildSwitcherCard compact: аватар 44 + ФИО + «{class} класс ⌄» +
 *             акцентный лейбл «Сменить ›»; клик открывает шторку выбора детей.
 *  1174–1179  HeroCard: непрозрачный градиент из child.avatar_gradient (135°),
 *             overflow hidden, 2 фоновые звёздочки (справа-сверху 16 / opacity .5,
 *             справа-снизу 10 / opacity .35), 56 аватар (rgba W22 + border W60),
 *             ФИО 15/800 #fff, «{class} класс» + status-chip (rgba W22 + W40),
 *             «ID ученика · {student_code}» 9.5/700 W75.
 *  1180–1185  TabsRow: 4 pill-таба. «Данные» — активный градиент 135°
 *             (#7c3aed→#4f6df5, тень 0 8 18 rgba(124,58,237,.35)), остальные —
 *             glass 160° (W60→W40) + border W75. Клики:
 *             Успехи → таб «p10», Посещаемость → «d14», Достижения → «dport»
 *             (Заход 8: реальный экран Портфолио, initialTab: "ach").
 *  1186       SectionLabel «Общая информация» (t.prof.generalInfo).
 *  1187–1194  GeneralInfoCard: одна glass r20, 6 label:value строк (padding 9/0,
 *             border-top .07 между строками). Значения — из child + CHILD_INFO.
 *             «Школа» захардкожен в макете — оставляем «SNR International School».
 *  1195       SectionLabel «Контакты школы» (t.prof.schoolContacts).
 *  1196–1200  SchoolContactsCard: одна glass r20, 3 строки — телефон +998 71 200-40-40,
 *             email info@snr-school.uz, адрес г. Ташкент, ул. Мустакиллик, 45.
 *             Все три значения захардкожены в макете (правило спец-контекста).
 *  1201       SectionLabel «Дополнительно» (t.prof.additional).
 *  1202–1205  MedicalCard: одна glass r20 (клик → «dmed»), 2 label:value — аллергия,
 *             мед. особенности. Значения — из CHILD_INFO.
 *
 * Данные — через getSelectedChildContext + getChildInfo. Тексты — d.parentApp.*.
 * Обе темы — useTheme(). iOS safe-area — из InnerHeader (реализуем шапку inline,
 * т.к. правый слот — кнопка меню, не info).
 *
 * Правило заказчика: экран информационный, кружков/чатов/2FA/языков нет. Спец-
 * правила чата/объявлений/настроек к d29 не применяются.
 *
 * 28.08.2026 — ЭКРАН ВРАЛ НАСТОЯЩЕМУ РОДИТЕЛЮ.
 *
 * Здесь стояло, что колонок под дату рождения и классного руководителя в
 * Supabase нет. Это НЕВЕРНО: students.birth_date и students.curator_id в
 * схеме есть, их просто никто не запрашивал. А getChildInfo() при промахе
 * отдавал ПЕРВЫЙ ФИКСТУРНЫЙ профиль (см. data/index.ts, childIndex), и
 * родитель читал дату рождения и куратора чужого выдуманного ребёнка как
 * данные своего. Экран не закрыт demoOr — это видел настоящий человек.
 *
 * СТАЛО. При настоящем входе строка показывается ТОЛЬКО если у неё есть
 * источник в базе. 29.08.2026 источников стало восемь вместо пяти —
 * миграция 232 и окна админки закрыли то, чего в схеме не хватало:
 *
 *   дата рождения         students.birth_date            пусто — строки нет
 *   возраст               арифметика от даты             нет даты — строки нет
 *   пол                   students.gender          232   пусто — строки нет
 *   телефон ученика       students.phone                 пусто — строки нет
 *   школа                 schools.name                   пусто — строки нет
 *   класс                 groups.name                    есть всегда
 *   классный руководитель groups.teacher_id              пусто — строки нет
 *   № личного дела        students.file_no         232   пусто — строки нет
 *   контакты школы        schools.phone/email/address    пусто — блока нет
 *   аллергия, мед.        student_medical          232   пусто — блока нет
 *
 * КУРАТОР ПЕРЕЕХАЛ. Читался из students.curator_id — колонки, которую не
 * заполняет ни один экран админки, то есть строка не показывалась НИКОГДА.
 * Решение заказчика: куратор один на класс, задаётся в форме группы
 * (groups.teacher_id). Подмена сделана в общем слое, здесь читается то же
 * поле summary.curatorName.
 *
 * МЕДИЦИНСКИЕ СВЕДЕНИЯ — из отдельной таблицы student_medical, и это не
 * прихоть верстальщика: её видят только админ школы и родитель ребёнка.
 * Запрос идёт под ключом родителя, служебного ключа в приложении нет вовсе
 * — обойти правило доступа отсюда нечем. Учителю и самому ученику эта
 * таблица вернёт ноль строк.
 *
 * Прочерк вместо значения не ставим: пустая графа «Дата рождения» родителю
 * не нужна, а выдуманная — вредна. Пустой РАЗДЕЛ тоже не рисуем: заголовок
 * «Контакты школы» над пустотой читается как поломка.
 *
 * Демо-гость видит ровно то, что видел: у него getChildInfo() находит свой
 * фикстурный профиль, и все шесть строк, контакты и медкарта на месте.
 *
 * ЧЕГО ЭТОТ ЗАХОД НЕ ЧИНИТ. Пока ParentDataContext ещё грузится, isRealFlow
 * ложен, и экран рисует фикстурного ребёнка целиком — как и все остальные
 * экраны настоящего входа. Это общий для приложения порядок загрузки, он
 * решается не здесь.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  EmptyBlock,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  GlassCircleButton,
  type ChildPickerItem,
} from "../../ui";
import {
  getChildInfo,
  getChildren,
  getSelectedChildContext,
  defaultChildId,
} from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useParentData } from "../../context/ParentDataContext";
import { toChildRow } from "../../lib/realChild";
import { ageYears, birthDayLabel } from "../../lib/dateLabels";
import { LOCALE_TAG, pluralizeYears } from "@snr/core";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Стрелка «назад» 18 stroke 2 — унифицирована с InnerHeader (строка 1168). */
function BackArrow({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5" />
      <Path d="m12 19-7-7 7-7" />
    </Svg>
  );
}

/** Kebab (3 точки по горизонтали) 16 stroke 2.2 — правый слот (строка 1170). */
function KebabIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <Circle cx={5} cy={12} r={1} />
      <Circle cx={12} cy={12} r={1} />
      <Circle cx={19} cy={12} r={1} />
    </Svg>
  );
}

/** Звёздочка (spark) 5-конечная — фон hero-карточки (строки 1175, 1176). */
function SparkStar({ size, opacity }: { size: number; opacity: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" opacity={opacity}>
      <Path d="M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z" />
    </Svg>
  );
}

/** Одна строка label:value внутри info-карточки (макет 1188–1193, 1197–1199, 1203–1204). */
function InfoRow({
  label,
  value,
  divider,
  valueAlignRight,
}: {
  label: string;
  value: string;
  divider: boolean;
  valueAlignRight?: boolean;
}) {
  const { tokens, scheme } = useTheme();
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 9,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: dividerColor,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink2 }}>
        {label}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          flexShrink: 1,
          fontFamily: fonts.manrope800,
          fontSize: 11.5,
          color: tokens.ink1,
          textAlign: valueAlignRight ? "right" : "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}

/** Ключи табов d29 (макет 1181–1184, порядок сохраняется). */
type ProfileTabKey = "data" | "progress" | "attend" | "achieve";

export default function ChildProfileScreen() {
  const { tokens, scheme } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const session = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string | null>(
    () => session.currentChildId ?? defaultChildId(),
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: parentData, selectedChildId, selectChild } = useParentData();
  const isRealFlow = !session.demoParentId && !!parentData && parentData.children.length > 0;
  const realIndex = isRealFlow
    // find, а не прижатый к нулю индекс: промах давал ПЕРВОГО ребёнка семьи
    // вместо выбранного. Тот же класс, что и подстановка выдуманного ребёнка
    // в resolveChild, только внутри одной семьи (28.08.2026).
    ? parentData!.children.findIndex((c) => c.id === selectedChildId)
    : -1;
  // realIndex теперь может быть −1 (выбранного ребёнка нет в семье), а
  // children[-1] это undefined — до конца проверять обязаны мы, тип массива
  // об этом молчит.
  const realChildRow =
    isRealFlow && realIndex >= 0
      ? toChildRow(parentData!.children[realIndex], realIndex)
      : null;

  const ctx = getSelectedChildContext(childId ?? undefined);
  const child = realChildRow ?? ctx.child;
  // Выдуманный профиль. У НАСТОЯЩЕГО ребёнка его нет и быть не может —
  // getChildInfo() отдаёт null, и это единственное условие, по которому
  // ниже прячутся выдуманные строки. Проверять isRealFlow для этого нельзя:
  // пока данные родителя грузятся, он ложен, а профиль уже фикстурный.
  const info = getChildInfo(childId ?? undefined);
  const realSummary = isRealFlow ? parentData!.children[realIndex] : undefined;

  // Строки «Общей информации» собираются списком, а не вёрсткой: только так
  // строка без источника не рисуется ВОВСЕ, а не показывает прочерк.
  const generalRows: { label: string; value: string }[] = [];
  if (info) {
    generalRows.push(
      { label: t.prof.birthDate, value: info.birth_date_label },
      { label: t.prof.age, value: info.age_label },
      { label: t.prof.school, value: "SNR International School" },
      { label: t.prof.classRow, value: child?.class_name ?? "" },
      { label: t.prof.curator, value: info.curator_name },
      { label: t.prof.fileNo, value: info.file_no },
    );
  } else {
    const born = realSummary?.birthDate ?? null;
    if (born) {
      generalRows.push({ label: t.prof.birthDate, value: birthDayLabel(born, LOCALE_TAG[locale]) });
      const years = ageYears(born);
      if (years !== null) {
        generalRows.push({ label: t.prof.age, value: pluralizeYears(years, locale) });
      }
    }
    // Пол — подписью на языке интерфейса, а не «male». Значений в базе два,
    // третьего быть не может: колонка под CHECK, а общий слой сузил тип.
    if (realSummary?.gender) {
      generalRows.push({
        label: t.prof.gender,
        value: realSummary.gender === "female" ? t.prof.genderFemale : t.prof.genderMale,
      });
    }
    if (realSummary?.phone) {
      generalRows.push({ label: t.prof.studentPhone, value: realSummary.phone });
    }
    const schoolName = parentData?.schoolName ?? null;
    if (schoolName) generalRows.push({ label: t.prof.school, value: schoolName });
    generalRows.push({ label: t.prof.classRow, value: child?.class_name ?? "" });
    if (realSummary?.curatorName) {
      generalRows.push({ label: t.prof.curator, value: realSummary.curatorName });
    }
    if (realSummary?.fileNo) {
      generalRows.push({ label: t.prof.fileNo, value: realSummary.fileNo });
    }
  }

  // Контакты школы настоящего родителя — из schools, а не из вёрстки.
  // Пусто у всех трёх — раздела нет вовсе.
  const contactRows: { label: string; value: string }[] = [];
  if (!info) {
    if (parentData?.schoolPhone) contactRows.push({ label: t.prof.phoneRow, value: parentData.schoolPhone });
    if (parentData?.schoolEmail) contactRows.push({ label: t.prof.emailRow, value: parentData.schoolEmail });
    if (parentData?.schoolAddress) contactRows.push({ label: t.prof.address, value: parentData.schoolAddress });
  }

  // Медицинские сведения. Карточка НЕ кликабельна, в отличие от демо: там
  // клик ведёт на витрину медкарты (экран dmed под demoOr), а настоящему
  // родителю показывать витрину вместо его данных нельзя.
  const medicalRows: { label: string; value: string }[] = [];
  if (!info) {
    if (realSummary?.allergies) medicalRows.push({ label: t.prof.allergies, value: realSummary.allergies });
    if (realSummary?.medicalNotes) medicalRows.push({ label: t.prof.medicalNotes, value: realSummary.medicalNotes });
  }

  // Активный таб — по макету (строка 1181) всегда «data» на входе; остальные
  // три — навигационные ссылки на другие экраны/табы.
  const [activeTab] = useState<ProfileTabKey>("data");

  // Цвета вспомогательные (обе темы).
  const sectionCapsColor = scheme === "light" ? "rgba(26,19,74,0.5)" : "rgba(255,255,255,0.55)";
  const inactiveTabTextColor = scheme === "light" ? "rgba(26,19,74,0.66)" : "rgba(255,255,255,0.7)";

  // Значения ниже считаются до стража «ребёнка нет» (он обязан стоять после
  // всех хуков), поэтому пишутся безопасно. На экран они попадают только
  // после стража, то есть когда ребёнок точно есть.
  const heroGradient = child?.avatar_gradient ?? (["#8b5cf6", "#6366f1"] as const);
  // Тень hero-карточки — в тоне второго стопа градиента (макет: box-shadow
  // 0 16 36 {g2}55 + inset 0 1.5 0 W35).
  const heroShadowColor = `${heroGradient[1]}55`;

  // Заход 2, шаг 1: для реального входа — РЕАЛЬНЫЕ дети семьи, не полный
  // фикстурный пул. statusLabel/statusTone у ChildPickerSheetContent не
  // опциональны — статуса "в школе/дома" для реальных детей ещё нет
  // (data-экран, следующие заходы), нейтральный "—" вместо выдумки.
  const pickerItems: ChildPickerItem[] = isRealFlow
    ? parentData!.children.map((c, i) => {
        const row = toChildRow(c, i);
        return {
          id: row.id,
          initials: row.first_name.slice(0, 1),
          gradient: row.avatar_gradient,
          ringColor: row.avatar_ring,
          name: row.full_name,
          classLabel: `${row.class_name} ${t.grades.class}`,
          statusLabel: "—",
          statusTone: "gray" as const,
        };
      })
    : children.map((k) => ({
        id: k.id,
        initials: k.first_name.slice(0, 1),
        gradient: k.avatar_gradient,
        ringColor: k.avatar_ring,
        name: k.full_name,
        classLabel: `${k.class_name} ${t.grades.class}`,
        statusLabel: k.status_chip,
        statusTone: k.status_chip === "В школе" ? "green" : "gray",
      }));

  const goProgress = () => navigation.navigate("Tabs", { screen: "p10" });
  const goAttend = () => navigation.navigate("d14");
  // Заход 8: Портфолио теперь реальный экран — ведём сразу на вкладку
  // «Достижения», а не на общую заглушку.
  const goAchieve = () => navigation.navigate("dport", { initialTab: "ach" });
  const goProfMenu = () => navigation.navigate("stub", { stubKey: "profmenu" });
  const goMed = () => navigation.navigate("dmed");

  // Табы (макет 1181–1184). Клик по «data» — no-op (уже активный).
  const tabs: { key: ProfileTabKey; label: string; onPress: () => void }[] = [
    { key: "data", label: t.prof.tabData, onPress: () => {} },
    { key: "progress", label: t.nav.grades, onPress: goProgress },
    { key: "attend", label: t.scr.attendance, onPress: goAttend },
    { key: "achieve", label: t.prof.tabAchievements, onPress: goAchieve },
  ];

  // РЕБЁНКА НЕТ. Школа завела родителя, но ученика к нему ещё не привязала —
  // случай настоящий. До 28.08.2026 сюда молча подставлялся выдуманный
  // ребёнок (resolveChild в data/index.ts), и человек читал чужое расписание
  // и чужие оценки как данные своего. Теперь говорим словами.
  //
  // Демо-показа это не касается: там ребёнок есть всегда.
  if (!child) {
    return (
      <AppBackground>
        <View style={{ flex: 1, justifyContent: "center", padding: 18 }}>
          <EmptyBlock
            title={t.common.noChildTitle}
            text={t.common.noChildText}
          />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      {/* Блок 1: Header (back + title + kebab). */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingTop: Math.max(insets.top, 46),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={() => navigation.goBack()}>
          <BackArrow color={tokens.ink1} />
        </GlassCircleButton>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontFamily: fonts.unbounded600,
            fontSize: 15,
            color: tokens.ink1,
          }}
        >
          {t.scr.childProfile}
        </Text>
        <GlassCircleButton onPress={goProfMenu}>
          <KebabIcon color={tokens.ink1} />
        </GlassCircleButton>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
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
          switchLabel={`${t.prof.switchChild} ›`}
          onPress={() => setSheetOpen(true)}
        />

        {/* Блок 3: HeroCard — большой градиент со звёздочками и ID ученика. */}
        <View
          style={[
            {
              position: "relative",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 15,
              borderRadius: 22,
              overflow: "hidden",
              minHeight: 86,
            },
            shadowStyle({ x: 0, y: 16, blur: 36, color: heroShadowColor }),
          ]}
        >
          <LinearGradient
            colors={heroGradient}
            {...gradPoints(135)}
            style={StyleSheet.absoluteFill}
          />
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
          {/* Фоновые звёздочки (макет 1175, 1176). */}
          <View style={{ position: "absolute", top: 10, right: 14 }}>
            <SparkStar size={16} opacity={0.5} />
          </View>
          <View style={{ position: "absolute", bottom: 14, right: 44 }}>
            <SparkStar size={10} opacity={0.35} />
          </View>

          {/* Аватар 56 (rgba W22, border W60 2px). */}
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.22)",
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.6)",
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 19, color: "#FFFFFF" }}>
              {child.first_name.slice(0, 1)}
            </Text>
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}
            >
              {child.full_name}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: "rgba(255,255,255,0.85)" }}>
                {`${child.class_name} ${t.grades.class}`}
              </Text>
              {/* Заход 2, шаг 1: у реальных детей статуса "в школе/дома" ещё
                  нет (child.status_chip === "" из toChildRow) — скрываем
                  пилюлю вовсе, не рисуем пустую. */}
              {child.status_chip ? (
                <View
                  style={{
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
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 8.5, color: "#FFFFFF" }}>
                    {child.status_chip}
                  </Text>
                </View>
              ) : null}
            </View>
            {/* Номер личного дела — выдуманный: колонки под него нет. */}
            {info ? (
              <Text
                numberOfLines={1}
                style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: "rgba(255,255,255,0.75)" }}
              >
                {`${t.prof.studentId} · ${info.student_code}`}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Блок 4: TabsRow — 4 pill-таба. */}
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
                  <LinearGradient
                    colors={["#7C3AED", "#4F6DF5"]}
                    {...gradPoints(135)}
                    style={{ paddingVertical: 9, alignItems: "center" }}
                  >
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: "#FFFFFF" }}>
                      {tab.label}
                    </Text>
                  </LinearGradient>
                </View>
              );
            }
            return (
              <Pressable
                key={tab.key}
                onPress={tab.onPress}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  paddingVertical: 9,
                  alignItems: "center",
                  backgroundColor: scheme === "light" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: scheme === "light" ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.14)",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: inactiveTabTextColor }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Блок 5: SectionLabel «Общая информация». */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            textTransform: "uppercase",
            color: sectionCapsColor,
          }}
        >
          {t.prof.generalInfo}
        </Text>

        {/* Блок 6: GeneralInfoCard. Демо — шесть строк макета; настоящий вход
            — только те, у которых есть источник (см. generalRows выше). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {generalRows.map((row, i) => (
            <InfoRow key={row.label} label={row.label} value={row.value} divider={i > 0} />
          ))}
        </GlassCard>

        {/* Блоки 7–10 — ТОЛЬКО ДЛЯ ДЕМО-ГОСТЯ, с зашитыми в вёрстку
            значениями макета. Витрина; не трогаем ни строки.

            29.08.2026: у настоящего родителя оба раздела теперь ТОЖЕ есть —
            но собираются ниже и из базы (schools.phone/email/address и
            student_medical, миграция 232). Раньше их не было потому, что
            источников не существовало, а не потому, что родителю не надо.

            Условие — info, а не isRealFlow: info равен null ровно тогда, когда
            ребёнок настоящий (см. data/index.ts, childIndex). */}
        {info ? (
          <>
          {/* Блок 7: SectionLabel «Контакты школы». */}
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 10.5,
              letterSpacing: 10.5 * 0.08,
              textTransform: "uppercase",
              color: sectionCapsColor,
            }}
          >
            {t.prof.schoolContacts}
          </Text>

          {/* Блок 8: SchoolContactsCard (3 строки, значения захардкожены в макете). */}
          <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
            <InfoRow label="Телефон" value="+998 71 200-40-40" divider={false} />
            <InfoRow label="Email" value="info@snr-school.uz" divider />
            <InfoRow label="Адрес" value="г. Ташкент, ул. Мустакиллик, 45" divider valueAlignRight />
          </GlassCard>

          {/* Блок 9: SectionLabel «Дополнительно». */}
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 10.5,
              letterSpacing: 10.5 * 0.08,
              textTransform: "uppercase",
              color: sectionCapsColor,
            }}
          >
            {t.prof.additional}
          </Text>

          {/* Блок 10: MedicalCard (2 строки, вся карточка кликабельна → dmed). */}
          <GlassCard
            radius={20}
            onPress={goMed}
            contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}
          >
            <InfoRow label="Аллергия" value={info.allergies_label} divider={false} />
            <InfoRow label="Медицинские особенности" value={info.med_note_label} divider />
          </GlassCard>
          </>
        ) : null}

        {/* Контакты школы НАСТОЯЩЕГО родителя. Раздел появляется целиком
            только если школа заполнила хоть один контакт. */}
        {contactRows.length > 0 ? (
          <>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10.5,
                letterSpacing: 10.5 * 0.08,
                textTransform: "uppercase",
                color: sectionCapsColor,
              }}
            >
              {t.prof.schoolContacts}
            </Text>
            <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
              {contactRows.map((row, i) => (
                <InfoRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  divider={i > 0}
                  valueAlignRight={row.label === t.prof.address}
                />
              ))}
            </GlassCard>
          </>
        ) : null}

        {/* Медицинские сведения НАСТОЯЩЕГО ребёнка — student_medical.
            Ничего не заполнено — раздела нет: пустая графа «Аллергия» хуже
            отсутствующей, речь о медицине. */}
        {medicalRows.length > 0 ? (
          <>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10.5,
                letterSpacing: 10.5 * 0.08,
                textTransform: "uppercase",
                color: sectionCapsColor,
              }}
            >
              {t.prof.additional}
            </Text>
            <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
              {medicalRows.map((row, i) => (
                <InfoRow key={row.label} label={row.label} value={row.value} divider={i > 0} valueAlignRight />
              ))}
            </GlassCard>
          </>
        ) : null}
      </ScrollView>

      {/* Шторка выбора ребёнка. Реальный phone-flow — переключаем реального
          активного ребёнка (ParentDataContext.selectChild); info (доп.
          сведения без колонки в БД) намеренно НЕ следует за этим выбором,
          см. заголовочный комментарий файла. Демо — ровно как было. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={isRealFlow ? (selectedChildId ?? undefined) : (childId ?? undefined)}
          onSelect={(id) => {
            if (isRealFlow) {
              selectChild(id);
            } else {
              setChildId(id);
            }
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}

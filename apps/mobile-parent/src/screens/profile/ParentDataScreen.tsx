/**
 * Экран d30 «Данные родителя» — read-only перенос 1:1 из макета
 * «SNR EduOS v2 Light.dc.html», строки 1209–1246.
 *
 * В макете экран НЕ содержит контролов редактирования/сохранения — только
 * шапка (back + kebab-меню → profmenu) и стек glass-карточек ключ/значение.
 * Композиция сверху вниз (11 блоков, порядок из BLOCK-LIST заказчика):
 *  1.  InnerHeader — стрелка «назад» + заголовок t.scr.parentData +
 *      круглая glass-кнопка kebab (3 dots) → stub {stubKey:'profmenu'}.
 *  2.  ScrollView flex-column, gap 12, padding 4 18 118 (макет строка 1215).
 *  3.  Identity-card GlassCard r22: аватар 54 c двойным кольцом (#fff 2 +
 *      violet 4.5, ringColor #8b5cf6) + имя + role_label + email + телефон.
 *  4.  SectionHeader «Личные данные» — t.prof.personalInfo.
 *  5.  GlassCard-rows: ФИО / Дата рождения / Пол / Семейное положение.
 *  6.  SectionHeader «Адрес» — t.prof.address.
 *  7.  GlassCard-rows: Город / Адрес / Индекс.
 *  8.  SectionHeader «Дополнительная информация» — литерал (в макете 1233
 *      строка захардкожена, в словаре нет отдельного ключа; переведём при
 *      следующем проходе i18n).
 *  9.  GlassCard-rows: Место работы / Должность / Рабочий телефон.
 *  10. SectionHeader «Связь» — литерал (макет 1239, отдельного ключа нет).
 *  11. GlassCard-rows: Email / Резервный телефон.
 *
 * Данные — только из фикстур: getParent() (identity-card), getParentProfile()
 * (все секции). Никаких input/edit-контролов, как в оригинале.
 */
import { Text, View, ScrollView, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Avatar,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  SectionHeader,
} from "../../ui";
import { AppBackground, fonts, useTheme } from "../../theme";
import { useAppLocale } from "../../i18n";
import { getParent, getParentProfile } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Пара ключ/значение внутри карточки-секции. */
interface KVRow {
  key: string;
  value: string;
}

export default function ParentDataScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const parent = getParent();
  const profile = getParentProfile();

  const goBack = () => navigation.goBack();
  // Kebab → универсальный profile-menu stub (согласовано с CardDetailsScreen).
  const goProfMenu = () => navigation.navigate("stub", { stubKey: "profmenu" });

  // Литералы «Дополнительная информация» / «Связь» — в макете (строки 1233,
  // 1239) захардкожены, в словаре core/src/i18n/ru.ts подходящих ключей нет.
  // Экран уже читает d.parentApp.prof.* — эти два переведутся вместе с
  // следующим i18n-проходом (Заход 8/10). SectionHeader сам применит
  // textTransform:'uppercase' и letter-spacing .08em.
  const SECTION_ADDITIONAL = "Дополнительная информация";
  const SECTION_CONTACT = "Связь";

  const personalRows: KVRow[] = [
    { key: "ФИО", value: profile.full_name_official },
    { key: "Дата рождения", value: profile.birth_date_label },
    { key: "Пол", value: profile.gender_label },
    { key: "Семейное положение", value: profile.marital_status_label },
  ];

  const addressRows: KVRow[] = [
    { key: "Город", value: profile.city },
    { key: "Адрес", value: profile.address },
    { key: "Индекс", value: profile.postal_code },
  ];

  const additionalRows: KVRow[] = [
    { key: "Место работы", value: profile.workplace },
    { key: "Должность", value: profile.job_title },
    { key: "Рабочий телефон", value: profile.work_phone },
  ];

  const contactRows: KVRow[] = [
    { key: "Email", value: parent.email },
    { key: "Резервный телефон", value: profile.backup_phone },
  ];

  return (
    <AppBackground>
      {/* 1. Шапка: back + title + kebab → profmenu. */}
      <InnerHeader
        title={d.parentApp.scr.parentData}
        titleSize={15}
        onBackPress={goBack}
        right={
          <GlassCircleButton onPress={goProfMenu}>
            {/* Kebab (3 dots): 16px, stroke 2.2, cx 5/12/19 r 1 (макет 1213). */}
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

      {/* 2. Скролл-контейнер: gap 12, padding 4 18 118. d30 живёт в стек-навигаторе,
           без floating tab-bar — фиксированного 118 достаточно (равно макет-педдингу). */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* 3. Identity-card: аватар 54 (ring #8b5cf6) + ФИО/роль/email/телефон. */}
        <GlassCard radius={22} contentStyle={{ padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ margin: 4.5 }}>
              <Avatar
                size={54}
                initials={parent.initials}
                gradient={parent.avatar_gradient}
                variant="ring"
                ringColor="#8b5cf6"
                fontSize={16}
              />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14.5, color: tokens.ink1 }}>
                {parent.full_name}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 10.5,
                  color: tokens.status.violet.text,
                }}
              >
                {parent.role_label}
              </Text>
              <Text
                style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}
                numberOfLines={1}
              >
                {parent.email}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}>
                {parent.phone}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* 4–5. Личные данные. */}
        <SectionHeader title={d.parentApp.prof.personalInfo} />
        <KVCard rows={personalRows} scheme={scheme} tokens={tokens} />

        {/* 6–7. Адрес. */}
        <SectionHeader title={d.parentApp.prof.address} />
        <KVCard rows={addressRows} scheme={scheme} tokens={tokens} />

        {/* 8–9. Дополнительная информация (литерал → i18n позже). */}
        <SectionHeader title={SECTION_ADDITIONAL} />
        <KVCard rows={additionalRows} scheme={scheme} tokens={tokens} />

        {/* 10–11. Связь (литерал → i18n позже). */}
        <SectionHeader title={SECTION_CONTACT} />
        <KVCard rows={contactRows} scheme={scheme} tokens={tokens} />
      </ScrollView>
    </AppBackground>
  );
}

/* ─── Внутренние вспомогательные компоненты. ─────────────────────────────── */

/**
 * KVCard — glass-карточка со списком key/value-строк (макет 1221/1228/1234/1240).
 * Радиус 20, contentStyle padding 4 14 (padding:4px 14px в макете).
 * Каждая строка: padding 9 0, key 11/700 ink2(.62), value 11.5/800 ink1;
 * между строками — border-top 1px rgba(23,18,67,.07) (тёмная пара W10).
 */
function KVCard({
  rows,
  scheme,
  tokens,
  style,
}: {
  rows: KVRow[];
  scheme: "light" | "dark";
  tokens: ReturnType<typeof useTheme>["tokens"];
  style?: StyleProp<ViewStyle>;
}) {
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  return (
    <GlassCard radius={20} style={style} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
      {rows.map((row, i) => (
        <View
          key={row.key}
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 9,
              gap: 12,
            },
            i > 0 && { borderTopWidth: 1, borderTopColor: dividerColor },
          ]}
        >
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 11,
              color: tokens.ink2,
              flexShrink: 0,
            }}
          >
            {row.key}
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11.5,
              color: tokens.ink1,
              textAlign: "right",
              flexShrink: 1,
            }}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </GlassCard>
  );
}

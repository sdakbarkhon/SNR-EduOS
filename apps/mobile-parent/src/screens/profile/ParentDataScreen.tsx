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
 * 28.08.2026 — ЭКРАН ВРАЛ НАСТОЯЩЕМУ РОДИТЕЛЮ.
 *
 * Из четырнадцати значений настоящими были два — ФИО и телефон. Остальные
 * двенадцать (инициалы аватара, роль «Мать», почта, дата рождения, пол,
 * семейное положение, город, адрес, индекс, место работы, должность,
 * рабочий и резервный телефоны) приходили из заготовки и были подписаны как
 * данные самого человека. Экран не закрыт demoOr — это видел живой родитель.
 *
 * ЧТО ЕСТЬ В БАЗЕ. Таблица public.parents держит ровно девять колонок:
 * id, user_id, full_name, phone, school_id, created_at, created_by,
 * google_email, apple_email. Проверено живым запросом 28.08.2026, сходится
 * с миграциями 74 / 180 / 201. Колонок под остальные поля нет ВООБЩЕ.
 *
 * СТАЛО. При настоящем входе экран показывает одну карточку: имя, роль,
 * почту (если заведена) и телефон. Секции «Личные данные», «Адрес»,
 * «Дополнительная информация» и «Связь» не рисуются вовсе — не прочерками,
 * а отсутствием: всё настоящее и так стоит в карточке выше, а повторять её
 * одной строкой под четырьмя заголовками бессмысленно. Под карточкой —
 * строка о том, почему больше ничего нет, иначе пустой экран читается как
 * поломка.
 *
 * РОЛЬ. В заготовке стояло «Мать». Пола родителя в базе нет, угадывать
 * нельзя — берём нейтральное «Родитель» из словаря, то же самое, что уже
 * показывает карточка на экране «Профиль».
 *
 * Демо-гость видит ровно то, что видел: getParentProfile(true) отдаёт ему
 * всю заготовку, все четыре секции на месте.
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
import { useParentData } from "../../context/ParentDataContext";
import { useDemoSession } from "../../context/DemoSessionContext";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** ФИО → инициалы: первые буквы первых двух слов. Тот же приём, что на
 *  экране «Профиль» (ProfileHubScreen.initialsFromFullName). */
function initialsFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
}

/** Пара ключ/значение внутри карточки-секции. */
interface KVRow {
  key: string;
  value: string;
}

export default function ParentDataScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  // Подписи экрана — из общего словаря (28.08.2026): раньше были вписаны
  // сюда по-русски и оставались русскими на узбекском и английском.
  const p = d.parentApp.prof;

  const parent = getParent();
  const { data: parentData } = useParentData();
  // ПРИЗНАК ПОКАЗА — тот же, которым пользуется demoOr: ключ аренды
  // демо-места в защищённом хранилище.
  //
  // 28.08.2026: здесь стояло `!!session.demoParentId`, а это поле НИКОГДА не
  // выставляется — единственное присваивание null в INITIAL_STATE. Проверка
  // была всегда ложной, и демо-гость терял витрину этого экрана. Найдено
  // сквозной сверкой.
  const { isDemo } = useDemoSession();
  // Выдуманный профиль. При настоящем входе его НЕТ — аксессор возвращает
  // null, и подстановка чужих данных невозможна по типам (см. data/index.ts).
  const profile = getParentProfile(isDemo);

  // Всё, что база знает о родителе.
  const realName = parentData?.parentName ?? null;
  const realPhone = parentData?.parentPhone ?? null;
  const realEmail = parentData?.parentEmail ?? null;

  // Карточка сверху. У настоящего родителя инициалы считаются из его ФИО
  // (в заготовке стояло «ДК» — буквы выдуманного человека), роль нейтральная
  // («Мать» из заготовки — выдумка: пола родителя в базе нет), почта из
  // parents.google_email/apple_email и только если заведена. Пока данные едут,
  // поля пустые: пустое место честнее чужого имени.
  const cardName = isDemo ? parent.full_name : (realName ?? "");
  const cardInitials = isDemo ? parent.initials : (realName ? initialsFromFullName(realName) : "");
  const cardRole = isDemo ? parent.role_label : p.parentRole;
  const cardEmail = isDemo ? parent.email : realEmail;
  const cardPhone = isDemo ? parent.phone : (realPhone ?? "");

  const goBack = () => navigation.goBack();
  // Kebab → универсальный profile-menu stub (согласовано с CardDetailsScreen).
  const goProfMenu = () => navigation.navigate("stub", { stubKey: "profmenu" });


  // Четыре секции ниже — ТОЛЬКО ДЛЯ ДЕМО-ГОСТЯ. Ни одно их поле не имеет
  // колонки в public.parents, а всё настоящее уже стоит в карточке выше.
  const personalRows: KVRow[] = profile
    ? [
        { key: p.fullNameRow, value: profile.full_name_official },
        { key: p.birthDate, value: profile.birth_date_label },
        { key: p.gender, value: profile.gender_label },
        { key: p.maritalStatus, value: profile.marital_status_label },
      ]
    : [];

  const addressRows: KVRow[] = profile
    ? [
        { key: p.city, value: profile.city },
        { key: p.address, value: profile.address },
        { key: p.postalCode, value: profile.postal_code },
      ]
    : [];

  const additionalRows: KVRow[] = profile
    ? [
        { key: p.workplace, value: profile.workplace },
        { key: p.jobTitle, value: profile.job_title },
        { key: p.workPhone, value: profile.work_phone },
      ]
    : [];

  const contactRows: KVRow[] = profile
    ? [
        // «Email» одинаков на всех трёх языках — переводить нечего.
        { key: "Email", value: parent.email },
        { key: p.backupPhone, value: profile.backup_phone },
      ]
    : [];

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
                initials={cardInitials}
                gradient={parent.avatar_gradient}
                variant="ring"
                ringColor="#8b5cf6"
                fontSize={16}
              />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14.5, color: tokens.ink1 }}>
                {cardName}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 10.5,
                  color: tokens.status.violet.text,
                }}
              >
                {cardRole}
              </Text>
              {/* Почты может не быть вовсе: администратор заводит её только
                  для входа вместо кода из SMS. Пустой строки не рисуем. */}
              {cardEmail ? (
                <Text
                  style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}
                  numberOfLines={1}
                >
                  {cardEmail}
                </Text>
              ) : null}
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink2 }}>
                {cardPhone}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Блоки 4–11 — ТОЛЬКО ДЛЯ ДЕМО-ГОСТЯ: ни одного из их полей в
            public.parents нет. Условие — profile: аксессор
            отдаёт null ровно при настоящем входе. */}
        {profile ? (
          <>
            {/* 4–5. Личные данные. */}
            <SectionHeader title={d.parentApp.prof.personalInfo} />
            <KVCard rows={personalRows} scheme={scheme} tokens={tokens} />

            {/* 6–7. Адрес. */}
            <SectionHeader title={d.parentApp.prof.address} />
            <KVCard rows={addressRows} scheme={scheme} tokens={tokens} />

            {/* 8–9. Дополнительная информация. */}
            <SectionHeader title={p.sectionAdditional} />
            <KVCard rows={additionalRows} scheme={scheme} tokens={tokens} />

            {/* 10–11. Связь. */}
            <SectionHeader title={p.sectionContact} />
            <KVCard rows={contactRows} scheme={scheme} tokens={tokens} />
          </>
        ) : (
          // Одна строка вместо четырёх пустых секций: без неё экран из одной
          // карточки читается как недогрузившийся.
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 11,
              lineHeight: 11 * 1.5,
              color: tokens.ink2,
              paddingHorizontal: 4,
            }}
          >
            {p.parentDataOnlySchool}
          </Text>
        )}
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

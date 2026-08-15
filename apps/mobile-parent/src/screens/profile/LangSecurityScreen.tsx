/**
 * Экран #34 «Язык и безопасность» (d34) — Заход 7 REBUILD.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 1295–1332,
 * сверху вниз (block-list задания):
 *  1. InnerHeader: back-button (glass 38) + Unbounded 15/600 «Язык и
 *     безопасность» (d.parentApp.scr.langSec).
 *  2. Секция «ОФОРМЛЕНИЕ» (t.setAppearance).
 *  3. Appearance-карточка (glass r20) — 3 радио-строки: Light / Dark / System,
 *     иконки как цветные градиентные плитки (солнце, луна, устройство),
 *     галочка справа у активной темы.
 *  4. Секция «ЯЗЫК ПРИЛОЖЕНИЯ» (t.setAppLanguage).
 *  5. Language-карточка — ровно 3 языка ru/uz/en (без «добавить язык» —
 *     в макете такой кнопки нет), радио-выбор с галочкой.
 *  6. Секция «БЕЗОПАСНОСТЬ» (t.setSecurity).
 *  7. Security-карточка — 3 строки: «Изменить пароль» (nav → dchpass),
 *     «Биометрия» (toggle, локальный state), «Активные сессии» (nav → dsessions).
 *     Никакой 2FA в макете нет — не рисуется.
 *  8. Секция «КОНФИДЕНЦИАЛЬНОСТЬ» (t.setPrivacySec).
 *  9. Privacy-карточка — 2 строки: «Автовыход» (nav + aeLabel из
 *     getAutoExitFixture, дефолт «Через 15 минут») и «Удалить аккаунт»
 *     (красный, иконка урны — ОСТАЁТСЯ по Apple-требованию; клик открывает
 *     CenterModalFrame по CONFIRM_DIALOGS.deleteAccount).
 * 10. Секция «О ПРИЛОЖЕНИИ» (t.scrAbout).
 * 11. About-карточка — 3 строки: «Версия приложения» 1.0.0 (без chevron),
 *     «Условия использования» и «Политика конфиденциальности».
 *
 * 15.08.2026 (заглушки). Обе правовые ссылки вели на ОДИН безымянный экран
 * «Просмотр документа» — теперь у каждой свой заголовок и свой текст о том,
 * что документа пока нет и где спросить. Кнопка «Удалить аккаунт» больше не
 * притворяется: подтверждение в модалке заменено объяснением, потому что
 * аккаунт заводит школа. Настоящий экран «О приложении» — da7.
 *
 * ИНТЕРАКТИВ РАБОЧИЙ (по требованию Захода 7):
 * — Оформление: useTheme() → { appearance, setAppearance }.
 *   Клик по строке персистит выбор в ThemeContext (mockStorage: pm2.appearance)
 *   и провайдер выше по дереву мгновенно перерисовывает всё приложение,
 *   включая DEV-панель.
 * — Язык: useAppLocale() → { locale, setLocale }. Аналогично, LocaleProvider
 *   персистит mob6.language и заново рендерит всё дерево.
 *
 * Обе темы — через useTheme(); iOS safe-area — из InnerHeader; тени/стекло —
 * токенами.
 */
import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import type { Locale } from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme, type AppearancePref } from "../../theme";
import {
  CenterModalFrame,
  GlassCard,
  InnerHeader,
  SectionHeader,
  Toggle,
} from "../../ui";
import { SoonNote } from "../../ui/notices";
import { useAppLocale } from "../../i18n";
import { legalUrl, type LegalKind } from "../../lib/legal";
import { getAutoExitFixture, getConfirmDialog } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/* ─── SVG-иконки строк (белые линии внутри градиентной плитки) ────────────── */

interface GlyphProps {
  size?: number;
  stroke?: number;
}

function SunIcon({ size = 15, stroke = 1.9 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v2" />
      <Path d="M12 20v2" />
      <Path d="m4.9 4.9 1.4 1.4" />
      <Path d="m17.7 17.7 1.4 1.4" />
      <Path d="M2 12h2" />
      <Path d="M20 12h2" />
      <Path d="m6.3 17.7-1.4 1.4" />
      <Path d="m19.1 4.9-1.4 1.4" />
    </Svg>
  );
}

function MoonIcon({ size = 15, stroke = 1.9 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </Svg>
  );
}

function DeviceIcon({ size = 15, stroke = 1.8 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={6} y={2} width={12} height={20} rx={3} />
      <Path d="M12 18h.01" />
    </Svg>
  );
}

function LockIcon({ size = 15, stroke = 1.8 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={4} y={11} width={16} height={10} rx={3} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

function FaceIcon({ size = 15, stroke = 1.8 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <Path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <Path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <Path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <Path d="M9 9h.01" />
      <Path d="M15 9h.01" />
      <Path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
    </Svg>
  );
}

function ClockIcon({ size = 15, stroke = 1.9 }: GlyphProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </Svg>
  );
}

function TrashIcon({ size = 15, stroke = 1.9, color = "#fff" }: GlyphProps & { color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <Path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

function ChevronRight() {
  const { scheme } = useTheme();
  const color = scheme === "dark" ? "rgba(255,255,255,0.42)" : "rgba(26,19,74,0.4)";
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="m9 18 6-6-6-6" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckMark() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

/* ─── Градиентная иконка-плитка 36×36 r12 (макет 1303–1305, 1315–1317, 1321) */

function IconTile({
  gradient,
  children,
  shadowRgb,
}: {
  gradient: [string, string];
  children: React.ReactNode;
  /** RGB акцента предмета/строки для тени 0 6 12 rgba(...,.3) (макет). */
  shadowRgb: string;
}) {
  return (
    <View
      style={[
        {
          width: 36,
          height: 36,
          borderRadius: 12,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },
        shadowStyle({ x: 0, y: 6, blur: 12, color: `rgba(${shadowRgb},0.3)` }),
      ]}
    >
      <LinearGradient
        colors={gradient}
        {...gradPoints(135)}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

/* ─── Круглая checkbox-галочка (для радио-строк appearance/language) ──────── */

function CheckDot({ active }: { active: boolean }) {
  const { scheme, tokens } = useTheme();
  const inactiveBorder = scheme === "dark" ? "rgba(255,255,255,0.28)" : "rgba(23,18,67,0.22)";
  if (!active) {
    return (
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: inactiveBorder,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LinearGradient
        colors={tokens.accentGrad.colors as [string, string]}
        {...gradPoints(tokens.accentGrad.angle)}
        style={StyleSheet.absoluteFill}
      />
      <CheckMark />
    </View>
  );
}

/* ─── Универсальная строка карточки с разделителем ────────────────────────── */

function CardRow({
  onPress,
  divider,
  children,
}: {
  onPress?: () => void;
  divider: boolean;
  children: React.ReactNode;
}) {
  const { scheme } = useTheme();
  const divColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  const rowStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 11,
    paddingVertical: 10,
    borderTopWidth: divider ? 1 : 0,
    borderTopColor: divColor,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [rowStyle, pressed ? { opacity: 0.75 } : null]}>
        {children}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{children}</View>;
}

/* ─── Экран ───────────────────────────────────────────────────────────────── */

export default function LangSecurityScreen() {
  const { tokens, scheme, appearance, setAppearance } = useTheme();
  const { d, locale, setLocale } = useAppLocale();
  const navigation = useNavigation<Nav>();

  // Биометрия и автовыход — локальный state экрана (реальная привязка к
  // OS/expo-local-authentication и app-timeout появится на этапе данных).
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const autoExitFixture = getAutoExitFixture();
  const [aeLabel] = useState<string>(() => {
    // DEFAULT_AUTO_EXIT_VALUE === "15" → «Через 15 минут» (options[1]).
    const idx = autoExitFixture.default_value === "5"
      ? 0
      : autoExitFixture.default_value === "30"
        ? 2
        : autoExitFixture.default_value === "never"
          ? 3
          : 1;
    return autoExitFixture.options[idx] ?? autoExitFixture.options[1];
  });

  const [delAccOpen, setDelAccOpen] = useState(false);
  const delAccDialog = getConfirmDialog("deleteAccount");

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  /**
   * Правовой документ: если заказчик уже дал адрес (app.json → expo.extra),
   * открываем его в браузере; если нет — ведём на экран, который объясняет,
   * что документ готовится. Одна и та же проверка, что и на экране входа
   * (lib/legal.ts) — до 15.08.2026 профиль про адреса не знал вовсе и после
   * публикации документов так и остался бы без ссылки.
   */
  const openLegal = (kind: LegalKind) => {
    const url = legalUrl(kind);
    if (url) {
      void Linking.openURL(url);
      return;
    }
    navigation.navigate("stub", { stubKey: kind });
  };

  const goTo = (route: keyof MainStackParamList) => () => navigation.navigate(route as never);

  // Строки «оформление» — иконка, ключи словаря, значение appearance.
  const appearanceRows: Array<{
    value: AppearancePref;
    title: string;
    subtitle: string;
    gradient: [string, string];
    shadowRgb: string;
    icon: React.ReactNode;
  }> = [
    {
      value: "light",
      title: d.parentApp.set.light,
      subtitle: d.parentApp.set.lightSub,
      gradient: ["#fbbf24", "#f97316"],
      shadowRgb: "249,115,22",
      icon: <SunIcon />,
    },
    {
      value: "dark",
      title: d.parentApp.set.dark,
      subtitle: d.parentApp.set.darkSub,
      gradient: ["#a78bfa", "#7c3aed"],
      shadowRgb: "124,58,237",
      icon: <MoonIcon />,
    },
    {
      value: "system",
      title: d.parentApp.set.system,
      subtitle: d.parentApp.set.systemSub,
      gradient: ["#60a5fa", "#2563eb"],
      shadowRgb: "37,99,235",
      icon: <DeviceIcon />,
    },
  ];

  // Строки «язык» — ровно 3 варианта. sub = автоним (Русский/Oʻzbekcha/English),
  // независимо от активного языка интерфейса.
  const languageRows: Array<{ value: Locale; name: string; sub: string }> = [
    { value: "ru", name: d.parentApp.set.langRu, sub: "Русский" },
    { value: "uz", name: d.parentApp.set.langUz, sub: "Oʻzbekcha" },
    { value: "en", name: d.parentApp.set.langEn, sub: "English" },
  ];

  return (
    <AppBackground>
      {/* 1. Header. */}
      <InnerHeader
        title={d.parentApp.scr.langSec}
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Section: Оформление */}
        <SectionHeader title={d.parentApp.set.appearance} />

        {/* 3. Appearance Card. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {appearanceRows.map((row, i) => (
            <CardRow key={row.value} divider={i > 0} onPress={() => setAppearance(row.value)}>
              <IconTile gradient={row.gradient} shadowRgb={row.shadowRgb}>
                {row.icon}
              </IconTile>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                  {row.title}
                </Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>
                  {row.subtitle}
                </Text>
              </View>
              <CheckDot active={appearance === row.value} />
            </CardRow>
          ))}
        </GlassCard>

        {/* 4. Section: Язык приложения */}
        <SectionHeader title={d.parentApp.set.appLanguage} />

        {/* 5. Language Card (ровно 3, без «добавить язык»). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {languageRows.map((row, i) => (
            <CardRow key={row.value} divider={i > 0} onPress={() => setLocale(row.value)}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                  {row.name}
                </Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>
                  {row.sub}
                </Text>
              </View>
              <CheckDot active={locale === row.value} />
            </CardRow>
          ))}
        </GlassCard>

        {/* 6. Section: Безопасность */}
        <SectionHeader title={d.parentApp.set.security} />

        {/* 7. Security Card: Change Password / Biometric toggle / Active Sessions. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {/* Изменить пароль → dchpass */}
          <CardRow divider={false} onPress={goTo("dchpass")}>
            <IconTile gradient={["#a78bfa", "#7c3aed"]} shadowRgb="124,58,237">
              <LockIcon />
            </IconTile>
            <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
              {d.parentApp.set.chPass}
            </Text>
            <ChevronRight />
          </CardRow>

          {/* Биометрия — toggle. */}
          <CardRow divider={true}>
            <IconTile gradient={["#34d399", "#059669"]} shadowRgb="5,150,105">
              <FaceIcon />
            </IconTile>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                {d.parentApp.prof.biometric}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>
                {d.parentApp.prof.biometricSub}
              </Text>
            </View>
            <Toggle value={biometricEnabled} onValueChange={setBiometricEnabled} />
          </CardRow>

          {/* Активные сессии → dsessions. */}
          <CardRow divider={true} onPress={goTo("dsessions")}>
            <IconTile gradient={["#60a5fa", "#2563eb"]} shadowRgb="37,99,235">
              <DeviceIcon />
            </IconTile>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                {d.parentApp.set.sessions}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink2, marginTop: 2 }}>
                {d.parentApp.prof.sessionsSub}
              </Text>
            </View>
            <ChevronRight />
          </CardRow>
        </GlassCard>

        {/* 8. Section: Конфиденциальность */}
        <SectionHeader title={d.parentApp.set.privacySec} />

        {/* 9. Privacy Card: Auto-exit + Delete account. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {/* Автовыход. */}
          <CardRow divider={false} onPress={() => navigation.navigate("stub", { stubKey: "autoexit" })}>
            <IconTile gradient={["#fbbf24", "#f97316"]} shadowRgb="249,115,22">
              <ClockIcon />
            </IconTile>
            <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
              {d.parentApp.set.autoExit}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink2, marginRight: 4 }}>
              {aeLabel}
            </Text>
            <ChevronRight />
          </CardRow>

          {/* Удалить аккаунт — ОСТАЁТСЯ (Apple-требование). */}
          <CardRow divider={true} onPress={() => setDelAccOpen(true)}>
            <IconTile gradient={["#fb7185", "#e11d48"]} shadowRgb="225,29,72">
              <TrashIcon />
            </IconTile>
            <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.status.red.text }}>
              {d.parentApp.prof.deleteAcc}
            </Text>
            <ChevronRight />
          </CardRow>
        </GlassCard>

        {/* 10. Section: О приложении */}
        <SectionHeader title={d.parentApp.scr.about} />

        {/* 11. About Card. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {/* Версия — без chevron, без onPress. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
              {d.parentApp.prof.appVersion}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink2 }}>
              {appVersion}
            </Text>
          </View>

          {/* 15.08.2026 (заглушки). Обе ссылки вели на один и тот же экран
              «Просмотр документа» — родитель нажимал «Политику
              конфиденциальности» и попадал в безымянный документ. Теперь у
              каждой свой заголовок и свой текст о том, чего ещё нет. */}
          <Pressable
            onPress={() => openLegal("terms")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)",
              },
              pressed ? { opacity: 0.75 } : null,
            ]}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
              {d.parentApp.prof.terms}
            </Text>
            <ChevronRight />
          </Pressable>

          {/* Политика конфиденциальности — свой текст, см. выше. */}
          <Pressable
            onPress={() => openLegal("privacy")}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)",
              },
              pressed ? { opacity: 0.75 } : null,
            ]}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
              {d.parentApp.prof.privacy}
            </Text>
            <ChevronRight />
          </Pressable>
        </GlassCard>
      </ScrollView>

      {/* Подтверждение удаления аккаунта — CONFIRM_DIALOGS.deleteAccount (B8). */}
      <CenterModalFrame
        visible={delAccOpen}
        onClose={() => setDelAccOpen(false)}
        iconBg={`rgba(${tokens.status.red.rgb},0.12)`}
        iconBorder={`rgba(${tokens.status.red.rgb},0.35)`}
        icon={<TrashIcon size={24} stroke={2} color={tokens.status.red.text} />}
        title={delAccDialog?.title ?? "Удалить аккаунт?"}
        text={delAccDialog?.body}
      >
        {/* 15.08.2026 (заглушки). Красная кнопка «Удалить» тут просто закрывала
            модалку — самое опасное действие в приложении молча не делало
            ничего. Аккаунт заводит школа, удалять его из приложения нельзя,
            поэтому вместо кнопки-обманки стоит объяснение и обычное
            «Понятно»; строку в настройках при этом не прячем. */}
        <SoonNote text={d.parentApp.soon.notes.delAcc} />
        <Pressable
          onPress={() => setDelAccOpen(false)}
          accessibilityRole="button"
          style={{
            alignSelf: "stretch",
            marginTop: 10,
            paddingVertical: 14,
            borderRadius: 16,
            alignItems: "center",
            backgroundColor: scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,18,67,0.06)",
          }}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
            {d.parentApp.common.gotIt}
          </Text>
        </Pressable>
      </CenterModalFrame>
    </AppBackground>
  );
}

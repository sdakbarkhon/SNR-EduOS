/**
 * Экран dchpass «Изменить пароль» — REBUILD (текущий заход, block-by-block из
 * макета «SNR EduOS v2 Light.dc.html», блок data-screen-label="Изменить пароль",
 * layerDChPass — вербатимная разметка блока приведена в промпте задачи, без
 * номеров строк файла-макета).
 *
 * Block-list (порядок реализации 1:1):
 *  1. HeaderBar        — back-glass 38 (InnerHeader) + заголовок t.scr.chPass.
 *                         Правого слота нет (в макете этого блока — без иконки).
 *  2. ScrollContainer   — flex:1, gap:11, padding 4/18/118/18 (литеральное
 *                         значение из макета, резерв под FloatingTabBar).
 *  3. PasswordFieldsCard — glass r20, padding 12/14, gap:11, 3 группы полей:
 *   3a. CurrentPasswordField  — «ТЕКУЩИЙ ПАРОЛЬ», placeholder «••••••••»,
 *                               border-bottom 2px rgba(124,58,237,.35),
 *                               font 14/800 ink1, eye/eye-off toggle справа.
 *   3b. NewPasswordField      — «НОВЫЙ ПАРОЛЬ», placeholder «Минимум 8 символов»,
 *                               тот же паттерн поля + toggle.
 *   3c. ConfirmPasswordField  — «ПОВТОРИТЕ НОВЫЙ ПАРОЛЬ», placeholder «Ещё раз»,
 *                               тот же паттерн + toggle; ниже — условный красный
 *                               текст «Пароли не совпадают» (только когда оба
 *                               pw2/pw3 непустые и различаются).
 *  4. PasswordRequirementsCard — glass r20, padding 12/14, gap:8:
 *   4a. CaptionLabel «ТРЕБОВАНИЯ К ПАРОЛЮ» (uppercase, тот же стиль, что и
 *       лейблы полей выше — 9/800 tracking .06em, dimmed).
 *   4b. RulesList — по PASSWORD_RULES (getPasswordFixture()): чек-круг
 *       (заполненный зелёный + белая галочка, если pw2 удовлетворяет правилу;
 *       иначе — нейтральный контур) + текст правила.
 *   4c. StrengthRow — hairline-разделитель сверху + 3-сегментная шкала
 *       (закрашено ровно N=число выполненных правил сегментов, цвет по N:
 *       1=red, 2=orange, 3=green) + текстовый лейбл из PASSWORD_STRENGTH_LABELS.
 *  5. SaveButton — PrimaryButton, accent-градиент 135° #7c3aed→#4f6df5, лок-глиф
 *     + «Сохранить пароль»; disabled, пока pw1/pw2/pw3 не заполнены, pw2≠pw3,
 *     или не все правила выполнены. onPress — mock-действие (без реального API,
 *     как в SubmitWorkSheet.tsx): navigation.goBack().
 *  6. InfoBanner — плашка rgba(59,130,246,.1)/border rgba(59,130,246,.3),
 *     info-глиф 17 stroke #1D4ED8 + текст 10/600 LH1.55 «После смены пароля
 *     потребуется войти заново на всех устройствах, где выполнен вход в
 *     аккаунт.» (литерал из макета, стиль — 1:1 с InfoBanner из LimitsScreen.tsx).
 *
 * Экран НЕ показывает child-switcher — это account/security-раздел, не привязан
 * к ребёнку (подтверждено повторным чтением блока макета: сразу после шапки
 * идёт карточка полей, строки child-переключателя в этом блоке нет).
 *
 * Данные — только getPasswordFixture() (rules/strength_labels), реальных
 * API-вызовов нет (мок-действие, соответствует прецеденту AddCardScreen.tsx /
 * SubmitWorkSheet.tsx). Обе темы — useTheme(). Заголовок — d.parentApp.scr.chPass.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { fonts, useTheme, AppBackground } from "../../theme";
import { GlassCard, InnerHeader, PrimaryButton } from "../../ui";
import { getPasswordFixture } from "../../data";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

// ─── Иконки (react-native-svg, локальные — тот же приём, что в других экранах) ─

/** Открытый глаз 16×16 stroke 1.8 (стандартный feather-паттерн, показать пароль). */
function EyeIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  );
}

/** Перечёркнутый глаз 16×16 stroke 1.8 (скрыть пароль). */
function EyeOffIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a13.16 13.16 0 0 1-2.87 3.93" />
      <Path d="M6.61 6.61A13.53 13.53 0 0 0 1 12s4 8 11 8a9.27 9.27 0 0 0 5.39-1.61" />
      <Path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <Path d="M2 2l20 20" />
    </Svg>
  );
}

/** Чек-круг требования пароля (блок 4b): заполненный зелёный + галочка, либо
 *  нейтральный контур. */
function RequirementGlyph({ satisfied, fillColor, dimColor }: { satisfied: boolean; fillColor: string; dimColor: string }) {
  if (satisfied) {
    return (
      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={10} fill={fillColor} />
        <Path d="M8 12.3l2.5 2.5L16 9.3" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9.3} stroke={dimColor} strokeWidth={1.6} />
    </Svg>
  );
}

/** Лок-глиф кнопки «Сохранить пароль» (блок 5) — 15×15 stroke #fff, тот же
 *  приём, что и плюс-глиф AddCardCTA в AddCardScreen.tsx. */
function LockIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 11h14v9H5z" />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

/** Info-иконка баннера (блок 6) — 1:1 с InfoGlyph из LimitsScreen.tsx. */
function InfoGlyph() {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="#1D4ED8" strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 16v-4" stroke="#1D4ED8" strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 8h.01" stroke="#1D4ED8" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Вывод соответствия правила текущему паролю (генерическая инференция по
//     тексту правила фикстуры — фикстура сейчас: «Минимум 8 символов»,
//     «Есть заглавная буква», «Есть цифра») ────────────────────────────────────

function isRuleSatisfied(rule: string, pw: string): boolean {
  const lower = rule.toLowerCase();
  const lenMatch = lower.match(/(\d+)\s*симв/);
  if (lenMatch) return pw.length >= Number(lenMatch[1]);
  if (lower.includes("заглавн")) return /[A-ZА-ЯЁ]/.test(pw);
  if (lower.includes("строчн")) return /[a-zа-яё]/.test(pw);
  if (lower.includes("цифр")) return /\d/.test(pw);
  if (lower.includes("специальн")) return /[^A-Za-z0-9А-Яа-яЁё]/.test(pw);
  // Фолбэк для неизвестного будущего правила — считаем выполненным, если
  // пароль вообще непустой (консервативная, не фальсифицирующая эвристика).
  return pw.length > 0;
}

/** Группа поля: uppercase-лейбл 9/800 tracking .06em + контент (1:1 с
 *  FieldGroup из AddCardScreen.tsx — единый приём для всех полей экрана). */
function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const { tokens, scheme } = useTheme();
  return (
    <View style={{ flexDirection: "column", gap: 4 }}>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 9,
          letterSpacing: 9 * 0.06,
          color: scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.5)",
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

/** Строка ввода пароля с toggle видимости (блок 3a/3b/3c). */
function PasswordInputRow({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisible,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.fieldUnderline, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.ink3}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { flex: 1, color: tokens.ink1 }]}
      />
      <Pressable onPress={onToggleVisible} hitSlop={8}>
        {visible ? <EyeOffIcon color={tokens.ink3} /> : <EyeIcon color={tokens.ink3} />}
      </Pressable>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation<Nav>();

  const { rules, strength_labels } = getPasswordFixture();

  // Стейт формы (pw1=текущий, pw2=новый, pw3=повтор) + видимость каждого поля.
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pw3, setPw3] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(false);

  const mismatch = pw3.length > 0 && pw2 !== pw3;

  const satisfiedFlags = useMemo(() => rules.map((r) => isRuleSatisfied(r, pw2)), [rules, pw2]);
  const satisfiedCount = satisfiedFlags.filter(Boolean).length;

  const canSave =
    pw1.length > 0 && pw2.length > 0 && pw3.length > 0 && pw2 === pw3 && satisfiedCount === rules.length;

  // Цвет 3-сегментной шкалы по числу выполненных правил (1=red,2=orange,3=green).
  const strengthColor =
    satisfiedCount >= 3 ? tokens.status.green.text : satisfiedCount === 2 ? tokens.status.orange.text : tokens.status.red.text;
  const strengthLabel = satisfiedCount > 0 ? strength_labels[Math.min(satisfiedCount, strength_labels.length) - 1] : "";
  const segmentDim = scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(23,18,67,0.1)";
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(23,18,67,0.07)";
  const captionColor = scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.5)";
  const ruleTextColor = tokens.ink1;
  const ruleDimColor = scheme === "dark" ? "rgba(255,255,255,0.28)" : "rgba(26,19,74,0.28)";
  const bannerText = scheme === "light" ? "rgba(26,19,74,0.7)" : "rgba(255,255,255,0.78)";

  /** upSavePass — мок-действие: реального API нет, просто возвращаемся назад
   *  (прецедент SubmitWorkSheet.tsx / AddCardScreen.tsx). */
  const doSavePass = () => {
    if (!canSave) return;
    navigation.goBack();
  };

  return (
    <AppBackground>
      {/* 1. HeaderBar — без правого слота. */}
      <InnerHeader title={t.scr.chPass} titleSize={15} onBackPress={() => navigation.goBack()} />

      {/* 2. ScrollContainer — padding 4/18/118/18, gap 11. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* 3. PasswordFieldsCard. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 11 }}>
          {/* 3a. Текущий пароль. */}
          <FieldGroup label="ТЕКУЩИЙ ПАРОЛЬ">
            <PasswordInputRow
              value={pw1}
              onChangeText={setPw1}
              placeholder="••••••••"
              visible={show1}
              onToggleVisible={() => setShow1((v) => !v)}
            />
          </FieldGroup>

          {/* 3b. Новый пароль. */}
          <FieldGroup label="НОВЫЙ ПАРОЛЬ">
            <PasswordInputRow
              value={pw2}
              onChangeText={setPw2}
              placeholder="Минимум 8 символов"
              visible={show2}
              onToggleVisible={() => setShow2((v) => !v)}
            />
          </FieldGroup>

          {/* 3c. Повтор нового пароля + условный текст несовпадения. */}
          <FieldGroup label="ПОВТОРИТЕ НОВЫЙ ПАРОЛЬ">
            <View style={{ gap: 4 }}>
              <PasswordInputRow
                value={pw3}
                onChangeText={setPw3}
                placeholder="Ещё раз"
                visible={show3}
                onToggleVisible={() => setShow3((v) => !v)}
              />
              {mismatch ? (
                <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.status.red.text }}>
                  Пароли не совпадают
                </Text>
              ) : null}
            </View>
          </FieldGroup>
        </GlassCard>

        {/* 4. PasswordRequirementsCard. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 8 }}>
          {/* 4a. Caption. */}
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 9,
              letterSpacing: 9 * 0.06,
              color: captionColor,
            }}
          >
            ТРЕБОВАНИЯ К ПАРОЛЮ
          </Text>

          {/* 4b. RulesList. */}
          <View style={{ gap: 7 }}>
            {rules.map((rule, i) => (
              <View key={rule} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <RequirementGlyph
                  satisfied={satisfiedFlags[i]}
                  fillColor={tokens.status.green.text}
                  dimColor={ruleDimColor}
                />
                <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: ruleTextColor }}>
                  {rule}
                </Text>
              </View>
            ))}
          </View>

          {/* 4c. StrengthRow — hairline + 3-сегментная шкала + лейбл. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: dividerColor,
            }}
          >
            <View style={{ flex: 1, flexDirection: "row", gap: 4 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: i < satisfiedCount ? strengthColor : segmentDim,
                  }}
                />
              ))}
            </View>
            <Text
              numberOfLines={1}
              style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: satisfiedCount > 0 ? strengthColor : tokens.ink3 }}
            >
              {strengthLabel}
            </Text>
          </View>
        </GlassCard>

        {/* 5. SaveButton. */}
        <PrimaryButton label="Сохранить пароль" disabled={!canSave} onPress={doSavePass} icon={<LockIcon />} />

        {/* 6. InfoBanner. */}
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
            После смены пароля потребуется войти заново на всех устройствах, где выполнен вход в
            аккаунт.
          </Text>
        </View>
      </ScrollView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    fontFamily: fonts.manrope800,
    fontSize: 14,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  /** Фиолетовая нижняя граница-подчёркивание 2px .35 — 1:1 с fieldUnderline
   *  из AddCardScreen.tsx (единый приём для полей ввода этого приложения). */
  fieldUnderline: {
    borderBottomWidth: 2,
    borderBottomColor: "rgba(124,58,237,0.35)",
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
});

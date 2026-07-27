/**
 * П-AddCard «Добавить карту» — Заход 6, block-by-block из макета
 * «SNR EduOS v2 Light.dc.html», строки 1872–1904 (data-screen-label
 * «Добавить карту», layerDAddCard).
 *
 * Порядок блоков (block-list):
 *  1874–1878 TopBar (glass-back 38 + Unbounded 15 title + красная «Отмена» справа)
 *  1879      ScrollContainer (gap 11, padding 4/18/118/18)
 *  1880–1884 CardPreview (гр. 135° #7c3aed→#4f6df5, декор-круг, brand/num/name/exp)
 *  1885–1889 CardFieldsGlassCard (glass1 r20; NumberField + brand-chip; Exp+CVV row;
 *            HolderName; фиолетовая нижняя граница-подчёркивание 2px .35)
 *  1890–1893 MainCardCheckboxRow (glass row 18px; квадратный чекбокс + текст)
 *  1894      AddCardCTA (accent-грaд. PrimaryButton с плюсом; disabled при пустых полях)
 *  1895–1898 SecuritySafeNotice (row shield-glyph + текст на зелёном фоне .1/.3)
 *
 * Данные — только через фикстуры (getCardsFixture: CARD_BIN_BRANDS для
 * определения бренда по BIN, ADD_CARD_PLACEHOLDERS для плейсхолдеров срока
 * и имени держателя). Реального сохранения карты нет — CTA просто
 * возвращает на предыдущий экран (в проде здесь будет экран платёжного
 * провайдера).
 *
 * ЗАМЕТКА для интеграции: в проде форма ввода реквизитов карты не
 * должна жить в приложении вообще — это экран платёжного шлюза (Payme
 * Merchant/Uzcard PSP), возвращающий токен карты. Здесь она есть только
 * для демо-макета.
 *
 * i18n: заголовок и CTA — d.parentApp.pay.addCardTitle; лейблы полей —
 * d.parentApp.pay.cardNumber/cardExpiry/cardCvv/cardHolder; «Отмена» —
 * d.parentApp.common.cancelAction. «Сделать основной картой» и текст
 * security-notice в словаре макета отсутствуют — оставлены литералами
 * (как и «Данные карты не хранятся…» в HTML-макете 1898).
 *
 * Обе темы через useTheme(); iOS safe-area — max(insets.top, 46) в кастомном
 * TopBar; нижний отступ 118 под таб-бар (не таб-экран, но паддинг из макета).
 */
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { GlassCircleButton, PrimaryButton } from "../../ui";
import { getCardsFixture } from "../../data";
import type { MainStackParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ── Хелперы форматирования и валидации ───────────────────────────────────────

/** Оставить только цифры и обрезать длину. */
function digitsOnly(input: string, max: number): string {
  return input.replace(/\D+/g, "").slice(0, max);
}

/** Формат номера карты: группы по 4 цифры, разделитель пробел (макет 1882). */
function formatCardNumber(raw: string): string {
  const d = digitsOnly(raw, 19);
  const groups: string[] = [];
  for (let i = 0; i < d.length; i += 4) groups.push(d.slice(i, i + 4));
  return groups.join(" ");
}

/** Формат срока: ММ/ГГ. */
function formatExpiry(raw: string): string {
  const d = digitsOnly(raw, 4);
  if (d.length <= 2) return d;
  return d.slice(0, 2) + "/" + d.slice(2);
}

/**
 * Бренд по BIN — единый источник CARD_BIN_BRANDS фикстуры (payments.ts B6).
 * Матчинг по префиксу; если ничего не подошло — 'CARD'.
 */
function detectBrand(
  cardNumberDigits: string,
  bins: readonly (readonly [string, string])[],
): string {
  for (const [prefix, brand] of bins) {
    if (cardNumberDigits.startsWith(prefix)) return brand;
  }
  return "CARD";
}

// ── Компонент ────────────────────────────────────────────────────────────────

export default function AddCardScreen() {
  const { d } = useAppLocale();
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const t = d.parentApp.pay;
  const tc = d.parentApp.common;

  const { bin_brands, add_card_placeholders } = getCardsFixture();

  // Состояния формы. Все поля — controlled useState, пересчёт бренда и
  // enabled-состояния CTA — по числу заполненных полей.
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [holder, setHolder] = useState("");
  const [isMain, setIsMain] = useState(false);

  const digits = useMemo(() => cardNumber.replace(/\D+/g, ""), [cardNumber]);
  const brand = useMemo(() => detectBrand(digits, bin_brands), [digits, bin_brands]);

  // «acBtnStyle»: заблокирована при пустых полях (правила заказчика —
  // видимая disabled-плашка + не нажимается). Порог валидности берём по
  // разумному минимуму, а не по строгой Luhn/13-19/CVV/MMYY — макет тоже
  // не валидирует, а нам важно поведение disabled → enabled при вводе.
  const canSubmit =
    digits.length >= 13 &&
    expiry.replace(/\D+/g, "").length === 4 &&
    cvv.replace(/\D+/g, "").length >= 3 &&
    holder.trim().length >= 2;

  const doAddCard = () => {
    if (!canSubmit) return;
    // Стаб — в проде отсюда уходим в экран платёжного провайдера, здесь
    // просто возвращаемся назад к «Способам оплаты».
    navigation.goBack();
  };

  // Значения превью — с плейсхолдерами (см. макет 1882–1884).
  const numPreview = cardNumber || "•••• •••• •••• ••••";
  const namePreview =
    holder.trim() !== ""
      ? holder.trim().toUpperCase()
      : add_card_placeholders.holder;
  const expPreview = expiry || add_card_placeholders.expiry;

  // Плейсхолдеры/цвета текста (для placeholderTextColor).
  const placeholderColor = tokens.ink3;

  return (
    <AppBackground>
      {/* 1874–1878 · TopBar: back + title + Cancel-ссылка. Кастомный, а не
          InnerHeader, потому что справа нужен красный текстовый Pressable
          с фирменным цветом статуса red (не круглая glass-кнопка). */}
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
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.ink1}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M19 12H5" />
            <Path d="m12 19-7-7 7-7" />
          </Svg>
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
          {t.addCardTitle}
        </Text>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11.5,
              color: tokens.status.red.text,
            }}
          >
            {tc.cancelAction}
          </Text>
        </Pressable>
      </View>

      {/* 1879 · ScrollContainer. */}
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
        {/* 1880–1884 · CardPreview (violet→blue градиент 135°). */}
        <CardPreview
          brand={brand}
          numberText={numPreview}
          holderText={namePreview}
          expiryText={expPreview}
        />

        {/* 1885–1889 · CardFieldsGlassCard. */}
        <GlassFormCard>
          {/* (a) Номер карты */}
          <FieldGroup label={t.cardNumber.toUpperCase()}>
            <View
              style={[
                styles.fieldUnderline,
                { flexDirection: "row", alignItems: "center", gap: 8 },
              ]}
            >
              <TextInput
                value={cardNumber}
                onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                placeholder="0000 0000 0000 0000"
                placeholderTextColor={placeholderColor}
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={19 + 4} /* 16 digits + 3 spaces max (allow 19-digit) */
                style={[styles.input, { flex: 1, color: tokens.ink1 }]}
              />
              <BrandChip label={brand} />
            </View>
          </FieldGroup>

          {/* (b) Срок + CVV */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <FieldGroup label={t.cardExpiry.toUpperCase()}>
                <View style={styles.fieldUnderline}>
                  <TextInput
                    value={expiry}
                    onChangeText={(v) => setExpiry(formatExpiry(v))}
                    placeholder={add_card_placeholders.expiry}
                    placeholderTextColor={placeholderColor}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    maxLength={5}
                    style={[styles.input, { color: tokens.ink1, width: "100%" }]}
                  />
                </View>
              </FieldGroup>
            </View>
            <View style={{ flex: 1 }}>
              <FieldGroup label={t.cardCvv.toUpperCase()}>
                <View style={styles.fieldUnderline}>
                  <TextInput
                    value={cvv}
                    onChangeText={(v) => setCvv(digitsOnly(v, 4))}
                    placeholder="•••"
                    placeholderTextColor={placeholderColor}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    style={[styles.input, { color: tokens.ink1, width: "100%" }]}
                  />
                </View>
              </FieldGroup>
            </View>
          </View>

          {/* (c) Имя держателя */}
          <FieldGroup label={t.cardHolder.toUpperCase()}>
            <View style={styles.fieldUnderline}>
              <TextInput
                value={holder}
                onChangeText={(v) =>
                  // Только буквы, пробелы, дефисы; авто-uppercase.
                  setHolder(v.replace(/[^A-Za-zА-Яа-яЁё\-\s]/g, "").toUpperCase())
                }
                placeholder="Как на карте"
                placeholderTextColor={placeholderColor}
                autoCapitalize="characters"
                style={[styles.input, { color: tokens.ink1, width: "100%" }]}
              />
            </View>
          </FieldGroup>
        </GlassFormCard>

        {/* 1890–1893 · MainCardCheckboxRow. */}
        <MainCardCheckboxRow
          checked={isMain}
          onToggle={() => setIsMain((v) => !v)}
          label="Сделать основной картой"
        />

        {/* 1894 · AddCardCTA — PrimaryButton с иконкой «плюс». */}
        <PrimaryButton
          label={t.addCardTitle}
          disabled={!canSubmit}
          onPress={doAddCard}
          icon={
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M12 5v14" />
              <Path d="M5 12h14" />
            </Svg>
          }
        />

        {/* 1895–1898 · SecuritySafeNotice — зелёная строка со щитом и подписью. */}
        <SecuritySafeNotice
          greenText={tokens.status.green.text}
          greenRgb={tokens.status.green.rgb}
          bodyColor={scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.7)"}
        />
      </ScrollView>
    </AppBackground>
  );
}

// ── Подкомпоненты ────────────────────────────────────────────────────────────

/** CardPreview (макет 1880–1884): градиент 135° #7c3aed→#4f6df5, r22,
 *  padding 16, декоративный полупрозрачный круг 120×120 в правом верхнем
 *  углу (top:-30, right:-30), сверху бренд, номер и нижняя строка с именем
 *  держателя + срок действия. Тень фиолетовая + inset верхний блик. */
function CardPreview({
  brand,
  numberText,
  holderText,
  expiryText,
}: {
  brand: string;
  numberText: string;
  holderText: string;
  expiryText: string;
}) {
  const g = gradPoints(135);
  return (
    <View
      style={[
        shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(124,58,237,0.38)" }),
        { borderRadius: 22 },
      ]}
    >
      <View
        style={{
          borderRadius: 22,
          overflow: "hidden",
          padding: 16,
          gap: 12,
        }}
      >
        <LinearGradient
          colors={["#7c3aed", "#4f6df5"]}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
        {/* Декор-круг (макет 1881). */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: "rgba(255,255,255,0.12)",
          }}
        />
        {/* inset-блик (макет 1880: inset 0 1.5 0 rgba(255,255,255,.35)). */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1.5,
            backgroundColor: "rgba(255,255,255,0.35)",
          }}
        />
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 12,
            letterSpacing: 12 * 0.08,
            color: "#FFFFFF",
          }}
        >
          {brand}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 16,
            letterSpacing: 16 * 0.13,
            color: "#FFFFFF",
          }}
        >
          {numberText}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontFamily: fonts.manrope700,
              fontSize: 10.5,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {holderText}
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 10.5,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {expiryText}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Стеклянная карточка формы полей (макет 1885): glass1-стиль, r20, padding
 *  12/14, blur 22, белая граница, тень + inset блик. Внутри — group'ы полей. */
function GlassFormCard({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  const g = gradPoints(tokens.glass1.angle);
  return (
    <View style={[shadowStyle(tokens.shCard), { borderRadius: 20 }]}>
      <View
        style={{
          borderRadius: 20,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
          padding: 12,
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        {/* Стекло — заливка градиентом (в GlassCard добавляется ещё
            expo-blur, но здесь достаточно градиента: карточка формы —
            тонкая и постоянно поверх статичного фона). Для тёмной темы
            цвета glass1 автоматически другие через tokens. */}
        <LinearGradient
          colors={tokens.glass1.colors as [string, string]}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
        {/* inset-блик стекла. */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: tokens.glassInset.y,
            backgroundColor: tokens.glassInset.color,
          }}
        />
        {children}
      </View>
    </View>
  );
}

/** Группа поля: uppercase-лейбл 9/800 letter-spacing .06em + инпут-обёртка. */
function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const { tokens, scheme } = useTheme();
  return (
    <View style={{ flexDirection: "column", gap: 4 }}>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 9,
          letterSpacing: 9 * 0.06,
          // Макет: rgba(26,19,74,.5) — совпадает с ink3 в светлой, для
          // тёмной берём ink3 из токенов.
          color: scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.5)",
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

/** BrandChip в правой части поля «Номер карты» (макет 1887, стиль acBrandChip). */
function BrandChip({ label }: { label: string }) {
  const { tokens } = useTheme();
  const chip = tokens.chip("124,58,237"); // фиолет акцента
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: chip.bg,
        borderWidth: 1,
        borderColor: chip.border,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 9,
          letterSpacing: 9 * 0.06,
          color: tokens.accent,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** MainCardCheckboxRow (макет 1890–1893): glass row с квадратным чекбоксом. */
function MainCardCheckboxRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  const { tokens } = useTheme();
  const g = gradPoints(tokens.glass1.angle);
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        shadowStyle(tokens.shCard),
        { borderRadius: 18 },
        pressed ? { opacity: 0.9 } : null,
      ]}
    >
      <View
        style={{
          borderRadius: 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: tokens.glassBorder,
          padding: 12,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <LinearGradient
          colors={tokens.glass1.colors as [string, string]}
          start={g.start}
          end={g.end}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: tokens.glassInset.y,
            backgroundColor: tokens.glassInset.color,
          }}
        />
        {/* Квадратный чекбокс 20×20 r6 — заполнен акцент-градиентом при
            checked, иначе прозрачный с фиолетовой границей (стиль acMainCk). */}
        <Checkbox checked={checked} />
        <Text
          style={{
            flex: 1,
            fontFamily: fonts.manrope800,
            fontSize: 11.5,
            color: tokens.ink1,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function Checkbox({ checked }: { checked: boolean }) {
  const { tokens } = useTheme();
  const g = gradPoints(135);
  if (checked) {
    return (
      <View
        style={[
          shadowStyle({ x: 0, y: 4, blur: 10, color: "rgba(124,58,237,0.35)" }),
          { borderRadius: 6 },
        ]}
      >
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinearGradient
            colors={["#7c3aed", "#4f6df5"]}
            start={g.start}
            end={g.end}
            style={StyleSheet.absoluteFill}
          />
          <Svg
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M20 6 9 17l-5-5" />
          </Svg>
        </View>
      </View>
    );
  }
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: tokens.accent,
        backgroundColor: "transparent",
      }}
    />
  );
}

/** SecuritySafeNotice (макет 1895–1898): row shield-glyph + текст на зелёном
 *  фоне (rgba(16,185,129,.1)) с границей rgba(16,185,129,.3). */
function SecuritySafeNotice({
  greenText,
  greenRgb,
  bodyColor,
}: {
  greenText: string;
  greenRgb: string;
  bodyColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        padding: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: `rgba(${greenRgb},0.1)`,
        borderWidth: 1,
        borderColor: `rgba(${greenRgb},0.3)`,
      }}
    >
      <Svg
        width={17}
        height={17}
        viewBox="0 0 24 24"
        fill="none"
        stroke={greenText}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d="M20 13c0 5-3.5 7.5-7.7 9a.6.6 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z" />
        <Path d="m9 12 2 2 4-4" />
      </Svg>
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.manrope600,
          fontSize: 10,
          lineHeight: 10 * 1.55,
          color: bodyColor,
        }}
      >
        Данные карты не хранятся в приложении — они передаются напрямую платёжному провайдеру по защищённому каналу.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    fontFamily: fonts.manrope800,
    fontSize: 14,
    backgroundColor: "transparent",
    // Убираем нативную обводку iOS/Android для input.
    borderWidth: 0,
  },
  /** Фиолетовая нижняя граница-подчёркивание 2px .35 (макет 1886/1888/1889). */
  fieldUnderline: {
    borderBottomWidth: 2,
    borderBottomColor: "rgba(124,58,237,0.35)",
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
});

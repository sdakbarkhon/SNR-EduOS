/**
 * Экран #28 «Поддержка / Бухгалтерия» — REBUILD (Заход 7, block-by-block из макета).
 *
 * ИСПРАВЛЕНИЕ (пост-заход 8): заголовок/meta-card/пункт меню «Профиль
 * службы» вели на generic-заглушку stubKey:"teacherprof", пункт меню
 * «Уведомления» — на stubKey:"notif", хотя dteach (TeacherProfileScreen,
 * заход 5) и d8 (NotificationsScreen, заход 5) уже реальные экраны. Теперь
 * ведут напрямую. «Поиск в чате» (da6) и «Прикрепить файл» (afile) остаются
 * заглушкой/действием — не в объёме этого фикса.
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», строки 873–907
 * (data-screen-label="Экран 28 Поддержка"):
 *
 *  1. 874–878  Header: back (38 glass) + column(title 14/600, subtitle
 *              «Онлайн» с зелёной точкой 5×5) + kebab (38 glass). Иконок
 *              phone/video нет в макете — соответствует UI-decision «убрать
 *              phone/video» (см. extract chat #25).
 *  2. 880–884  Meta-card службы поддержки: аватар 40 (grad #8b5cf6→#6366f1,
 *              иконка headset), name «Поддержка SNR EduOS» + note
 *              «Мы отвечаем быстро», справа — колонка «Среднее время ответа»
 *              и «5 мин» акцентом #047857.
 *  3. 885      Caption uppercase «ПОПУЛЯРНЫЕ ВОПРОСЫ» (10/800 letter-spacing).
 *  4. 886–891  Chips row (flex-wrap gap 6): 4 цветных pill-чипа
 *              (violet/pink/blue/orange). Значения — из SUPPORT_CHIPS.
 *  5. 892      Day divider «Сегодня» — центрированная glass-плашка (r999).
 *  6. 893      Outgoing #1 (10:15) + double-check — bubble rgba(139,92,246,.16)
 *              с бордером rgba(139,92,246,.32), радиусы 16 16 5 16.
 *  7. 894      Incoming #1 (10:16) — mini-avatar 24 support + white glass bubble,
 *              радиусы 16 16 16 5.
 *  8. 895      Outgoing #2 (10:17).
 *  9. 896      Incoming rich card #2 (10:19) — «Информация по счёту» с зелёной
 *              каёмкой rgba(16,185,129,.4), 18×18 check-badge #10b981 и
 *              заголовком #047857.
 *  10. 897     Outgoing #3 (10:20).
 *  11. 899–905 Input bar: attach 34 (rgba(139,92,246,.14) + paperclip #6d28d9)
 *              + TextInput + send 36 (accent-grad + paper-plane #fff).
 *              Микрофона и эмодзи-иконки в макете НЕТ (совпадает с UI-decision).
 *
 * Данные — через getSupportChat() (src/data). Тексты хедера / meta-card /
 * плейсхолдер поля — из фикстуры и словаря d.parentApp.msg. Обе темы — через
 * useTheme(); iOS safe-area — вручную (шапка + KeyboardAvoidingView + inset
 * снизу). Экран стековый — FloatingTabBar здесь не рендерится.
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppBackground,
  fonts,
  gradPoints,
  shadowStyle,
  useTheme,
} from "../../theme";
import { GlassCard, GlassCircleButton, Popover } from "../../ui";
import { getSupportChat } from "../../data";
import { getDueBills, getDueTotal } from "../../data";
import { useChildScope } from "../../hooks/useChildScope";
import { formatMoney } from "../../utils/format";
import { DemoBanner, SoonNote } from "../../ui/notices";
import type { ChatMessageRow } from "../../data/types";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, StubKey } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** Градиент фирменного аватара поддержки (макет 881, 894, 896). */
const SUPPORT_GRAD: [string, string] = ["#8B5CF6", "#6366F1"];
/** Градиент send-кнопки и accent-элементов (макет 903, тень 0 8 18 rgba(124,58,237,.4)). */
const SEND_GRAD: [string, string] = ["#7C3AED", "#4F6DF5"];
/** Градиент исходящего bubble body — фиолет rgba(139,92,246,α), общий для тем. */
const OUT_BUBBLE_BG = "rgba(139,92,246,0.16)";
const OUT_BUBBLE_BORDER = "rgba(139,92,246,0.32)";
const OUT_TIME_COLOR = "#6D28D9";

/** Цвета chips «Популярные вопросы» (макет 887–890). */
const CHIP_PRESETS = [
  { bg: "rgba(139,92,246,0.13)", border: "rgba(139,92,246,0.33)", text: "#6D28D9" },
  { bg: "rgba(236,72,153,0.12)", border: "rgba(236,72,153,0.30)", text: "#BE185D" },
  { bg: "rgba(2,132,199,0.12)", border: "rgba(2,132,199,0.30)", text: "#0369A1" },
  { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.30)", text: "#C2410C" },
];

/** Иконка поддержки (headset) 18×18 stroke 1.8 — макет 881. */
const SUPPORT_ICON_PATHS = [
  "M4 14v-2a8 8 0 0 1 16 0v2",
  // rect'ы отрисуем отдельно ниже (Rect), т.к. path не покрывает rx полностью.
];

export default function SupportScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const chat = getSupportChat();

  // 23.08.2026. В фикстуре стояли фикстурное имя ребёнка и сумма счёта
  // литералом. Имя убрано совсем, класс берётся у настоящего ребёнка, а
  // сумма — из тех же BILLS, что и раздел оплат: разойтись им негде.
  const { child } = useChildScope();
  const dueLine = getDueBills()
    .map((b) => `${b.title.split(" · ")[0].toLowerCase()} — ${formatMoney(b.amount)}`)
    .join(", ");
  const messages = chat.messages.map((m) => ({
    ...m,
    text: m.text
      .replace("{class}", child ? `${child.class_name} класс` : "")
      .replace("{sum}", `${dueLine}, итого ${formatMoney(getDueTotal())}`),
  }));
  const [text, setText] = useState("");
  // 15.08.2026 (заглушки). Кнопка «отправить» раньше просто чистила поле:
  // текст исчезал, сообщение не появлялось, и родитель не понимал, ушло оно
  // или нет. Теперь она объясняет, почему отправлять некуда.
  const [sendNote, setSendNote] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const openStub = (key: StubKey) => {
    setMenuOpen(false);
    navigation.navigate("stub", { stubKey: key });
  };
  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  const headerTitle = `${chat.header.title} / ${chat.header.subtitle}`;
  const placeholder = d.parentApp.msg.typeMessage;

  return (
    <AppBackground>
      {/* ═══════════ 1. Header (44–878) ═══════════ */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingTop: Math.max(insets.top, 46),
          paddingHorizontal: 18,
          paddingBottom: 8,
        }}
      >
        <GlassCircleButton onPress={goBack}>
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

        {/* Клик по заголовку/аватару = профиль контакта поддержки
         *  (UI-decision extract, п.2 — общее правило chat #25). */}
        <Pressable
          onPress={() => navigation.navigate("dteach")}
          style={{ flex: 1 }}
          hitSlop={4}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.unbounded600,
              fontSize: 14,
              color: tokens.ink1,
            }}
          >
            {headerTitle}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: "#22C55E",
              }}
            />
            <Text
              style={{
                fontFamily: fonts.manrope700,
                fontSize: 9.5,
                color: tokens.status.green.text,
              }}
            >
              {chat.header.status_label}
            </Text>
          </View>
        </Pressable>

        {/* Kebab (three-dot) menu — Popover со стандартными «действиями чата». */}
        <View style={{ position: "relative" }}>
          <GlassCircleButton onPress={() => setMenuOpen((v) => !v)}>
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill={tokens.ink1}
              stroke="none"
            >
              <Path d="M5 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z" />
              <Path d="M12 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z" />
              <Path d="M19 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z" />
            </Svg>
          </GlassCircleButton>
          <Popover visible={menuOpen} align="right" width={190} top={44}>
            <MenuItem label="Профиль службы" onPress={() => navigation.navigate("dteach")} />
            <MenuItem label="Уведомления" onPress={() => navigation.navigate("d8")} />
            <MenuItem label="Поиск в чате" onPress={() => openStub("search")} />
          </Popover>
        </View>
      </View>

      {/* ═══════════ Скролл + input bar с KeyboardAvoiding ═══════════ */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: 6,
            paddingBottom: 12,
            gap: 9,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 2. Meta-card поддержки */}
          <GlassCard
            radius={18}
            contentStyle={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 11,
              paddingHorizontal: 13,
            }}
            onPress={() => navigation.navigate("dteach")}
          >
            <SupportAvatar size={40} iconSize={18} withShadow />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 12.5,
                  color: tokens.ink1,
                }}
              >
                {chat.header.card_name}
              </Text>
              <Text
                style={{
                  marginTop: 1,
                  fontFamily: fonts.manrope600,
                  fontSize: 9.5,
                  color: tokens.ink2,
                }}
              >
                {chat.header.card_note}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 8.5,
                  color: tokens.ink3,
                }}
              >
                {d.parentApp.msg.avgReply}
              </Text>
              <Text
                style={{
                  marginTop: 1,
                  fontFamily: fonts.manrope800,
                  fontSize: 11,
                  color: tokens.status.green.text,
                }}
              >
                {chat.header.avg_reply_label}
              </Text>
            </View>
          </GlassCard>

          {/* Плашка «это пример» — службы поддержки в системе школы нет. */}
          <DemoBanner text={d.parentApp.soon.sections.support} />

          {/* 3. Section label caps */}
          <Text
            style={{
              marginTop: 2,
              fontFamily: fonts.manrope800,
              fontSize: 10,
              letterSpacing: 0.7,
              color: scheme === "dark" ? "rgba(255,255,255,0.55)" : "rgba(26,19,74,0.5)",
            }}
          >
            ПОПУЛЯРНЫЕ ВОПРОСЫ
          </Text>

          {/* 4. Chips row (flex-wrap) */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {chat.chips.map((chip, i) => {
              const preset = CHIP_PRESETS[i % CHIP_PRESETS.length];
              return (
                <Pressable
                  key={chip.label}
                  onPress={() => setText(chip.text)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 11,
                    borderRadius: 999,
                    backgroundColor: preset.bg,
                    borderColor: preset.border,
                    borderWidth: 1,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 10,
                      color: preset.text,
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* 5. Day divider */}
          <DayDividerPill label={d.parentApp.date.today} />

          {/* 6–10. Сообщения */}
          {messages.map((m, i) => (
            <MessageRow key={i} row={m} />
          ))}
        </ScrollView>

        {/* 11. Input bar (44–905) */}
        <View
          style={{
            paddingHorizontal: 18,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 10) + 6,
          }}
        >
          {sendNote ? <SoonNote text={d.parentApp.soon.notes.supportSend} /> : null}

          <InputBar
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            onAttach={() => openStub("afile")}
            onSend={() => setSendNote(true)}
          />
        </View>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

/* ═══════════════════ Support avatar ═══════════════════ */

function SupportAvatar({
  size,
  iconSize,
  withShadow,
}: {
  size: number;
  iconSize: number;
  withShadow?: boolean;
}) {
  return (
    <View
      style={
        withShadow
          ? shadowStyle({
              x: 0,
              y: 6,
              blur: 14,
              color: "rgba(99,102,241,0.35)",
            })
          : undefined
      }
    >
      <LinearGradient
        colors={SUPPORT_GRAD}
        {...gradPoints(135)}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {SUPPORT_ICON_PATHS.map((p, i) => (
            <Path key={i} d={p} />
          ))}
          <Rect x={3} y={14} width={4} height={6} rx={2} />
          <Rect x={17} y={14} width={4} height={6} rx={2} />
        </Svg>
      </LinearGradient>
    </View>
  );
}

/* ═══════════════════ Day-divider pill ═══════════════════ */

function DayDividerPill({ label }: { label: string }) {
  const { scheme } = useTheme();
  const bgColors: [string, string] =
    scheme === "dark"
      ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.05)"]
      : ["rgba(255,255,255,0.70)", "rgba(255,255,255,0.50)"];
  const border =
    scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.80)";
  const color =
    scheme === "dark" ? "rgba(255,255,255,0.60)" : "rgba(26,19,74,0.60)";
  return (
    <View style={{ alignSelf: "center", marginTop: 2 }}>
      <LinearGradient
        colors={bgColors}
        {...gradPoints(160)}
        style={{
          paddingVertical: 5,
          paddingHorizontal: 12,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: border,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 9.5,
            color,
          }}
        >
          {label}
        </Text>
      </LinearGradient>
    </View>
  );
}

/* ═══════════════════ Message row ═══════════════════ */

function MessageRow({ row }: { row: ChatMessageRow }) {
  if (row.from === "p") return <OutgoingBubble row={row} />;
  return <IncomingRow row={row} />;
}

/* — Outgoing bubble (макет 893, 895, 897) — */

function OutgoingBubble({ row }: { row: ChatMessageRow }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        maxWidth: "80%",
        alignSelf: "flex-end",
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 5,
        backgroundColor: OUT_BUBBLE_BG,
        borderWidth: 1,
        borderColor: OUT_BUBBLE_BORDER,
        gap: 3,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.manrope600,
          fontSize: 11.5,
          lineHeight: 11.5 * 1.5,
          color: tokens.ink1,
        }}
      >
        {row.text}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          alignSelf: "flex-end",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 8.5,
            color: OUT_TIME_COLOR,
          }}
        >
          {row.time_label}
        </Text>
        {/* Double-check (макет 893: SVG 12×9 viewBox 18×12, stroke #6d28d9). */}
        <Svg width={12} height={9} viewBox="0 0 18 12" fill="none">
          <Path
            d="m1 6 4 4L13 2"
            stroke={OUT_TIME_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="m7 8 2 2L17 2"
            stroke={OUT_TIME_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  );
}

/* — Incoming bubble/row (макет 894, 896) — */

function IncomingRow({ row }: { row: ChatMessageRow }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 6,
        maxWidth: "88%",
        alignSelf: "flex-start",
      }}
    >
      <SupportAvatar size={24} iconSize={11} />
      {row.is_info_card ? (
        <InvoiceCardBubble row={row} />
      ) : (
        <IncomingPlainBubble row={row} />
      )}
    </View>
  );
}

function IncomingPlainBubble({ row }: { row: ChatMessageRow }) {
  const { tokens, scheme } = useTheme();
  const bg: [string, string] =
    scheme === "dark"
      ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"]
      : ["rgba(255,255,255,0.75)", "rgba(255,255,255,0.55)"];
  const border =
    scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.82)";
  const timeColor =
    scheme === "dark" ? "rgba(255,255,255,0.48)" : "rgba(26,19,74,0.45)";
  return (
    <View style={{ flexShrink: 1 }}>
      <LinearGradient
        colors={bg}
        {...gradPoints(160)}
        style={{
          paddingVertical: 9,
          paddingHorizontal: 12,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderBottomLeftRadius: 5,
          borderBottomRightRadius: 16,
          borderWidth: 1,
          borderColor: border,
          gap: 3,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 11.5,
            lineHeight: 11.5 * 1.5,
            color: tokens.ink1,
          }}
        >
          {row.text}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 8.5,
            color: timeColor,
            alignSelf: "flex-end",
          }}
        >
          {row.time_label}
        </Text>
      </LinearGradient>
    </View>
  );
}

/* — Rich «Информация по счёту» bubble (макет 896) — */

function InvoiceCardBubble({ row }: { row: ChatMessageRow }) {
  const { tokens, scheme } = useTheme();
  const bg: [string, string] =
    scheme === "dark"
      ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"]
      : ["rgba(255,255,255,0.78)", "rgba(255,255,255,0.60)"];
  const timeColor =
    scheme === "dark" ? "rgba(255,255,255,0.48)" : "rgba(26,19,74,0.45)";
  const bodyColor =
    scheme === "dark" ? "rgba(255,255,255,0.82)" : "rgba(26,19,74,0.78)";
  return (
    <View
      style={[
        { flexShrink: 1 },
        shadowStyle({
          x: 0,
          y: 10,
          blur: 24,
          color: "rgba(16,185,129,0.12)",
        }),
      ]}
    >
      <LinearGradient
        colors={bg}
        {...gradPoints(160)}
        style={{
          paddingVertical: 11,
          paddingHorizontal: 13,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderBottomLeftRadius: 5,
          borderBottomRightRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(16,185,129,0.40)",
          gap: 6,
        }}
      >
        {/* Title row: 18 green badge + check + title */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: "#10B981",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Svg
              width={10}
              height={10}
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
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11,
              color: tokens.status.green.text,
            }}
          >
            {row.info_card_title ?? "Информация"}
          </Text>
        </View>

        {/* Body */}
        <Text
          style={{
            fontFamily: fonts.manrope600,
            fontSize: 11,
            lineHeight: 11 * 1.55,
            color: bodyColor,
          }}
        >
          {row.text}
        </Text>

        {/* Time */}
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 8.5,
            color: timeColor,
            alignSelf: "flex-end",
          }}
        >
          {row.time_label}
        </Text>
      </LinearGradient>
    </View>
  );
}

/* ═══════════════════ Input bar (макет 899–905) ═══════════════════ */

function InputBar({
  value,
  onChangeText,
  placeholder,
  onAttach,
  onSend,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onAttach: () => void;
  onSend: () => void;
}) {
  const { tokens, scheme } = useTheme();
  const barBg: [string, string] =
    scheme === "dark"
      ? ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.05)"]
      : ["rgba(255,255,255,0.78)", "rgba(255,255,255,0.55)"];
  const barBorder =
    scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.85)";
  const attachBg = "rgba(139,92,246,0.14)";
  const attachBorder = "rgba(139,92,246,0.32)";
  const canSend = value.trim().length > 0;

  return (
    <View
      style={[
        shadowStyle({
          x: 0,
          y: 14,
          blur: 34,
          color: "rgba(78,66,190,0.22)",
        }),
        { borderRadius: 24 },
      ]}
    >
      <LinearGradient
        colors={barBg}
        {...gradPoints(160)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 7,
          paddingHorizontal: 8,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: barBorder,
        }}
      >
        {/* Attach button 34×34 */}
        <Pressable
          onPress={onAttach}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: attachBg,
            borderWidth: 1,
            borderColor: attachBorder,
          }}
        >
          <Svg
            width={15}
            height={15}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6D28D9"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </Svg>
        </Pressable>

        {/* Text input */}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.ink3}
          multiline
          style={{
            flex: 1,
            paddingVertical: 4,
            paddingHorizontal: 4,
            fontFamily: fonts.manrope600,
            fontSize: 12,
            color: tokens.ink1,
            maxHeight: 96,
          }}
        />

        {/* Send button 36×36 */}
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[
            shadowStyle({
              x: 0,
              y: 8,
              blur: 18,
              color: "rgba(124,58,237,0.40)",
            }),
            { opacity: canSend ? 1 : 0.55 },
          ]}
        >
          <LinearGradient
            colors={SEND_GRAD}
            {...gradPoints(135)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="m22 2-7 20-4-9-9-4Z" />
              <Path d="M22 2 11 13" />
            </Svg>
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

/* ═══════════════════ Popover menu item ═══════════════════ */

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        pressed ? { backgroundColor: "rgba(124,58,237,0.10)" } : null,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.manrope700,
          fontSize: 12,
          color: tokens.ink1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
});

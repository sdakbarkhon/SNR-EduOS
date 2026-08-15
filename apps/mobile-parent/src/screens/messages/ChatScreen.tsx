/**
 * d25 «Чат с учителем» — Заход 7, block-by-block rebuild из макета
 * «SNR EduOS v2 Light.dc.html», строки 768–800.
 *
 * Порядок блоков (сверху вниз, block-list Захода 7):
 *  1) Header row: back(38) + кликабельная teacher-identity + kebab(38).
 *     Только 3 иконки в шапке — телефона/видеокамеры НЕТ (UI-decision).
 *     Kebab = actions/шторка (goActions → stub 'actions').
 *  2) Teacher identity: аватар 40 с инициалами ГЮ + gradient
 *     #8b5cf6→#6366f1, зелёный online-dot 11×11 с белой обводкой; имя
 *     13.5/800; чип «Математика» (цвета subject.math: text_color,
 *     chip_bg, chip_border); индикатор «Онлайн» с зелёной точкой.
 *     Всё — Pressable → 'dteach'.
 *  3) Messages scroll area: вертикальный ScrollView, gap 8, padding
 *     6/18/12; contentContainerStyle прижимает содержимое вниз через
 *     flexGrow+justify-end аналогично макету.
 *  4) Day divider (Сегодня, 23 июля): стеклянная пилюля, self-center,
 *     9.5/800 ink3, padding 5/12, r999, светлый glass.
 *  5) Incoming bubble (from='t') — ChatBubble direction="in" (без реакций).
 *  6) Outgoing bubble (from='p') — ChatBubble direction="out" ticks=true.
 *  7) Composer container: absolute-нижний блок, padding 0/18/max(inset,12).
 *  8) Attach menu (Popover) над «+»: пункты «Фото» → stub 'aphoto' и
 *     «Файл» → stub 'afile». Не «Голосовое» (UI-decision).
 *  9) Attach «+» button — круглая 34, purple W14 + border W32 → toggleAttach.
 *  10) TextInput placeholder — d.parentApp.msg.typeMessage.
 *  11) Emoji icon в поле ввода — SVG smiley 18, stroke ink3.
 *  12) Send button — 36 purple gradient (#7c3aed→#4f6df5), send SVG 15.
 *
 * ═══ КРИТИЧНО (rebuild-контракт) ═══
 * • НЕТ иконок phone/video в шапке;
 * • НЕТ микрофона в composer;
 * • НЕТ реакций под пузырями;
 * • Attach меню — только «Фото» и «Файл»;
 * • Teacher identity кликабельна → dteach; kebab → 'actions'.
 *
 * Данные — через getTeacherChat() и getSubject('math'). Тексты — из
 * useAppLocale().d.parentApp.msg (online, typeMessage, attachPhoto, attachFile).
 * Обе темы — useTheme(); iOS safe-area — useSafeAreaInsets (top для шапки,
 * bottom для composer). d25 живёт в STACK_ROUTES → под композером нет
 * FloatingTabBar, нижний отступ = safe-area.
 *
 * 15.08.2026 (подготовка к сборке). Сверху ленты — плашка «это пример»:
 * сообщения не отправляются и не приходят, переписка выдумана.
 */
import { useState, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  ChatBubble,
  GlassCircleButton,
  Popover,
} from "../../ui";
import { getSubject, getTeacherChat } from "../../data";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";
import { DemoBanner } from "../../ui/notices";

type Nav = NativeStackNavigationProp<MainStackParamList>;

export default function ChatScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const { header, messages } = getTeacherChat();
  const subject = getSubject("math");

  const [value, setValue] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };
  const goTeacher = () => navigation.navigate("dteach");
  const goActions = () => navigation.navigate("stub", { stubKey: "actions" });
  const goPhoto = () => {
    setAttachOpen(false);
    navigation.navigate("stub", { stubKey: "aphoto" });
  };
  const goFile = () => {
    setAttachOpen(false);
    navigation.navigate("stub", { stubKey: "afile" });
  };
  const onSend = () => {
    // Заглушка: отправка вернётся в Заходе data-layer (Supabase).
    if (!value.trim()) return;
    setValue("");
  };

  // Стеклянный фон day-divider — светлая / тёмная пары (те же, что у Popover).
  const dividerBg =
    scheme === "dark" ? "rgba(44,36,102,0.9)" : "rgba(255,255,255,0.7)";
  const dividerBorder =
    scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.8)";
  // Стекло композера (строка 792) — та же светлая/тёмная пара.
  const composerBg =
    scheme === "dark" ? "rgba(44,36,102,0.9)" : "rgba(255,255,255,0.72)";
  const composerBorder =
    scheme === "dark" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.85)";
  // Purple accent для «+»-кнопки (строка 793).
  const attachBg =
    scheme === "dark" ? "rgba(139,92,246,0.22)" : "rgba(139,92,246,0.14)";
  const attachBorder =
    scheme === "dark" ? "rgba(139,92,246,0.42)" : "rgba(139,92,246,0.32)";

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* 1) Header row: back + teacher-identity + kebab. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingTop: Math.max(insets.top, 46),
            paddingHorizontal: 18,
            paddingBottom: 8,
            flexShrink: 0,
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

          {/* 2) Teacher identity — кликабельная. */}
          <Pressable
            onPress={goTeacher}
            style={{
              flex: 1,
              minWidth: 0,
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
            }}
          >
            <TeacherAvatar initials="ГЮ" online />
            <View style={{ flex: 1, minWidth: 0, flexDirection: "column", gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 13.5,
                  color: tokens.ink1,
                }}
              >
                {header.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    paddingVertical: 2,
                    paddingHorizontal: 7,
                    borderRadius: 999,
                    backgroundColor: subject.chip_bg,
                    borderWidth: 1,
                    borderColor: subject.chip_border,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 8.5,
                      color: subject.text_color,
                    }}
                  >
                    {header.subject_chip}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
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
                      fontSize: 9,
                      color: scheme === "dark" ? "#4ADE80" : "#047857",
                    }}
                  >
                    {header.status_label}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          <GlassCircleButton onPress={goActions}>
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
        </View>

        {/* 3) Messages scroll area. */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 18,
            paddingTop: 6,
            paddingBottom: 12,
            gap: 8,
          }}
        >
          {/* Плашка «это пример» — раздел ещё не на данных школы. */}
          <DemoBanner text={d.parentApp.soon.sections.chat} />

          {/* 4) Day divider. */}
          <View
            style={{
              alignSelf: "center",
              paddingVertical: 5,
              paddingHorizontal: 12,
              borderRadius: 999,
              backgroundColor: dividerBg,
              borderWidth: 1,
              borderColor: dividerBorder,
            }}
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9.5,
                color: tokens.ink3,
              }}
            >
              {header.day_divider}
            </Text>
          </View>

          {/* 5–6) Bubbles (teacher = in / parent = out). */}
          {messages.map((m, i) => (
            <ChatBubble
              key={`${m.time_label}-${i}`}
              direction={m.from === "t" ? "in" : "out"}
              text={m.text}
              time={m.time_label}
              ticks={m.from === "p"}
            />
          ))}
        </ScrollView>

        {/* 7) Composer container. */}
        <View
          style={{
            position: "relative",
            flexShrink: 0,
            paddingHorizontal: 18,
            paddingTop: 6,
            paddingBottom: Math.max(insets.bottom, 12),
          }}
        >
          {/* 8) Attach menu (Popover) — над «+»-кнопкой. */}
          {attachOpen ? (
            <View style={{ position: "absolute", left: 18, bottom: 60, zIndex: 30 }}>
              <Popover width={170} top={0}>
                <AttachRow
                  labelKey="attachPhoto"
                  onPress={goPhoto}
                  iconGradient={["#60A5FA", "#2563EB"]}
                  icon={
                    <Svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Rect x={3} y={3} width={18} height={18} rx={4} />
                      <Circle cx={9} cy={9} r={2} />
                      <Path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                    </Svg>
                  }
                />
                <AttachRow
                  labelKey="attachFile"
                  onPress={goFile}
                  iconGradient={["#FBBF24", "#F97316"]}
                  divider
                  icon={
                    <Svg
                      width={14}
                      height={14}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
                      <Path d="M14 3v5h5" />
                    </Svg>
                  }
                />
              </Popover>
            </View>
          ) : null}

          {/* Input row (стеклянная пилюля r24). */}
          <View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 7,
                paddingHorizontal: 8,
                borderRadius: 24,
                backgroundColor: composerBg,
                borderWidth: 1,
                borderColor: composerBorder,
              },
              shadowStyle({ x: 0, y: 14, blur: 34, color: "rgba(78,66,190,0.22)" }),
            ]}
          >
            {/* 9) Attach (+) — покажет / скроет popover. */}
            <Pressable
              onPress={() => setAttachOpen((v) => !v)}
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
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6D28D9"
                strokeWidth={2.2}
                strokeLinecap="round"
              >
                <Path d="M12 5v14" />
                <Path d="M5 12h14" />
              </Svg>
            </Pressable>

            {/* 10) TextInput placeholder. */}
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={d.parentApp.msg.typeMessage}
              placeholderTextColor={tokens.ink3}
              multiline
              style={{
                flex: 1,
                fontFamily: fonts.manrope600,
                fontSize: 11.5,
                color: tokens.ink1,
                paddingVertical: 0,
                maxHeight: 96,
              }}
            />

            {/* 11) Emoji icon (ОСТАЁТСЯ — UI-decision). */}
            <Pressable hitSlop={6} onPress={() => {}}>
              <Svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke={tokens.ink3}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Circle cx={12} cy={12} r={9} />
                <Path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <Path d="M9 9h.01" />
                <Path d="M15 9h.01" />
              </Svg>
            </Pressable>

            {/* 12) Send button. */}
            <Pressable
              onPress={onSend}
              style={[
                { borderRadius: 18 },
                shadowStyle({ x: 0, y: 8, blur: 18, color: "rgba(124,58,237,0.4)" }),
              ]}
            >
              <LinearGradient
                colors={["#7C3AED", "#4F6DF5"]}
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
          </View>
        </View>
      </KeyboardAvoidingView>
    </AppBackground>
  );
}

/** Круглый аватар шапки 40×40 с инициалами + белая обводка 2px + online-dot. */
function TeacherAvatar({ initials, online }: { initials: string; online: boolean }) {
  return (
    <View style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
      <LinearGradient
        colors={["#8B5CF6", "#6366F1"]}
        {...gradPoints(135)}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: "#FFFFFF",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 12,
            color: "#FFFFFF",
          }}
        >
          {initials}
        </Text>
      </LinearGradient>
      {online ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 11,
            height: 11,
            borderRadius: 5.5,
            backgroundColor: "#22C55E",
            borderWidth: 2,
            borderColor: "#FFFFFF",
          }}
        />
      ) : null}
    </View>
  );
}

/** Строка attach-меню: иконка-плитка 30 с градиентом + label 11.5/800. */
function AttachRow({
  labelKey,
  onPress,
  iconGradient,
  icon,
  divider,
}: {
  labelKey: "attachPhoto" | "attachFile";
  onPress: () => void;
  iconGradient: [string, string];
  icon: ReactNode;
  divider?: boolean;
}) {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: "rgba(23,18,67,0.07)",
      }}
    >
      <LinearGradient
        colors={iconGradient}
        {...gradPoints(135)}
        style={{
          width: 30,
          height: 30,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </LinearGradient>
      <Text
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 11.5,
          color: tokens.ink1,
        }}
      >
        {d.parentApp.msg[labelKey]}
      </Text>
    </Pressable>
  );
}

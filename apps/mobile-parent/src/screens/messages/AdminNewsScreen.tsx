/**
 * Экран #27 «Сообщение от администрации» (AdminNews) — Заход 7 редизайна v2.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 840–870
 * (сверху вниз, block-by-block из block-list задания):
 *  1. Header (InnerHeader: glass-back + Unbounded 15/600 title + kebab
 *     справа → stub("actions")).
 *  2. Sender card — стеклянная карточка отправителя: квадрат 40×40 r13
 *     с градиентом #60a5fa→#2563eb и иконкой школы (home 17px), «Администрация
 *     школы» + timestamp «21 июля 2026, 10:30», справа красный chip «Важно»
 *     (tokens.status.red).
 *  3. Cover placeholder — прямоугольник 140px r18 с трёхстоповым мокапным
 *     градиентом (роза→оранж→синий, alpha≈.24/.26/.22) и placeholder-иконкой
 *     ICONS.img (30px stroke 1.7 ink3, дословно из макета).
 *  4. News title Unbounded 17/600 «Школьная ярмарка — 24 июля».
 *  5. Body paragraph 1 (Manrope 600 11.5, lineHeight 1.6, ink2).
 *  6. Body paragraph 2 (тот же стиль).
 *  7. Event details GlassCard — 3 строки (Дата / Время / Место) с иконками
 *     14×14 фиолет #6d28d9, разделители hairline rgba(23,18,67,.07).
 *  8. Info callout «Важно!» — blue-tinted блок (tokens.chip("59,130,246")),
 *     иконка info 15px stroke 2, заголовок 11/800 tokens.status.blue,
 *     текст 10.5/600 ink2 line-height 1.5.
 *  9. Reactions/comments row — сердце-счётчик 245 (красный #e11d48) +
 *     облачко-счётчик «12 комментариев» (серый ink3).
 * 10. Files section label — uppercase 10.5/800 letterSpacing .08em ink3,
 *     подпись из d.parentApp.files.attached (=«Прикреплённые файлы»,
 *     единственный доступный parentApp-ключ; в макете это `t.filesAttached`).
 * 11. Attached files grid — 3 колонки (flex:1), карточки glass r15 с
 *     цветной иконкой типа файла 30×30 (PDF красный / IMG синий / XLSX
 *     зелёный) + имя 9/800 + размер 8/700 ink3; tap → stub("file").
 * 12. Primary button «Назад к сообщениям» — accent PrimaryButton со
 *     стрелкой ← (16 stroke 2 white), navigate → таб «d24».
 *
 * Данные — вкомпилированы из мокапа (в фикстурах карточки #27 нет; этот экран
 * не в фикстурном покрытии Захода 5, аналогично тому, как контент d13
 * лежит в детальных фикстурах). При добавлении фикстуры замена — тривиальная.
 * i18n: заголовок и подпись файлов через d.parentApp; тело сообщения — русский
 * литерал (мокап-контент, не в словаре).
 * iOS safe-area — из InnerHeader (max(insets.top, 46)); нижний отступ 118
 * под FloatingTabBar. Обе темы — через useTheme() (ink1/ink2/ink3, glassBorder,
 * status.blue/red, chip()).
 */
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  PrimaryButton,
} from "../../ui";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/* ═════════════════════════ Контент мокапа (строки 847–867) ══════════════ */

const SENDER = {
  name: "Администрация школы",
  sent_at: "21 июля 2026, 10:30",
  priority_label: "Важно",
} as const;

const NEWS = {
  title: "Школьная ярмарка — 24 июля",
  paragraphs: [
    "Уважаемые родители! 24 июля в нашей школе состоится ежегодная школьная ярмарка.",
    "Будем рады видеть вас и ваших детей на этом празднике. Вас ждут интересные активности, выступления учеников и вкусные угощения.",
  ],
  event: {
    date: "24 июля (пятница)",
    time: "10:00 – 15:00",
    place: "Школьный двор",
  },
  callout: {
    title: "Важно!",
    text: "Просим подтвердить участие вашего ребёнка до 23 июля в разделе «Мероприятия».",
  },
  likes_count: 245,
  comments_label: "12 комментариев",
} as const;

type FileKind = "pdf" | "img" | "xlsx";
interface AttachedFile {
  kind: FileKind;
  name: string;
  size: string;
}
const FILES: AttachedFile[] = [
  { kind: "pdf", name: "Программа ярмарки.pdf", size: "1.2 МБ" },
  { kind: "img", name: "Плакат ярмарки.png", size: "2.4 МБ" },
  { kind: "xlsx", name: "Список участников.xlsx", size: "18 КБ" },
];

const FILE_GRADIENTS: Record<FileKind, [string, string]> = {
  pdf: ["#f87171", "#dc2626"],
  img: ["#60a5fa", "#2563eb"],
  xlsx: ["#34d399", "#059669"],
};

/* ═════════════════════════ Экран ═════════════════════════════════════════ */

export default function AdminNewsScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const goActions = () => navigation.navigate("stub", { stubKey: "actions" });
  const goFile = () => navigation.navigate("stub", { stubKey: "file" });
  const goBackToMsgs = () => navigation.navigate("d24");

  // Blue-tinted callout: цвет семьи «blue» из статусных токенов (макет
  // rgba(59,130,246,.1) bg + .3 border ≡ tokens.chip("59,130,246")).
  const blueChip = tokens.chip(tokens.status.blue.rgb);

  return (
    <AppBackground>
      {/* 1. Header — glass-back + title + kebab (три точки → stub actions). */}
      <InnerHeader
        title={d.parentApp.scr.adminNews}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
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
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 11,
        }}
      >
        {/* 2. Sender card. */}
        <SenderCard />

        {/* 3. Cover placeholder — 140px r18, мокап-градиент + icon ICONS.img. */}
        <CoverPlaceholder borderColor={tokens.glassBorder} inkFaded={tokens.ink3} />

        {/* 4. News title. */}
        <Text
          style={{
            fontFamily: fonts.unbounded600,
            fontSize: 17,
            color: tokens.ink1,
          }}
        >
          {NEWS.title}
        </Text>

        {/* 5–6. Body paragraphs. */}
        {NEWS.paragraphs.map((p, i) => (
          <Text
            key={i}
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 11.5,
              lineHeight: 11.5 * 1.6,
              color: tokens.ink2,
            }}
          >
            {p}
          </Text>
        ))}

        {/* 7. Event details card (Дата / Время / Место). */}
        <EventDetailsCard />

        {/* 8. Info callout «Важно!» (blue tinted). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 9,
            padding: 11,
            paddingHorizontal: 13,
            borderRadius: 16,
            backgroundColor: blueChip.bg,
            borderWidth: 1,
            borderColor: blueChip.border,
          }}
        >
          <View style={{ marginTop: 1 }}>
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.status.blue.text}
              strokeWidth={2}
              strokeLinecap="round"
            >
              <Circle cx={12} cy={12} r={9} />
              <Path d="M12 16v-4" />
              <Path d="M12 8h.01" />
            </Svg>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11,
                color: tokens.status.blue.text,
              }}
            >
              {NEWS.callout.title}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 10.5,
                lineHeight: 10.5 * 1.5,
                color: tokens.ink2,
              }}
            >
              {NEWS.callout.text}
            </Text>
          </View>
        </View>

        {/* 9. Reactions/comments row (heart 245 + chat 12). */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <ReactionCell
            iconStroke={tokens.status.red.text}
            paths={[
              "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z",
            ]}
            label={String(NEWS.likes_count)}
          />
          <ReactionCell
            iconStroke={tokens.ink3}
            paths={["M7.9 20A9 9 0 1 0 4 16.1L2 22Z"]}
            label={NEWS.comments_label}
          />
        </View>

        {/* 10. Files section label (uppercase). */}
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 10.5,
            letterSpacing: 10.5 * 0.08,
            color: tokens.ink3,
          }}
        >
          {d.parentApp.files.attached.toUpperCase()}
        </Text>

        {/* 11. Attached files grid — 3 колонки. */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {FILES.map((f) => (
            <FileTile key={f.name} file={f} onPress={goFile} />
          ))}
        </View>

        {/* 12. Primary button «Назад к сообщениям» → таб «d24». */}
        <PrimaryButton
          label="Назад к сообщениям"
          onPress={goBackToMsgs}
          icon={
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
              <Path d="M19 12H5" />
              <Path d="m12 19-7-7 7-7" />
            </Svg>
          }
        />
      </ScrollView>
    </AppBackground>
  );
}

/* ═════════════════════════ Подкомпоненты ════════════════════════════════ */

/** Стеклянная карточка отправителя (мокап 847–851). */
function SenderCard() {
  const { tokens } = useTheme();
  const g = gradPoints(135);
  const redChip = tokens.chip(tokens.status.red.rgb);
  return (
    <GlassCard
      radius={18}
      contentStyle={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        padding: 11,
        paddingHorizontal: 13,
      }}
    >
      {/* Иконка школы 40×40 r13 с градиентом и box-shadow-цветом. */}
      <View
        style={[
          shadowStyle({ x: 0, y: 6, blur: 14, color: "rgba(37,99,235,0.30)" }),
          { borderRadius: 13 },
        ]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinearGradient
            colors={["#60a5fa", "#2563eb"]}
            start={g.start}
            end={g.end}
            style={StyleSheet.absoluteFill}
          />
          <Svg
            width={17}
            height={17}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M3 21h18" />
            <Path d="M5 21V7l7-4 7 4v14" />
            <Path d="M9 21v-4h6v4" />
          </Svg>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0, flexDirection: "column", gap: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 12.5,
            color: tokens.ink1,
          }}
        >
          {SENDER.name}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 9.5,
            color: tokens.ink3,
          }}
        >
          {SENDER.sent_at}
        </Text>
      </View>

      {/* Красный chip «Важно» — chip() семьи red. */}
      <View
        style={{
          paddingVertical: 4,
          paddingHorizontal: 9,
          borderRadius: 999,
          backgroundColor: redChip.bg,
          borderWidth: 1,
          borderColor: redChip.border,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 9,
            color: tokens.status.red.text,
          }}
        >
          {SENDER.priority_label}
        </Text>
      </View>
    </GlassCard>
  );
}

/** Обложка-плейсхолдер 140px (мокап строка 852). */
function CoverPlaceholder({
  borderColor,
  inkFaded,
}: {
  borderColor: string;
  inkFaded: string;
}) {
  const g = gradPoints(135);
  return (
    <View
      style={{
        height: 140,
        borderRadius: 18,
        borderWidth: 1,
        borderColor,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LinearGradient
        colors={[
          "rgba(244,63,94,0.24)",
          "rgba(251,146,60,0.26)",
          "rgba(79,134,246,0.22)",
        ]}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <Svg
        width={30}
        height={30}
        viewBox="0 0 24 24"
        fill="none"
        stroke={inkFaded}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Rect x={3} y={3} width={18} height={18} rx={4} />
        <Circle cx={9} cy={9} r={2} />
        <Path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
      </Svg>
    </View>
  );
}

/** Стеклянная карточка события (Дата / Время / Место, мокап 856–860). */
function EventDetailsCard() {
  const { tokens } = useTheme();
  const rows: {
    icon: React.ReactNode;
    label: string;
    value: string;
  }[] = [
    {
      icon: (
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6d28d9"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M8 2v4" />
          <Path d="M16 2v4" />
          <Rect x={3} y={4} width={18} height={17} rx={4} />
          <Path d="M3 10h18" />
        </Svg>
      ),
      label: "Дата",
      value: NEWS.event.date,
    },
    {
      icon: (
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6d28d9"
          strokeWidth={1.9}
          strokeLinecap="round"
        >
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 7v5l3 2" />
        </Svg>
      ),
      label: "Время",
      value: NEWS.event.time,
    },
    {
      icon: (
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6d28d9"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <Circle cx={12} cy={10} r={3} />
        </Svg>
      ),
      label: "Место",
      value: NEWS.event.place,
    },
  ];
  return (
    <GlassCard
      radius={18}
      contentStyle={{
        paddingHorizontal: 14,
        paddingVertical: 5,
        flexDirection: "column",
      }}
    >
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            paddingVertical: 9,
            borderTopWidth: i === 0 ? 0 : 1,
            borderTopColor: "rgba(23,18,67,0.07)",
          }}
        >
          {r.icon}
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.manrope700,
              fontSize: 11,
              color: tokens.ink2,
            }}
          >
            {r.label}
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 11,
              color: tokens.ink1,
            }}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </GlassCard>
  );
}

/** Ячейка реакций (heart/chat + число). */
function ReactionCell({
  iconStroke,
  paths,
  label,
}: {
  iconStroke: string;
  paths: string[];
  label: string;
}) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Svg
        width={13}
        height={13}
        viewBox="0 0 24 24"
        fill="none"
        stroke={iconStroke}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((p, i) => (
          <Path key={i} d={p} />
        ))}
      </Svg>
      <Text
        style={{
          fontFamily: fonts.manrope700,
          fontSize: 10.5,
          color: tokens.ink3,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Плитка прикреплённого файла — 3-колоночная сетка (мокап 865–867). */
function FileTile({
  file,
  onPress,
}: {
  file: AttachedFile;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const g = gradPoints(135);
  const label = file.kind.toUpperCase();
  return (
    <View style={{ flex: 1 }}>
      <GlassCard
        radius={15}
        onPress={onPress}
        contentStyle={{
          padding: 10,
          paddingHorizontal: 8,
          flexDirection: "column",
          gap: 5,
        }}
      >
        {/* Иконка типа файла 30×30 r10 с градиентом. */}
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinearGradient
            colors={FILE_GRADIENTS[file.kind]}
            start={g.start}
            end={g.end}
            style={StyleSheet.absoluteFill}
          />
          {file.kind === "pdf" ? (
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 7,
                color: "#FFFFFF",
              }}
            >
              {label}
            </Text>
          ) : file.kind === "img" ? (
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
          ) : (
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
              <Rect x={3} y={3} width={18} height={18} rx={3} />
              <Path d="M3 9h18" />
              <Path d="M3 15h18" />
              <Path d="M9 3v18" />
            </Svg>
          )}
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: fonts.manrope800,
            fontSize: 9,
            color: tokens.ink1,
          }}
        >
          {file.name}
        </Text>
        <Text
          style={{
            fontFamily: fonts.manrope700,
            fontSize: 8,
            color: tokens.ink3,
          }}
        >
          {file.size}
        </Text>
      </GlassCard>
    </View>
  );
}

/**
 * Экран #11 «Детали предмета» — Математика, read-only обзор одного предмета.
 * REBUILD 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 455–495
 * (block-list Захода 5, порядок строго по макету):
 *  456–460  Header (Back + Subject Title with Gradient Icon + Favorite Toggle)
 *  461      Scroll Container (padding 4 18 118, gap 12)
 *  462–467  Teacher Card (ГЮ avatar + chat + email actions)
 *  468–471  Current Performance Hero Card (4.8/5.0 + Gauge 96%)
 *  472      Section Header 'Темы' + 'Подробнее ›'
 *  473–478  Topics Progress List Card (½, ▲, x=, doc — 4 темы)
 *  479–482  Two-column row: Last Work + Upcoming Test
 *  483–487  Teacher Comment Card
 *  488–492  EduOS Assistant Recommendation CTA Card
 *
 * На экране нет посещаемости / кружков / 7-дневной ленты — это чистый обзор
 * предмета. Ссылки в i18n: t.scr.topics, t.grades.teacherComment,
 * t.common.more (на «Подробнее»); остальные лейблы («ТЕКУЩАЯ УСПЕВАЕМОСТЬ»,
 * «ПОСЛЕДНЯЯ РАБОТА», «ПРЕДСТОЯЩИЙ ТЕСТ», «УЧИТЕЛЬ», «Рекомендации EduOS
 * Assistant», «Отлично!») в словаре макета отсутствуют — оставлены дословно,
 * как в HTML (аналогично stub-заголовкам).
 *
 * Данные — через фикстуры: getSubject('math'), getSubjectDetail(childId),
 * getTeacherProfile(). Учитель на макете всегда Гульнора Юсупова (аномалия №6,
 * teacher_online = true).
 *
 * Gauge — обёртка над react-native-svg (без overflow:visible проблем),
 * viewBox 120×70, thickness 10, size 110 — 1:1 макет строка 470.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import { Gauge, GlassCircleButton, ProgressBar } from "../../ui";
import {
  getSelectedChildContext,
  getSubject,
  getSubjectDetail,
  getTeacherProfile,
} from "../../data";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Конфиг иконок тем в «Освоение тем» (макет 474–477). Порядок = порядок
 *  topics[] в SUBJECT_DETAIL_MATH. */
type TopicIcon =
  | { kind: "text"; text: string; gradient: [string, string] }
  | { kind: "svg"; paths: string[]; gradient: [string, string] };

const TOPIC_ICONS: TopicIcon[] = [
  // Дроби и проценты — «½» на жёлтом (макет 474).
  { kind: "text", text: "½", gradient: ["#facc15", "#ca8a04"] },
  // Геометрия — треугольник на голубом (макет 475).
  {
    kind: "svg",
    paths: ["M12 3 2 21h20Z"],
    gradient: ["#38bdf8", "#0284c7"],
  },
  // Уравнения — «x=» на бирюзовом (макет 476).
  { kind: "text", text: "x=", gradient: ["#2dd4bf", "#0d9488"] },
  // Текстовые задачи — документ на розовом (макет 477).
  {
    kind: "svg",
    paths: [
      "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z",
      "M9 13h6",
      "M9 17h4",
    ],
    gradient: ["#f472b6", "#db2777"],
  },
];

/** Chevron > (используется в Assistant CTA). */
function ChevronRight({ size = 16, color = "rgba(255,255,255,0.8)" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="m9 18 6-6-6-6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Caps-лейбл 9.5/800, letter-spacing .06em, полупрозрачно-тёмный (на стекле). */
function GlassCaps({ children }: { children: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 9.5,
        letterSpacing: 9.5 * 0.06,
        textTransform: "uppercase",
        color: tokens.ink3,
      }}
    >
      {children}
    </Text>
  );
}

/** Caps-лейбл 9.5/800, letter-spacing .08em, полупрозрачно-белый (на градиенте). */
function AccentCapsLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 9.5,
        letterSpacing: 9.5 * 0.08,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.8)",
      }}
    >
      {children}
    </Text>
  );
}

export default function SubjectDetailScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const ctx = getSelectedChildContext();
  const subject = getSubject("math");
  const detail = getSubjectDetail(ctx.child.id);
  const teacher = getTeacherProfile();

  const [isFavorite, setIsFavorite] = useState(false);

  const glass1Grad = gradPoints(tokens.glass1.angle);
  const teacherAvatarGrad = gradPoints(135);
  const subjectIconGrad = gradPoints(135);
  const heroGrad = gradPoints(135);
  const assistantGrad = gradPoints(135);

  return (
    <AppBackground>
      {/* 1. Header (макет 456–460): back + subject title + favorite toggle. */}
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

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          {/* Градиентная плитка 30×30 с текстом √x (макет 458). */}
          <View
            style={[
              {
                width: 30,
                height: 30,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              },
              shadowStyle({ x: 0, y: 6, blur: 14, color: "rgba(202,138,4,0.3)" }),
            ]}
          >
            <LinearGradient
              colors={subject.gradient as [string, string]}
              start={subjectIconGrad.start}
              end={subjectIconGrad.end}
              style={StyleSheet.absoluteFill}
            />
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: "#FFFFFF" }}>
              √x
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: tokens.ink1 }}
          >
            {subject.name}
          </Text>
        </View>

        <GlassCircleButton onPress={() => setIsFavorite((v) => !v)}>
          {/* Сердечко: залитое если favorite, иначе контур. */}
          <Svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill={isFavorite ? "#EF4444" : "none"}
            stroke={isFavorite ? "#EF4444" : tokens.ink1}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
          </Svg>
        </GlassCircleButton>
      </View>

      {/* 2. Scroll Container (макет 461): padding 4 18 118, gap 12. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* 3. Teacher Card (макет 462–467). */}
        <Pressable
          onPress={() => navigation.navigate("dteach")}
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 10,
              paddingLeft: 12,
              paddingRight: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: tokens.glassBorder,
              overflow: "hidden",
            },
            shadowStyle(tokens.shCard),
          ]}
        >
          <LinearGradient
            colors={tokens.glass1.colors as [string, string]}
            start={glass1Grad.start}
            end={glass1Grad.end}
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
          {/* Аватар ГЮ 42 + зелёная точка онлайн (макет 463). */}
          <View style={{ position: "relative", width: 42, height: 42 }}>
            <LinearGradient
              colors={["#8b5cf6", "#6366f1"]}
              start={teacherAvatarGrad.start}
              end={teacherAvatarGrad.end}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#FFFFFF",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: "#FFFFFF" }}>
                ГЮ
              </Text>
            </LinearGradient>
            {detail.teacher_online ? (
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: "#22C55E",
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9.5,
                letterSpacing: 9.5 * 0.06,
                color: tokens.ink3,
              }}
            >
              УЧИТЕЛЬ
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
              {teacher.full_name}
            </Text>
          </View>
          {/* Кнопка «сообщения» (макет 465). */}
          <Pressable
            onPress={() => navigation.navigate("d24")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `rgba(${tokens.status.violet.rgb},0.14)`,
              borderWidth: 1,
              borderColor: `rgba(${tokens.status.violet.rgb},0.35)`,
            }}
          >
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.status.violet.text}
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </Svg>
          </Pressable>
          {/* Кнопка «email» (макет 466). */}
          <Pressable
            onPress={() => navigation.navigate("d24")}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: `rgba(${tokens.status.blue.rgb},0.13)`,
              borderWidth: 1,
              borderColor: `rgba(${tokens.status.blue.rgb},0.32)`,
            }}
          >
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke={tokens.status.blue.text}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M3 5h18v14H3z" />
              <Path d="m3 7 9 6 9-6" />
            </Svg>
          </Pressable>
        </Pressable>

        {/* 4. Current Performance Hero Card (макет 468–471). */}
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 15,
              borderRadius: 22,
              overflow: "hidden",
            },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(99,102,241,0.35)" }),
          ]}
        >
          <LinearGradient
            colors={["#38bdf8", "#6366f1"]}
            start={heroGrad.start}
            end={heroGrad.end}
            style={StyleSheet.absoluteFill}
          />
          {/* Верхний блик inset W35. */}
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
          <View style={{ flex: 1, gap: 3 }}>
            <AccentCapsLabel>ТЕКУЩАЯ УСПЕВАЕМОСТЬ</AccentCapsLabel>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
              <Text
                style={{
                  fontFamily: fonts.unbounded600,
                  fontSize: 28,
                  color: "#FFFFFF",
                  lineHeight: 28,
                }}
              >
                {detail.current_grade_label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.75)",
                  paddingBottom: 2,
                }}
              >
                /5.0
              </Text>
            </View>
            <View
              style={{
                alignSelf: "flex-start",
                paddingVertical: 3,
                paddingHorizontal: 9,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.22)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.4)",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 9.5, color: "#FFFFFF" }}>
                {detail.grade_note}
              </Text>
            </View>
          </View>
          {/* Semi-gauge 96% (макет 470): viewBox 120×70, size 110×66. */}
          <Gauge
            value={detail.gauge_pct}
            max={100}
            size={110}
            thickness={10}
            trackColor="rgba(255,255,255,0.3)"
            fillColor="#FFFFFF"
            centerLabel={`${detail.gauge_pct}%`}
            centerLabelColor="#FFFFFF"
            centerLabelSize={13}
            centerLabelY={60}
          />
        </View>

        {/* 5. Section Header 'Темы' + 'Подробнее ›' (макет 472). */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              fontFamily: fonts.manrope800,
              fontSize: 10.5,
              letterSpacing: 10.5 * 0.08,
              textTransform: "uppercase",
              color: tokens.ink3,
            }}
          >
            {d.parentApp.scr.topics}
          </Text>
          <Pressable onPress={() => navigation.navigate("dtopics")} hitSlop={8}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11.5,
                color: tokens.status.violet.text,
              }}
            >
              {`${d.parentApp.common.more} ›`}
            </Text>
          </Pressable>
        </View>

        {/* 6. Topics Progress List Card (макет 473–478). */}
        <View
          style={[
            {
              paddingVertical: 6,
              paddingHorizontal: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: tokens.glassBorder,
              overflow: "hidden",
            },
            shadowStyle(tokens.shCard),
          ]}
        >
          <LinearGradient
            colors={tokens.glass1.colors as [string, string]}
            start={glass1Grad.start}
            end={glass1Grad.end}
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
          {detail.topics.map((topic, i) => {
            const icon = TOPIC_ICONS[i] ?? TOPIC_ICONS[0];
            const iconGrad = gradPoints(135);
            return (
              <View
                key={topic.title}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  paddingVertical: 8,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: "rgba(23,18,67,0.07)",
                }}
              >
                {/* Иконка темы 28×28. */}
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <LinearGradient
                    colors={icon.gradient}
                    start={iconGrad.start}
                    end={iconGrad.end}
                    style={StyleSheet.absoluteFill}
                  />
                  {icon.kind === "text" ? (
                    <Text
                      style={{
                        fontFamily: fonts.manrope800,
                        fontSize: 10,
                        color: "#FFFFFF",
                      }}
                    >
                      {icon.text}
                    </Text>
                  ) : (
                    <Svg
                      width={13}
                      height={13}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {icon.paths.map((p, k) => (
                        <Path key={k} d={p} />
                      ))}
                    </Svg>
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    width: 104,
                    fontFamily: fonts.manrope700,
                    fontSize: 11,
                    color: tokens.ink1,
                  }}
                >
                  {topic.title}
                </Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar
                    pct={topic.pct / 100}
                    height={5.5}
                    fillGradient={icon.gradient}
                  />
                </View>
                <Text
                  style={{
                    width: 34,
                    textAlign: "right",
                    fontFamily: fonts.manrope800,
                    fontSize: 11.5,
                    color: tokens.ink1,
                  }}
                >
                  {topic.pct}%
                </Text>
              </View>
            );
          })}
        </View>

        {/* 7. Two-column row: Last Work + Upcoming Test (макет 479–482). */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {/* 8. Last Work Card (макет 480). */}
          <View
            style={[
              {
                flex: 1,
                padding: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: tokens.glassBorder,
                overflow: "hidden",
                gap: 5,
              },
              shadowStyle({ x: 0, y: 10, blur: 24, color: "rgba(99,86,214,0.13)" }),
            ]}
          >
            <LinearGradient
              colors={tokens.glass1.colors as [string, string]}
              start={glass1Grad.start}
              end={glass1Grad.end}
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
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9,
                letterSpacing: 9 * 0.06,
                color: tokens.ink3,
              }}
            >
              ПОСЛЕДНЯЯ РАБОТА
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11.5,
                color: tokens.ink1,
                lineHeight: 11.5 * 1.35,
              }}
            >
              {detail.last_work.title}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 9.5,
                  color: tokens.ink2,
                }}
              >
                {detail.last_work.date_label}
              </Text>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: `rgba(${tokens.status.green.rgb},0.14)`,
                  borderWidth: 1,
                  borderColor: `rgba(${tokens.status.green.rgb},0.35)`,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 13,
                    color: tokens.status.green.text,
                  }}
                >
                  {String(detail.last_work.grade)}
                </Text>
              </View>
            </View>
          </View>

          {/* 9. Upcoming Test Card (макет 481). */}
          <View
            style={[
              {
                flex: 1,
                padding: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: tokens.glassBorder,
                overflow: "hidden",
                gap: 5,
              },
              shadowStyle({ x: 0, y: 10, blur: 24, color: "rgba(99,86,214,0.13)" }),
            ]}
          >
            <LinearGradient
              colors={tokens.glass1.colors as [string, string]}
              start={glass1Grad.start}
              end={glass1Grad.end}
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
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9,
                letterSpacing: 9 * 0.06,
                color: tokens.ink3,
              }}
            >
              ПРЕДСТОЯЩИЙ ТЕСТ
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 11.5,
                color: tokens.ink1,
                lineHeight: 11.5 * 1.35,
              }}
            >
              {detail.upcoming_test.title}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 9.5,
                  color: tokens.ink2,
                }}
              >
                {detail.upcoming_test.date_label}
              </Text>
              <View
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: `rgba(${tokens.status.blue.rgb},0.13)`,
                  borderWidth: 1,
                  borderColor: `rgba(${tokens.status.blue.rgb},0.32)`,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 9,
                    color: tokens.status.blue.text,
                  }}
                >
                  {detail.upcoming_test.countdown_label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 10. Teacher Comment Card (макет 483–487). */}
        <View
          style={[
            {
              paddingVertical: 13,
              paddingHorizontal: 14,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: tokens.glassBorder,
              overflow: "hidden",
              gap: 7,
            },
            shadowStyle(tokens.shCard),
          ]}
        >
          <LinearGradient
            colors={tokens.glass1.colors as [string, string]}
            start={glass1Grad.start}
            end={glass1Grad.end}
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
          <GlassCaps>КОММЕНТАРИЙ УЧИТЕЛЯ</GlassCaps>
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 11.5,
              lineHeight: 11.5 * 1.55,
              color: tokens.ink2,
            }}
          >
            {`${detail.teacher_comment} ${detail.teacher_comment_extra}`}
          </Text>
          <Text
            style={{
              fontFamily: fonts.manrope700,
              fontSize: 9.5,
              color: tokens.ink3,
            }}
          >
            {detail.teacher_comment_time_label}
          </Text>
        </View>

        {/* 11. EduOS Assistant Recommendation CTA Card (макет 488–492). */}
        <Pressable
          onPress={() => navigation.navigate("d7")}
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 20,
              overflow: "hidden",
            },
            shadowStyle({ x: 0, y: 16, blur: 36, color: "rgba(99,102,241,0.38)" }),
          ]}
        >
          <LinearGradient
            colors={["#8b5cf6", "#6366f1"]}
            start={assistantGrad.start}
            end={assistantGrad.end}
            style={StyleSheet.absoluteFill}
          />
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
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.2)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.4)",
            }}
          >
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="#FFFFFF">
              <Path d="M12 2l2.2 7.2L22 12l-7.8 2.8L12 22l-2.2-7.2L2 12l7.8-2.8L12 2z" />
            </Svg>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12.5,
                color: "#FFFFFF",
              }}
            >
              Рекомендации EduOS Assistant
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 11,
                lineHeight: 11 * 1.5,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              {detail.assistant_note}
            </Text>
          </View>
          <ChevronRight />
        </Pressable>
      </ScrollView>
    </AppBackground>
  );
}

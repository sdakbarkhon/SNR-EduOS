/**
 * dteach «Профиль учителя» — Заход 5, block-by-block rebuild из макета
 * «SNR EduOS v2 Light.dc.html», строки 1430–1463.
 *
 * Порядок блоков (сверху вниз):
 *  1) Header (Back + Title + 3-dots) — InnerHeader (46/18/8, gap 12); правый
 *     GlassCircleButton с 3-точечной иконкой (строка 1434).
 *  2) TeacherCard — AccentCard в градиенте предмета (SUBJ.math.g, строка 1436–
 *     1440): круглый аватар 58×58 (rgba(255,255,255,.22) + border W60), имя
 *     15/800 white, подпись «Учитель · {tchSubj}» 10.5/700 W85, pill-бейдж
 *     «Онлайн» с зелёной точкой #4ade80.
 *  3) ActionButtons — 2 кнопки в ряд gap 8 flex 1 (1441–1443): слева primary-
 *     градиент #7c3aed→#4f6df5 + иконка чата, справа outline-glass (W40 + бордер
 *     rgba(124,58,237,.45)) + иконка телефона, текст #6d28d9.
 *  4) SectionLabel «Информация» — uppercase 10.5/800 .08em ink3 (1445).
 *  5) InfoCard — GlassCard со списком 4 строк (label слева ink2 11/700, value
 *     справа ink1 11.5/800), разделители rgba(23,18,67,.07) (1446–1451).
 *  6) SectionLabel «РАСПИСАНИЕ С ВАШИМ РЕБЁНКОМ» — тот же uppercase (1452).
 *  7) ScheduleList — GlassCard, ~3 строки из tchSched: бейдж дня 30×?/11/800
 *     ink2, цветная точка 9×9 (SUBJ.math.c + ring 3px SUBJ.math.chip_bg), время
 *     12/800 ink1 + «Кабинет 101 · 45 минут» (правило заказчика: кабинет
 *     захардкожен), chevron → goSched (1453–1457).
 *  8) SectionHeader «ПОСЛЕДНИЕ ОТЗЫВЫ О ВАШЕМ РЕБЁНКЕ» + link «Все отзывы ›»
 *     (1458).
 *  9) ReviewsList — 2 отдельные glass-карточки: заголовок 'Оценка работы · {имя
 *     ребёнка}' 11.5/800, время 9/700 ink3 справа, текст 11/600 line-height 1.5
 *     ink2 (1459–1461).
 *
 * Данные — через аксессоры src/data (getTeacherProfile, getTeacherReviews,
 * getSubject, getSelectedChildContext, getUnreadNotificationsCount).
 * Тексты — useAppLocale().d.parentApp.*.
 * Обе темы — useTheme(); iOS safe-area — из InnerHeader; скролл имеет
 * paddingBottom 118 под FloatingTabBar.
 */
import { Pressable, ScrollView, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  AccentCard,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  SectionHeader,
} from "../../ui";
import {
  getSelectedChildContext,
  getSubject,
  getTeacherProfile,
  getTeacherReviews,
} from "../../data";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

/** «#ca8a04» → «202,138,4» для shadowRgb карточки. */
function hexToRgbCsv(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** «Гульнора Юсупова» → «ГЮ» (первые буквы двух первых слов). */
function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("");
}

/** Uppercase caps-лейбл 10.5/800 .08em (макет 1445, 1452). */
function SectionLabel({ children }: { children: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        textTransform: "uppercase",
        color: tokens.ink3,
      }}
    >
      {children}
    </Text>
  );
}

export default function TeacherProfileScreen() {
  const { tokens } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const { currentChildId } = useAuthSession();

  const profile = getTeacherProfile();
  const subject = getSubject(profile.subject_id);
  const reviews = getTeacherReviews()
    .filter((r) => r.teacher_name === profile.full_name)
    .slice(0, 2);
  const ctx = getSelectedChildContext(currentChildId ?? undefined);
  const child = ctx.child;

  const shadowRgb = hexToRgbCsv(subject.color);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };
  const goMenu = () => navigation.navigate("stub", { stubKey: "profmenu" });
  const goMsgs = () => navigation.navigate("d25");
  const goCall = () => navigation.navigate("stub", { stubKey: "call" });
  const goSched = () => navigation.navigate("d15");
  const goReviews = () => navigation.navigate("drev");

  return (
    <AppBackground>
      {/* 1) Header (Back + Title + 3-dots). */}
      <InnerHeader
        title={d.parentApp.scr.teacherProfile}
        titleSize={15}
        onBackPress={goBack}
        right={
          <GlassCircleButton onPress={goMenu}>
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
          gap: 12,
        }}
      >
        {/* 2) TeacherCard — AccentCard в градиенте предмета. */}
        <AccentCard
          gradient={subject.gradient}
          shadowRgb={shadowRgb}
          radius={22}
          contentStyle={{
            padding: 15,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          {/* Аватар 58×58 с инициалами tchInit. */}
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.22)",
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.6)",
            }}
          >
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 17, color: "#FFFFFF" }}>
              {initialsOf(profile.full_name)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>
              {profile.full_name}
            </Text>
            <Text
              style={{
                fontFamily: fonts.manrope700,
                fontSize: 10.5,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {`Учитель · ${profile.subject_name}`}
            </Text>
            {/* Pill «Онлайн» с зелёной точкой #4ade80. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.22)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.4)",
                alignSelf: "flex-start",
              }}
            >
              <View
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: "#4ADE80",
                }}
              />
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 8.5, color: "#FFFFFF" }}>
                {d.parentApp.msg.online}
              </Text>
            </View>
          </View>
        </AccentCard>

        {/* 3) ActionButtons — 2 кнопки в ряд. */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {/* Primary: градиент #7c3aed→#4f6df5, иконка чата, «Написать сообщение». */}
          <Pressable
            onPress={goMsgs}
            style={{
              flex: 1,
              borderRadius: 15,
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={["#7C3AED", "#4F6DF5"]}
              {...gradPoints(135)}
              style={{
                paddingVertical: 13,
                paddingHorizontal: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
              }}
            >
              <Svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </Svg>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                Написать сообщение
              </Text>
            </LinearGradient>
          </Pressable>
          {/* Outline: W40 фон + бордер (124,58,237,.45), текст #6d28d9. */}
          <Pressable
            onPress={goCall}
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 15,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              backgroundColor: "rgba(255,255,255,0.4)",
              borderWidth: 1.5,
              borderColor: "rgba(124,58,237,0.45)",
            }}
          >
            <Svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6D28D9"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.13.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.45c.9.34 1.84.57 2.8.7A2 2 0 0 1 22 16.9Z" />
            </Svg>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#6D28D9" }}>
              Позвонить в школу
            </Text>
          </Pressable>
        </View>

        {/* 4) SectionLabel «Информация». */}
        <SectionLabel>{d.parentApp.about.info}</SectionLabel>

        {/* 5) InfoCard — 4 строки (label / value). */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {[
            { label: "Предмет", value: profile.subject_name },
            { label: "Стаж", value: profile.experience_label },
            { label: "Образование", value: profile.education_label },
            { label: "Классы", value: profile.classes_label },
          ].map((row, i) => (
            <View
              key={row.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 9,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(23,18,67,0.07)",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink2 }}>
                {row.label}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 11.5,
                  color: tokens.ink1,
                  textAlign: "right",
                  flexShrink: 1,
                  marginLeft: 12,
                }}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </GlassCard>

        {/* 6) SectionLabel «РАСПИСАНИЕ С ВАШИМ РЕБЁНКОМ». */}
        <SectionLabel>РАСПИСАНИЕ С ВАШИМ РЕБЁНКОМ</SectionLabel>

        {/* 7) ScheduleList — уроки с этим учителем. */}
        <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
          {profile.schedule.map(([day, time], i) => (
            <Pressable
              key={`${day}-${time}`}
              onPress={goSched}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(23,18,67,0.07)",
              }}
            >
              <Text
                style={{
                  width: 30,
                  fontFamily: fonts.manrope800,
                  fontSize: 11,
                  color: tokens.ink2,
                }}
              >
                {day}
              </Text>
              {/* Точка предмета: 9×9 + «кольцо» 3px chip_bg через box-shadow-эмуляцию. */}
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 4.5,
                  backgroundColor: subject.color,
                  borderWidth: 3,
                  borderColor: subject.chip_bg,
                }}
              />
              <View style={{ flex: 1, flexDirection: "column" }}>
                <Text
                  style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}
                >
                  {time}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope600,
                    fontSize: 9.5,
                    color: tokens.ink3,
                  }}
                >
                  Кабинет 101 · 45 минут
                </Text>
              </View>
              <Svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke={tokens.ink3}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <Path d="m9 18 6-6-6-6" />
              </Svg>
            </Pressable>
          ))}
        </GlassCard>

        {/* 8) SectionHeader «Последние отзывы о вашем ребёнке» + link. */}
        <SectionHeader
          title="ПОСЛЕДНИЕ ОТЗЫВЫ О ВАШЕМ РЕБЁНКЕ"
          linkLabel="Все отзывы ›"
          onPress={goReviews}
        />

        {/* 9) ReviewsList — 2 отдельные glass-карточки. */}
        {reviews.map((r, i) => (
          <GlassCard
            key={`${r.time_label}-${i}`}
            radius={18}
            contentStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 6 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}
              >
                {`Оценка работы · ${child.first_name}`}
              </Text>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>
                {r.time_label}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 11,
                lineHeight: 11 * 1.5,
                color: tokens.ink2,
              }}
            >
              {r.text}
            </Text>
          </GlassCard>
        ))}
      </ScrollView>
    </AppBackground>
  );
}

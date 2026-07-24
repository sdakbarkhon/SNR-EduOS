/**
 * Экран №13 «Детали задания» (HomeworkDetail) — заход 5 редизайна v2.
 *
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 546–583
 * (сверху вниз):
 *  1. TopBar 46/18/8 — glass-back + заголовок «Домашнее задание» + glass-upload;
 *  2. ScrollContainer paddingBottom 118 (в этом экране табов нет, но nav-стек
 *     единый — держим единый нижний отступ ради целостности);
 *  3. ChildSelectorPill — ChildSwitcherCard variant="compact" (без статуса);
 *  4. HomeworkHeaderCard — glass r20, subject-плитка 42 + status-chip + мета;
 *  5. TeacherInstructionCard — glass r20 с uppercase-меткой;
 *  6. AttachmentsCard — glass с PDF-плиткой и pill «Открыть файл»;
 *  7. StatusStepperCard — 4-точечный горизонт. степпер (3 done + 1 review);
 *  8. TeacherCommentCard — glass с аватаром «ГЮ» и таймстампом;
 *  9. PrimaryActionMessageTeacher — accent-CTA «Написать учителю» → d24;
 *  10. SecondaryActionResendConditional (hwNotSent) — outline «Отправить
 *      обновлённую работу» → stub 'upload';
 *  11. SentStateBadgeConditional (hwSentF) — информ-пилюля «Работа отправлена».
 *
 * Данные — из HOMEWORK_DETAIL через getHomeworkDetail() + getSubject() для
 * цвета/градиента (CLAUDE.md §6: subject-config, не хардкод). Активный ребёнок
 * — из useAuthSession().currentChildId (аналогично HomeScreen). Тексты — из
 * useAppLocale().d.parentApp.* (RU/UZ/EN). Обе темы — через useTheme(); в тёмной
 * теме uppercase-подписи и мета-цвета берутся из ink2/ink3.
 *
 * Условные блоки: два взаимоисключающих состояния — «можно переотправить» vs
 * «уже на проверке» — определяются по hw.status_chip. «На проверке» → показать
 * «Отправлена» pill; «В работе»/«Просрочено»/«Не сдано» → показать «Отправить
 * обновлённую работу». В фикстуре сейчас «На проверке», поэтому по факту
 * рендерится SentStateBadge; SecondaryActionResend спрятан.
 *
 * Радар из «Навыков» здесь НЕ используется — этот экран без SVG-радара.
 */
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  Avatar,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  GlassCircleButton,
  type ChildPickerItem,
} from "../../ui";
import {
  getChildren,
  getHomeworkDetail,
  getSelectedChildContext,
  getSubject,
} from "../../data";
import type { BaseSubjectKey } from "../../data/types";
import { useAppLocale } from "../../i18n";
import { useAuthSession } from "../../context/AuthSessionContext";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/**
 * Глиф-символ на плитке предмета (мокап: «√x» для математики). В общем
 * subject-config глифов пока нет (§6 CLAUDE.md вынесение планируется), поэтому
 * здесь единственная точка их определения — тот же приём используют
 * HomeScreen (лента «Сегодня») и другие экраны Захода 4.
 */
const SUBJECT_GLYPH: Record<BaseSubjectKey, string> = {
  math: "√x",
  eng: "Aa",
  rus: "Р",
  prog: "{}",
  robo: "⚙",
};

/** Полное uppercase-название предмета для метки в HomeworkHeaderCard. */
const SUBJECT_UPPER: Record<BaseSubjectKey, string> = {
  math: "МАТЕМАТИКА",
  eng: "АНГЛИЙСКИЙ",
  rus: "РУССКИЙ",
  prog: "ПРОГРАММИРОВАНИЕ",
  robo: "РОБОТОТЕХНИКА",
};

/** Мелкая uppercase-метка секции: «ИНСТРУКЦИЯ ОТ УЧИТЕЛЯ» и т.п. */
function CapsLabel({ children }: { children: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 9.5,
        letterSpacing: 9.5 * 0.06,
        color: tokens.ink3,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * TopBar экрана: то же, что InnerHeader, но с правым круглым glass-слотом
 * (upload/share). Реализовано инлайном, чтобы правая кнопка была той же
 * glass-формы 38×38, что и back-кнопка (InnerHeader принимает произвольный
 * ReactNode, круглую glass-обёртку экспортирует RootHeader — используем её).
 */
function DetailTopBar({
  title,
  onBack,
  onShare,
}: {
  title: string;
  onBack?: () => void;
  onShare?: () => void;
}) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  return (
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
      <GlassCircleButton onPress={onBack}>
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
        {title}
      </Text>
      <GlassCircleButton onPress={onShare}>
        {/* upload-arrow-from-folder 16px stroke 1.8 — мокап строка 550. */}
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={tokens.ink1}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
          <Path d="m16 6-4-4-4 4" />
          <Path d="M12 2v13" />
        </Svg>
      </GlassCircleButton>
    </View>
  );
}

/**
 * Цветная плитка предмета 42×42 r14, глиф белым 14/800; тень 0 6 14 rgba(base,.30)
 * — мокап строка 555. Градиент — из SUBJECTS[subject_id].
 */
function SubjectTileGlyph({ subjectId }: { subjectId: BaseSubjectKey }) {
  const subject = getSubject(subjectId);
  const g = gradPoints(135);
  // RGB для colored shadow берём из hex базового цвета (парсим #rrggbb).
  const hex = subject.color.replace("#", "");
  const rgb =
    hex.length === 6
      ? `${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)}`
      : "202,138,4";
  return (
    <View
      style={[
        {
          width: 42,
          height: 42,
          borderRadius: 14,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        shadowStyle({ x: 0, y: 6, blur: 14, color: `rgba(${rgb},0.30)` }),
      ]}
    >
      <LinearGradient
        colors={subject.gradient as [string, string]}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
        {SUBJECT_GLYPH[subjectId]}
      </Text>
    </View>
  );
}

/** Красная PDF-плитка 38×38 r12 c текстом «PDF» — мокап строка 567. */
function AttachmentTypeTile({ label }: { label: string }) {
  const g = gradPoints(135);
  return (
    <View
      style={[
        {
          width: 38,
          height: 38,
          borderRadius: 12,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        shadowStyle({ x: 0, y: 6, blur: 12, color: "rgba(220,38,38,0.28)" }),
      ]}
    >
      <LinearGradient
        colors={["#f87171", "#dc2626"]}
        start={g.start}
        end={g.end}
        style={StyleSheet.absoluteFill}
      />
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 8, color: "#FFFFFF" }}>
        {label}
      </Text>
    </View>
  );
}

/** Аватар учителя фиолет-градиент 135° (мокап 558, 576). */
function TeacherAvatar({ initials, size = 24 }: { initials: string; size?: number }) {
  return (
    <Avatar
      initials={initials}
      gradient={["#8b5cf6", "#6366f1"]}
      size={size}
      fontSize={size * 0.36}
    />
  );
}

/** Календарь-иконка 12px stroke 1.9 (мокап 557). */
function CalendarGlyph({ color, size = 12 }: { color: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M8 2v4" />
      <Path d="M16 2v4" />
      <Rect x={3} y={4} width={18} height={17} rx={4} />
      <Path d="M3 10h18" />
    </Svg>
  );
}

/** Одна точка степпера: done — зелёный круг с галочкой; review — фиолет-кольцо. */
function StepDot({ state }: { state: "done" | "review" }) {
  if (state === "done") {
    return (
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: "#10b981",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 6 9 17l-5-5" />
        </Svg>
      </View>
    );
  }
  return (
    <View
      style={[
        {
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: "rgba(124,58,237,0.25)",
          borderWidth: 2.5,
          borderColor: "#7c3aed",
        },
        shadowStyle({ x: 0, y: 0, blur: 8, color: "rgba(124,58,237,0.40)" }),
      ]}
    />
  );
}

export default function HomeworkDetailScreen() {
  const { tokens, scheme } = useTheme();
  const { d } = useAppLocale();
  const navigation = useNavigation<Nav>();
  const auth = useAuthSession();

  const children = getChildren();
  const [childId, setChildId] = useState<string>(() =>
    auth.currentChildId ?? children[0].id,
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;
  const hw = getHomeworkDetail();

  const t = d.parentApp;

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };
  const goFile = () => navigation.navigate("stub", { stubKey: "file" });
  const goUpload = () => navigation.navigate("stub", { stubKey: "upload" });
  const goMsgs = () => navigation.navigate("d24" as never);

  // Условные блоки: единственный источник — hw.status_chip. «На проверке» →
  // работа отправлена (SentStateBadge); всё остальное — можно переотправить
  // (SecondaryActionResend). Именно это состояние в текущей фикстуре.
  const isUnderReview = hw.status_chip === "На проверке";
  const hwNotSent = !isUnderReview; // sc-if hwNotSent из мокапа
  const hwSentF = isUnderReview; // sc-if hwSentF из мокапа

  // «На проверке»-chip: violet — токен status.violet.
  const violet = tokens.status.violet;
  const chipVi = tokens.chip(violet.rgb);

  // Мета-цвета (тёмная тема — ink2, светлая — rgba(26,19,74,.66) как в мокапе).
  const metaColor = scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.66)";
  const stepMetaColor = scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.50)";
  const doneStepColor = tokens.status.green.text;

  // Divider в HeaderCard: light — rgba(23,18,67,.07), dark — glassBorder тонкий.
  const dividerColor = scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.07)";
  // Линия между точками степпера (незакрашенный участок).
  const stepLineDim = scheme === "dark" ? "rgba(255,255,255,0.12)" : "rgba(23,18,67,0.12)";

  const pickerItems: ChildPickerItem[] = useMemo(
    () =>
      children.map((k) => ({
        id: k.id,
        initials: k.first_name.slice(0, 1),
        gradient: k.avatar_gradient,
        ringColor: k.avatar_ring,
        name: k.full_name,
        classLabel: `${k.class_name} ${t.grades.class}`,
        statusLabel: k.status_chip,
        statusTone: k.status_chip === "В школе" ? "green" : "gray",
      })),
    [children, t.grades.class],
  );

  return (
    <AppBackground>
      {/* 1. TopBar */}
      <DetailTopBar title={t.scr.homework} onBack={goBack} onShare={goFile} />

      {/* 2. ScrollContainer */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* 3. ChildSelectorPill */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${t.grades.class}`}
          onPress={() => setSheetOpen(true)}
        />

        {/* 4. HomeworkHeaderCard */}
        <GlassCard radius={20} contentStyle={{ padding: 13, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
            <SubjectTileGlyph subjectId={hw.subject_id} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10,
                  letterSpacing: 10 * 0.05,
                  color: getSubject(hw.subject_id).text_color,
                }}
              >
                {SUBJECT_UPPER[hw.subject_id]}
              </Text>
              <Text
                numberOfLines={2}
                style={{ fontFamily: fonts.manrope800, fontSize: 13.5, color: tokens.ink1 }}
              >
                {hw.title}
              </Text>
            </View>
            <View
              style={{
                paddingVertical: 3,
                paddingHorizontal: 8,
                borderRadius: 999,
                backgroundColor: chipVi.bg,
                borderWidth: 1,
                borderColor: chipVi.border,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 8.5,
                  color: violet.text,
                }}
              >
                {hw.status_chip}
              </Text>
            </View>
          </View>
          {/* Divider + мета-строка */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingTop: 9,
              borderTopWidth: 1,
              borderTopColor: dividerColor,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <CalendarGlyph color={metaColor} />
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 10.5,
                  color: metaColor,
                }}
              >
                {hw.due_label}
              </Text>
            </View>
            <View
              style={{
                marginLeft: "auto",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <TeacherAvatar initials={hw.teacher_initials} size={24} />
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 10.5,
                  color: metaColor,
                }}
              >
                {hw.teacher_name}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* 5. TeacherInstructionCard */}
        <GlassCard radius={20} contentStyle={{ padding: 13, gap: 6 }}>
          <CapsLabel>ИНСТРУКЦИЯ ОТ УЧИТЕЛЯ</CapsLabel>
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 11.5,
              lineHeight: 11.5 * 1.6,
              color: scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.78)",
            }}
          >
            {hw.instruction}
          </Text>
        </GlassCard>

        {/* 6. AttachmentsCard */}
        <GlassCard radius={20} contentStyle={{ padding: 13, gap: 9 }}>
          <CapsLabel>ПРИКРЕПЛЁННЫЕ МАТЕРИАЛЫ</CapsLabel>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <AttachmentTypeTile label={hw.attachment.type_label} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 11.5,
                  color: tokens.ink1,
                }}
              >
                {hw.attachment.name}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 9.5,
                  color: scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.55)",
                }}
              >
                {hw.attachment.type_label} · {hw.attachment.size_label}
              </Text>
            </View>
            <Pressable
              onPress={goFile}
              style={({ pressed }) => [
                {
                  paddingVertical: 7,
                  paddingHorizontal: 11,
                  borderRadius: 10,
                  backgroundColor: chipVi.bg,
                  borderWidth: 1,
                  borderColor: chipVi.border,
                },
                pressed ? { opacity: 0.8 } : null,
              ]}
            >
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10,
                  color: violet.text,
                }}
              >
                {/* «Открыть файл»: ключа в d.parentApp пока нет (аналогичный
                 *  hwDetailOpenFileBtn лежит в d.parent — v1 web-словарь).
                 *  Ставим литерал, добавление ключа — вне scope Захода 5. */}
                Открыть файл
              </Text>
            </Pressable>
          </View>
        </GlassCard>

        {/* 7. StatusStepperCard */}
        <GlassCard radius={20} contentStyle={{ padding: 13, gap: 10 }}>
          <CapsLabel>СТАТУС ВЫПОЛНЕНИЯ</CapsLabel>
          {/* Точки + линии */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 4,
            }}
          >
            <StepDot state="done" />
            <View style={{ flex: 1, height: 2.5, backgroundColor: "#10b981" }} />
            <StepDot state="done" />
            <View style={{ flex: 1, height: 2.5, backgroundColor: "#10b981" }} />
            <StepDot state="done" />
            <View style={{ flex: 1, height: 2.5, backgroundColor: stepLineDim }} />
            <StepDot state="review" />
          </View>
          {/* 4 подписи space-between */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 2,
            }}
          >
            {hw.timeline.map((step, i) => {
              const isLast = i === hw.timeline.length - 1;
              const align =
                i === 0 ? "flex-start" : isLast ? "flex-end" : "center";
              const titleColor = isLast ? violet.text : doneStepColor;
              return (
                <View
                  key={step.label}
                  style={{ flexDirection: "column", alignItems: align as "flex-start" }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.manrope800,
                      fontSize: 9,
                      color: titleColor,
                    }}
                  >
                    {step.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.manrope600,
                      fontSize: 8,
                      color: stepMetaColor,
                    }}
                  >
                    {step.date_label}
                  </Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* 8. TeacherCommentCard */}
        <GlassCard radius={20} contentStyle={{ padding: 13, gap: 8 }}>
          <CapsLabel>КОММЕНТАРИЙ УЧИТЕЛЯ</CapsLabel>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
            <TeacherAvatar initials={hw.teacher_initials} size={28} />
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 11.5,
                  lineHeight: 11.5 * 1.55,
                  color: scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.78)",
                }}
              >
                {hw.teacher_comment}
              </Text>
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 9,
                  color: scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.50)",
                }}
              >
                {hw.teacher_comment_date_label}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* 9. PrimaryActionMessageTeacher — accent-CTA #7c3aed→#4f6df5 r15 p14 */}
        <Pressable
          onPress={goMsgs}
          style={({ pressed }) => [
            shadowStyle({ x: 0, y: 14, blur: 32, color: "rgba(124,58,237,0.40)" }),
            { borderRadius: 15 },
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          <LinearGradient
            colors={["#7c3aed", "#4f6df5"]}
            {...gradPoints(135)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 14,
              borderRadius: 15,
              overflow: "hidden",
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
              <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
            </Svg>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#FFFFFF" }}>
              {t.home.msgTeacher}
            </Text>
            {/* inset-блик hairline W35 */}
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
          </LinearGradient>
        </Pressable>

        {/* 10. SecondaryActionResendConditional — sc-if hwNotSent */}
        {hwNotSent ? (
          <Pressable
            onPress={goUpload}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 13,
                borderRadius: 15,
                backgroundColor:
                  scheme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.40)",
                borderWidth: 1.5,
                borderColor: "rgba(124,58,237,0.45)",
              },
              pressed ? { opacity: 0.85 } : null,
            ]}
          >
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke={violet.text}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M12 15V3" />
              <Path d="m7 8 5-5 5 5" />
              <Path d="M5 21h14" />
            </Svg>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 13,
                color: violet.text,
              }}
            >
              {/* «Отправить обновлённую работу»: ключа в d.parentApp пока нет
               *  (hwDetailSubmitUpdatedBtn — v1 d.parent). Литерал; ключ
               *  добавим позже, без ломающих правок shared-словаря. */}
              Отправить обновлённую работу
            </Text>
          </Pressable>
        ) : null}

        {/* 11. SentStateBadgeConditional — sc-if hwSentF (не кликабельно) */}
        {hwSentF ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: 13,
              borderRadius: 15,
              backgroundColor: chipVi.bg,
              borderWidth: 1,
              borderColor: chipVi.border,
            }}
          >
            <Svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke={violet.text}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="M20 6 9 17l-5-5" />
            </Svg>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 12.5,
                color: violet.text,
              }}
            >
              {/* «Работа отправлена · На проверке» — конкатенация из
               *  локализованного статусного ярлыка + литерала «Работа
               *  отправлена» (нет отдельного parentApp-ключа). Так же
               *  поступает мокап (строка 580). */}
              Работа отправлена · {t.status.underReview}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Шторка выбора ребёнка. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={childId}
          onSelect={(id) => {
            setChildId(id);
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}

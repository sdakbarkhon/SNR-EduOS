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
 *
 * Заход 2, шаг 5: для реального входа (isRealFlow) экран показывает КОНКРЕТНОЕ
 * задание (homeworkId из route.params — список передаёт row.id) через
 * packages/core getChildHomeworkDetail (реюз getHomeworkWithSubmissions,
 * parent-скоуп на одного ребёнка). Родитель — read-only: «Отправить
 * обновлённую работу» полностью скрыта для real-флоу (вёрстка не удаляется,
 * просто не рендерится); TopBar-кнопка «upload» — неактивна (onShare
 * не задаётся). StatusStepperCard (4-точечный таймлайн) для real-флоу не
 * рендерится — под него нет реальных данных (не изобретаемfake-даты).
 * Числовая оценка НЕ показывается — только статус (реюз
 * lib/homeworkStatus, тот же паттерн, что уже на вебе). Демо-флоу
 * (HOMEWORK_DETAIL) не тронут ни строкой.
 */
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getChildHomeworkDetail, getSubmissionFileUrl, format, LOCALE_TAG, type ChildHomeworkDetail, type Dictionary } from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import type { StatusFamily } from "../../ui";
import {
  EmptyBlock,
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
  defaultChildId,
} from "../../data";
import type { BaseSubjectKey } from "../../data/types";
import { useAppLocale } from "../../i18n";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useParentData } from "../../context/ParentDataContext";
import { toChildRow } from "../../lib/realChild";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { getSupabase } from "../../lib/supabase";
import { SubjectIcon } from "../../lib/subjectIcons";
import { tashkentDateKey, addDays } from "../../lib/tashkent";
import { realSubmissionStatusKind, realTestStatusKind, homeworkStatusLabel, realGradeDisplay, type RealHomeworkStatusKind } from "../../lib/homeworkStatus";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** «#ca8a04» → «202,138,4» — тот же локальный паттерн, что уже в
 *  ScheduleScreen.tsx/HomeworksScreen.tsx и др. */
function hexToRgbCsv(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** kind → StatusFamily по enum, не по локализованному тексту (тот же фикс,
 *  что в HomeworksScreen.tsx — лейбл теперь переведён и меняется с языком). */
function realStatusFamily(kind: RealHomeworkStatusKind): StatusFamily {
  if (kind === "pending_review") return "violet";
  if (kind === "graded") return "green";
  return "gray"; // «Не сдано»
}

/** Расширение файла → короткая заглавная метка на плитке (PDF/PNG/DOC…). */
function fileExtLabel(name: string | null | undefined): string {
  if (!name) return "FILE";
  const ext = name.split(".").pop();
  return ext ? ext.toUpperCase().slice(0, 4) : "FILE";
}

function fileSizeLabel(bytes: number | null | undefined, hw: Dictionary["parentApp"]["hw"]): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return format(hw.sizeKb, { n: Math.round(bytes / 1024) });
  return format(hw.sizeMb, { n: (bytes / (1024 * 1024)).toFixed(1) });
}

const HTTP_URL_RE = /^https?:\/\/\S+$/;

// Подпись ссылки идёт по сети, и всё это время кнопка оставалась нажимаемой:
// каждый тап уходил новым запросом и новым открытием браузера. Замок общий на
// экран — файлов на нём несколько, но открывать два разом всё равно незачем.
let signingFile = false;

async function openSignedFile(storagePath: string, errorTitle: string) {
  if (signingFile) return;
  signingFile = true;
  try {
    const url = await getSubmissionFileUrl(getSupabase(), storagePath);
    await Linking.openURL(url);
  } catch (e) {
    Alert.alert(errorTitle, e instanceof Error ? e.message : String(e));
  } finally {
    signingFile = false;
  }
}

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
      {/* 15.08.2026 (заглушки). В настоящем потоке кнопка приходила без
          обработчика (onShare === undefined) и молча нажималась. Теперь её
          просто нет, когда делать нечего. */}
      {onShare ? (
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
      ) : null}
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
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const localeTag = LOCALE_TAG[locale];
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<MainStackParamList, "d13">>();
  const auth = useAuthSession();

  const session = useAuthSession();
  const { data: parentData, selectedChildId, selectChild } = useParentData();
  const isRealFlow = !session.demoParentId && !!parentData && parentData.children.length > 0;
  const realIndex = isRealFlow
    // find, а не прижатый к нулю индекс: промах давал ПЕРВОГО ребёнка семьи
    // вместо выбранного. Тот же класс, что и подстановка выдуманного ребёнка
    // в resolveChild, только внутри одной семьи (28.08.2026).
    ? parentData!.children.findIndex((c) => c.id === selectedChildId)
    : -1;
  // realIndex теперь может быть −1 (выбранного ребёнка нет в семье), а
  // children[-1] это undefined — до конца проверять обязаны мы, тип массива
  // об этом молчит.
  const realChildRow =
    isRealFlow && realIndex >= 0
      ? toChildRow(parentData!.children[realIndex], realIndex)
      : null;

  const children = getChildren();
  const [childId, setChildId] = useState<string | null>(() =>
    auth.currentChildId ?? defaultChildId(),
  );
  const [sheetOpen, setSheetOpen] = useState(false);

  const ctx = getSelectedChildContext(childId ?? undefined);
  const child = ctx.child;
  const identityChild = realChildRow ?? child;
  const hw = getHomeworkDetail();

  // ── Заход 2, шаг 5: реальное задание — homeworkId из навигации (список
  // передаёт row.id), getChildHomeworkDetail уже безопасно скопирован на
  // ОДНОГО ребёнка (реюз getHomeworkWithSubmissions, без своего select).
  const homeworkId = route.params?.homeworkId;
  const detailState = useAsyncData(
    () =>
      isRealFlow && selectedChildId && homeworkId
        ? getChildHomeworkDetail(getSupabase(), selectedChildId, homeworkId)
        : Promise.resolve(null),
    [isRealFlow, selectedChildId, homeworkId],
  );
  const realHw: ChildHomeworkDetail | null = detailState.data ?? null;
  // Долги, проход 3 — единственный элемент уже загружен, "сегодня/завтра"
  // в дедлайне — derived-лейбл; useTashkentToday сам пересчитывает его на
  // границе суток, отдельный refresh() не нужен (нечего перезапрашивать
  // заново — это не список).
  const todayKey = useTashkentToday();
  const tomorrowKey = useMemo(() => addDays(todayKey, 1), [todayKey]);

  const isRealTest = realHw?.content_type === "test";
  const realKind: RealHomeworkStatusKind | null = realHw
    ? isRealTest
      ? realTestStatusKind(realHw.test_submission)
      : realSubmissionStatusKind(realHw.submission?.status)
    : null;
  // Заход 2, шаг 6 — числовая оценка (была скрыта в Шаге 5): добавляем к
  // лейблу статуса только для "graded".
  const realGradeDisplayValue =
    realKind === "graded" && realHw ? realGradeDisplay(realHw.content_type, realHw.submission, realHw.test_submission) : null;
  const realStatusLabel = realKind
    ? realGradeDisplayValue
      ? format(t.hw.gradedWithScore, { grade: realGradeDisplayValue })
      : homeworkStatusLabel(realKind, t.status)
    : "";
  const realFamily = realKind ? realStatusFamily(realKind) : "gray";
  const realSt = tokens.status[realFamily];
  const realChip = tokens.chip(realSt.rgb);
  const realSubmittedAtAll = realKind != null && realKind !== "not_submitted";

  const realDueLabel = useMemo(() => {
    if (!realHw?.due_date) return t.hw.noDeadline;
    const key = tashkentDateKey(realHw.due_date);
    const time = new Date(realHw.due_date).toLocaleTimeString(localeTag, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tashkent",
    });
    if (key === todayKey) return format(t.hw.dueToday, { time });
    if (key === tomorrowKey) return format(t.hw.dueTomorrow, { time });
    const dateLabel = new Date(realHw.due_date).toLocaleDateString(localeTag, {
      day: "numeric",
      month: "long",
      timeZone: "Asia/Tashkent",
    });
    return format(t.hw.dueOn, { date: dateLabel });
  }, [realHw?.due_date, todayKey, tomorrowKey, t.hw, localeTag]);

  const realTeacherInitials = useMemo(() => {
    const name = realHw?.teacherName?.trim();
    if (!name) return "—";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "—";
  }, [realHw?.teacherName]);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };
  const goFile = () => navigation.navigate("stub", { stubKey: "file" });
  const goUpload = () => navigation.navigate("stub", { stubKey: "upload" });
  const goMsgs = () => navigation.navigate("Tabs", { screen: "d24" });

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
      isRealFlow
        ? parentData!.children.map((c, i) => {
            const row = toChildRow(c, i);
            return {
              id: row.id,
              initials: row.first_name.slice(0, 1),
              gradient: row.avatar_gradient,
              ringColor: row.avatar_ring,
              name: row.full_name,
              classLabel: `${row.class_name} ${t.grades.class}`,
              statusLabel: "—",
              statusTone: "gray" as const,
            };
          })
        : children.map((k) => ({
            id: k.id,
            initials: k.first_name.slice(0, 1),
            gradient: k.avatar_gradient,
            ringColor: k.avatar_ring,
            name: k.full_name,
            classLabel: `${k.class_name} ${t.grades.class}`,
            statusLabel: k.status_chip,
            statusTone: k.status_chip === "В школе" ? "green" : "gray",
          })),
    [isRealFlow, parentData, children, t.grades.class],
  );

  // РЕБЁНКА НЕТ. Школа завела родителя, но ученика к нему ещё не привязала —
  // случай настоящий. До 28.08.2026 сюда молча подставлялся выдуманный
  // ребёнок (resolveChild в data/index.ts), и человек читал чужое расписание
  // и чужие оценки как данные своего. Теперь говорим словами.
  //
  // Демо-показа это не касается: там ребёнок есть всегда.
  if (!identityChild) {
    return (
      <AppBackground>
        <View style={{ flex: 1, justifyContent: "center", padding: 18 }}>
          <EmptyBlock
            title={t.common.noChildTitle}
            text={t.common.noChildText}
          />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      {/* 1. TopBar — заход 2, шаг 5: upload-иконка неактивна для real-флоу
          (родитель read-only), вёрстка не убрана. */}
      <DetailTopBar title={t.scr.homework} onBack={goBack} onShare={isRealFlow ? undefined : goFile} />

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
            initials: identityChild.first_name.slice(0, 1),
            gradient: identityChild.avatar_gradient,
            ringColor: identityChild.avatar_ring,
          }}
          name={identityChild.full_name}
          classLabel={`${identityChild.class_name} ${t.grades.class}`}
          onPress={() => setSheetOpen(true)}
        />

        {isRealFlow ? (
          detailState.loading ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator color={tokens.accent} />
            </View>
          ) : detailState.error ? (
            <GlassCard
              radius={20}
              contentStyle={{
                padding: 18,
                gap: 10,
                alignItems: "center",
                borderWidth: 1,
                borderColor: `rgba(${tokens.status.red.rgb},0.35)`,
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.status.red.text, textAlign: "center" }}>
                {t.hw.loadDetailError}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2, textAlign: "center" }}>
                {detailState.error.message}
              </Text>
              <Pressable
                onPress={() => detailState.refresh()}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: `rgba(${tokens.status.red.rgb},0.14)`,
                  borderWidth: 1,
                  borderColor: `rgba(${tokens.status.red.rgb},0.4)`,
                }}
              >
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.status.red.text }}>
                  {t.common.retry}
                </Text>
              </Pressable>
            </GlassCard>
          ) : !realHw ? (
            <GlassCard radius={20} contentStyle={{ padding: 18, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 12, color: tokens.ink2, textAlign: "center" }}>
                {t.hw.notFound}
              </Text>
            </GlassCard>
          ) : (
            <>
              {/* 4-real. HomeworkHeaderCard — реальный предмет/статус/срок/учитель. */}
              <GlassCard radius={20} contentStyle={{ padding: 13, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                  <View
                    style={[
                      {
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: realHw.subjectColor ?? "#6366f1",
                      },
                      shadowStyle({ x: 0, y: 6, blur: 14, color: `rgba(${hexToRgbCsv(realHw.subjectColor ?? "#6366f1")},0.30)` }),
                    ]}
                  >
                    {/* 30.08.2026 — значок предмета из subjects.icon; его нет —
                        остаются две первые буквы названия, как было. */}
                    {realHw.subjectIcon ? (
                      <SubjectIcon name={realHw.subjectIcon} size={21} />
                    ) : (
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                        {(realHw.subjectName ?? "—").slice(0, 2)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontFamily: fonts.manrope800, fontSize: 10, letterSpacing: 10 * 0.05, color: tokens.ink3 }}
                    >
                      {(realHw.subjectName ?? t.hw.subjectFallbackCaps).toUpperCase()}
                    </Text>
                    <Text numberOfLines={2} style={{ fontFamily: fonts.manrope800, fontSize: 13.5, color: tokens.ink1 }}>
                      {realHw.title}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: realChip.bg,
                      borderWidth: 1,
                      borderColor: realChip.border,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 8.5, color: realSt.text }}>
                      {realStatusLabel}
                    </Text>
                  </View>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingTop: 9,
                    borderTopWidth: 1,
                    borderTopColor: scheme === "dark" ? "rgba(255,255,255,0.10)" : "rgba(23,18,67,0.07)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <CalendarGlyph color={scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.66)"} />
                    <Text
                      style={{
                        fontFamily: fonts.manrope700,
                        fontSize: 10.5,
                        color: scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.66)",
                      }}
                    >
                      {realDueLabel}
                    </Text>
                  </View>
                  <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <TeacherAvatar initials={realTeacherInitials} size={24} />
                    <Text
                      style={{
                        fontFamily: fonts.manrope700,
                        fontSize: 10.5,
                        color: scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.66)",
                      }}
                    >
                      {realHw.teacherName ?? t.hw.teacherUnassigned}
                    </Text>
                  </View>
                </View>
              </GlassCard>

              {/* 5-real. TeacherInstructionCard — только если реально есть описание. */}
              {realHw.description ? (
                <GlassCard radius={20} contentStyle={{ padding: 13, gap: 6 }}>
                  <CapsLabel>{t.hw.instructionLabel}</CapsLabel>
                  <Text
                    style={{
                      fontFamily: fonts.manrope600,
                      fontSize: 11.5,
                      lineHeight: 11.5 * 1.6,
                      color: scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.78)",
                    }}
                  >
                    {realHw.description}
                  </Text>
                </GlassCard>
              ) : null}

              {/* 6-real. AttachmentsCard — прикреплённый УЧИТЕЛЕМ файл (инструкция),
                  только если реально прикреплён. */}
              {realHw.attachment_filename ? (
                <GlassCard radius={20} contentStyle={{ padding: 13, gap: 9 }}>
                  <CapsLabel>{t.hw.attachmentsLabel}</CapsLabel>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <AttachmentTypeTile label={fileExtLabel(realHw.attachment_filename)} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                        {realHw.attachment_filename}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.manrope600,
                          fontSize: 9.5,
                          color: scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.55)",
                        }}
                      >
                        {fileSizeLabel(realHw.attachment_size_bytes, t.hw)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => realHw.attachment_storage_path && openSignedFile(realHw.attachment_storage_path, t.hw.openFileError)}
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
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: violet.text }}>
                        {t.hw.openFile}
                      </Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ) : null}

              {/* 7-real. «Ваша сдача» — read-only содержимое сдачи ученика по типу
                  задания (код/текст/результат теста/фото+ссылка). Заход 2, шаг 6:
                  числовая оценка теперь показывается — для теста она уже часть
                  testResult ниже, для файла/программирования (раньше нигде не
                  показывалась) — отдельной строкой сразу под заголовком. */}
              <GlassCard radius={20} contentStyle={{ padding: 13, gap: 9 }}>
                <CapsLabel>{t.hw.submissionLabel}</CapsLabel>
                {!isRealTest && realGradeDisplayValue ? (
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.status.green.text }}>
                    {format(t.hw.gradedWithScore, { grade: realGradeDisplayValue })}
                  </Text>
                ) : null}
                {isRealTest ? (
                  realHw.test_submission ? (
                    realHw.test_submission.score != null && realHw.test_submission.max_score != null ? (
                      <Text style={{ fontFamily: fonts.manrope700, fontSize: 12.5, color: tokens.ink1 }}>
                        {format(t.hw.testResult, { score: realHw.test_submission.score, max: realHw.test_submission.max_score })}
                      </Text>
                    ) : (
                      <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, color: tokens.ink2 }}>
                        {t.hw.testPendingResult}
                      </Text>
                    )
                  ) : (
                    <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, color: tokens.ink3 }}>
                      {t.hw.testNotTaken}
                    </Text>
                  )
                ) : realHw.content_type === "programming" ? (
                  realHw.submission?.code_text ? (
                    <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled showsVerticalScrollIndicator>
                      <Text
                        selectable
                        style={{
                          fontFamily: "Courier",
                          fontSize: 10.5,
                          lineHeight: 10.5 * 1.5,
                          color: tokens.ink1,
                        }}
                      >
                        {realHw.submission.code_text}
                      </Text>
                    </ScrollView>
                  ) : (
                    <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, color: tokens.ink3 }}>
                      {t.hw.codeNotSubmitted}
                    </Text>
                  )
                ) : !realHw.submission ? (
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, color: tokens.ink3 }}>
                    {t.hw.workNotSubmitted}
                  </Text>
                ) : !realHw.submission.answer_text && !realHw.submission.file_storage_path ? (
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, color: tokens.ink3 }}>
                    {t.hw.workNotSubmitted}
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {realHw.submission.answer_text ? (
                      HTTP_URL_RE.test(realHw.submission.answer_text) ? (
                        <Pressable
                          onPress={() => Linking.openURL(realHw.submission!.answer_text!)}
                          style={({ pressed }) => [
                            {
                              alignSelf: "flex-start",
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
                          <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: violet.text }}>
                            {t.hw.openLink}
                          </Text>
                        </Pressable>
                      ) : (
                        <Text
                          style={{
                            fontFamily: fonts.manrope600,
                            fontSize: 11.5,
                            lineHeight: 11.5 * 1.6,
                            color: scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.78)",
                          }}
                        >
                          {realHw.submission.answer_text}
                        </Text>
                      )
                    ) : null}
                    {realHw.submission.file_storage_path ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <AttachmentTypeTile label={fileExtLabel(realHw.submission.file_original_name)} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                            {realHw.submission.file_original_name ?? t.hw.fileFallbackName}
                          </Text>
                          <Text
                            style={{
                              fontFamily: fonts.manrope600,
                              fontSize: 9.5,
                              color: scheme === "dark" ? tokens.ink3 : "rgba(26,19,74,0.55)",
                            }}
                          >
                            {fileSizeLabel(realHw.submission.file_size_bytes, t.hw)}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => openSignedFile(realHw.submission!.file_storage_path!, t.hw.openFileError)}
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
                          <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: violet.text }}>
                            {t.hw.openFile}
                          </Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                )}
              </GlassCard>

              {/* StatusStepperCard пропущен для real-флоу — нет реальных данных
                  таймлайна (не изобретаем 4 фейковые даты). */}

              {/* 8-real. TeacherCommentCard — только если реально есть комментарий. */}
              {realHw.submission?.teacher_comment ? (
                <GlassCard radius={20} contentStyle={{ padding: 13, gap: 8 }}>
                  <CapsLabel>{t.hw.commentLabel}</CapsLabel>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
                    <TeacherAvatar initials={realTeacherInitials} size={28} />
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Text
                        style={{
                          fontFamily: fonts.manrope600,
                          fontSize: 11.5,
                          lineHeight: 11.5 * 1.55,
                          color: scheme === "dark" ? tokens.ink2 : "rgba(26,19,74,0.78)",
                        }}
                      >
                        {realHw.submission.teacher_comment}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              ) : null}

              {/* 9-real. PrimaryActionMessageTeacher — безопасное действие, остаётся активным. */}
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
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                  </Svg>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#FFFFFF" }}>
                    {t.home.msgTeacher}
                  </Text>
                  <View
                    pointerEvents="none"
                    style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1.5, backgroundColor: "rgba(255,255,255,0.35)" }}
                  />
                </LinearGradient>
              </Pressable>

              {/* 10-real. Read-only: «Отправить обновлённую работу» полностью
                  скрыта для родителя (ни при каком статусе), вёрстка не удалена —
                  просто не рендерится в real-флоу. */}

              {/* 11-real. SentStateBadge — показываем, только если что-то реально сдано. */}
              {realSubmittedAtAll ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: 13,
                    borderRadius: 15,
                    backgroundColor: realChip.bg,
                    borderWidth: 1,
                    borderColor: realChip.border,
                  }}
                >
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={realSt.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6 9 17l-5-5" />
                  </Svg>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: realSt.text }}>
                    {format(t.hw.sentPrefix, { status: realStatusLabel })}
                  </Text>
                </View>
              ) : null}
            </>
          )
        ) : (
          <>
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
          <CapsLabel>{t.hw.instructionLabel}</CapsLabel>
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
          <CapsLabel>{t.hw.attachmentsLabel}</CapsLabel>
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
                {t.hw.openFile}
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
          <CapsLabel>{t.hw.commentLabel}</CapsLabel>
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
              {format(t.hw.sentPrefix, { status: t.status.underReview })}
            </Text>
          </View>
        ) : null}
          </>
        )}
      </ScrollView>

      {/* Шторка выбора ребёнка. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={isRealFlow ? (selectedChildId ?? undefined) : (childId ?? undefined)}
          onSelect={(id) => {
            if (isRealFlow) {
              selectChild(id);
            } else {
              setChildId(id);
            }
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}

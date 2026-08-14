/**
 * П5 «Главная» (Dashboard) — заход 4.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 219–271:
 *  220–225 шапка (RootHeader с логотипом), 227 приветствие,
 *  228–241 ChildSwitcherCard large + MetricsSplitRow (5 колонок),
 *  242–245 AccentCard «Следующий урок», 246–249 ряд «К оплате / Питание»,
 *  250–254 AccentCard «EduOS Assistant» с 2 CTA, 255–263 QuickActionGrid 3×2,
 *  264 SectionHeader ленты, 265–269 GlassCard с 3 ListRow «Сегодня».
 *
 * Данные — через аксессоры src/data (getDashboard, getChildren,
 * getSelectedChildContext). Бэйдж колокольчика — useUnreadNotifications()
 * (настоящая таблица notifications). Тексты — через
 * useAppLocale().d.parentApp.* (RU/UZ/EN). Обе темы через useTheme().
 * iOS safe-area у шапки — из RootHeader; у скролла — paddingBottom 118px
 * под FloatingTabBar (макет: строка 226 — «118 под FloatingTabBar»).
 *
 * Заход 2, шаг 1: ChildSwitcherCard (228–241, только ИМЯ/КЛАСС/аватар/
 * переключатель, не footer-метрики) для реального (не демо) входа берёт
 * активного ребёнка из ParentDataContext — РЕАЛЬНЫЙ Supabase-student, а не
 * фикстуру. Демо-флоу (session.demoParentId != null) не тронут ни строкой.
 *
 * Заход 2, шаг 4: для реального входа (isRealFlow) 3 плитки метрик
 * («В школе с» / «Уроков» / «Посещено X/Y») и карточка «Следующий урок»
 * теперь тоже реальные — getStudentLessonsForWeek (неделя группы, для
 * подсчёта уроков сегодня и ближайшего предстоящего урока) +
 * getStudentAttendance (реюз Шага 3, для «сегодня отмечено present» и
 * времени первой отметки). «Кошелёк» — по-прежнему фикстура (getDashboard).
 *
 * Заход 2, шаг 5: плитка «ДЗ» тоже реальная — getHomeworkWithSubmissions,
 * критерий «невыполненных» — ТОЧНО тот же, что уже на вебе у родительского
 * дашборда (apps/web parent dashboard/page.tsx): нет ни homework_submissions,
 * ни test_submissions, и (срока нет ИЛИ срок сегодня/позже — просроченные
 * туда сознательно не попадают, это поведение веба, не своя логика).
 * Отдельный useAsyncData от лессонов/посещаемости — сбой загрузки ДЗ не
 * должен гасить уже отгруженные «Уроков»/«Посещено»/«В школе с».
 */
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getStudentLessonsForWeek, getStudentAttendance, getHomeworkWithSubmissions, formatTime, format, LOCALE_TAG } from "@snr/core";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  AccentCard,
  AccentInset,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  GlassCard,
  ListRow,
  MetricsSplitRow,
  QuickActionTile,
  QuickActionsGrid,
  RootHeader,
  SectionHeader,
  StatusChip,
  TabScreenScroll,
  type ChildPickerItem,
  type MetricCell,
} from "../../ui";
import {
  DEFAULT_CHILD_INDEX,
  getChildren,
  getDashboard,
  getParent,
  getSelectedChildContext,
} from "../../data";
import { ICONS, type MainStackParamList, type TabParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";
import { formatMoney } from "../../lib/format";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useParentData } from "../../context/ParentDataContext";
import { toChildRow } from "../../lib/realChild";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications";
import { getSupabase } from "../../lib/supabase";
import { tashkentDateKey } from "../../lib/tashkent";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { getAppNow } from "../../lib/appTime";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Заход 2, шаг 2: реальные ФИО хранятся как "Фамилия Имя" — для обращения
 *  в приветствии берём последнее слово ("Ismailov Sherzod" → "Sherzod"). */
function givenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] || fullName;
}

/** Иконка-глиф из inline SVG-paths, 17px белым — как quick-action и «Следующий урок». */
function WhiteGlyph({ paths, size = 17 }: { paths: string[]; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

/** Плитка 46×46 grad-glass с глифом-строкой («√x») — макет строка 244. */
function AccentGlyphTile({
  gradient,
  glyph,
  size = 46,
}: {
  gradient: [string, string];
  glyph: string;
  size?: number;
}) {
  const g = gradPoints(135);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.35)",
      }}
    >
      <LinearGradient colors={gradient} start={g.start} end={g.end} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>{glyph}</Text>
        </View>
      </View>
    </View>
  );
}

/** Chip-«5» 30×30 rounded-10 зелёный — макет строка 267 (feed #1, оценка). */
function GradeBadge({ value }: { value: number }) {
  const { tokens } = useTheme();
  const st = tokens.status.green;
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 10,
        backgroundColor: `rgba(${st.rgb},0.14)`,
        borderWidth: 1,
        borderColor: `rgba(${st.rgb},0.35)`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: st.text }}>{value}</Text>
    </View>
  );
}

/** Иконка feed-ряда 36×36 rounded-12 с градиентом и текстовым/SVG-глифом. */
function FeedIconTile({
  gradient,
  glyph,
  svgPaths,
}: {
  gradient: [string, string];
  glyph?: string;
  svgPaths?: string[];
}) {
  const g = gradPoints(135);
  return (
    <LinearGradient
      colors={gradient}
      start={g.start}
      end={g.end}
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {svgPaths ? (
        <WhiteGlyph paths={svgPaths} size={17} />
      ) : (
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: "#FFFFFF" }}>{glyph}</Text>
      )}
    </LinearGradient>
  );
}

/**
 * CTA-glass кнопка для акцентной карточки ассистента.
 * Заказчик просил чтобы две кнопки в ряду делили 50/50. Обёртка
 * `<View style={{flex:1}}>` вокруг AccentInset не помогала, потому что
 * AccentInset рендерит `<Pressable>` без flex:1, и Pressable сжимался по
 * контенту. Здесь Pressable явно `flex:1` + `minHeight:36` (одинаковая
 * высота обеих кнопок при переносе на 2 строки, что случается на UZ/EN
 * с более длинными фразами).
 */
function AssistantCta({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: PressableStateCallbackType) => [
        {
          flex: 1,
          minHeight: 36,
          borderRadius: 12,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
          backgroundColor: "rgba(255,255,255,0.2)",
          paddingVertical: 8,
          paddingHorizontal: 10,
          alignItems: "center",
          justifyContent: "center",
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <Text
        numberOfLines={2}
        style={{
          fontFamily: fonts.manrope800,
          fontSize: 11.5,
          color: "#FFFFFF",
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const children = getChildren();
  // Демо (session.demoParentId != null) не тронут: childId остаётся
  // единственным источником и для идентичности, и для фикстурных
  // data-плиток, ровно как было.
  const [childId, setChildId] = useState<string>(children[DEFAULT_CHILD_INDEX].id);
  const [sheetOpen, setSheetOpen] = useState(false);

  const session = useAuthSession();
  const { data: parentData, selectedChildId, selectChild } = useParentData();
  const isRealFlow = !session.demoParentId && !!parentData && parentData.children.length > 0;
  const realIndex = isRealFlow
    ? Math.max(0, parentData!.children.findIndex((c) => c.id === selectedChildId))
    : -1;
  const realChildRow = isRealFlow ? toChildRow(parentData!.children[realIndex], realIndex) : null;

  const parent = getParent();
  // getDashboard/getSelectedChildContext — фикстурные "данные-экраны"
  // (метрики, приветствие), НЕ идентичность; продолжают ходить по
  // session.currentChildId/childId как раньше, в этом шаге не меняются.
  const dashboard = getDashboard(childId);
  const ctx = getSelectedChildContext(childId);
  const child = ctx.child;
  // Идентичность в ChildSwitcherCard (имя/класс/аватар/статус) — реальная
  // для phone-flow, фикстурная (как раньше) для демо.
  const identityChild = realChildRow ?? child;
  const bellCount = useUnreadNotifications();

  // Приветствие: «Доброе утро, {родитель}!» + «Вот что происходит у {ребёнок}
  // сегодня». Заход 2, шаг 2: для real-flow — реальные ФИО (родитель из
  // parentData.parentName, ребёнок из identityChild.full_name), демо — как
  // раньше genitive-фикстура (child.first_name_gen). Реальные ФИО в базе —
  // "Фамилия Имя" (см. testAccounts.ts), для обращения берём последнее слово
  // (даёт "Бахтиёр"/"Шерзод", не "Исмаилов"); шаблон (dashboard.greeting,
  // локализован ru/uz/en) не меняется, меняется только подставляемое имя.
  const greetingParentName = isRealFlow ? givenName(parentData!.parentName) : parent.first_name;
  const greetingChildName = isRealFlow ? givenName(identityChild.full_name) : child.first_name_gen;
  const greetingTitle = `${dashboard.greeting.title_prefix}${greetingParentName}!`;
  const greetingSub = dashboard.greeting.subtitle_template.replace("{gen}", greetingChildName);

  // ── Заход 2, шаг 4: реальные «В школе с» / «Уроков» / «Посещено X/Y» +
  // карточка «Следующий урок» — из недели уроков группы (getStudentLessonsForWeek,
  // тот же безопасный FK-hint join, что чинил баг «Выходной везде», d9c6baf)
  // + посещаемости (getStudentAttendance, реюз Шага 3). ОДИН комбинированный
  // fetch на оба запроса — один loading/error гейт на весь блок.
  //
  // Окно — СКОЛЬЗЯЩИЕ 7 дней от «сегодня» (todayKey..+6), НЕ календарная
  // неделя Пн-Вс (в отличие от ScheduleScreen, которому нужно выравнивание
  // по Пн-Вс под день-пилюли): адверсариальная проверка поймала, что
  // календарная неделя даёт ложный «Нет предстоящих уроков» на карточке
  // Dashboard весь конец недели (с вечера последнего учебного дня недели до
  // понедельника) — следующий урок физически есть, но лежит в СЛЕДУЮЩЕЙ
  // календарной неделе, вне загруженного окна. Скользящее окно от today
  // всегда включает «today + 6 следующих дней», так что этот кейс не
  // возникает (если только у группы не было бы разрыва в занятиях длиннее
  // недели — тогда честно «Нет предстоящих уроков», не фейк).
  // Долги, проход 2: не useMemo(() => tashkentToday(), []) — та не
  // пересчитывается, если приложение висит открытым через полночь;
  // useTashkentToday реагирует на возврат на передний план (AppState).
  const todayKey = useTashkentToday();
  const homeDataState = useAsyncData(() => {
    if (!isRealFlow || !selectedChildId) return Promise.resolve(null);
    const db = getSupabase();
    return Promise.all([
      getStudentLessonsForWeek(db, todayKey, selectedChildId),
      getStudentAttendance(db, undefined, selectedChildId),
    ]);
  }, [isRealFlow, selectedChildId, todayKey]);

  const [weekLessons, attendanceResult] = homeDataState.data ?? [null, null];

  const todayLessonsReal = useMemo(
    () => (weekLessons ?? []).filter((l) => tashkentDateKey(l.starts_at) === todayKey),
    [weekLessons, todayKey],
  );
  // Ближайший урок с starts_at >= сейчас — недельный список уже отсортирован
  // по starts_at (getStudentLessonsForWeek), поэтому просто find() первого
  // подходящего. Если его нет во всём 7-дневном скользящем окне — честный
  // нейтральный placeholder (не фейк), не «эта неделя закончилась».
  const nextLessonReal = useMemo(
    () => (weekLessons ?? []).find((l) => l.starts_at >= getAppNow().toISOString()) ?? null,
    [weekLessons],
  );
  const attendanceTodayReal = useMemo(
    () => (attendanceResult?.records ?? []).filter((r) => tashkentDateKey(r.lesson_date) === todayKey),
    [attendanceResult, todayKey],
  );
  const presentTodayReal = attendanceTodayReal.filter((r) => r.status === "present");
  // Самая ранняя отметка present сегодня (не полагаемся на общий порядок
  // getStudentAttendance — тот marked_at DESC по ВСЕЙ истории, тут явный min
  // по отфильтрованному сегодняшнему подмножеству).
  const arrivalTimeReal = presentTodayReal.reduce<string | null>((min, r) => {
    if (!r.marked_at) return min;
    return !min || r.marked_at < min ? r.marked_at : min;
  }, null);

  // 5 колонок метрики-сплит (макет 230–240). Валюта коротким — «185 000 сум».
  // «В школе с» / «Уроков» / «Посещено X/Y» — реальные для isRealFlow (загрузка
  // → «…», ошибка → «—», не фейк-ноль); «ДЗ» и «Кошелёк» не тронуты (фикстура).
  const homeLoading = isRealFlow && homeDataState.loading;
  const homeError = isRealFlow && !!homeDataState.error;

  // ── Заход 2, шаг 5: «ДЗ N» — отдельный fetch (не делим loading/error с
  // уроками/посещаемостью выше — сбой ДЗ не должен гасить уже рабочие
  // плитки). Критерий «невыполненных» — тот же, что apps/web parent
  // dashboard/page.tsx: нет ни submission, ни test_submission, и (без
  // срока ИЛИ срок сегодня/позже).
  const homeworkTileState = useAsyncData(
    () => (isRealFlow && selectedChildId ? getHomeworkWithSubmissions(getSupabase(), selectedChildId) : Promise.resolve(null)),
    [isRealFlow, selectedChildId],
  );
  const homeworkLoading = isRealFlow && homeworkTileState.loading;
  const homeworkError = isRealFlow && !!homeworkTileState.error;
  const pendingHomeworkCount = useMemo(
    () =>
      (homeworkTileState.data ?? []).filter(
        (hw) => !hw.submission && !hw.test_submission && (!hw.due_date || tashkentDateKey(hw.due_date) >= todayKey),
      ).length,
    [homeworkTileState.data, todayKey],
  );
  const homeworkCountValue = isRealFlow
    ? homeworkLoading
      ? "…"
      : homeworkError
        ? "—"
        : String(pendingHomeworkCount)
    : String(dashboard.child_status.homework_count);

  const atSchoolSinceValue = isRealFlow
    ? homeLoading
      ? "…"
      : homeError
        ? "—"
        : (arrivalTimeReal ? formatTime(arrivalTimeReal, LOCALE_TAG[locale]) : "—")
    : dashboard.child_status.at_school_since_label;
  const lessonsTotalValue = isRealFlow
    ? homeLoading
      ? "…"
      : homeError
        ? "—"
        : String(todayLessonsReal.length)
    : String(dashboard.child_status.lessons_total);
  const attendedValue = isRealFlow
    ? homeLoading
      ? "…"
      : homeError
        ? "—"
        : `${presentTodayReal.length}/${todayLessonsReal.length}`
    : `${dashboard.child_status.lessons_attended}/${dashboard.child_status.lessons_total}`;

  const metricCells: MetricCell[] = [
    { label: d.parentApp.home.atSchoolSince, value: atSchoolSinceValue },
    { label: d.parentApp.home.lessons, value: lessonsTotalValue },
    {
      label: d.parentApp.home.attended,
      value: attendedValue,
      valueColor: tokens.status.green.text,
    },
    {
      label: d.parentApp.home.hw,
      value: homeworkCountValue,
      valueColor: tokens.status.orange.text,
    },
    {
      label: d.parentApp.home.wallet,
      value: `${formatMoney(dashboard.wallet_balance)} ${d.parentApp.pay.sum}`,
      flex: 1.4,
    },
  ];

  // Карточка «Следующий урок» (242–245): реальные предмет/время/кабинет/
  // учитель (fallback предметник → куратор группы), нейтральный placeholder
  // при отсутствии предстоящих уроков. Градиент/размер плитки — как в
  // фикстуре (вёрстку не трогаем, варьируется только текст).
  const nextLessonTeacherName = nextLessonReal?.subject?.teacher?.full_name ?? nextLessonReal?.group?.teacher?.full_name ?? null;
  const nextLessonRoomLabel = nextLessonReal?.room ? format(d.parentApp.home.roomLabel, { room: nextLessonReal.room }) : null;
  const nextLessonTimeLabel = nextLessonReal
    ? `${formatTime(nextLessonReal.starts_at, LOCALE_TAG[locale])}${nextLessonReal.ends_at ? `–${formatTime(nextLessonReal.ends_at, LOCALE_TAG[locale])}` : ""}`
    : null;
  const nextLessonRealLabel = nextLessonReal
    ? [nextLessonTimeLabel, nextLessonRoomLabel, nextLessonTeacherName].filter(Boolean).join(" · ")
    : "";
  const nextLessonRealSubjectName = nextLessonReal?.subject?.name ?? nextLessonReal?.title ?? "—";
  const nextLessonRealTile = nextLessonRealSubjectName.slice(0, 2);

  const nextLessonView = isRealFlow
    ? homeLoading
      ? { subjectName: d.parentApp.common.loading, timeRoomTeacherLabel: "", tileLabel: "…" }
      : homeError
        ? { subjectName: d.parentApp.home.nextLessonError, timeRoomTeacherLabel: d.parentApp.home.nextLessonRetryHint, tileLabel: "!" }
        : nextLessonReal
          ? { subjectName: nextLessonRealSubjectName, timeRoomTeacherLabel: nextLessonRealLabel, tileLabel: nextLessonRealTile }
          : { subjectName: d.parentApp.home.nextLessonEmpty, timeRoomTeacherLabel: "", tileLabel: "–" }
    : {
        subjectName: dashboard.next_lesson.subject_name,
        timeRoomTeacherLabel: dashboard.next_lesson.time_room_teacher_label,
        tileLabel: dashboard.next_lesson.tile_label,
      };
  const nextLessonCardPress =
    isRealFlow && homeError ? () => homeDataState.refresh() : () => navigation.navigate("d15");

  const dueSum = `${formatMoney(dashboard.due_card.amount)} ${d.parentApp.pay.sum}`;
  const dueSubtitle = `${dashboard.due_card.bills_count} счёта · ${dashboard.due_card.until_label}`;

  // Пункты шторки выбора ребёнка (BottomSheetFrame + ChildPickerSheetContent).
  // Заход 2, шаг 1: для реального входа — РЕАЛЬНЫЕ дети семьи (не полный
  // фикстурный пул из 6 детей всех демо-семей). ChildPickerSheetContent
  // требует statusLabel/statusTone (не опциональны) — для реальных детей
  // статуса "в школе/дома" ещё нет (это data-экран, следующие заходы),
  // ставим нейтральный "—", а не выдумываем "В школе".
  const pickerItems: ChildPickerItem[] = isRealFlow
    ? parentData!.children.map((c, i) => {
        const row = toChildRow(c, i);
        return {
          id: row.id,
          initials: row.first_name.slice(0, 1),
          gradient: row.avatar_gradient,
          ringColor: row.avatar_ring,
          name: row.full_name,
          classLabel: `${row.class_name} ${d.parentApp.grades.class}`,
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
        classLabel: `${k.class_name} ${d.parentApp.grades.class}`,
        statusLabel: k.status_chip,
        statusTone: k.status_chip === "В школе" ? "green" : "gray",
      }));

  // Пункты quick-actions (макет 256–263). Иконки из ICONS + inline paths.
  // «Оплатить» → card; «Дом. задания» → check; «Все сервисы» → grid;
  // «Питание» → food; «Профиль ребёнка» → user; «Расписание» → cal.
  type QuickGo = "d18" | "d12" | "d9" | "dmeals" | "d29" | "d15";
  const QUICKS: {
    label: string;
    gradient: [string, string];
    iconPaths: string[];
    shadowRgb: string;
    go: QuickGo;
  }[] = [
    { label: d.parentApp.home.pay, gradient: ["#fb923c", "#ef4444"], iconPaths: ICONS.card, shadowRgb: "251,146,60", go: "d18" },
    { label: d.parentApp.home.hwShort, gradient: ["#60a5fa", "#2563eb"], iconPaths: ICONS.check, shadowRgb: "96,165,250", go: "d12" },
    { label: d.parentApp.scr.services, gradient: ["#a78bfa", "#7c3aed"], iconPaths: ICONS.grid, shadowRgb: "167,139,250", go: "d9" },
    { label: d.parentApp.svc.meals, gradient: ["#f472b6", "#db2777"], iconPaths: ICONS.food, shadowRgb: "244,114,182", go: "dmeals" },
    { label: d.parentApp.scr.childProfile, gradient: ["#34d399", "#059669"], iconPaths: ICONS.user, shadowRgb: "52,211,153", go: "d29" },
    { label: d.parentApp.scr.schedule, gradient: ["#22d3ee", "#0891b2"], iconPaths: ICONS.cal, shadowRgb: "34,211,238", go: "d15" },
  ];

  return (
    <AppBackground>
      <RootHeader
        title="SNR EduOS"
        titleSize={14}
        showLogo
        bellCount={bellCount}
        onBellPress={() => navigation.navigate("d8")}
        avatar={{
          initials: parent.initials,
          gradient: parent.avatar_gradient,
          variant: "ring",
        }}
        onAvatarPress={() => navigation.navigate("dhub")}
      />
      <TabScreenScroll
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          gap: 12,
        }}
      >
        {/* Приветствие (227). */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontFamily: fonts.unbounded600, fontSize: 20, color: tokens.ink1 }}>
            {greetingTitle}
          </Text>
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 12, color: tokens.ink2 }}>
            {greetingSub}
          </Text>
        </View>

        {/* ChildSwitcherCard large + MetricsSplitRow (228–241). Имя/класс/
            аватар — identityChild; footer-метрики (MetricsSplitRow) — заход
            2, шаг 4: «В школе с»/«Уроков»/«Посещено X/Y» реальные для
            isRealFlow (metricCells выше), «ДЗ»/«Кошелёк» по-прежнему
            фикстурные (dashboard/childId), не в скоупе этого шага. */}
        <ChildSwitcherCard
          variant="large"
          avatar={{
            initials: identityChild.first_name.slice(0, 1),
            gradient: identityChild.avatar_gradient,
            ringColor: identityChild.avatar_ring,
          }}
          name={identityChild.full_name}
          classLabel={`${identityChild.class_name} ${d.parentApp.grades.class}`}
          status={
            isRealFlow
              ? undefined
              : { label: child.status_chip, tone: "green", withChevron: true }
          }
          chevron
          onPress={() => setSheetOpen(true)}
          onStatusPress={() => navigation.navigate("d6")}
          footer={<MetricsSplitRow cells={metricCells} topDivider />}
        />

        {/* AccentCard «Следующий урок» (242–245). */}
        <AccentCard
          gradient={dashboard.next_lesson.gradient}
          angle={135}
          shadowRgb="99,102,241"
          radius={20}
          contentStyle={{
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
          onPress={nextLessonCardPress}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9,
                letterSpacing: 9 * 0.08,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              {d.parentApp.home.nextLesson}
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 15.5, color: "#FFFFFF" }}>
              {nextLessonView.subjectName}
            </Text>
            {nextLessonView.timeRoomTeacherLabel ? (
              <Text
                style={{
                  fontFamily: fonts.manrope700,
                  fontSize: 11.5,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {nextLessonView.timeRoomTeacherLabel}
              </Text>
            ) : null}
          </View>
          <AccentGlyphTile gradient={dashboard.next_lesson.gradient} glyph={nextLessonView.tileLabel} />
        </AccentCard>

        {/* Ряд «К оплате / Питание» (246–249). */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <AccentCard
            gradient={[dashboard.due_card.gradient[0], dashboard.due_card.gradient[1]]}
            shadowRgb="244,63,94"
            radius={18}
            contentStyle={{ padding: 12, gap: 4 }}
            style={{ flex: 1 }}
            onPress={() => navigation.navigate("p17")}
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9,
                letterSpacing: 9 * 0.08,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {d.parentApp.status.due}
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>
              {dueSum}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.9)" }}>
              {dueSubtitle}
            </Text>
          </AccentCard>
          <AccentCard
            gradient={[dashboard.meals_card.gradient[0], dashboard.meals_card.gradient[1]]}
            shadowRgb="52,211,153"
            radius={18}
            contentStyle={{ padding: 12, gap: 4 }}
            style={{ flex: 1 }}
            onPress={() => navigation.navigate("dmeals")}
          >
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 9,
                letterSpacing: 9 * 0.08,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {d.parentApp.svc.meals}
            </Text>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: "#FFFFFF" }}>
              {dashboard.meals_card.status_label}
            </Text>
            <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "rgba(255,255,255,0.9)" }}>
              {dashboard.meals_card.until_label}
            </Text>
          </AccentCard>
        </View>

        {/* AccentCard «EduOS Assistant» + 2 CTA (250–254). */}
        <AccentCard
          gradient={["#8b5cf6", "#6366f1"]}
          shadowRgb="139,92,246"
          radius={20}
          contentStyle={{ padding: 14, gap: 10 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.35)",
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <WhiteGlyph paths={ICONS.spark} size={18} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
              EduOS Assistant
            </Text>
            <StatusChip label="NEW" variant="new" />
          </View>
          <Text
            style={{
              fontFamily: fonts.manrope600,
              fontSize: 12,
              lineHeight: 12 * 1.55,
              color: "rgba(255,255,255,0.95)",
            }}
          >
            {dashboard.assistant_text}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "stretch", gap: 8 }}>
            <AssistantCta
              label={d.parentApp.home.viewProgress}
              onPress={() => navigation.navigate("p10")}
            />
            <AssistantCta
              label={d.parentApp.home.msgTeacher}
              onPress={() => navigation.navigate("d24")}
            />
          </View>
        </AccentCard>

        {/* Быстрые действия (255–263). */}
        <SectionHeader title={d.parentApp.home.quickActions} />
        <QuickActionsGrid columns={3}>
          {QUICKS.map((q) => (
            <QuickActionTile
              key={q.label}
              label={q.label}
              gradient={q.gradient}
              shadowRgb={q.shadowRgb}
              icon={<WhiteGlyph paths={q.iconPaths} size={17} />}
              onPress={() => navigation.navigate(q.go as never)}
            />
          ))}
        </QuickActionsGrid>

        {/* Лента «Сегодня» (264–269). */}
        <SectionHeader
          title={d.parentApp.home.todaySection}
          linkLabel={`${d.parentApp.common.viewAll} ›`}
          onPress={() => navigation.navigate("d8")}
        />
        <GlassCard radius={22} contentStyle={{ paddingHorizontal: 14 }}>
          {dashboard.feed.map((row, idx) => {
            // Иконка ряда — по маршруту go: d11 → math √x, d12 → eng Aa, dmeals → food.
            const icon =
              row.go === "d11" ? (
                <FeedIconTile gradient={["#facc15", "#ca8a04"]} glyph="√x" />
              ) : row.go === "d12" ? (
                <FeedIconTile gradient={["#f472b6", "#db2777"]} glyph="Aa" />
              ) : (
                <FeedIconTile gradient={["#34d399", "#0ea5e9"]} svgPaths={ICONS.food} />
              );
            const right =
              row.badge.kind === "grade" ? (
                <GradeBadge value={row.badge.value} />
              ) : (
                <StatusChip
                  label={row.badge.label}
                  family={
                    row.badge.label === "Успешно"
                      ? "green"
                      : row.badge.label.indexOf("Срок") === 0
                        ? "orange"
                        : "gray"
                  }
                />
              );
            return (
              <ListRow
                key={idx}
                left={icon}
                title={row.title}
                subtitle={row.subtitle}
                right={right}
                divider={idx > 0}
                verticalPadding={10}
                onPress={() => navigation.navigate(row.go as never)}
              />
            );
          })}
        </GlassCard>
      </TabScreenScroll>

      {/* Шторка выбора ребёнка. Реальный phone-flow — переключаем реального
          активного ребёнка (ParentDataContext.selectChild), не локальный
          childId (тот продолжает питать фикстурные data-плитки, здесь не
          трогаем). Демо — ровно как было. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={d.parentApp.auth.chooseChild}
          items={pickerItems}
          selectedId={isRealFlow ? (selectedChildId ?? undefined) : childId}
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

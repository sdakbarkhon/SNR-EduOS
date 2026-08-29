/**
 * П10 «Успехи» — заход 4.
 * Композиция 1:1 из макета «SNR EduOS v2 Light.dc.html», строки 273–374:
 *  274–279 шапка (RootHeader без лого, заголовок nav.grades 17/600),
 *  281 ChildSwitcherCard compact со «Сменить ребёнка ›»,
 *  282–289 AccentCard «Средний балл» + inset-tile «Прогресс за неделю»
 *   (Sparkline 56×20, viewBox 64×24) и «Посещаемость» (линейная 4px + текст),
 *  290 SegmentPills 3 таба «Оценки / Навыки / Динамика»,
 *  ветка isGrades: 294 period-popover + delta, 305–312 grid 3×2 SubjectTile,
 *    313–319 5 строк ProgressBar-list, 320–325 «Сильные / зоны роста» с chip,
 *    326 SectionHeader Reviews + 327–331 карточка отзыва,
 *    332–336 AccentCard Assistant;
 *  ветка isSkills: 342 header + 343–348 4 плитки-навыков (24×24 icon + %
 *    + ProgressBar 3.5px), 349–353 GlassCard «Профиль навыков» (Radar 200×172)
 *    + 4 chip-навыка, 354 AccentCard Assistant;
 *  ветка isDyn: 360–364 Sparkline 320×90 с endDot + месяцы, 365–369 3 строки,
 *    370 note.
 *
 * Данные — через аксессоры src/data. Тексты — через useAppLocale().d.parentApp.*.
 * Обе темы через useTheme(); iOS safe-area — из RootHeader; скролл имеет
 * paddingBottom 118 под FloatingTabBar.
 *
 * Заход 2, шаг 6: для реального входа (isRealFlow) вкладка «Оценки» —
 * средний балл + разбивка по предметам из packages/core getStudentGrades
 * (throw-on-error, useAsyncData), сгруппированные по уже РЕЗОЛВЛЕННОМУ
 * subject-ключу (homework/lesson.subject_id → subjects.name — веб-баг «всё
 * Программирование» через groups.subject сюда не попадает). Карточка
 * отзыва учителя — getChildTeacherReviews (та же функция, что на
 * web-«Успехах»). Переключение ребёнка — общий selectedChildId
 * (ParentDataContext), перезапрашивает оба запроса.
 * Вкладка «Навыки» — фикстура (радар, вне скоупа этого захода). Вкладка
 * «Динамика», карточка «Прогресс за неделю»/мини-«Посещаемость» внутри
 * AccentCard, «Сильные/зоны роста» — остаются фикстурой (см. отчёт захода):
 * либо нет естественного способа посчитать без выдумывания метрики (тренд/
 * период сравнения), либо явно не входят в список задачи. Экраны «Все
 * предметы» (dallsubj) и «Дневник» (ddiary) тоже читают из data/fixtures/
 * grades.ts, но не тронуты в этом заходе — им нужны данные, которых нет в
 * getStudentGrades (учитель на предмет, счётчики уроков/заданий за период,
 * привязка урок→день недели).
 */
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Polygon } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  format,
  getChildSkills,
  getHomeworkWithSubmissions,
  getStudentAttendance,
  getStudentGrades,
  getChildTeacherReviews,
  getSubjectConfig,
  formatDate,
  LOCALE_TAG,
  type Dictionary,
  type StudentGradeItem,
  type ChildTeacherReview,
  averageOf,
  countsTowardAverage,
} from "@snr/core";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import {
  EmptyBlock,
  AccentCard,
  AccentInset,
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  ErrorBlock,
  GlassCard,
  LoadingBlock,
  Popover,
  ProgressBar,
  RootHeader,
  SectionHeader,
  SegmentPills,
  Sparkline,
  StarRating,
  SubjectTile,
  TabScreenScroll,
  type ChildPickerItem,
  type SubjectId,
} from "../../ui";
import {
  getAssistantTexts,
  getChildren,
  getGradePeriods,
  getGradesAssistantNotes,
  getGradesSummary,
  getSelectedChildContext,
  getSubject,
  getSubjectStats,
  getSkillsTab,
  getTeacherReviews,
  defaultChildId,
} from "../../data";
import { SoonNote } from "../../ui/notices";
import type { BaseSubjectKey, SubjectStatRow } from "../../data";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { useAppLocale } from "../../i18n";
import { useAuthSession } from "../../context/AuthSessionContext";
import { useParentData } from "../../context/ParentDataContext";
import { useDemoSession } from "../../context/DemoSessionContext";
import { toChildRow } from "../../lib/realChild";
import { useAsyncData } from "../../hooks/useAsyncData";
import { useUnreadNotifications } from "../../hooks/useUnreadNotifications";
import { getSupabase } from "../../lib/supabase";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;

/** Градиент плитки навыка — тот же, что на экране «Навыки и развитие» (d16):
 *  один навык обязан выглядеть одинаково на обоих экранах. */
const PROGRESS_SKILL_GRADIENT: Record<
  "knowledge" | "thinking" | "communication" | "independence" | "discipline",
  [string, string]
> = {
  knowledge: ["#a78bfa", "#7c3aed"],
  thinking: ["#60a5fa", "#2563eb"],
  communication: ["#34d399", "#059669"],
  independence: ["#f472b6", "#db2777"],
  discipline: ["#fbbf24", "#f97316"],
};

/** Названия навыков — из общего словаря, что и на d16. */
function PROGRESS_SKILL_NAME(d: Dictionary): Record<string, string> {
  const m3 = d.parentApp.more3;
  return {
    knowledge: m3.skillKnowledge,
    thinking: m3.skillThinking,
    communication: m3.skillCommunication,
    independence: m3.skillIndependence,
    discipline: m3.skillDiscipline,
  };
}

/** ФИО учителя → инициалы (2 буквы), как в HomeworkDetailScreen.tsx
 *  realTeacherInitials — тот же паттерн, не изобретаем новый. */
function initialsFromName(name: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "—";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "—";
}

/** Глиф предмета (макет: prog «< >», math «√x», eng «Aa», rus «Aa», robo — SVG). */
const SUBJECT_GLYPH: Record<BaseSubjectKey, string> = {
  prog: "</>",
  robo: "⚙",
  math: "√x",
  eng: "Aa",
  rus: "✏",
};

/** Icon-glyph SVG (звёздочка `#f59e0b` рядом с оценкой, макет строка 306). */
function StarGlyph({ size = 12, color = "#F59E0B" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2z" />
    </Svg>
  );
}

/** Chevron > для sub-tile «Посещаемость». */
function ChevronRight({ size = 9, color = "#FFFFFF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="m9 18 6-6-6-6" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Uppercase caps-лейбл 9/800, letter-spacing .08em, полупрозрачно-белый. */
function AccentCapsLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 9,
        letterSpacing: 9 * 0.08,
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {children}
    </Text>
  );
}

/** SubjectGridTile — плитка предмета в grid 3×2 (макет 306–312). */
function SubjectGridTile({
  stat,
  onPress,
  subjectName,
}: {
  stat: SubjectStatRow;
  subjectName: string;
  onPress?: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexBasis: "31%",
        flexGrow: 1,
        alignItems: "center",
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.glassBorder,
        backgroundColor: "rgba(255,255,255,0.4)",
      }}
    >
      <SubjectTile subjectId={stat.subject_id as SubjectId} size={34} radius={11} glyph={SUBJECT_GLYPH[stat.subject_id]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
          {stat.grade_label}
        </Text>
        <StarGlyph size={11} />
      </View>
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.manrope700, fontSize: 8.5, color: tokens.ink2, textAlign: "center" }}
      >
        {subjectName}
      </Text>
    </Pressable>
  );
}

/** Заход 2, шаг 6 — агрегат «предмет → средний балл» по реальным оценкам
 *  (getStudentGrades, сгруппировано по уже резолвленному subject-ключу).
 *  color — из общего @snr/core getSubjectConfig (10-предметная палитра веба),
 *  НЕ из фикстурного 5-ключевого SubjectId/getSubject() мобилки — реальный
 *  предмет может не входить в узкий фикстурный набор (rus/eng/math/prog/robo). */
type RealSubjectAgg = {
  subject: string;
  label: string;
  color: string;
  avg: number;
  avgLabel: string;
  pct: number;
  count: number;
};

/** RealSubjectGridTile — тот же слот, что SubjectGridTile, но плоский цвет
 *  вместо фикстурного градиента (параллельно RealSubjectTile в
 *  HomeworksScreen.tsx) и без onPress: d11 «Детали предмета» — фикстурный
 *  экран, всегда показывает Математику (SUBJECT_DETAIL_MATH), поэтому для
 *  реального предмета туда вести нельзя — показал бы чужой предмет. */
function RealSubjectGridTile({ stat }: { stat: RealSubjectAgg }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexBasis: "31%",
        flexGrow: 1,
        alignItems: "center",
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.glassBorder,
        backgroundColor: "rgba(255,255,255,0.4)",
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          backgroundColor: stat.color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
          {stat.label.slice(0, 2)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
          {stat.avgLabel}
        </Text>
        <StarGlyph size={11} />
      </View>
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.manrope700, fontSize: 8.5, color: tokens.ink2, textAlign: "center" }}
      >
        {stat.label}
      </Text>
    </View>
  );
}

/** RealSubjectListRow — тот же слот, что строка Progress-list, без onPress
 *  (см. RealSubjectGridTile) и без delta-стрелки (нет данных для тренда —
 *  не выдумываем период сравнения, которого нет в задаче). */
function RealSubjectListRow({ stat }: { stat: RealSubjectAgg }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          backgroundColor: stat.color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: "#FFFFFF" }}>
          {stat.label.slice(0, 2)}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{ width: 96, fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}
      >
        {stat.label}
      </Text>
      <View style={{ flex: 1 }}>
        <ProgressBar pct={stat.pct / 100} height={5.5} fillGradient={[stat.color, stat.color]} />
      </View>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}>
        {stat.avgLabel}
      </Text>
    </View>
  );
}

/** Chip-«pill»: маленький бордерный chip с текстом (сильные / зоны роста). */
function ToneChip({ label, tone }: { label: string; tone: "green" | "red" }) {
  const { tokens } = useTheme();
  const st = tokens.status[tone];
  const chip = tokens.chip(st.rgb);
  return (
    <View
      style={{
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: chip.bg,
        borderWidth: 1,
        borderColor: chip.border,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: st.text }}>{label}</Text>
    </View>
  );
}

export default function ProgressScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const navigation = useNavigation<Nav>();

  const children = getChildren();
  const [childId, setChildId] = useState<string | null>(defaultChildId());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 grades, 1 skills, 2 dyn

  const periods = getGradePeriods();
  const [period, setPeriod] = useState<string>(periods.default_period);
  const [periodOpen, setPeriodOpen] = useState(false);
  // 15.08.2026 (заглушки). Выбор периода менял только подпись на кнопке:
  // оценки под ним не пересчитывались, и родитель мог решить, что видит
  // четверть. Учебных четвертей в базе школы нет — говорим об этом прямо.
  const [periodNote, setPeriodNote] = useState(false);

  // Заход 2, шаг 6: реальный вход — тот же isRealFlow/selectedChildId
  // паттерн, что и на Home/Attendance/Homeworks (ParentDataContext).
  const session = useAuthSession();
  const { data: parentData, selectedChildId, selectChild } = useParentData();
  const isRealFlow = !session.demoParentId && !!parentData && parentData.children.length > 0;
  // Признак ПОКАЗА — ключ аренды демо-места, как у demoOr. Через
  // session.demoParentId это не работает: поле всегда null, и 28.08.2026
  // из-за него демо-гость потерял витрину этой вкладки.
  const { isDemo: showcase } = useDemoSession();
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

  const ctx = getSelectedChildContext(childId ?? undefined);
  const child = realChildRow ?? ctx.child;
  const summary = getGradesSummary();
  const stats = getSubjectStats();
  // Вкладка «Навыки» витрины: плитки, радар и чипы макета. У настоящего
  // родителя вкладка считается из его данных (skillsState ниже), и сюда
  // не заходит.
  const skillsFixture = getSkillsTab(locale);

  // Навыки на вкладке «Навыки» — настоящие, тот же расчёт, что на d16.
  const skillsState = useAsyncData(
    async () => {
      if (!isRealFlow || !selectedChildId) return null;
      const db = getSupabase();
      const [attendance, homework] = await Promise.all([
        getStudentAttendance(db, undefined, selectedChildId),
        getHomeworkWithSubmissions(db, selectedChildId),
      ]);
      return getChildSkills(db, selectedChildId, { attendance, homework });
    },
    [isRealFlow, selectedChildId],
  );

  // Реальные оценки активного ребёнка — throw-on-error (getStudentGrades,
  // Долги-фикс), useAsyncData отдаёт loading/error/data раздельно, ничего не
  // глотаем. Переключение ребёнка (selectedChildId в deps) перезапрашивает.
  const gradesState = useAsyncData(
    () => (isRealFlow && selectedChildId ? getStudentGrades(getSupabase(), selectedChildId) : Promise.resolve(null)),
    [isRealFlow, selectedChildId],
  );
  // Последний текстовый отзыв учителя (lesson_grades.comment, последние 2
  // недели) — уже готовая под это packages/core-функция (используется на
  // web-«Успехах» тем же способом). Второстепенный блок: на её ошибку
  // отдельным error-состоянием не блокируем всю вкладку «Оценки», просто не
  // рендерим карточку (основной error-контракт — у gradesState).
  //
  // 18.08.2026 — БЫЛО sinceDays: 14, и блок писал «отзывов пока нет», хотя на
  // экране отзывов их девятнадцать. Причина: окно считалось от РЕАЛЬНОГО
  // Date.now(), а отзывы демо-школы датированы её собственным замороженным
  // временем — в окно не попадал ни один. Тот же класс ошибки, что уже
  // вылезал в аналитике: реальные часы против школьных.
  //
  // Чинится не подменой часов, а тем, что окна не должно быть вовсе: экран
  // отзывов спрашивает БЕЗ ограничения по дате, и блок на главной обязан
  // спрашивать так же — иначе они снова разойдутся. Осталось limit: 1:
  // «последний отзыв» — это последний, а не последний за две недели.
  const reviewsState = useAsyncData(
    () =>
      isRealFlow && selectedChildId
        ? getChildTeacherReviews(getSupabase(), selectedChildId, { limit: 1 })
        : Promise.resolve(null),
    [isRealFlow, selectedChildId],
  );

  // Средний балл + разбивка по предметам — ТОЛЬКО по оценённым работам
  // (grade5 != null: есть заявки без оценки — напр. этап теста без
  // auto-grade). subject — уже РЕЗОЛВЛЕННЫЙ ключ (getStudentGrades берёт его
  // из homework/lesson.subject_id → subjects.name, НЕ из groups.subject —
  // тот самый веб-баг «всё Программирование»), поэтому здесь просто
  // группируем как есть, без своего резолва.
  const realGradedItems = useMemo(
    () => (gradesState.data ?? []).filter((g): g is StudentGradeItem & { grade5: number } => g.grade5 != null),
    [gradesState.data],
  );
  // 25.08.2026, заход 2 — среднее по общему правилу: оценки за этапы урока
  // в него не входят. Правило одно на весь продукт, utils/gradeAverage.
  const realCountedItems = useMemo(
    () => realGradedItems.filter((g) => countsTowardAverage(g.sourceTable)),
    [realGradedItems],
  );
  const realAverage = useMemo(
    () => averageOf(realCountedItems.map((g) => g.grade5)),
    [realCountedItems],
  );
  const realSubjectStats = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const g of realGradedItems) {
      if (!g.subject) continue;
      const cur = map.get(g.subject) ?? { sum: 0, count: 0 };
      cur.sum += g.grade5;
      cur.count += 1;
      map.set(g.subject, cur);
    }
    return Array.from(map.entries())
      .map(([subject, { sum, count }]) => {
        const cfg = getSubjectConfig(subject);
        const avg = sum / count;
        return {
          subject,
          label: cfg.label,
          color: cfg.color,
          avg,
          avgLabel: avg.toFixed(1),
          pct: Math.round((avg / 5) * 100),
          count,
        };
      })
      .sort((a, b) => b.avg - a.avg);
  }, [realGradedItems]);
  const realStarsFilled = realAverage != null ? Math.max(0, Math.min(5, Math.round(realAverage))) : 0;
  const realAverageChip =
    realAverage == null
      ? ""
      : realAverage >= 4.5
        ? d.parentApp.grades.gradeChipExcellent
        : realAverage >= 3.5
          ? d.parentApp.grades.gradeChipGood
          : d.parentApp.grades.gradeChipNeedsWork;
  const realReview: ChildTeacherReview | null = reviewsState.data?.[0] ?? null;
  // Второстепенный блок — на ошибке карточку просто не показываем (см. ниже),
  // но не молчим совсем: тот же console.error-паттерн, что и у остальных
  // catch-точек packages/core (напр. getGradeSubmissionDetail).
  useEffect(() => {
    if (reviewsState.error) {
      console.error("[ProgressScreen] getChildTeacherReviews failed:", reviewsState.error.message);
    }
  }, [reviewsState.error]);

  // Persistent-хедер (виден на Оценках/Навыках/Динамике): деградация
  // инлайновая — "…" при загрузке, "—" при ошибке (полноценный error-блок
  // с retry — только в контенте вкладки «Оценки» ниже, карточка сама не
  // тапается, вёрстку/интерактив не меняем).
  const realAvgLoading = isRealFlow && gradesState.loading;
  const realAvgError = isRealFlow && !!gradesState.error;
  const averageValueLabel = isRealFlow
    ? realAvgLoading
      ? "…"
      : realAvgError
        ? "—"
        : realAverage != null
          ? realAverage.toFixed(1)
          : "—"
    : summary.average_label;
  const averageMaxLabel = isRealFlow ? "5.0" : summary.average_max_label;

  // ПОСЕЩАЕМОСТЬ НА КАРТОЧКЕ «СРЕДНИЙ БАЛЛ» — НАСТОЯЩАЯ (28.08.2026).
  // Раньше и полоса, и подпись «присутствий 24/25» брались из заготовки, и
  // настоящий родитель читал выдуманные 96 % как посещаемость своего ребёнка.
  // Числа уже загружены этим же экраном: getChildSkills возвращает их в
  // source вместе с навыками — второго запроса не нужно.
  const attSource = skillsState.data?.source ?? null;
  const realAttTotal = attSource?.attendanceTotal ?? 0;
  const realAttPresent = attSource?.attendancePresent ?? 0;
  const realAttPct = realAttTotal > 0 ? Math.round((realAttPresent / realAttTotal) * 100) : null;
  // Отмеченных уроков нет — показывать нечего, вставка не рисуется вовсе.
  const showAttendance = showcase ? true : realAttPct !== null;
  // «Прогресс за неделю» (стрелка, спарклайн, «отличный рост») источника в
  // базе не имеет ни одного: ни колонки, ни расчёта. Настоящему родителю
  // вставка не показывается.
  const showWeekProgress = showcase;
  const attPct = showcase ? summary.attendance_pct : (realAttPct ?? 0);
  const attRatio = showcase
    ? summary.attendance_ratio_label
    : `${realAttPresent}/${realAttTotal}`;
  const averageChipLabel = isRealFlow ? (realAvgLoading || realAvgError ? "" : realAverageChip) : summary.average_chip;
  const averageStars = isRealFlow ? (realAvgLoading || realAvgError ? 0 : realStarsFilled) : summary.stars_filled;
  // Подписи осей радара удалены вместе с самим радаром (14.08.2026):
  // навыков, посчитанных из данных, пять, а у радара шесть осей — шестую
  // («Творчество», «Команда») взять неоткуда.
  const notes = getGradesAssistantNotes();
  const reviews = getTeacherReviews();
  const bellCount = useUnreadNotifications();

  // Sparkline данные для карточки «Средний балл» — точки макета строка 286
  // «2,19 14,16 26,17 38,10 50,12 62,4»: значения = 24 − y (viewBox 64×24),
  // так шаг «выше — больше» сохраняется.
  const weekSparklineValues = useMemo(
    () =>
      summary.sparkline_points.split(" ").map((p) => {
        const y = parseFloat(p.split(",")[1] ?? "0");
        return 24 - y;
      }),
    [summary.sparkline_points],
  );

  // То же для вкладки «Динамика» (строка 362, viewBox 320×90).
  const dynSparklineValues = useMemo(
    () =>
      summary.dynamics_points.split(" ").map((p) => {
        const y = parseFloat(p.split(",")[1] ?? "0");
        return 90 - y;
      }),
    [summary.dynamics_points],
  );

  // Заход 2, шаг 6: реальные дети ЭТОГО родителя при isRealFlow (тот же
  // паттерн, что и на Home/Attendance/Homeworks), не общий фикстурный пул.
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

  // Инициалы в аватаре шапки. Раньше здесь стояло «ДК» — инициалы
  // выдуманного родителя из макета, и НАСТОЯЩИЙ человек видел в своём
  // аватаре чужие буквы. Демо-гостю оставляем как было.
  const parentInitials = isRealFlow ? initialsFromName(parentData!.parentName) : "ДК";
  const parentGradient: [string, string] = ["#8b5cf6", "#22d3ee"];

  // РЕБЁНКА НЕТ. Школа завела родителя, но ученика к нему ещё не привязала —
  // случай настоящий. До 28.08.2026 сюда молча подставлялся выдуманный
  // ребёнок (resolveChild в data/index.ts), и человек читал чужое расписание
  // и чужие оценки как данные своего. Теперь говорим словами.
  //
  // Демо-показа это не касается: там ребёнок есть всегда.
  if (!child) {
    return (
      <AppBackground>
        <View style={{ flex: 1, justifyContent: "center", padding: 18 }}>
          <EmptyBlock
            title={d.parentApp.common.noChildTitle}
            text={d.parentApp.common.noChildText}
          />
        </View>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <RootHeader
        title={d.parentApp.nav.grades}
        titleSize={17}
        showLogo
        bellCount={bellCount}
        onBellPress={() => navigation.navigate("d8")}
        avatar={{ initials: parentInitials, gradient: parentGradient, variant: "ring" }}
        onAvatarPress={() => navigation.navigate("dhub")}
      />
      <TabScreenScroll
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          gap: 12,
        }}
      >
        {/* Compact ChildSwitcherCard (281). */}
        <ChildSwitcherCard
          variant="compact"
          avatar={{
            initials: child.first_name.slice(0, 1),
            gradient: child.avatar_gradient,
            ringColor: child.avatar_ring,
          }}
          name={child.full_name}
          classLabel={`${child.class_name} ${d.parentApp.grades.class}`}
          status={child.status_chip ? { label: child.status_chip, tone: "green" } : undefined}
          switchLabel={`${d.parentApp.prof.switchChild} ›`}
          onPress={() => setSheetOpen(true)}
        />

        {/* AccentCard «Средний балл» (282–289). Заход 2, шаг 6: реальные
            average/stars/chip при isRealFlow (persistent-хедер — виден на
            всех 3 табах, поэтому деградация инлайновая, как у Home-плитки
            «Следующий урок», без блокировки всего экрана). */}
        <AccentCard
          gradient={["#f97316", "#ec4899"]}
          shadowRgb="249,115,22"
          radius={22}
          contentStyle={{ padding: 16, gap: 12 }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: 6 }}>
              <AccentCapsLabel>{d.parentApp.grades.average}</AccentCapsLabel>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                <Text style={{ fontFamily: fonts.unbounded600, fontSize: 34, color: "#FFFFFF" }}>
                  {averageValueLabel}
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.manrope700,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.85)",
                    marginBottom: 6,
                  }}
                >
                  /{averageMaxLabel}
                </Text>
              </View>
              <StarRating count={averageStars} size={14} />
            </View>
            {averageChipLabel ? (
              <View
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.35)",
                  backgroundColor: "rgba(255,255,255,0.2)",
                }}
              >
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: "#FFFFFF" }}>
                  {averageChipLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Ряд из двух вставок. У настоящего родителя левой нет вовсе
              (источника «прогресса за неделю» в базе не существует), а правая
              рисуется только когда есть отмеченные уроки. Если не остаётся ни
              одной — ряда нет: пустая полоса читается как поломка. */}
          {showWeekProgress || showAttendance ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            {showWeekProgress ? (
            <AccentInset radius={14} style={{ flex: 1, padding: 12, gap: 6 }}>
              <AccentCapsLabel>{d.parentApp.progressWeb.weekProgressLabel}</AccentCapsLabel>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                  {summary.week_progress_label}
                </Text>
                <Sparkline
                  values={weekSparklineValues}
                  width={56}
                  height={20}
                  strokeColor="#FFFFFF"
                  strokeWidth={2.2}
                />
              </View>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: "rgba(255,255,255,0.85)" }}>
                {summary.week_progress_note}
              </Text>
            </AccentInset>
            ) : null}
            {showAttendance ? (
            <AccentInset
              radius={14}
              style={{ flex: 1, padding: 12, gap: 6 }}
              onPress={() => navigation.navigate("d14")}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AccentCapsLabel>{d.parentApp.scr.attendance}</AccentCapsLabel>
                <ChevronRight />
              </View>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: "#FFFFFF" }}>
                {attPct}%
              </Text>
              <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.3)" }}>
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    width: `${attPct}%`,
                    backgroundColor: "#FFFFFF",
                  }}
                />
              </View>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: "rgba(255,255,255,0.85)" }}>
                {format(d.parentApp.grades.attendanceRatio, { ratio: attRatio })}
              </Text>
            </AccentInset>
            ) : null}
          </View>
          ) : null}
        </AccentCard>

        {/* Две вкладки: «Оценки» и «Навыки» — обе на настоящих данных.
            Третья, «Динамика», убрана 16.08.2026: её график был нарисован по
            выдуманному ряду, считать тренд пока не из чего. */}
        <SegmentPills
          items={[d.parentApp.grades.tabGrades, d.parentApp.grades.tabSkills]}
          activeIndex={activeTab}
          onChange={setActiveTab}
        />

        {/* Ветка «Оценки». */}
        {activeTab === 0 && (
          <>
            {/* Период + delta (294–304). */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ position: "relative" }}>
                <Pressable
                  onPress={() => setPeriodOpen((v) => !v)}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: tokens.glassBorder,
                    backgroundColor: "rgba(255,255,255,0.6)",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}>
                    {period}
                  </Text>
                  <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="m6 9 6 6 6-6"
                      stroke={tokens.ink1}
                      strokeWidth={2.4}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </Pressable>
                <Popover visible={periodOpen} width={170}>
                  <View style={{ paddingVertical: 4 }}>
                    {periods.periods.map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => {
                          setPeriod(p);
                          setPeriodOpen(false);
                          setPeriodNote(true);
                        }}
                        style={{ paddingVertical: 9, paddingHorizontal: 14 }}
                      >
                        <Text
                          style={{
                            fontFamily: p === period ? fonts.manrope800 : fonts.manrope700,
                            fontSize: 12,
                            color: p === period ? tokens.accent : tokens.ink1,
                          }}
                        >
                          {p}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Popover>
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                {/* «Выше на 0.2, чем в июне ↗» — выдумка: сравнения среднего
                    балла с прошлым месяцем никто не считает, ни в приложении,
                    ни в базе. Настоящему родителю не показываем. */}
                {showcase ? (
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.status.green.text }}>
                    {summary.vs_prev_month_note} ↗
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Объяснение — сразу под выбором периода. */}
            {periodNote ? <SoonNote text={d.parentApp.soon.notes.periodFilter} /> : null}

            {/* Subjects grid (305–312). Заход 2, шаг 6: реальные данные при
                isRealFlow — getStudentGrades сгруппированы по предмету
                (subject уже резолвлен из homework/lesson.subject_id →
                subjects.name, НЕ из groups.subject — тот самый веб-баг «всё
                Программирование»). Демо — фикстура, байт-в-байт как было. */}
            <SectionHeader
              title={d.parentApp.grades.subjects}
              linkLabel={`${d.parentApp.scr.allSubjects} ›`}
              onPress={() => navigation.navigate("dallsubj")}
            />
            {isRealFlow ? (
              gradesState.loading ? (
                <View style={{ paddingVertical: 24, alignItems: "center" }}>
                  <ActivityIndicator color={tokens.accent} />
                </View>
              ) : gradesState.error ? (
                <GlassCard
                  radius={20}
                  contentStyle={{
                    padding: 16,
                    gap: 10,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: `rgba(${tokens.status.red.rgb},0.35)`,
                  }}
                >
                  <Text
                    style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.status.red.text, textAlign: "center" }}
                  >
                    {d.parentApp.grades.loadError}
                  </Text>
                  <Pressable
                    onPress={() => gradesState.refresh()}
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
                      {d.parentApp.common.retry}
                    </Text>
                  </Pressable>
                </GlassCard>
              ) : realSubjectStats.length === 0 ? (
                <GlassCard radius={20} contentStyle={{ padding: 16, alignItems: "center" }}>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 12, color: tokens.ink2, textAlign: "center" }}>
                    {d.parentApp.grades.empty}
                  </Text>
                </GlassCard>
              ) : (
                <>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {realSubjectStats.map((s) => (
                      <RealSubjectGridTile key={s.subject} stat={s} />
                    ))}
                  </View>
                  <GlassCard radius={22} contentStyle={{ padding: 14, gap: 12 }}>
                    {realSubjectStats.map((s) => (
                      <RealSubjectListRow key={s.subject} stat={s} />
                    ))}
                  </GlassCard>
                </>
              )
            ) : (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {stats.map((s) => (
                    <SubjectGridTile
                      key={s.subject_id}
                      stat={s}
                      subjectName={getSubject(s.subject_id).name}
                      onPress={() => navigation.navigate("d11")}
                    />
                  ))}
                </View>

                <GlassCard radius={22} contentStyle={{ padding: 14, gap: 12 }}>
                  {stats.map((s) => {
                    const subject = getSubject(s.subject_id);
                    const isDown = !s.is_up;
                    return (
                      <Pressable
                        key={s.subject_id}
                        onPress={() => navigation.navigate("d11")}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                      >
                        <SubjectTile
                          subjectId={s.subject_id as SubjectId}
                          size={28}
                          radius={9}
                          glyph={SUBJECT_GLYPH[s.subject_id]}
                        />
                        <Text
                          numberOfLines={1}
                          style={{
                            width: 96,
                            fontFamily: fonts.manrope800,
                            fontSize: 11,
                            color: tokens.ink1,
                          }}
                        >
                          {subject.name}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <ProgressBar
                            pct={s.pct / 100}
                            height={5.5}
                            fillGradient={subject.gradient}
                          />
                        </View>
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink1 }}>
                          {s.grade_label}
                        </Text>
                        <Text
                          style={{
                            fontFamily: fonts.manrope800,
                            fontSize: 10,
                            color: isDown ? tokens.status.red.text : tokens.status.green.text,
                            minWidth: 32,
                            textAlign: "right",
                          }}
                        >
                          {s.delta_label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </GlassCard>
              </>
            )}

            {/* «Сильные стороны / Зоны роста».

                28.08.2026: чипы называют конкретные предметы — «Программирование,
                Математика, Логика» против «Английский язык, Говорение,
                Сочинения». Они из заготовки и одинаковы для любого ребёнка, а
                читаются как разбор именно этого. Настоящему родителю блок не
                показываем.

                Посчитать их можно: средние по предметам уже есть на этом
                экране, а правило («выше общего среднего — сильные, ниже —
                зоны роста») уже написано в packages/core, getChildGradesSummary.
                Не делаю здесь: средний балл — отдельная тема, её правила в этом
                заходе не трогаем. */}
            {showcase ? (
            <GlassCard radius={22} contentStyle={{ padding: 14, gap: 10 }}>
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10,
                  letterSpacing: 10 * 0.08,
                  textTransform: "uppercase",
                  color: tokens.status.green.text,
                }}
              >
                {d.parentApp.grades.strengths}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {summary.strengths.map((s) => (
                  <ToneChip key={s} label={s} tone="green" />
                ))}
              </View>
              <View style={{ height: 1, backgroundColor: "rgba(23,18,67,0.08)" }} />
              <Text
                style={{
                  fontFamily: fonts.manrope800,
                  fontSize: 10,
                  letterSpacing: 10 * 0.08,
                  textTransform: "uppercase",
                  color: tokens.status.red.text,
                }}
              >
                {d.parentApp.grades.growthAreas}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {summary.growth_areas.map((s) => (
                  <ToneChip key={s} label={s} tone="red" />
                ))}
              </View>
            </GlassCard>
            ) : null}

            {/* Отзыв учителя (326–331). Заход 2, шаг 6: реальный последний
                отзыв при isRealFlow — getChildTeacherReviews (lesson_grades.
                comment, последние 2 недели), уже готовая под это
                packages/core-функция (та же, что на web-«Успехах», тот же
                резолв предмета через lesson.subject_id, не groups.subject).
                Второстепенный блок: на loading/error карточку просто не
                показываем — основной error-контракт вкладки у gradesState
                выше, не дублируем ещё одним блокирующим состоянием. */}
            <SectionHeader
              title={d.parentApp.grades.lastReviews}
              linkLabel={`${d.parentApp.common.viewAll} ›`}
              onPress={() => navigation.navigate("drev")}
            />
            {isRealFlow ? (
              reviewsState.loading || reviewsState.error ? null : !realReview ? (
                <GlassCard radius={22} contentStyle={{ padding: 16, alignItems: "center" }}>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 12, color: tokens.ink2, textAlign: "center" }}>
                    {d.parentApp.grades.noReviews}
                  </Text>
                </GlassCard>
              ) : (
                <GlassCard radius={22} contentStyle={{ padding: 14, flexDirection: "row", gap: 10 }}>
                  <View style={{ position: "relative", width: 38, height: 38 }}>
                    <LinearGradient
                      colors={["#8b5cf6", "#6366f1"]}
                      {...gradPoints(135)}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                        {initialsFromName(realReview.teacherName)}
                      </Text>
                    </LinearGradient>
                    <View
                      style={{
                        position: "absolute",
                        right: -1,
                        bottom: -1,
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: "#22C55E",
                        borderWidth: 2,
                        borderColor: "#FFFFFF",
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                        {(realReview.teacherName ?? "—") + " · " + (realReview.subjectName ?? d.parentApp.hw.subjectFallback)}
                      </Text>
                      <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink2 }}>
                        {formatDate(realReview.gradedAt, LOCALE_TAG[locale])}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={3}
                      style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 11 * 1.5, color: tokens.ink2 }}
                    >
                      {realReview.comment}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      backgroundColor: `rgba(${tokens.status.green.rgb},0.14)`,
                      borderWidth: 1,
                      borderColor: `rgba(${tokens.status.green.rgb},0.35)`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M7 22V11m0 0h10a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-3l1 4a2 2 0 1 1-4 0v-1H7Z"
                        stroke={tokens.status.green.text}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </View>
                </GlassCard>
              )
            ) : (
              <GlassCard radius={22} contentStyle={{ padding: 14, flexDirection: "row", gap: 10 }}>
                <View style={{ position: "relative", width: 38, height: 38 }}>
                  <LinearGradient
                    colors={["#8b5cf6", "#6366f1"]}
                    {...gradPoints(135)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                      ГЮ
                    </Text>
                  </LinearGradient>
                  <View
                    style={{
                      position: "absolute",
                      right: -1,
                      bottom: -1,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: "#22C55E",
                      borderWidth: 2,
                      borderColor: "#FFFFFF",
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                      {reviews[0].teacher_name} · {getSubject(reviews[0].subject_id).name}
                    </Text>
                    <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink2 }}>
                      {reviews[0].time_label}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={3}
                    style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 11 * 1.5, color: tokens.ink2 }}
                  >
                    {getAssistantTexts(childId ?? undefined).review}
                  </Text>
                </View>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    backgroundColor: `rgba(${tokens.status.green.rgb},0.14)`,
                    borderWidth: 1,
                    borderColor: `rgba(${tokens.status.green.rgb},0.35)`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M7 22V11m0 0h10a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-3l1 4a2 2 0 1 1-4 0v-1H7Z"
                      stroke={tokens.status.green.text}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
              </GlassCard>
            )}

            {/* 16.08.2026. Карточка помощника убрана: её текст был заготовлен
                заранее и к ребёнку отношения не имел. Оценки, предметы и отзыв
                учителя выше — настоящие, из журнала. */}
          </>
        )}

        {/* Ветка «Навыки». */}
        {activeTab === 1 && (
          <>
            <SectionHeader
              title={d.parentApp.skills.progress}
              linkLabel={`${d.parentApp.common.more} ›`}
              onPress={() => navigation.navigate("d16")}
            />
            {/* 14.08.2026: плитки навыков — НАСТОЯЩИЕ (getChildSkills, тот же
                расчёт, что на экране «Навыки и развитие» d16). До этого здесь
                стояли четыре числа из фикстуры — 92/88/85/90, — и они
                расходились бы с настоящими на соседнем экране.

                Радар «Профиль навыков» убран: у него шесть осей, а навыков,
                посчитанных из данных, пять. Шестую («Творчество», «Команда»)
                взять неоткуда — ни одна таблица о ней ничего не знает. */}
            {showcase ? (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {skillsFixture.tiles.map((s) => (
                    <View
                      key={s.name}
                      style={{
                        width: "47%",
                        flexGrow: 1,
                        minWidth: 0,
                        padding: 10,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: tokens.glassBorder,
                        backgroundColor: "rgba(255,255,255,0.4)",
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <LinearGradient
                          colors={[s.gradient[0], s.gradient[1]]}
                          {...gradPoints(135)}
                          style={{ width: 24, height: 24, borderRadius: 8 }}
                        />
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                          {`${s.pct}%`}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink2 }}>
                        {s.name}
                      </Text>
                      <ProgressBar pct={s.pct / 100} height={3.5} fillGradient={[s.gradient[0], s.gradient[1]]} />
                    </View>
                  ))}
                </View>

                {/* «Профиль навыков» — шестиугольник макета (строка 351).
                    Три полигона: рамка, внутренняя сетка и сам профиль;
                    подписей осей в макете нет, и мы их не досочиняем. */}
                <SectionHeader title={d.parentApp.skills.profile} />
                <GlassCard radius={22} contentStyle={{ padding: 14, gap: 12 }}>
                  <View style={{ alignItems: "center" }}>
                    <Svg width={150} height={135} viewBox="0 0 120 108">
                      <Polygon
                        points={skillsFixture.radar.frame}
                        fill="none"
                        stroke={tokens.glassBorder}
                        strokeWidth={1.2}
                      />
                      <Polygon
                        points={skillsFixture.radar.grid}
                        fill="none"
                        stroke={tokens.glassBorder}
                        strokeWidth={1}
                      />
                      <Polygon
                        points={skillsFixture.radar.values}
                        fill="rgba(124,58,237,0.22)"
                        stroke="#7c3aed"
                        strokeWidth={1.6}
                      />
                    </Svg>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {skillsFixture.chips.map((c) => {
                      const st = tokens.status[c.tone];
                      return (
                        <View
                          key={c.name}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 5,
                            paddingVertical: 5,
                            paddingHorizontal: 9,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: `rgba(${st.rgb},0.32)`,
                            backgroundColor: `rgba(${st.rgb},0.13)`,
                          }}
                        >
                          <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                            {c.name}
                          </Text>
                          <Text style={{ fontFamily: fonts.manrope800, fontSize: 10.5, color: st.text }}>
                            {c.value_label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </GlassCard>

                {/* Заметка помощника по вкладке — из заготовки макета. */}
                <GlassCard radius={20} contentStyle={{ padding: 13 }}>
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 16, color: tokens.ink2 }}>
                    {getGradesAssistantNotes().skills}
                  </Text>
                </GlassCard>
              </>
            ) : skillsState.loading ? (
              <LoadingBlock paddingVertical={28} />
            ) : skillsState.error ? (
              <ErrorBlock
                title={d.parentApp.more4.loadFailed}
                message={skillsState.error.message}
                retryLabel={d.common.retry}
                onRetry={() => skillsState.refresh()}
              />
            ) : (skillsState.data?.source.gradeCount ?? 0) === 0 ? (
              <EmptyBlock title={d.parentApp.more3.skillEmptyTitle} />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {skillsState.data!.skills.map((s) => {
                  const g = PROGRESS_SKILL_GRADIENT[s.key];
                  return (
                    <View
                      key={s.key}
                      style={{
                        width: "31.8%",
                        flexGrow: 1,
                        minWidth: 0,
                        padding: 10,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: tokens.glassBorder,
                        backgroundColor: "rgba(255,255,255,0.4)",
                        gap: 6,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <LinearGradient colors={g} {...gradPoints(135)} style={{ width: 24, height: 24, borderRadius: 8 }} />
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                          {`${s.pct}%`}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink2 }}>
                        {PROGRESS_SKILL_NAME(d)[s.key]}
                      </Text>
                      <ProgressBar pct={s.pct / 100} height={3.5} fillGradient={g} />
                    </View>
                  );
                })}
              </View>
            )}

            {/* Карточка с «рекомендацией помощника» убрана 14.08.2026: это был
                готовый текст в файле («Сильные стороны — логика и математика…»),
                а не разбор чего-либо, и он расходился с настоящими числами
                выше. Вместо неё — та же подпись, что на экране «Навыки»:
                из чего посчитаны проценты. */}
            {!showcase && skillsState.data && skillsState.data.source.gradeCount > 0 ? (
              <Text
                style={{
                  fontFamily: fonts.manrope600,
                  fontSize: 9,
                  lineHeight: 14,
                  color: tokens.ink3,
                  paddingHorizontal: 2,
                }}
              >
                {format(d.parentApp.more3.skillNote, {
                  grades: String(skillsState.data.source.gradeCount),
                  present: String(skillsState.data.source.attendancePresent),
                  total: String(skillsState.data.source.attendanceTotal),
                  done: String(skillsState.data.source.homeworkSubmitted),
                  hw: String(skillsState.data.source.homeworkTotal),
                })}
              </Text>
            ) : null}
          </>
        )}

      </TabScreenScroll>

      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={d.parentApp.auth.chooseChild}
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

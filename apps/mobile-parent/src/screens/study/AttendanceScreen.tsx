/**
 * Экран #14 «Посещаемость» — REBUILD (Заход 5, block-by-block из макета).
 *
 * Композиция 1:1 из «SNR EduOS v2 Light.dc.html», строки 584–622:
 *  585–589  InnerHeader с info-иконкой (без функции) в правом слоте.
 *  591      ChildSwitcherCard compact — триггер шторки выбора ребёнка.
 *  592–596  StatsRow: три плитки (зелёная 96%, оранжевая 2, красная 1).
 *           ВНИМАНИЕ: НЕТ плитки «Опоздания» — правило заказчика соблюдено.
 *  597–613  MonthCalendarCard: prev/next + сетка 7×N (N — динамическое число
 *           недель месяца, см. calendarRows ниже; стили ST по коду из макета
 *           3807–3817) + легенда из 4 маркеров.
 *  614      SectionLabel uppercase «Последние дни».
 *  615–620  LastDaysList: 4 записи в одной glass-карточке с border-top-
 *           разделителями. Иконки-бэйджи справа: галочка / крестик / документ.
 *
 * Данные — через аксессоры src/data. Тексты — через useAppLocale().
 * Обе темы через useTheme(); iOS safe-area — из InnerHeader; скролл имеет
 * paddingBottom 118 под FloatingTabBar.
 *
 * Экран без FAB и без CTA-кнопок: интерактив — только ChildSwitcherCard
 * (openSheet) и стрелки календаря (prev/next меняют месяц в локальном state).
 *
 * Заход 2, шаг 3: для реального входа (isRealFlow) все 3 блока данных
 * (StatsRow/MonthCalendarCard/LastDaysList) — из public.attendance активного
 * ребёнка (packages/core getStudentAttendance, throw-on-error, ОДИН запрос,
 * без month-фильтра — марки уже отсортированы marked_at desc), а не из
 * data/fixtures/attendance.ts. Идентичность (ChildSwitcherCard) и переклю-
 * чатель — тот же общий свитчер, что и в Шагах 1–2 (ParentDataContext).
 * Заход 2 витрины (29.08.2026): ветка заготовки ВЕРНУЛАСЬ. Она была
 * удалена 14.08 вместе с демо-входом как недостижимая; показ снова идёт
 * без базы — и снова нужен свой календарь. Настоящий поток не тронут:
 * запрос, разбор записей и построение месяца на лету остались как были,
 * ветка показа стоит рядом и включается только по признаку показа.
 * Календарь строится на лету по видимому {year,month} (не фиксированный
 * 2-месячный фикстурный массив) — см. buildRealMonthCells ниже; вперёд
 * дальше текущего (ташкентского) месяца не листаем.
 *
 * Долги, проход 2: число рядов сетки — динамическое (calendarRows), не
 * жёсткие 5×7=35 — иначе месяц с 6-м рядом (напр. 31 день, начинающийся в
 * воскресенье) терял последние дни. todayKey — через useTashkentToday()
 * (hooks/), пересчитывается на возврат приложения на передний план, а не
 * только при монтировании — иначе «сегодня» в календаре/статистике
 * застывало на вчера, если приложение висело открытым через полночь.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  format,
  getStudentAttendance,
  formatDate,
  formatTime,
  APP_TIME_ZONE,
  LOCALE_TAG,
  type AttendanceStatus,
} from "@snr/core";
import { AppBackground, fonts, gradPoints, shadowStyle, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  InnerHeader,
  LoadingBlock,
  type ChildPickerItem,
} from "../../ui";
import {
  defaultChildId,
  getAttendanceLastDays,
  getAttendanceMonths,
  getAttendanceStats,
  getChildren,
} from "../../data";
import type { AttendanceCellCode, AttendanceDayRow, AttendanceStats } from "../../data";
import { useDemoSession } from "../../context/DemoSessionContext";
import { useChildQuery, useChildScope } from "../../hooks/useChildScope";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { addDays } from "../../lib/tashkent";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

// ─── Заход 2, шаг 3: Ташкент-корректная работа с датами ───────────────────
// НЕ toISOString().slice(0,10) — та берёт UTC-дату, что даёт неверный день
// рядом с полуночью по Ташкенту (UTC+5). См. предупреждение задания про
// баг UTC→Ташкент, уже словленный в вебе. Intl/timeZone — тот же механизм,
// что уже использует packages/core/src/utils/date.ts (formatDate/formatTime).
function tashkentDateKey(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

/** Реальный статус БД → существующая категория UI (календарь/стат/бэйдж) —
 *  новых категорий не вводим, только маппим на уже нарисованные p/u/n. */
function statusToCellCode(status: AttendanceStatus): "p" | "u" | "n" {
  if (status === "present") return "p";
  if (status === "absent_excused") return "u";
  return "n";
}
type StatusMeta = { tone: "green" | "orange" | "red"; badge: "check" | "doc" | "x"; label: string };
/** Долги, проход 1: лейблы — из словаря (t.attend.day*), не хардкод. */
function buildStatusMeta(attend: { dayPresent: string; dayExcused: string; dayUnexcused: string }): Record<AttendanceStatus, StatusMeta> {
  return {
    present: { tone: "green", badge: "check", label: attend.dayPresent },
    absent_excused: { tone: "orange", badge: "doc", label: attend.dayExcused },
    absent_unexcused: { tone: "red", badge: "x", label: attend.dayUnexcused },
  };
}
// При нескольких уроках/записях за один ташкентский день на ячейку календаря
// побеждает "худший" статус (пропуск без причины важнее уважительного важнее
// присутствия) — иначе порядок записей в массиве произвольно решал бы, какой
// статус увидит родитель.
const STATUS_PRIORITY: Record<AttendanceStatus, number> = {
  present: 0,
  absent_excused: 1,
  absent_unexcused: 2,
};

/** Сетка 5×7 для видимого {year, month} (1-12) по реальным записям
 *  (dateKey → status). Дни без записи: будущее → 'f', прошлое/сегодня без
 *  урока → 'w' (без данных расписания не отличить "выходной" от "урок был,
 *  не размечен" — это сознательное упрощение, расписание в этом шаге не
 *  подключаем). Год/месяц — чистая календарная арифметика на Y-M-D, TZ тут
 *  не участвует (не момент времени, а уже вычисленные целые). */
function buildRealMonthCells(
  year: number,
  month: number,
  recordsByDate: Map<string, AttendanceStatus>,
  todayKey: string,
): { code: AttendanceCellCode; dayNumber: number | null }[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=Вс..6=Сб
  const leadingPad = (firstWeekday + 6) % 7; // Пн=0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: { code: AttendanceCellCode; dayNumber: number | null }[] = [];
  for (let i = 0; i < leadingPad; i += 1) cells.push({ code: "e", dayNumber: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const status = recordsByDate.get(key);
    let code: AttendanceCellCode;
    if (key === todayKey) code = "t";
    else if (status) code = statusToCellCode(status);
    else if (key > todayKey) code = "f";
    else code = "w";
    cells.push({ code, dayNumber: day });
  }
  return cells;
}

/** Иконка «info» правого слота шапки (макет 588, 17×17 stroke 1.9). */
function InfoIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 16v-4" />
      <Path d="M12 8h.01" />
    </Svg>
  );
}

/** Круглая кнопка prev/next заголовка календаря (макет 599/601, 28×28). */
function CalNavButton({ dir, onPress }: { dir: "prev" | "next"; onPress?: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.55)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.8)",
      }}
    >
      <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <Path d={dir === "prev" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
      </Svg>
    </Pressable>
  );
}

/** Плитка статистики (одна из трёх, макет 593/594/595). */
function StatTile({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "green" | "orange" | "red";
}) {
  const { tokens } = useTheme();
  const st = tokens.status[tone];
  return (
    <View
      style={[
        {
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: 8,
          borderRadius: 16,
          alignItems: "center",
          gap: 2,
          backgroundColor: `rgba(${st.rgb},0.13)`,
          borderWidth: 1,
          borderColor: `rgba(${st.rgb},0.32)`,
        },
        shadowStyle({ x: 0, y: 10, blur: 22, color: `rgba(${st.rgb},0.14)` }),
      ]}
    >
      <Text style={{ fontFamily: fonts.unbounded600, fontSize: 19, color: st.text }}>{value}</Text>
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.manrope800, fontSize: 8.5, color: tokens.ink2, textAlign: "center" }}
      >
        {label}
      </Text>
    </View>
  );
}

/** Ячейка календаря (макет 605): стиль зависит от кода AttendanceCellCode. */
function CalendarCell({ code, dayNumber }: { code: AttendanceCellCode; dayNumber: number | null }) {
  const { tokens } = useTheme();

  // Общий каркас 26×flex1, radius 8 (макет 3808 base).
  const base = {
    flex: 1,
    height: 26,
    borderRadius: 8,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  // Пустая ячейка — прозрачно (макет 3810 e).
  if (code === "e") {
    return (
      <View style={base}>
        <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: "transparent" }}>·</Text>
      </View>
    );
  }

  // «Сегодня» — акцентный градиент 135° + двойное кольцо (макет 3816 t).
  // Кольцо box-shadow (0 0 0 2px #fff, 0 0 0 3.5px #7c3aed) — приближаем
  // borderWidth 2 + внешним тонким outline через shadowStyle.
  if (code === "t") {
    const g = gradPoints(135);
    return (
      <View
        style={[
          {
            flex: 1,
            height: 26,
            borderRadius: 8,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "#FFFFFF",
          },
          shadowStyle({ x: 0, y: 0, blur: 6, color: "rgba(124,58,237,0.9)" }),
        ]}
      >
        <LinearGradient
          colors={["#7C3AED", "#4F6DF5"]}
          start={g.start}
          end={g.end}
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
        >
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: "#FFFFFF" }}>
            {dayNumber ?? ""}
          </Text>
        </LinearGradient>
      </View>
    );
  }

  // Остальные коды: плоская заливка + белый / приглушённый текст.
  const styleByCode: Record<
    Exclude<AttendanceCellCode, "e" | "t">,
    { bg: string; color: string }
  > = {
    p: { bg: "rgba(16,185,129,0.72)", color: "#FFFFFF" },
    u: { bg: "rgba(249,115,22,0.78)", color: "#FFFFFF" },
    n: { bg: "rgba(239,68,68,0.78)", color: "#FFFFFF" },
    w: { bg: "rgba(23,18,67,0.05)", color: tokens.ink3 },
    f: { bg: "rgba(23,18,67,0.08)", color: tokens.ink3 },
  };
  const s = styleByCode[code];

  return (
    <View style={[base, { backgroundColor: s.bg }]}>
      <Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: s.color }}>
        {dayNumber ?? ""}
      </Text>
    </View>
  );
}

/** Легенда календаря (макет 607–611). */
function LegendMarker({ color, label }: { color: string; label: string }) {
  const { tokens } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink2 }}>{label}</Text>
    </View>
  );
}

/** Круглый 24×24 бэйдж-иконка справа в строке «Последних дней». Вид берётся
 *  из StatusMeta.badge, то есть из НАСТОЯЩЕГО статуса записи. */
function LastDayBadge({ kind }: { kind: StatusMeta["badge"] }) {
  const bg =
    kind === "check"
      ? "rgba(16,185,129,0.16)"
      : kind === "x"
        ? "rgba(239,68,68,0.13)"
        : "rgba(249,115,22,0.14)";
  const stroke = kind === "check" ? "#047857" : kind === "x" ? "#B91C1C" : "#C2410C";

  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      {kind === "check" ? (
        <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 6 9 17l-5-5" />
        </Svg>
      ) : kind === "x" ? (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2.8} strokeLinecap="round">
          <Path d="M18 6 6 18" />
          <Path d="m6 6 12 12" />
        </Svg>
      ) : (
        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
          <Path d="M14 3v5h5" />
        </Svg>
      )}
    </View>
  );
}

export default function AttendanceScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const STATUS_META = useMemo(() => buildStatusMeta(t.attend), [t.attend]);
  const navigation = useNavigation<Nav>();

  const [sheetOpen, setSheetOpen] = useState(false);

  // Признак показа — тот же, которым пользуется demoOr.
  const { isDemo: showcase } = useDemoSession();

  // Идентичность и переключатель — из общего useChildScope, того же, что у
  // остальных экранов на настоящих данных. В показе родителя в слое данных
  // нет вовсе (см. ParentDataContext), поэтому семья берётся из заготовок,
  // а выбранный ребёнок живёт в локальном состоянии — ровно как на главной
  // и в расписании.
  const { childId: realChildId, child: realIdentityChild, pickerItems: realPickerItems, selectChild } = useChildScope();
  const [fixtureChildId, setFixtureChildId] = useState<string | null>(defaultChildId());
  const fixtureChildren = getChildren();
  const selectedChildId = showcase ? fixtureChildId : realChildId;
  const identityChild = showcase
    ? (fixtureChildren.find((c) => c.id === fixtureChildId) ?? null)
    : realIdentityChild;
  const pickerItems: ChildPickerItem[] = showcase
    ? fixtureChildren.map((k) => ({
        id: k.id,
        initials: k.first_name.slice(0, 1),
        gradient: k.avatar_gradient,
        ringColor: k.avatar_ring,
        name: k.full_name,
        classLabel: `${k.class_name} ${d.parentApp.grades.class}`,
        // Чип статуса — с подписью, но без тона, как у настоящих детей в
        // useChildScope. Выводить тон сравнением статуса с русской строкой
        // («В школе» → зелёный, иначе серый) — тот же класс ошибки, что уже
        // ловили на статусах уроков; заводить его заново в новом коде не
        // станем. В макете на этом экране чипа у карточки нет вовсе.
        statusLabel: k.status_chip,
        statusTone: "gray" as const,
      }))
    : realPickerItems;

  // ── Посещаемость активного ребёнка: ОДИН запрос без month-фильтра
  // (throw-on-error getStudentAttendance, НЕ .catch(()=>[])).
  // Перезапрашивается при смене ребёнка. ──────────────────────────────────
  // В показе запрос не уходит вовсе: realChildId там null, и useChildQuery
  // по null не стреляет. Передаём именно его, а не selectedChildId —
  // иначе идентификатор выдуманного ребёнка ушёл бы в базу.
  const attendanceState = useChildQuery(realChildId, (db, id) =>
    getStudentAttendance(db, undefined, id),
  );

  // Долги, проход 2: не useMemo(() => tashkentToday(), []) — та не
  // пересчитывается, если приложение висит открытым через полночь;
  // useTashkentToday реагирует на возврат на передний план (AppState).
  // yesterdayKey теперь производная ОТ todayKey (addDays(todayKey, -1)),
  // а не "24 часа назад от момента маунта" — иначе после полуночного
  // обновления todayKey «вчера» указывало бы на позавчера.
  const todayKey = useTashkentToday();
  const yesterdayKey = useMemo(() => addDays(todayKey, -1), [todayKey]);

  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    attendanceState.data?.records.forEach((r) => {
      const key = tashkentDateKey(r.lesson_date);
      const existing = map.get(key);
      if (!existing || STATUS_PRIORITY[r.status] > STATUS_PRIORITY[existing]) {
        map.set(key, r.status);
      }
    });
    return map;
  }, [attendanceState.data]);

  // Видимый месяц реального календаря — по умолчанию текущий (ташкентский);
  // вперёд дальше него не листаем (макет тоже не даёт уйти за границу).
  const [todayYear, todayMonthNum] = todayKey.split("-").map(Number);
  const [realVisibleMonth, setRealVisibleMonth] = useState<{ year: number; month: number }>(
    () => ({ year: todayYear, month: todayMonthNum }),
  );
  // Долги, проход 2: если приложение висит открытым через границу месяца
  // (напр. 31-е поздно вечером → 1-е), todayKey (useTashkentToday) сам
  // обновится, но realVisibleMonth — обычный useState, сам за ним не
  // следует. Без этого эффекта пользователь, смотревший "текущий" месяц,
  // после полуночи видел бы уже вчерашний месяц без подсветки "сегодня" —
  // пришлось бы вручную листать вперёд. Подтягиваем месяц ТОЛЬКО если
  // видимый месяц и был тем самым "текущим" (ref хранит todayYear/Month с
  // прошлого рендера) — если пользователь сам пролистал в прошлое, его
  // выбор не трогаем.
  const prevTodayMonthRef = useRef({ year: todayYear, month: todayMonthNum });
  useEffect(() => {
    const prevToday = prevTodayMonthRef.current;
    setRealVisibleMonth((prev) =>
      prev.year === prevToday.year && prev.month === prevToday.month
        ? { year: todayYear, month: todayMonthNum }
        : prev,
    );
    prevTodayMonthRef.current = { year: todayYear, month: todayMonthNum };
  }, [todayYear, todayMonthNum]);
  const realMonthLabel = useMemo(() => {
    const dt = new Date(Date.UTC(realVisibleMonth.year, realVisibleMonth.month - 1, 1));
    const label = dt.toLocaleDateString(LOCALE_TAG[locale], { month: "long", year: "numeric", timeZone: APP_TIME_ZONE });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [realVisibleMonth, locale]);
  const realCells = useMemo(
    () => buildRealMonthCells(realVisibleMonth.year, realVisibleMonth.month, recordsByDate, todayKey),
    [realVisibleMonth, recordsByDate, todayKey],
  );
  const goPrevMonthReal = () =>
    setRealVisibleMonth(({ year, month }) =>
      month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
    );
  const goNextMonthReal = () =>
    setRealVisibleMonth(({ year, month }) => {
      if (year === todayYear && month === todayMonthNum) return { year, month };
      return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
    });

  // ── Календарь показа: два готовых месяца макета, июль открыт первым.
  // Листается между ними и не дальше — в макете месяцев ровно два, и
  // придумывать третий было бы добавлением того, чего в макете нет.
  // useMemo обязателен: аксессор пересобирает массив месяцев на каждый
  // вызов, и без него новая ссылка приходила бы каждый кадр — а от неё
  // зависят и fixtureCells, и calendarRows ниже. Пересчёт тридцати пяти
  // ячеек на пустом месте.
  const fixtureCalendar = useMemo(() => getAttendanceMonths(locale), [locale]);
  const [fixtureMonth, setFixtureMonth] = useState(fixtureCalendar.default_month_index);
  const fixtureMonthRow =
    fixtureCalendar.months.find((m) => m.month_index === fixtureMonth) ?? fixtureCalendar.months[0];
  // Формат ячейки — тот же, что у настоящего календаря: код + номер дня.
  // Код 'e' — пустая клетка (отступ до 1-го числа и хвост месяца), номера
  // у неё нет; остальные нумеруются подряд, как в attCells макета.
  const fixtureCells = useMemo(() => {
    let day = 0;
    return fixtureMonthRow.cells.map((code) => {
      if (code === "e") return { code, dayNumber: null };
      day += 1;
      return { code, dayNumber: day };
    });
  }, [fixtureMonthRow]);
  const fixtureMonthIndexes = fixtureCalendar.months.map((m) => m.month_index);
  const goPrevMonthFixture = () =>
    setFixtureMonth((m) => (fixtureMonthIndexes.includes(m - 1) ? m - 1 : m));
  const goNextMonthFixture = () =>
    setFixtureMonth((m) => (fixtureMonthIndexes.includes(m + 1) ? m + 1 : m));

  const monthLabel = showcase ? fixtureMonthRow.label : realMonthLabel;
  const calendarDaysFinal = showcase ? fixtureCells : realCells;
  const goPrevMonth = showcase ? goPrevMonthFixture : goPrevMonthReal;
  const goNextMonth = showcase ? goNextMonthFixture : goNextMonthReal;

  // Долги, проход 2: число рядов — динамическое, не жёсткие 5. Демо-фикстура
  // (cells()) всегда даёт ровно 35 ячеек (5×7) — Math.ceil(35/7)=5, поведение
  // не меняется. Реальный месяц (leadingPad + daysInMonth) может занимать 4–6
  // рядов (напр. месяц из 31 дня, начинающийся в воскресенье, — leadingPad=6,
  // итого 37 ячеек, при жёстких 5×7=35 последние 2 дня месяца пропадали).
  // Хвостовые пустые ячейки последнего ряда — тем же кодом "e", что и
  // leadingPad в начале (CalendarCell рендерит "e" прозрачно).
  const calendarRows = useMemo(() => {
    const weekCount = Math.ceil(calendarDaysFinal.length / 7);
    const rows: (typeof calendarDaysFinal)[] = [];
    for (let r = 0; r < weekCount; r += 1) {
      const row = calendarDaysFinal.slice(r * 7, r * 7 + 7);
      while (row.length < 7) row.push({ code: "e", dayNumber: null });
      rows.push(row);
    }
    return rows;
  }, [calendarDaysFinal]);

  const weekdayLabels = [t.date.mon, t.date.tue, t.date.wed, t.date.thu, t.date.fri, t.date.sat, t.date.sun];

  // Реальные «последние дни» — из тех же records (уже marked_at desc из
  // getStudentAttendance без фильтров), первые 4. tone/badge — по РЕАЛЬНОМУ
  // статусу записи (STATUS_META), не по позиции в массиве, как было у
  // фикстуры (LAST_DAYS_META[i]) — позиционный маппинг не годится для
  // реальных данных переменной длины/порядка.
  const realLastDays: AttendanceDayRow[] = useMemo(() => {
    if (!attendanceState.data) return [];
    return attendanceState.data.records.slice(0, 4).map((r) => {
      const dateKey = tashkentDateKey(r.lesson_date);
      const plain = formatDate(r.lesson_date, LOCALE_TAG[locale]);
      const dateLabel =
        dateKey === todayKey ? `${t.date.today}, ${plain}` : dateKey === yesterdayKey ? `${t.date.yesterday}, ${plain}` : plain;
      return {
        date_label: dateLabel,
        status_label: STATUS_META[r.status].label,
        arrived_label: r.status === "present" && r.marked_at ? formatTime(r.marked_at, LOCALE_TAG[locale]) : null,
        left_label: null,
      };
    });
  }, [attendanceState.data, todayKey, yesterdayKey, locale, t.date.today, t.date.yesterday, STATUS_META]);
  // «Последние дни» показа — четыре записи макета, с подставленным
  // гендерным суффиксом выбранного ребёнка.
  const fixtureLastDays = useMemo(
    () => getAttendanceLastDays(fixtureChildId ?? undefined, locale),
    [fixtureChildId, locale],
  );
  const lastDaysFinal = showcase ? fixtureLastDays : realLastDays;
  // Тот же срез records, параллельно realLastDays — tone/badge по РЕАЛЬНОМУ
  // статусу записи, а не по её позиции в списке.
  const realLastDaysMeta = useMemo(
    () => attendanceState.data?.records.slice(0, 4).map((r) => STATUS_META[r.status]) ?? [],
    [attendanceState.data],
  );
  // У витрины статуса-перечисления нет — есть готовая строка. Значок
  // подбирается по порядку записей макета: присутствует, присутствовал,
  // без уважительной, уважительная. Позиционно это верно ровно потому,
  // что список фиксированный и лежит рядом; для настоящих данных так
  // делать нельзя, и там значок берётся по статусу записи.
  const fixtureLastDaysMeta = useMemo(
    () => [
      STATUS_META.present,
      STATUS_META.present,
      STATUS_META.absent_unexcused,
      STATUS_META.absent_excused,
    ],
    [STATUS_META],
  );
  const lastDaysMetaFinal = showcase ? fixtureLastDaysMeta : realLastDaysMeta;

  // Реальная сводка — за ВСЮ историю (не только видимый месяц календаря),
  // из того же ответа getStudentAttendance.stats. Сводка показа — три
  // числа макета, пересчитывающие его же июльский календарь.
  const statsFinal: AttendanceStats | null = showcase
    ? getAttendanceStats()
    : attendanceState.data
      ? {
          attendance_pct: attendanceState.data.stats.percentage,
          excused_count: attendanceState.data.stats.excused,
          unexcused_count: attendanceState.data.stats.unexcused,
        }
      : null;

  // Гейты загрузки/ошибки/пустоты — только для настоящего входа. В показе
  // запроса не было, и все три состояния к нему не относятся: без этого
  // «нет записей» закрывало бы витрину целиком.
  const gateLoading = !showcase && attendanceState.loading;
  const gateError = showcase ? null : attendanceState.error;
  const gateEmpty = !showcase && (attendanceState.data?.records.length ?? 0) === 0;

  return (
    <AppBackground>
      {/* Блок 1: TopBar — InnerHeader + info-иконка в правом слоте. */}
      <InnerHeader
        title={t.scr.attendance}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={<InfoIcon color={tokens.ink3} />}
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
        {/* Блок 2: ChildSelectorCard (открывает шторку выбора ребёнка). */}
        {identityChild ? (
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
        ) : null}

        {/* Заход 2, шаг 3: loading/error — ТОЛЬКО для реального входа (демо
            резолвится мгновенно в data:null и никогда не попадает сюда).
            «Нет записей» (см. Блок 6 ниже) и «ошибка» — визуально разные
            состояния, не заминаем сбой запроса пустым списком (история
            тихих RLS-пустот 75/76/77/82/126 — родитель получал 0 строк без
            ошибки). */}
        {gateLoading ? (
          <LoadingBlock />
        ) : gateError ? (
          <ErrorBlock
            title={t.attend.loadError}
            message={gateError.message}
            retryLabel={d.common.retry}
            onRetry={() => attendanceState.refresh()}
          />
        ) : gateEmpty ? (
          <EmptyBlock title={t.attend.empty} text={t.more4.attendanceNoRecords} />
        ) : (
          <>
            {/* Блок 3: StatsRow — 3 плитки (Посещаемость / Уважительные / Неуважительные). */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <StatTile value={`${statsFinal?.attendance_pct ?? 0}%`} label={t.attend.present} tone="green" />
              <StatTile value={String(statsFinal?.excused_count ?? 0)} label={t.attend.excused} tone="orange" />
              <StatTile value={String(statsFinal?.unexcused_count ?? 0)} label={t.attend.unexcused} tone="red" />
            </View>

            {/* Блок 4: MonthCalendarCard. */}
            <GlassCard radius={20} contentStyle={{ padding: 13, gap: 10 }}>
              {/* Заголовок с стрелками. */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <CalNavButton dir="prev" onPress={goPrevMonth} />
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.ink1 }}>
                  {monthLabel}
                </Text>
                <CalNavButton dir="next" onPress={goNextMonth} />
              </View>

              {/* Шапка дней недели + N рядов по 7 ячеек (N — calendarRows.length). */}
              <View style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {weekdayLabels.map((w) => (
                    <Text
                      key={w}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        fontFamily: fonts.manrope800,
                        fontSize: 8.5,
                        color: tokens.ink3,
                      }}
                    >
                      {w}
                    </Text>
                  ))}
                </View>
                {calendarRows.map((row, rowIdx) => (
                  <View key={rowIdx} style={{ flexDirection: "row", gap: 4 }}>
                    {row.map((cell, colIdx) => (
                      <CalendarCell key={`${rowIdx}-${colIdx}`} code={cell.code} dayNumber={cell.dayNumber} />
                    ))}
                  </View>
                ))}
              </View>

              {/* Легенда: 4 маркера (без «опоздания»). */}
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 9,
                  paddingTop: 8,
                  borderTopWidth: 1,
                  borderTopColor: "rgba(23,18,67,0.07)",
                }}
              >
                <LegendMarker color="rgba(16,185,129,0.75)" label={t.attend.legendPresent} />
                <LegendMarker color="rgba(249,115,22,0.8)" label={t.attend.legendExcused} />
                <LegendMarker color="rgba(239,68,68,0.8)" label={t.attend.legendUnexcused} />
                <LegendMarker color="rgba(23,18,67,0.08)" label={t.attend.legendWeekend} />
              </View>
            </GlassCard>

            {/* Блок 5: SectionLabel «Последние дни». */}
            <Text
              style={{
                fontFamily: fonts.manrope800,
                fontSize: 10.5,
                letterSpacing: 10.5 * 0.08,
                textTransform: "uppercase",
                color: tokens.ink3,
              }}
            >
              {t.attend.lastDays}
            </Text>

            {/* Блок 6: LastDaysList — одна GlassCard, разделители border-top.
                Реальный вход с пустой историей (0 записей) — отдельная
                нейтральная надпись, а не пустая GlassCard (которая выглядела
                бы неотличимо от сбоя — уже отфильтрован веткой error выше). */}
            {lastDaysFinal.length === 0 ? (
              <GlassCard radius={20} contentStyle={{ padding: 16, alignItems: "center" }}>
                <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink3, textAlign: "center" }}>
                  {t.attend.empty}
                </Text>
              </GlassCard>
            ) : (
              <GlassCard radius={20} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
                {lastDaysFinal.map((row, i) => {
                  const meta = lastDaysMetaFinal[i] ?? STATUS_META.absent_unexcused;
                  const st = tokens.status[meta.tone];
                  const bothNull = row.arrived_label === null && row.left_label === null;

                  return (
                    <View
                      key={`${row.date_label}-${i}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 11,
                        paddingVertical: 10,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: "rgba(23,18,67,0.07)",
                      }}
                    >
                      <View style={{ flex: 1, flexDirection: "column" }}>
                        <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                          {row.date_label}
                        </Text>
                        <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: st.text }}>
                          {row.status_label}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        {bothNull ? (
                          <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink3 }}>
                            — · —
                          </Text>
                        ) : (
                          <>
                            <Text
                              style={{
                                fontFamily: fonts.manrope700,
                                fontSize: 10,
                                color: row.arrived_label ? tokens.ink2 : tokens.ink3,
                              }}
                            >
                              {t.attend.arrivedPrefix} {row.arrived_label ?? "—"}
                            </Text>
                            <Text
                              style={{
                                fontFamily: fonts.manrope700,
                                fontSize: 10,
                                color: row.left_label ? tokens.ink2 : tokens.ink3,
                              }}
                            >
                              {t.attend.leftPrefix} {row.left_label ?? "—"}
                            </Text>
                          </>
                        )}
                      </View>
                      <LastDayBadge kind={meta.badge} />
                    </View>
                  );
                })}
              </GlassCard>
            )}

            {/* Из чего сложились три плитки сверху — как на вебе: экран
                показывает выведенные проценты, и родитель должен видеть, на
                каких отметках они посчитаны.

                В показе подписи нет: считать не из чего, и она вывела бы
                четыре нуля под живыми числами витрины. В макете её тоже
                нет — она появилась вместе с настоящим расчётом. */}
            {showcase ? null : (
            <Text
              style={{
                fontFamily: fonts.manrope600,
                fontSize: 9,
                lineHeight: 14,
                color: tokens.ink3,
                textAlign: "center",
                paddingHorizontal: 6,
              }}
            >
              {format(t.more4.attendanceNote, {
                total: String(attendanceState.data?.stats.total ?? 0),
                present: String(attendanceState.data?.stats.present ?? 0),
                excused: String(attendanceState.data?.stats.excused ?? 0),
                unexcused: String(attendanceState.data?.stats.unexcused ?? 0),
              })}
            </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Шторка выбора ребёнка — общий свитчер семьи. */}
      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={t.auth.chooseChild}
          items={pickerItems}
          selectedId={selectedChildId ?? undefined}
          onSelect={(id) => {
            if (showcase) setFixtureChildId(id);
            else selectChild(id);
            setSheetOpen(false);
          }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}

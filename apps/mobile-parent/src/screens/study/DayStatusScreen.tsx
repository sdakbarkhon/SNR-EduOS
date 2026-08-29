/**
 * d6 «Статус дня» — НАСТОЯЩИЕ ДАННЫЕ.
 *
 * БЫЛО: экран-заглушка «Скоро» с оговоркой «приходов и уходов школа не
 * отмечает». Оговорка верна — турникетов и отметок «пришёл/ушёл» в базе нет, —
 * но всё остальное про день у школы записано: уроки, посещаемость по каждому,
 * оценки за день и заданные домашние задания.
 *
 * СТАЛО: `getChildDailyStatus` из @snr/core — тот же запрос, что питает статус
 * дня у веб-родителя. Второй копии не заводим.
 *
 * ПРО «СЕГОДНЯ». Дата берётся через `useTashkentToday()` — уже готовый хук
 * приложения: он знает про заморозку времени школы (getAppNowMs +
 * subscribeSchoolTime) и сам пересчитывается, когда дата заморозки приезжает
 * из базы или наступает полночь. Ни источник заморозки, ни её правило здесь не
 * трогаются — экран только СПРАШИВАЕТ школьное «сегодня».
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Приходов и уходов, питания, автобуса — под это в базе нет ни
 * таблицы. Пустой день честно говорит «уроков нет», а не выдумывает распорядок.
 */
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { format, formatTime, getChildDailyStatus, type ChildDailyStatus } from "@snr/core";
import { AppBackground, fonts, useTheme } from "../../theme";
import {
  BottomSheetFrame,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  InnerHeader,
  LoadingBlock,
  SectionHeader,
  StatusChip,
} from "../../ui";
import { getDayStatus, getSubject } from "../../data";
import { formatMoney } from "../../lib/format";
import { useChildQuery } from "../../hooks/useChildScope";
import { useShowcaseChild } from "../../hooks/useShowcaseChild";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { MainStackParamList } from "../../navigation/routes";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { useAppLocale } from "../../i18n";

export function DayStatusScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp.dayStatusScreen;
  const pa = d.parentApp;
  const sc = d.parentApp.showcase;
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const todayKey = useTashkentToday();
  const { showcase, childId, realChildId, child, pickerItems, selectChild, loading: childLoading } =
    useShowcaseChild();
  const [sheetOpen, setSheetOpen] = useState(false);

  const state = useChildQuery<ChildDailyStatus>(
    realChildId,
    (db, id) => getChildDailyStatus(db, id, todayKey),
    [todayKey],
  );

  // Витрина. Числа не записаны подписью: уроки дня берутся у расписания, а
  // «сколько прошло», «какой идёт» и «сколько впереди» выводятся из самого
  // списка — см. getDayStatus.
  const витрина = getDayStatus(childId ?? undefined, locale);
  const day = state.data;

  const attendanceLabel = (s: string | null): string => {
    if (s === "present") return t.attPresent;
    if (s === "absent_excused") return t.attExcused;
    if (s === "absent_unexcused") return t.attUnexcused;
    return t.attNotMarked;
  };
  const attendanceTone = (s: string | null): string => {
    if (s === "present") return tokens.status.green.text;
    if (s === "absent_excused") return tokens.status.orange.text;
    if (s === "absent_unexcused") return tokens.status.red.text;
    return tokens.ink3;
  };

  return (
    <AppBackground>
      <InnerHeader title={t.title} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {child ? (
          <ChildSwitcherCard
            variant="compact"
            avatar={{ initials: child.first_name.slice(0, 1), gradient: child.avatar_gradient, ringColor: child.avatar_ring }}
            name={child.full_name}
            classLabel={`${child.class_name} ${pa.grades.class}`}
            onPress={() => setSheetOpen(true)}
          />
        ) : null}

        {showcase ? (
          <>
            {/* Строка присутствия (разметка 424). */}
            <GlassCard radius={18} contentStyle={{ padding: 14, gap: 4 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.status.green.text }}>
                {format(sc.atSchoolNow, { name: child?.first_name ?? "" })}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }}>
                {format(sc.arrivedAt, {
                  suf: child?.is_female ? "а" : "",
                  time: витрина.arrived_label,
                  entry: sc.mainEntrance,
                })}
              </Text>
            </GlassCard>

            {/* Посещаемость за день (427–434). Ссылка ведёт на свой экран. */}
            <SectionHeader
              title={d.parentApp.scr.attendance}
              linkLabel={`${d.parentApp.common.viewAll} ›`}
              onPress={() => navigation.navigate("d14")}
            />
            <GlassCard radius={18} contentStyle={{ padding: 14, gap: 10 }}>
              <Text style={{ fontFamily: fonts.unbounded600, fontSize: 17, color: tokens.ink1 }}>
                {format(sc.lessonsOf, { done: String(витрина.done), total: String(витрина.total) })}
              </Text>
              {[
                { label: sc.presentCap, n: витрина.done, tone: tokens.status.green.text },
                { label: sc.excusedCap, n: витрина.excused, tone: tokens.status.orange.text },
                { label: sc.unexcusedCap, n: витрина.unexcused, tone: tokens.status.red.text },
              ].map((r) => (
                <View key={r.label} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }}>
                    {r.label}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: r.tone }}>{r.n}</Text>
                </View>
              ))}
              {витрина.live_number ? (
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
                  {format(sc.lessonRunning, {
                    n: String(витрина.live_number),
                    ahead: String(витрина.ahead),
                  })}
                </Text>
              ) : null}
            </GlassCard>

            {/* Уроки дня (437–444) — те же строки, что в расписании. */}
            <SectionHeader title={d.parentApp.sched.today} />
            <GlassCard radius={18} contentStyle={{ paddingVertical: 5, paddingHorizontal: 14 }}>
              {витрина.lessons.map((l, i) => {
                const sb = getSubject(l.subject_id);
                return (
                  <View
                    key={`${l.slot_index}-${l.subject_id}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingVertical: 10,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: "rgba(23,18,67,0.07)",
                    }}
                  >
                    <Text style={{ width: 42, fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink2 }}>
                      {l.starts_at}
                    </Text>
                    <View style={{ width: 4, height: 22, borderRadius: 2, backgroundColor: sb.color }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                        {sb.name}
                      </Text>
                      <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                        {l.room_label}
                      </Text>
                    </View>
                    {l.status === "live" ? <StatusChip label={sc.nowRunning} family="violet" /> : null}
                  </View>
                );
              })}
            </GlassCard>

            {/* Питание (446–449). */}
            <SectionHeader title={d.parentApp.svc.meals} />
            <GlassCard radius={18} contentStyle={{ padding: 14, gap: 5 }}>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink1 }}>
                {format(sc.mealsMenu, { menu: витрина.meals.menu_label })}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }}>
                {витрина.meals.lunch_label}
              </Text>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.status.green.text }}>
                {format(sc.mealsBalance, {
                  sum: `${formatMoney(витрина.meals.balance)} ${d.parentApp.pay.sum}`,
                })}
              </Text>
            </GlassCard>
          </>
        ) : childLoading || state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={pa.more4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : !day || day.isDayOff || day.totalLessons === 0 ? (
          <EmptyBlock title={t.dayOffTitle} text={t.dayOffText} />
        ) : (
          <>
            {/* Сводка дня: три числа, все из журнала. */}
            <GlassCard radius={18} contentStyle={{ padding: 14, flexDirection: "row", gap: 10 }}>
              {[
                { n: day.totalLessons, label: t.statLessons, tone: tokens.ink1 },
                { n: day.attendedCount, label: t.statAttended, tone: tokens.status.green.text },
                { n: day.missedCount, label: t.statMissed, tone: tokens.status.red.text },
              ].map((c) => (
                <View key={c.label} style={{ flex: 1, alignItems: "center", gap: 2 }}>
                  <Text style={{ fontFamily: fonts.unbounded600, fontSize: 19, color: c.tone }}>{c.n}</Text>
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3, textAlign: "center" }}>
                    {c.label}
                  </Text>
                </View>
              ))}
            </GlassCard>

            {/* Уроки дня с отметкой посещаемости по каждому. */}
            {day.lessons.map((l) => (
              <GlassCard key={l.id} radius={18} contentStyle={{ padding: 13, gap: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontFamily: fonts.unbounded600, fontSize: 11.5, color: tokens.ink2 }}>
                    {formatTime(l.startsAt, locale)}
                  </Text>
                  <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }} numberOfLines={1}>
                    {l.subjectName ?? l.title}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 10, color: attendanceTone(l.attendanceStatus) }}>
                    {attendanceLabel(l.attendanceStatus)}
                  </Text>
                </View>
                {l.teacherName || l.room ? (
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3 }} numberOfLines={1}>
                    {[l.teacherName, l.room].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </GlassCard>
            ))}

            {/* Оценки за день — только если есть. */}
            {day.gradesToday.length > 0 ? (
              <GlassCard radius={18} contentStyle={{ padding: 14, gap: 8 }}>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>{t.gradesToday}</Text>
                {day.gradesToday.map((g, i) => (
                  <View key={`${g.subjectName}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ flex: 1, fontFamily: fonts.manrope600, fontSize: 11.5, color: tokens.ink2 }} numberOfLines={1}>
                      {g.subjectName}
                    </Text>
                    <Text style={{ fontFamily: fonts.unbounded600, fontSize: 13, color: tokens.accent }}>{g.grade}</Text>
                  </View>
                ))}
              </GlassCard>
            ) : null}

            {day.homeworkAssignedToday > 0 ? (
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink3, paddingHorizontal: 2 }}>
                {t.homeworkAssigned.replace("{n}", String(day.homeworkAssignedToday))}
              </Text>
            ) : null}

            <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 15, color: tokens.ink3, paddingHorizontal: 2 }}>
              {t.footnote}
            </Text>
          </>
        )}
      </ScrollView>

      <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ChildPickerSheetContent
          title={pa.auth.chooseChild}
          items={pickerItems}
          selectedId={childId ?? undefined}
          onSelect={(id: string) => { selectChild(id); setSheetOpen(false); }}
        />
      </BottomSheetFrame>
    </AppBackground>
  );
}

export default DayStatusScreen;

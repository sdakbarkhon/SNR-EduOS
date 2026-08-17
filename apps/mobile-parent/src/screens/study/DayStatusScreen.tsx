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
import { formatTime, getChildDailyStatus, type ChildDailyStatus } from "@snr/core";
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
} from "../../ui";
import { useChildQuery, useChildScope } from "../../hooks/useChildScope";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { useAppLocale } from "../../i18n";

export function DayStatusScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp.dayStatusScreen;
  const pa = d.parentApp;
  const todayKey = useTashkentToday();
  const { childId, child, pickerItems, selectChild, loading: childLoading } = useChildScope();
  const [sheetOpen, setSheetOpen] = useState(false);

  const state = useChildQuery<ChildDailyStatus>(
    childId,
    (db, id) => getChildDailyStatus(db, id, todayKey),
    [todayKey],
  );
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

        {childLoading || state.loading ? (
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

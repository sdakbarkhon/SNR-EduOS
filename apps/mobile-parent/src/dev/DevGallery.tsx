/**
 * ВРЕМЕННАЯ DEV-ГАЛЕРЕЯ UI-КИТА — снести в Заходе 8 вместе с DevPanel.
 *
 * Полноэкранный скролл-каталог всех компонентов библиотеки v2 с примерами,
 * по секциям: Поверхности (группа A) / Контролы (B) / Строки (C) / Хром
 * (таб-бар и шапки). Открывается кнопкой «Галерея UI» из DevPanel.
 * Демо-данные — краткие инлайн-строки в духе фикстур (Малика Каримова,
 * 7-А класс и т.п.); это dev-инструмент, правило «данные только через props
 * экранов» на него не распространяется.
 */
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  CalendarDays,
  CreditCard,
  Home,
  MessageCircle,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBackground, useTheme, fonts } from "../theme";
import {
  AccentCard,
  AccentInset,
  AttendanceHeatmap,
  AttendanceHeatmapLegend,
  Avatar,
  BottomSheetFrame,
  CenterModalFrame,
  ChatBubble,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  CountBadge,
  DemoBannerGlass,
  FloatingTabBar,
  Gauge,
  GlassCard,
  InnerHeader,
  LessonRow,
  ListRow,
  MetricsSplitRow,
  MiniRing,
  Popover,
  PrimaryButton,
  ProgressBar,
  QuickActionTile,
  QuickActionsGrid,
  Radar,
  Ring,
  RingSegmented,
  RootHeader,
  SectionHeader,
  SegmentPills,
  Sparkline,
  StarRating,
  StatusChip,
  SubjectTile,
  TimelineHorizontal,
  TimelineVertical,
  Toggle,
} from "../ui";
import { getAttendanceMonths, getTransportRoute } from "../data";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: tokens.ink1 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Caption({ text }: { text: string }) {
  const { tokens } = useTheme();
  return (
    <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: tokens.ink3 }}>
      {text}
    </Text>
  );
}

export interface DevGalleryProps {
  visible: boolean;
  onClose: () => void;
}

export function DevGallery({ visible, onClose }: DevGalleryProps) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState(0);
  const [filter, setFilter] = useState(0);
  const [toggleOn, setToggleOn] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickedChild, setPickedChild] = useState("malika");
  const [tab, setTab] = useState("p5");

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <AppBackground>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: Math.max(insets.top, 46),
            paddingHorizontal: 18,
            paddingBottom: 8,
          }}
        >
          <Text style={{ fontFamily: fonts.unbounded600, fontSize: 16, color: tokens.ink1 }}>
            Галерея UI (временная)
          </Text>
          <Pressable onPress={onClose} style={{ padding: 8 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 13, color: tokens.accent }}>
              Закрыть
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingBottom: insets.bottom + 40,
            gap: 24,
          }}
        >
          {/* ═══ ПОВЕРХНОСТИ (группа A) ═══ */}
          <Section title="Поверхности">
            <Caption text="GlassCard · glass1 / glass2" />
            <GlassCard contentStyle={{ padding: 14 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                Стеклянная карточка glass-1
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink2 }}>
                160° W72→W46 · blur 22 · r24
              </Text>
            </GlassCard>
            <GlassCard variant="glass2" radius={18} contentStyle={{ padding: 12 }}>
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink2 }}>
                glass-2, r18 — второстепенная
              </Text>
            </GlassCard>

            <Caption text="AccentCard + AccentInset" />
            <AccentCard
              gradient={["#6366F1", "#38BDF8"]}
              shadowRgb="99,102,241"
              radius={20}
              contentStyle={{ padding: 13, gap: 8 }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 15.5, color: "#fff" }}>
                Математика
              </Text>
              <AccentInset radius={12} style={{ alignSelf: "flex-start" }}>
                <Text
                  style={{
                    fontFamily: fonts.manrope800,
                    fontSize: 11.5,
                    color: "#fff",
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                  }}
                >
                  10:20–11:05 · Каб. 204
                </Text>
              </AccentInset>
            </AccentCard>

            <Caption text="DemoBannerGlass" />
            <DemoBannerGlass message="Демо-режим: данные не сохраняются" onClose={() => {}} />

            <Caption text="Popover (статично)" />
            <View style={{ height: 120 }}>
              <Popover top={0}>
                {["Четверть 1", "Четверть 2", "Учебный год"].map((p, i) => (
                  <Text
                    key={p}
                    style={{
                      fontFamily: fonts.manrope700,
                      fontSize: 11.5,
                      color: tokens.ink1,
                      paddingVertical: 10,
                      paddingHorizontal: 13,
                      borderTopWidth: i ? 1 : 0,
                      borderTopColor: "rgba(127,127,127,0.15)",
                    }}
                  >
                    {p}
                  </Text>
                ))}
              </Popover>
            </View>

            <Caption text="BottomSheetFrame / CenterModalFrame" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PrimaryButton label="Открыть шторку" onPress={() => setSheetOpen(true)} style={{ flex: 1 }} />
              <PrimaryButton label="Открыть confirm" onPress={() => setConfirmOpen(true)} style={{ flex: 1 }} />
            </View>
          </Section>

          {/* ═══ КОНТРОЛЫ (группа B) ═══ */}
          <Section title="Контролы">
            <Caption text="StatusChip" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <StatusChip label="В школе" family="green" variant="live" />
              <StatusChip label="Срок завтра" family="orange" />
              <StatusChip label="Просрочено" family="red" />
              <StatusChip label="NEW" variant="new" />
            </View>

            <Caption text="PrimaryButton" />
            <PrimaryButton label="Оплатить всё · 4 950 000 сум" onPress={() => {}} />
            <PrimaryButton label="Недоступно" disabled />

            <Caption text="SegmentPills (табы / скролл-фильтры)" />
            <SegmentPills
              items={["Оценки", "Навыки", "Динамика"]}
              activeIndex={segment}
              onChange={setSegment}
            />
            <SegmentPills
              items={["Все", "Сегодня", "На завтра", "Просрочено", "Сдано"]}
              activeIndex={filter}
              onChange={setFilter}
              scrollable
            />

            <Caption text="Toggle / CountBadge" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Toggle value={toggleOn} onValueChange={setToggleOn} />
              <CountBadge value={3} preset="alert" />
              <CountBadge value={2} preset="accent" />
              <CountBadge value={1} preset="alert" size={15} />
            </View>

            <Caption text="SectionHeader" />
            <SectionHeader title="К ОПЛАТЕ СЕЙЧАС" linkLabel="Смотреть все ›" onPress={() => {}} />

            <Caption text="QuickActionsGrid (3 колонки, md)" />
            <QuickActionsGrid columns={3}>
              <QuickActionTile
                label="Оплатить"
                gradient={["#FB923C", "#EF4444"]}
                shadowRgb="239,68,68"
                icon={<CreditCard size={17} color="#fff" strokeWidth={1.8} />}
              />
              <QuickActionTile
                label="Расписание"
                gradient={["#22D3EE", "#0891B2"]}
                shadowRgb="8,145,178"
                icon={<CalendarDays size={17} color="#fff" strokeWidth={1.8} />}
              />
              <QuickActionTile
                label="Питание"
                gradient={["#F472B6", "#DB2777"]}
                shadowRgb="219,39,119"
                icon={<UtensilsCrossed size={17} color="#fff" strokeWidth={1.8} />}
              />
            </QuickActionsGrid>

            <Caption text="SubjectTile (5 предметов)" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <SubjectTile subjectId="math" glyph="√x" />
              <SubjectTile subjectId="prog" glyph="{ }" />
              <SubjectTile subjectId="robo" glyph="🤖" />
              <SubjectTile subjectId="eng" glyph="Aa" />
              <SubjectTile subjectId="rus" glyph="Ру" />
            </View>
          </Section>

          {/* ═══ СТРОКИ (группа C) ═══ */}
          <Section title="Строки">
            <Caption text="Avatar (plain / ring / story / online)" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Avatar initials="МК" gradient={["#F472B6", "#DB2777"]} variant="plain" size={40} />
              <Avatar
                initials="МК"
                gradient={["#F472B6", "#DB2777"]}
                variant="ring"
                ringColor="#F472B6"
                size={44}
              />
              <Avatar initials="ГЮ" gradient={["#8B5CF6", "#6366F1"]} variant="story" size={54} />
              <Avatar initials="СУ" gradient={["#34D399", "#059669"]} size={44} online />
            </View>

            <Caption text="ChildSwitcherCard · large (с метриками)" />
            <ChildSwitcherCard
              variant="large"
              avatar={{ initials: "М", gradient: ["#F472B6", "#DB2777"], ringColor: "#F472B6" }}
              name="Малика Каримова"
              classLabel="7-А класс"
              status={{ label: "В школе", tone: "green", withChevron: true }}
              chevron
              onPress={() => {}}
              footer={
                <MetricsSplitRow
                  topDivider
                  cells={[
                    { label: "В школе с", value: "08:12" },
                    { label: "Уроков", value: "6" },
                    { label: "Была на", value: "2/6", valueColor: tokens.status.green.text },
                    { label: "ДЗ", value: "2", valueColor: tokens.status.orange.text },
                    { label: "Кошелёк", value: "185 000", flex: 1.4 },
                  ]}
                />
              }
            />

            <Caption text="ChildSwitcherCard · compact" />
            <ChildSwitcherCard
              variant="compact"
              avatar={{ initials: "М", gradient: ["#F472B6", "#DB2777"], ringColor: "#F472B6" }}
              name="Малика Каримова"
              classLabel="7-А класс"
              status={{ label: "В школе", tone: "green" }}
              switchLabel="Сменить ребёнка ›"
              onPress={() => {}}
            />

            <Caption text="ChildPickerSheetContent (статично)" />
            <GlassCard contentStyle={{ paddingVertical: 6 }}>
              <ChildPickerSheetContent
                title="Выберите ребёнка"
                items={[
                  {
                    id: "malika",
                    initials: "М",
                    gradient: ["#F472B6", "#DB2777"],
                    ringColor: "#F472B6",
                    name: "Малика Каримова",
                    classLabel: "7-А класс",
                    statusLabel: "В школе",
                    statusTone: "green",
                  },
                  {
                    id: "timur",
                    initials: "Т",
                    gradient: ["#38BDF8", "#0284C7"],
                    ringColor: "#38BDF8",
                    name: "Тимур Каримов",
                    classLabel: "3-Б класс",
                    statusLabel: "Дома",
                    statusTone: "gray",
                  },
                ]}
                selectedId={pickedChild}
                onSelect={setPickedChild}
              />
            </GlassCard>

            <Caption text="ListRow" />
            <GlassCard radius={20} contentStyle={{ paddingHorizontal: 14 }}>
              <ListRow
                left={<SubjectTile subjectId="math" size={36} radius={12} glyph="√x" />}
                title="Математика — оценка за контрольную"
                subtitle="Дроби и проценты · 10:42"
                right={<StatusChip label="5" family="green" />}
              />
              <ListRow
                divider
                left={<SubjectTile subjectId="eng" size={36} radius={12} glyph="Aa" />}
                title="Английский язык — эссе «My Summer»"
                subtitle="Домашнее задание"
                right={<StatusChip label="Срок завтра" family="orange" />}
                chevron
                onPress={() => {}}
              />
            </GlassCard>

            <Caption text="LessonRow" />
            <LessonRow
              timeStart="10:20"
              timeEnd="11:05"
              active
              dotColor={tokens.subjects.math.base}
              dotHalo={tokens.chip(tokens.status.orange.rgb).bg}
              barGradient={tokens.subjects.math.grad}
              title="Математика"
              subtitle="10:20 – 11:05 · Каб. 204 · Гульнора Юсупова"
              themeLine="Тема: Дроби и проценты"
              nowLabel="Идёт сейчас"
            />
            <LessonRow
              timeStart="08:30"
              timeEnd="09:15"
              dotColor={tokens.subjects.eng.base}
              barGradient={tokens.subjects.eng.grad}
              title="Английский язык"
              subtitle="08:30 – 09:15 · Каб. 105"
              grade={{ value: "5", text: tokens.status.green.text, rgb: tokens.status.green.rgb }}
              dimmed
            />

            <Caption text="ChatBubble" />
            <View style={{ gap: 8 }}>
              <ChatBubble
                direction="in"
                text="Добрый день! Напоминаю: завтра сдаём № 140–148."
                time="08:45"
              />
              <ChatBubble
                direction="out"
                text="Спасибо за напоминание. Малика уже почти закончила"
                time="08:46"
                ticks
              />
            </View>

            <Caption text="StarRating" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StarRating count={4} color={tokens.accent} mutedColor={tokens.ink3} />
            </View>
          </Section>

          {/* ═══ ГРАФИКИ (Заход 3) ═══ */}
          <Section title="Графики">
            <Caption text="Gauge · 110×70 (96%) / 62×38 мини (68%) / 4.7 на градиенте" />
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 14 }}>
              <Gauge value={96} centerLabel="96%" size={110} />
              <Gauge
                value={68}
                size={62}
                thickness={12}
                centerLabel="68%"
                centerLabelSize={20}
                centerLabelY={56}
              />
            </View>
            <AccentCard
              gradient={tokens.subjects.math.grad}
              shadowRgb="202,138,4"
              radius={20}
              contentStyle={{ padding: 14, alignItems: "center", gap: 4 }}
            >
              <Gauge
                value={4.7}
                max={5}
                size={128}
                centerLabel="4.7"
                centerLabelColor="#FFFFFF"
                fillColor="#FFFFFF"
                trackColor="rgba(255,255,255,0.28)"
              />
              <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, color: "#FFFFFF" }}>
                Средний балл (макс. 5.0)
              </Text>
            </AccentCard>

            <Caption text="Radar 200×172 фиолетовый (6 осей, 6 подписей)" />
            <GlassCard contentStyle={{ padding: 14, alignItems: "center" }}>
              <Radar
                values={[4.8, 3.8, 4.7, 4.2, 4.5, 4.3]}
                labels={["Логика", "Комм.", "Дисциплина", "Креатив", "Самост.", "Команда"]}
                max={5}
                size={220}
              />
            </GlassCard>

            <Caption text="Ring · 86×86 (2/6 уроков) / 72×72 (70%) / RingSegmented 62×62 (94%) — с r/viewBoxSize по макету" />
            <GlassCard contentStyle={{ padding: 14, flexDirection: "row", gap: 18, alignItems: "center" }}>
              {/* #6 «Статус дня»: рендер 86, viewBox 88, r 32, w 10 — 1:1 с макетом. */}
              <Ring
                value={2}
                max={6}
                size={86}
                viewBoxSize={88}
                r={32}
                thickness={10}
                color={tokens.accent}
                centerContent={
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontFamily: fonts.manrope800, fontSize: 16, color: tokens.ink1 }}>
                      2/6
                    </Text>
                    <Text style={{ fontFamily: fonts.manrope700, fontSize: 9, color: tokens.ink3 }}>
                      уроков
                    </Text>
                  </View>
                }
              />
              {/* «Освоение тем»: рендер 72, viewBox = size, r 32, w 9 — как в макете строка 1421. */}
              <Ring
                value={70}
                size={72}
                r={32}
                thickness={9}
                color={tokens.subjects.math.base}
                centerContent={
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 15, color: tokens.ink1 }}>
                    70%
                  </Text>
                }
              />
              {/* Библиотека §s5: рендер 62, viewBox 88, r 30, w 11 — 3 сегмента 24/2/1. */}
              <RingSegmented
                size={62}
                viewBoxSize={88}
                r={30}
                thickness={11}
                segments={[
                  { color: `rgb(${tokens.status.green.rgb})`, value: 24 },
                  { color: `rgb(${tokens.status.orange.rgb})`, value: 2 },
                  { color: `rgb(${tokens.status.red.rgb})`, value: 1 },
                ]}
                max={27}
                centerContent={
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                    94%
                  </Text>
                }
              />
            </GlassCard>

            <Caption text="MiniRing · 42×42 (100% green) / 42×42 (60% orange)" />
            <View style={{ flexDirection: "row", gap: 14 }}>
              <MiniRing pct={100} size={42} thickness={4.5} color={`rgb(${tokens.status.green.rgb})`} />
              <MiniRing
                pct={60}
                size={42}
                thickness={4.5}
                color={`rgb(${tokens.status.orange.rgb})`}
                labelColor={tokens.status.orange.text}
              />
            </View>

            <Caption text="Sparkline · 320×90 фиолетовый (endDot) / 56×20 белый на градиенте" />
            <GlassCard contentStyle={{ padding: 12 }}>
              <Sparkline
                values={[4.3, 4.4, 4.6, 4.5, 4.6, 4.7]}
                width={320}
                height={90}
                strokeWidth={3}
                endDot
              />
            </GlassCard>
            <AccentCard
              gradient={tokens.subjects.prog.grad}
              shadowRgb="2,132,199"
              radius={16}
              contentStyle={{
                padding: 12,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                  Средний балл
                </Text>
                <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: "rgba(255,255,255,0.75)" }}>
                  Динамика недели
                </Text>
              </View>
              <Sparkline
                values={[4.2, 4.3, 4.4, 4.5, 4.6, 4.7]}
                width={56}
                height={20}
                strokeColor="#FFFFFF"
                strokeWidth={2.2}
              />
            </AccentCard>

            <Caption text="ProgressBar · 5.5px «Программирование» 90% (subject-градиент, right-label)" />
            <ProgressBar
              pct={0.9}
              height={5.5}
              fillGradient={tokens.subjects.prog.grad}
              showValueLabel="right"
              valueLabelText="90%"
            />
            <Caption text="ProgressBar · 4px «96%» белая на градиентной плитке (inline-label)" />
            <AccentCard
              gradient={tokens.accentGrad.colors as [string, string]}
              shadowRgb="124,58,237"
              radius={16}
              contentStyle={{ padding: 14, gap: 8 }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: "#FFFFFF" }}>
                Посещаемость · 96%
              </Text>
              <ProgressBar
                pct={0.96}
                height={4}
                fillColor="#FFFFFF"
                trackColor="rgba(255,255,255,0.3)"
                showValueLabel="none"
              />
            </AccentCard>

            <Caption text="AttendanceHeatmap · Июль 2026 (реальный fixture) + легенда" />
            <GlassCard contentStyle={{ padding: 12, gap: 10 }}>
              <AttendanceHeatmap cells={getAttendanceMonths()[1]!.cells} />
              <AttendanceHeatmapLegend />
            </GlassCard>

            <Caption text="TimelineHorizontal · 4 узла (done → done → done → current)" />
            <GlassCard contentStyle={{ padding: 14 }}>
              <TimelineHorizontal
                steps={[
                  { label: "Выдано", date: "22 июля", state: "done" },
                  { label: "В работе", date: "22 июля", state: "done" },
                  { label: "Сдано", date: "23 июля", state: "done" },
                  { label: "Проверка", date: "до 24 июля", state: "current" },
                ]}
              />
            </GlassCard>

            <Caption text="TimelineVertical · TRANSPORT_STOPS (past · now · next)" />
            <GlassCard contentStyle={{ padding: 14 }}>
              <TimelineVertical
                stops={getTransportRoute().stops.map((s) => ({
                  label: s.name,
                  time: s.time_label,
                  state: s.status,
                  chipLabel: s.is_my_stop ? "Ваша остановка" : undefined,
                }))}
              />
            </GlassCard>
          </Section>

          {/* ═══ ГРАФИКИ · КРАЙНИЕ ЗНАЧЕНИЯ ═══ */}
          <Section title="Графики · крайние значения">
            <Caption text="Gauge · 0% / 100% / max / >max (клампится к 100%)" />
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
              <Gauge value={0} centerLabel="0%" size={92} />
              <Gauge value={100} centerLabel="100%" size={92} />
              <Gauge value={5} max={5} centerLabel="5/5" size={92} />
              <Gauge value={150} centerLabel=">max" size={92} />
            </View>

            <Caption text="Sparkline · пустой массив / одно значение / плоская линия (min=max) / отрицательная дельта" />
            <GlassCard contentStyle={{ padding: 12, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Text style={{ width: 96, fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                  values=[]
                </Text>
                <Sparkline values={[]} width={200} height={36} />
              </View>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Text style={{ width: 96, fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                  values=[4.5]
                </Text>
                <Sparkline values={[4.5]} width={200} height={36} />
              </View>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Text style={{ width: 96, fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                  плоская линия
                </Text>
                <Sparkline values={[3, 3, 3, 3, 3, 3]} width={200} height={36} endDot />
              </View>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Text style={{ width: 96, fontFamily: fonts.manrope700, fontSize: 10, color: tokens.ink2 }}>
                  дельта −0.5
                </Text>
                <Sparkline
                  values={[4.6, 4.5, 4.3, 4.2, 4.15, 4.1]}
                  width={200}
                  height={36}
                  endDot
                  strokeColor={`rgb(${tokens.status.red.rgb})`}
                />
              </View>
            </GlassCard>

            <Caption text="Ring · 0% / 100% / value=max / value>max (клампится) / max=0 (защита от /0)" />
            <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
              <Ring value={0} size={70} thickness={8} color={tokens.accent}
                centerContent={<Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>0%</Text>} />
              <Ring value={100} size={70} thickness={8} color={tokens.accent}
                centerContent={<Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>100%</Text>} />
              <Ring value={5} max={5} size={70} thickness={8} color={tokens.accent}
                centerContent={<Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>5/5</Text>} />
              <Ring value={17} max={10} size={70} thickness={8} color={tokens.accent}
                centerContent={<Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>&gt;max</Text>} />
              <Ring value={5} max={0} size={70} thickness={8} color={tokens.accent}
                centerContent={<Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: tokens.ink3 }}>max=0</Text>} />
            </View>

            <Caption text="RingSegmented · один сегмент = 0 / все сегменты равны / всё в одном сегменте" />
            <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
              <RingSegmented
                size={70} thickness={10}
                segments={[
                  { color: `rgb(${tokens.status.green.rgb})`, value: 8 },
                  { color: `rgb(${tokens.status.orange.rgb})`, value: 0 },
                  { color: `rgb(${tokens.status.red.rgb})`, value: 2 },
                ]}
                max={10}
                centerContent={<Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: tokens.ink1 }}>0-сегмент</Text>}
              />
              <RingSegmented
                size={70} thickness={10}
                segments={[
                  { color: `rgb(${tokens.status.green.rgb})`, value: 1 },
                  { color: `rgb(${tokens.status.orange.rgb})`, value: 1 },
                  { color: `rgb(${tokens.status.red.rgb})`, value: 1 },
                ]}
                centerContent={<Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: tokens.ink1 }}>1/3 × 3</Text>}
              />
              <RingSegmented
                size={70} thickness={10}
                segments={[
                  { color: `rgb(${tokens.status.green.rgb})`, value: 10 },
                  { color: `rgb(${tokens.status.orange.rgb})`, value: 0 },
                  { color: `rgb(${tokens.status.red.rgb})`, value: 0 },
                ]}
                centerContent={<Text style={{ fontFamily: fonts.manrope800, fontSize: 10, color: tokens.ink1 }}>10/0/0</Text>}
              />
            </View>

            <Caption text="MiniRing · 0% / 100% / value>max" />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <MiniRing pct={0} size={52} thickness={5} color={tokens.accent} />
              <MiniRing pct={100} size={52} thickness={5} color={`rgb(${tokens.status.green.rgb})`} />
              <MiniRing pct={150} size={52} thickness={5} color={`rgb(${tokens.status.red.rgb})`} />
            </View>

            <Caption text="ProgressBar · 0% / 100% / >100% / отрицательное значение (клампится к 0)" />
            <View style={{ gap: 8 }}>
              <ProgressBar pct={0} height={5.5} fillColor={tokens.accent} showValueLabel="right" valueLabelText="0%" />
              <ProgressBar pct={1} height={5.5} fillColor={`rgb(${tokens.status.green.rgb})`} showValueLabel="right" valueLabelText="100%" />
              <ProgressBar pct={1.5} height={5.5} fillColor={`rgb(${tokens.status.orange.rgb})`} showValueLabel="right" valueLabelText="150% (клампится)" />
              <ProgressBar pct={-0.2} height={5.5} fillColor={`rgb(${tokens.status.red.rgb})`} showValueLabel="right" valueLabelText="−0.2 (клампится)" />
            </View>

            <Caption text="Radar · длинные подписи UZ / EN — не должны налезать друг на друга и вылетать из viewBox" />
            <GlassCard contentStyle={{ padding: 14, alignItems: "center" }}>
              <Radar
                values={[4.8, 3.8, 4.7, 4.2, 4.5, 4.3]}
                labels={[
                  "Mantiqiy fikrlash",
                  "Muloqot ko‘nikmalari",
                  "Intizom",
                  "Kreativlik",
                  "Mustaqillik",
                  "Jamoada ishlash",
                ]}
                max={5}
                size={220}
              />
            </GlassCard>
            <GlassCard contentStyle={{ padding: 14, alignItems: "center" }}>
              <Radar
                values={[4.8, 3.8, 4.7, 4.2, 4.5, 4.3]}
                labels={[
                  "Logical reasoning",
                  "Communication",
                  "Discipline",
                  "Creativity",
                  "Self-management",
                  "Teamwork",
                ]}
                max={5}
                size={220}
              />
            </GlassCard>

            <Caption text="Radar · все нули (полигон схлопывается в точку) / все max (полигон = внешнему гексагону)" />
            <View style={{ flexDirection: "row", gap: 14, justifyContent: "center" }}>
              <Radar values={[0, 0, 0, 0, 0, 0]} max={5} size={140} />
              <Radar values={[5, 5, 5, 5, 5, 5]} max={5} size={140} />
            </View>

            <Caption text="TimelineHorizontal · один узел / только upcoming (все не done)" />
            <GlassCard contentStyle={{ padding: 14, gap: 12 }}>
              <TimelineHorizontal
                steps={[{ label: "Единственный шаг", date: "сегодня", state: "current" }]}
              />
              <TimelineHorizontal
                steps={[
                  { label: "Шаг 1", date: "—", state: "upcoming" },
                  { label: "Шаг 2", date: "—", state: "upcoming" },
                  { label: "Шаг 3", date: "—", state: "upcoming" },
                ]}
              />
            </GlassCard>

            <Caption text="AttendanceHeatmap · все прошлые дни присутствовал / все ячейки будущие / все выходные" />
            <GlassCard contentStyle={{ padding: 12, gap: 12 }}>
              <AttendanceHeatmap
                cells={"ppppp pp ppppp pp ppppp pp ppppp pp ppppp pp".replace(/ /g, "").split("") as never}
              />
              <AttendanceHeatmap
                cells={"fffff ff fffff ff fffff ff fffff ff fffff ff".replace(/ /g, "").split("") as never}
              />
              <AttendanceHeatmap
                cells={"wwwww ww wwwww ww wwwww ww wwwww ww wwwww ww".replace(/ /g, "").split("") as never}
              />
            </GlassCard>
          </Section>

          {/* ═══ ХРОМ (интеграция) ═══ */}
          <Section title="Хром">
            <Caption text="RootHeader (лого + колокольчик + аватар)" />
            <GlassCard radius={20} contentStyle={{ paddingBottom: 4 }}>
              <RootHeader
                title="SNR EduOS"
                titleSize={14}
                showLogo
                bellCount={3}
                onBellPress={() => {}}
                avatar={{ initials: "ДК", gradient: ["#8B5CF6", "#22D3EE"] }}
                onAvatarPress={() => {}}
              />
            </GlassCard>

            <Caption text="InnerHeader" />
            <GlassCard radius={20} contentStyle={{ paddingBottom: 4 }}>
              <InnerHeader title="Уведомления" onBackPress={() => {}} />
            </GlassCard>

            <Caption text="FloatingTabBar (интерактивный)" />
            <View style={{ height: 110 }}>
              <FloatingTabBar
                items={[
                  { key: "p5", label: "Главная", icon: (c) => <Home size={20} color={c} strokeWidth={1.9} /> },
                  { key: "p10", label: "Успехи", icon: (c) => <TrendingUp size={20} color={c} strokeWidth={1.9} /> },
                  {
                    key: "d24",
                    label: "Сообщения",
                    icon: (c) => <MessageCircle size={20} color={c} strokeWidth={1.9} />,
                    badge: 2,
                  },
                ]}
                activeKey={tab}
                onPress={setTab}
              />
            </View>
          </Section>
        </ScrollView>

        {/* Демо шторки и confirm */}
        <BottomSheetFrame visible={sheetOpen} onClose={() => setSheetOpen(false)}>
          <View style={{ padding: 18, paddingBottom: insets.bottom + 18, gap: 10 }}>
            <Text style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: tokens.ink1 }}>
              Пример шторки
            </Text>
            <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }}>
              Каркас BottomSheetFrame группы A: стекло 160° W92→W76, blur 26, r30.
            </Text>
            <PrimaryButton label="Закрыть" onPress={() => setSheetOpen(false)} />
          </View>
        </BottomSheetFrame>
        <CenterModalFrame
          visible={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Выйти из аккаунта?"
          text="Вы всегда сможете войти заново по номеру телефона."
        >
          <PrimaryButton
            label="Понятно"
            onPress={() => setConfirmOpen(false)}
            style={{ alignSelf: "stretch" }}
          />
        </CenterModalFrame>
      </AppBackground>
    </Modal>
  );
}

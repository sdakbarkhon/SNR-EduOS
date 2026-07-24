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
  Avatar,
  BottomSheetFrame,
  CenterModalFrame,
  ChatBubble,
  ChildPickerSheetContent,
  ChildSwitcherCard,
  CountBadge,
  DemoBannerGlass,
  FloatingTabBar,
  GlassCard,
  InnerHeader,
  LessonRow,
  ListRow,
  MetricsSplitRow,
  Popover,
  PrimaryButton,
  QuickActionTile,
  QuickActionsGrid,
  RootHeader,
  SectionHeader,
  SegmentPills,
  StarRating,
  StatusChip,
  SubjectTile,
  Toggle,
} from "../ui";

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

/**
 * Шесть экранов-действий витрины: детали работы (da3), детали заявления
 * (da4), новое заявление (da5), поиск (da6), «Что нового» (da8) и документ
 * (ddoc).
 *
 * ПОЧЕМУ В ОДНОМ ФАЙЛЕ. Каждый короток, ни у одного нет ветки настоящего
 * потока и ни один не ходит в базу: это концы уже собранных разделов —
 * портфолио, заявлений, библиотеки, «О приложении». Держать их шестью
 * файлами по полсотни строк значило бы шесть раз повторить одну и ту же
 * обвязку.
 *
 * ФОРМА «НОВОЕ ЗАЯВЛЕНИЕ» — БЕЗ ПОЛЕЙ ВВОДА, по той же причине, что и форма
 * карты (см. showcase/payments.tsx): в макете это рабочая форма с датами,
 * причиной, комментарием и вложениями, а отправлять её некуда. Показываем
 * состав и порядок, не давая заполнить.
 *
 * Все шесть закрыты demoOr: у настоящего родителя на этих маршрутах
 * по-прежнему «Скоро».
 */
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppBackground, fonts, useTheme } from "../../theme";
import { GlassCard, InnerHeader, ProgressBar, SectionHeader, StatusChip } from "../../ui";
import {
  getApplicationDetail,
  getLegalDoc,
  getNewApplication,
  getSearchShowcase,
  getSubject,
  getWhatsNew,
  getWorkDetail,
} from "../../data";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList } from "../../navigation/routes";

type Nav = NativeStackNavigationProp<MainStackParamList>;

function Caps({ children }: { children: string }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={{
        fontFamily: fonts.manrope800,
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.08,
        color: tokens.ink3,
        paddingHorizontal: 2,
      }}
    >
      {children}
    </Text>
  );
}

function KeyValue({ label, value, first }: { label: string; value: string; first: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 11,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(23,18,67,0.07)",
      }}
    >
      <Text style={{ width: 110, fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3 }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink1 }}>{value}</Text>
    </View>
  );
}

function FileRow({ name, size, first }: { name: string; size: string; first: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(23,18,67,0.07)",
      }}
    >
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink1 }}>
        {name}
      </Text>
      <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>{size}</Text>
    </View>
  );
}

function PreviewNote({ text }: { text: string }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 14,
        backgroundColor: tokens.chip(tokens.status.orange.rgb).bg,
        borderWidth: 1,
        borderColor: tokens.chip(tokens.status.orange.rgb).border,
      }}
    >
      <Text style={{ fontFamily: fonts.manrope700, fontSize: 10.5, lineHeight: 16, color: tokens.status.orange.text }}>
        {text}
      </Text>
    </View>
  );
}

const SCROLL = { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 11 } as const;

/* ═══════════════ da3 — Детали работы ═══════════════ */

export function WorkDetailScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();
  const work = getWorkDetail(locale);
  const sb = getSubject(work.comment_from_subject);

  return (
    <AppBackground>
      <InnerHeader title={t.more.teacherReviewsTitle} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SCROLL}>
        <Caps>{sc.workDescCap}</Caps>
        <GlassCard radius={20} contentStyle={{ padding: 14 }}>
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 18, color: tokens.ink1 }}>
            {work.description}
          </Text>
        </GlassCard>

        <Caps>{sc.gradeCap}</Caps>
        <GlassCard radius={20} contentStyle={{ padding: 14, gap: 11 }}>
          {work.criteria.map(([name, pct]) => (
            <View key={name} style={{ gap: 5 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink1 }}>
                  {name}
                </Text>
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: tokens.ink2 }}>{`${pct}%`}</Text>
              </View>
              <ProgressBar pct={pct / 100} height={4} fillGradient={sb.gradient} />
            </View>
          ))}
        </GlassCard>

        <Caps>{sc.teacherCommentCap}</Caps>
        <GlassCard radius={20} contentStyle={{ padding: 14, gap: 6 }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: sb.text_color }}>{sb.teacher_name}</Text>
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 18, color: tokens.ink1 }}>
            {work.comment}
          </Text>
        </GlassCard>

        <Caps>{sc.attachedDocsCap}</Caps>
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {work.files.map((f, i) => (
            <FileRow key={f.name} name={f.name} size={f.size_label} first={i === 0} />
          ))}
        </GlassCard>

        <Pressable onPress={() => navigation.navigate("d25")}>
          <GlassCard radius={16} contentStyle={{ padding: 13, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.accent }}>{sc.writeMessage}</Text>
          </GlassCard>
        </Pressable>
      </ScrollView>
    </AppBackground>
  );
}

/* ═══════════════ da4 — Детали заявления ═══════════════ */

export function ApplicationDetailScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();
  const данные = getApplicationDetail(locale);

  return (
    <AppBackground>
      <InnerHeader title={t.svc.applications} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SCROLL}>
        {данные ? (
          <>
            <GlassCard radius={20} contentStyle={{ padding: 14, gap: 6 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 13.5, color: tokens.ink1 }}>{данные.row.name}</Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3 }}>
                {данные.row.number_label}
              </Text>
            </GlassCard>

            <Caps>{sc.appDataCap}</Caps>
            <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
              <KeyValue label={sc.periodCap} value={данные.detail.period_label} first />
              <KeyValue label={sc.reasonCap} value={данные.detail.reason} first={false} />
            </GlassCard>

            <Caps>{sc.schoolCommentCap}</Caps>
            <GlassCard radius={20} contentStyle={{ padding: 14, gap: 6 }}>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 18, color: tokens.ink1 }}>
                {данные.detail.comment}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
                {`${данные.detail.comment_by} · ${данные.detail.comment_date_label}`}
              </Text>
            </GlassCard>

            <PreviewNote text={sc.formPreviewNote} />
            <GlassCard radius={16} contentStyle={{ padding: 13, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.status.red.text }}>
                {sc.withdrawApp}
              </Text>
            </GlassCard>
          </>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
}

/* ═══════════════ da5 — Новое заявление ═══════════════ */

export function NewApplicationScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();
  const данные = getNewApplication(locale);

  return (
    <AppBackground>
      <InnerHeader title={t.svc.applications} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SCROLL}>
        <PreviewNote text={sc.formPreviewNote} />

        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {данные.types.map((тип, i) => (
            <View
              key={тип.name}
              style={{
                gap: 3,
                paddingVertical: 11,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(23,18,67,0.07)",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>{тип.name}</Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>{тип.subtitle}</Text>
            </View>
          ))}
        </GlassCard>

        <Caps>{sc.reasonCap}</Caps>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {данные.reasons.map((r) => (
            <StatusChip key={r} label={r} family="violet" />
          ))}
        </View>

        <Caps>{sc.attachedDocsCap}</Caps>
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {данные.submit.files.map((f, i) => (
            <FileRow key={f.name} name={f.name} size={f.size_label} first={i === 0} />
          ))}
        </GlassCard>

        <Caps>{sc.commentCap}</Caps>
        <GlassCard radius={20} contentStyle={{ padding: 14, gap: 6 }}>
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 18, color: tokens.ink1 }}>
            {данные.submit.comment}
          </Text>
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3 }}>
            {`${данные.submit.comment_by} · ${данные.submit.comment_date_label}`}
          </Text>
        </GlassCard>
      </ScrollView>
    </AppBackground>
  );
}

/* ═══════════════ da6 — Поиск по сервисам ═══════════════ */

export function SearchScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();
  const [group, setGroup] = useState<"msgs" | "mats" | "hw" | "pays" | "svc" | null>(null);
  const данные = getSearchShowcase(locale, group);

  const ЗАГОЛОВОК: Record<string, string> = {
    msgs: t.nav.messages,
    mats: t.svc.library,
    hw: t.scr.homeworks,
    pays: t.nav.payments,
    svc: t.scr.services,
  };
  const ЧИПЫ: { key: typeof group; label: string }[] = [
    { key: null, label: sc.allChip },
    { key: "msgs", label: t.nav.messages },
    { key: "mats", label: t.svc.library },
    { key: "hw", label: t.scr.homeworks },
    { key: "pays", label: t.nav.payments },
    { key: "svc", label: t.scr.services },
  ];

  return (
    <AppBackground>
      <InnerHeader title={t.scr.services} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SCROLL}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {ЧИПЫ.map((c) => {
            const on = group === c.key;
            return (
              <Pressable
                key={c.label}
                onPress={() => setGroup(c.key)}
                style={{
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: on ? tokens.accent : tokens.glassBorder,
                  backgroundColor: on ? tokens.accent : "rgba(255,255,255,0.55)",
                }}
              >
                <Text style={{ fontFamily: fonts.manrope800, fontSize: 11, color: on ? "#FFFFFF" : tokens.ink2 }}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {group === null ? (
          <>
            <Caps>{sc.searchRecentCap}</Caps>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {данные.recent.map((r) => (
                <StatusChip key={r} label={r} family="gray" />
              ))}
            </View>
            <Caps>{sc.searchPopularCap}</Caps>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
              {данные.popular.map((p) => (
                <StatusChip key={p} label={p} family="violet" />
              ))}
            </View>
          </>
        ) : null}

        {данные.groups.map((g) => (
          <View key={g.key} style={{ gap: 8 }}>
            <Caps>{(ЗАГОЛОВОК[g.key] ?? g.key).toUpperCase()}</Caps>
            <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
              {g.rows.map((r, i) => (
                <Pressable
                  key={r.name}
                  onPress={() => navigation.navigate(r.go as never)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 11,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: "rgba(23,18,67,0.07)",
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>
                      {r.name}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>
                      {r.subtitle}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>{r.tail}</Text>
                </Pressable>
              ))}
            </GlassCard>
          </View>
        ))}
      </ScrollView>
    </AppBackground>
  );
}

/* ═══════════════ da8 — Что нового ═══════════════ */

export function WhatsNewScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();
  const данные = getWhatsNew(locale);

  return (
    <AppBackground>
      <InnerHeader title={t.scr.whatsnew} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SCROLL}>
        <GlassCard radius={20} contentStyle={{ padding: 14, gap: 4 }}>
          <Text style={{ fontFamily: fonts.manrope800, fontSize: 14, color: tokens.ink1 }}>
            {данные.current.version_label}
          </Text>
          <Text style={{ fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3 }}>
            {данные.current.release_label}
          </Text>
        </GlassCard>

        <Caps>{sc.thisVersionCap}</Caps>
        <GlassCard radius={20} contentStyle={{ paddingVertical: 4, paddingHorizontal: 14 }}>
          {данные.current.items.map((it, i) => (
            <View
              key={it.title}
              style={{
                gap: 3,
                paddingVertical: 11,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: "rgba(23,18,67,0.07)",
              }}
            >
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>{it.title}</Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, lineHeight: 15, color: tokens.ink2 }}>
                {it.text}
              </Text>
            </View>
          ))}
        </GlassCard>

        <Caps>{sc.prevVersionsCap}</Caps>
        {данные.previous.map((v) => (
          <GlassCard key={v.version_label} radius={20} contentStyle={{ padding: 14, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ flex: 1, fontFamily: fonts.manrope800, fontSize: 12, color: tokens.ink1 }}>
                {v.version_label}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3 }}>{v.date_label}</Text>
            </View>
            {v.items.map((it) => (
              <Text key={it} style={{ fontFamily: fonts.manrope600, fontSize: 10.5, lineHeight: 16, color: tokens.ink2 }}>
                {`· ${it}`}
              </Text>
            ))}
          </GlassCard>
        ))}
      </ScrollView>
    </AppBackground>
  );
}

/* ═══════════════ ddoc — Документ ═══════════════ */

export function DocumentScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const sc = t.showcase;
  const navigation = useNavigation<Nav>();
  const док = getLegalDoc(locale);

  return (
    <AppBackground>
      <InnerHeader title={док?.title ?? t.scr.documents} titleSize={15} onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={SCROLL}>
        <Text style={{ fontFamily: fonts.manrope600, fontSize: 10, color: tokens.ink3, paddingHorizontal: 2 }}>
          {sc.lastUpdatedLabel}
        </Text>
        {(док?.sections ?? []).map(([heading, body]) => (
          <GlassCard key={heading} radius={20} contentStyle={{ padding: 14, gap: 6 }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}>{heading}</Text>
            <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, lineHeight: 17, color: tokens.ink2 }}>
              {body}
            </Text>
          </GlassCard>
        ))}
        <Pressable onPress={() => navigation.goBack()}>
          <GlassCard radius={16} contentStyle={{ padding: 13, alignItems: "center" }}>
            <Text style={{ fontFamily: fonts.manrope800, fontSize: 12, color: tokens.accent }}>{t.common.back}</Text>
          </GlassCard>
        </Pressable>
      </ScrollView>
    </AppBackground>
  );
}

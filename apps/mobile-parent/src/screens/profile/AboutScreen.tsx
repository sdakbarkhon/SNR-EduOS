/**
 * Экран da7 «О приложении» — заход 5 (заглушки).
 *
 * Единственный из четырнадцати маршрутов-заглушек, под которым данные реально
 * есть, поэтому сделан по-настоящему, а не «появится позже». Всё, что здесь
 * написано, читается из живых источников:
 *   · версия, канал обновлений, среда Expo, время загрузки обновления —
 *     expo-constants / expo-updates (то, чем приложение раздаётся сейчас);
 *   · название школы и её учебный день — из базы (таблица schools; политика
 *     «authenticated reads own school» даёт родителю свою строку);
 *   · имя родителя, телефон и число привязанных детей — ParentDataContext,
 *     то же, чем живут остальные экраны.
 *
 * Ничего не выдумываем: если значение неизвестно — пишем «неизвестно», а не
 * правдоподобную строку.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import Svg, { Path } from "react-native-svg";
import { LOCALE_TAG } from "@snr/core";
import { AppBackground, fonts, gradPoints, useTheme } from "../../theme";
import { GlassCard, InnerHeader, SectionHeader } from "../../ui";
import { NoticeBanner } from "../../ui/notices";
import { LinearGradient } from "expo-linear-gradient";
import { useAppLocale } from "../../i18n";
import { useParentData } from "../../context/ParentDataContext";
import { getSupabase } from "../../lib/supabase";
import { fullDate } from "../../lib/dateLabels";
import { useTashkentToday } from "../../hooks/useTashkentToday";
import { useDemoSession } from "../../context/DemoSessionContext";
import { getAboutShowcase } from "../../data";

/** Строка «подпись — значение», как в остальных карточках профиля. */
function InfoRow({ label, value, divider }: { label: string; value: string; divider: boolean }) {
  const { tokens, scheme } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 11,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: scheme === "light" ? "rgba(23,18,67,0.07)" : "rgba(255,255,255,0.08)",
      }}
    >
      <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink2 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, fontFamily: fonts.manrope800, fontSize: 11.5, color: tokens.ink1 }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function AboutScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const navigation = useNavigation();
  const { data } = useParentData();
  // Витрина: значения из макета (разметка 2362–2391). У настоящего родителя
  // экран показывает свои версию, канал обновлений и школу.
  const { isDemo: showcase } = useDemoSession();
  const sc = t.showcase;
  const scAbout = getAboutShowcase(locale);
  const SC_FACT_LABEL: Record<string, string> = {
    aboutVersion: sc.aboutVersion,
    aboutBuildDate: sc.aboutBuildDate,
    aboutDeveloper: sc.aboutDeveloper,
    aboutPlatform: sc.aboutPlatform,
  };
  const [schoolName, setSchoolName] = useState<string | null>(null);

  // Название школы — тем же запросом, что уже ходит за frozen_date (одна
  // строка, своя школа); второй копии клиента не заводим.
  useEffect(() => {
    // В показе школы в базе не спрашиваем: сессии нет, и запрос вернул бы
    // пустоту. Название школы там своё, из заготовки.
    if (showcase) return;
    let alive = true;
    getSupabase()
      .from("schools")
      .select("name")
      .limit(1)
      .maybeSingle()
      .then(({ data: row }) => {
        if (alive) setSchoolName((row as { name: string } | null)?.name ?? null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const localeTag = LOCALE_TAG[locale];
  const unknown = t.about.unknown;

  const version = Constants.expoConfig?.version ?? unknown;
  const channel = Updates.channel ?? unknown;
  const runtime = Updates.runtimeVersion ?? unknown;
  const updatedAt = Updates.createdAt ? fullDate(Updates.createdAt.toISOString(), localeTag) : unknown;

  // «Учебный день школы» — то самое время, по которому живут все экраны
  // (замороженная дата школы), а не системное время телефона.
  const todayKey = useTashkentToday();
  const schoolDay = todayKey ? fullDate(todayKey, localeTag) : unknown;
  const childrenCount = data ? String(data.children.length) : unknown;

  const appGrad = gradPoints(135);

  return (
    <AppBackground>
      <InnerHeader title={t.scr.about} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 4,
          paddingBottom: 118,
          gap: 12,
        }}
      >
        {/* Шапка: логотип-плитка + название приложения и его версия. */}
        <GlassCard
          radius={22}
          contentStyle={{ alignItems: "center", gap: 8, paddingVertical: 20, paddingHorizontal: 16 }}
        >
          <LinearGradient
            colors={["#7c3aed", "#4f6df5"]}
            start={appGrad.start}
            end={appGrad.end}
            style={{ width: 66, height: 66, borderRadius: 20, alignItems: "center", justifyContent: "center" }}
          >
            <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="m12 3 9 5-9 5-9-5 9-5Z" />
              <Path d="M21 12v4c0 1.7-4 3-9 3s-9-1.3-9-3v-4" />
            </Svg>
          </LinearGradient>
          <Text style={{ fontFamily: fonts.unbounded600, fontSize: 15, color: tokens.ink1, textAlign: "center" }}>
            {showcase ? scAbout.app_name : t.about.appName}
          </Text>
          {showcase ? (
            <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }}>
              {scAbout.tagline}
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.manrope700, fontSize: 11, color: tokens.ink3 }}>
            {showcase ? scAbout.version_label : `${t.about.version}: ${version}`}
          </Text>
        </GlassCard>

        {showcase ? (
          <>
            <SectionHeader title={t.about.info} />
            <GlassCard radius={20} contentStyle={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {scAbout.facts.map((fct, i) => (
                <View
                  key={fct.label_key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingVertical: 11,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: "rgba(23,18,67,0.07)",
                  }}
                >
                  <Text style={{ width: 104, fontFamily: fonts.manrope600, fontSize: 10.5, color: tokens.ink3 }}>
                    {SC_FACT_LABEL[fct.label_key] ?? fct.label_key}
                  </Text>
                  <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink1 }}>
                    {fct.value}
                  </Text>
                </View>
              ))}
            </GlassCard>

            <SectionHeader title={t.scr.documents} />
            <GlassCard radius={20} contentStyle={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {[
                { label: sc.termsLink, go: "ddoc" },
                { label: sc.privacyLink, go: "ddoc" },
                { label: sc.licensesLink, go: "ddoc" },
              ].map((row, i) => (
                <Pressable
                  key={row.label}
                  onPress={() => navigation.navigate(row.go as never)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: "rgba(23,18,67,0.07)",
                  }}
                >
                  <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink1 }}>
                    {row.label}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 13, color: tokens.ink3 }}>›</Text>
                </Pressable>
              ))}
            </GlassCard>

            <SectionHeader title={t.scr.support} />
            <GlassCard radius={20} contentStyle={{ paddingVertical: 2, paddingHorizontal: 14 }}>
              {[
                { label: sc.writeSupportLink, go: "d28" },
                { label: sc.rateAppLink, go: "stub" },
                { label: sc.shareAppLink, go: "stub" },
              ].map((row, i) => (
                <Pressable
                  key={row.label}
                  onPress={() => navigation.navigate(row.go as never)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 12,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: "rgba(23,18,67,0.07)",
                  }}
                >
                  <Text style={{ flex: 1, fontFamily: fonts.manrope700, fontSize: 11.5, color: tokens.ink1 }}>
                    {row.label}
                  </Text>
                  <Text style={{ fontFamily: fonts.manrope700, fontSize: 13, color: tokens.ink3 }}>›</Text>
                </Pressable>
              ))}
            </GlassCard>

            <SectionHeader title={sc.aboutSchoolCap} />
            <GlassCard radius={20} contentStyle={{ padding: 14, gap: 5 }}>
              <Text style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                {scAbout.school_name}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }}>
                {scAbout.school_address}
              </Text>
              <Text style={{ fontFamily: fonts.manrope600, fontSize: 11, color: tokens.ink2 }}>
                {scAbout.school_contacts}
              </Text>
            </GlassCard>

            <Text style={{ fontFamily: fonts.manrope600, fontSize: 9.5, color: tokens.ink3, textAlign: "center" }}>
              {scAbout.copyright}
            </Text>
          </>
        ) : (
          <>

        <SectionHeader title={t.about.info} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 2, paddingHorizontal: 14 }}>
          <InfoRow label={t.about.version} value={version} divider={false} />
          <InfoRow label={t.about.channel} value={channel} divider />
          <InfoRow label={t.about.runtime} value={runtime} divider />
          <InfoRow label={t.about.updated} value={updatedAt} divider />
        </GlassCard>

        {/* Почему версия обновляется без магазина — иначе цифры выше непонятны. */}
        <NoticeBanner
          family="blue"
          paths={["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 16v-4", "M12 8h.01"]}
          text={t.about.storeNote}
        />

        <SectionHeader title={t.about.school} />
        <GlassCard radius={20} contentStyle={{ paddingVertical: 2, paddingHorizontal: 14 }}>
          <InfoRow label={t.about.school} value={schoolName ?? unknown} divider={false} />
          <InfoRow label={t.about.schoolToday} value={schoolDay} divider />
          <InfoRow label={t.about.parent} value={data?.parentName ?? unknown} divider />
          <InfoRow label={t.about.phone} value={data?.parentPhone ?? unknown} divider />
          <InfoRow label={t.about.childrenCount} value={childrenCount} divider />
        </GlassCard>
          </>
        )}
      </ScrollView>
    </AppBackground>
  );
}

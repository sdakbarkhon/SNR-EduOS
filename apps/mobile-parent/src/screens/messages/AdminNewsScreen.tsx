/**
 * d27 «От администрации» — НАСТОЯЩИЕ ДАННЫЕ (14.08.2026).
 *
 * БЫЛО: одно объявление, вкомпилированное в файл («Школьная ярмарка —
 * 24 июля»), с деталями мероприятия, врезкой «Важно!», 245 лайками, 12
 * комментариями и тремя прикреплёнными файлами. Ни лайков, ни комментариев,
 * ни вложений у объявления в базе нет — ни одной такой колонки.
 *
 * СТАЛО: два режима одного экрана, оба на `announcements`.
 *  • с `announcementId` — то самое объявление, по которому нажали на d26:
 *    `getParentAnnouncementById`;
 *  • без параметра — список объявлений ОТ АДМИНИСТРАЦИИ (фильтр
 *    `isFromAdmin` над тем же `getParentAnnouncements`, что и на экране
 *    «Объявления»). Отдельного запроса не заводим: экран «Объявления»
 *    остаётся полным (учителя + администрация), а здесь тот же разрез, что
 *    и на вебе, — родителю нужно уметь посмотреть только официальное.
 *
 * Карточка списка — та же `AnnouncementCard`, что на d26: одна карточка на
 * два экрана вместо двух похожих.
 */
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  format,
  getParentAnnouncementById,
  getParentAnnouncements,
  LOCALE_TAG,
} from "@snr/core";
import { AppBackground, fonts, useTheme } from "../../theme";
import {
  EmptyBlock,
  ErrorBlock,
  GlassCard,
  GlassCircleButton,
  InnerHeader,
  LoadingBlock,
  PrimaryButton,
  SectionHeader,
} from "../../ui";
import { useAsyncData } from "../../hooks/useAsyncData";
import { getSupabase } from "../../lib/supabase";
import { fullDate } from "../../lib/dateLabels";
import { useAppLocale } from "../../i18n";
import type { MainStackParamList, TabParamList } from "../../navigation/routes";
import { AnnouncementCard } from "./AnnouncementsScreen";

type Nav = NativeStackNavigationProp<MainStackParamList & TabParamList>;
type Route = RouteProp<MainStackParamList, "d27">;

export default function AdminNewsScreen() {
  const { tokens } = useTheme();
  const { d, locale } = useAppLocale();
  const t = d.parentApp;
  const m = t.more;
  const m4 = t.more4;
  const ann = t.ann;
  const localeTag = LOCALE_TAG[locale];
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const announcementId = route.params?.announcementId ?? null;

  const state = useAsyncData(
    async () => {
      const db = getSupabase();
      if (announcementId) return { one: await getParentAnnouncementById(db, announcementId), list: null };
      const all = await getParentAnnouncements(db, 100);
      return { one: null, list: all.filter((a) => a.isFromAdmin) };
    },
    [announcementId],
  );

  const one = state.data?.one ?? null;
  const list = useMemo(() => state.data?.list ?? [], [state.data]);

  return (
    <AppBackground>
      <InnerHeader
        // На d26 нажать можно и объявление УЧИТЕЛЯ — тогда заголовок «От
        // администрации» врал бы. В режиме карточки он идёт за автором.
        title={announcementId && one && !one.isFromAdmin ? t.scr.announcements : t.scr.adminNews}
        titleSize={15}
        onBackPress={() => navigation.goBack()}
        right={
          <GlassCircleButton onPress={() => navigation.navigate("d8")}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={tokens.ink1} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </Svg>
          </GlassCircleButton>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 118, gap: 12 }}
      >
        {state.loading ? (
          <LoadingBlock />
        ) : state.error ? (
          <ErrorBlock
            title={m4.loadFailed}
            message={state.error.message}
            retryLabel={d.common.retry}
            onRetry={() => state.refresh()}
          />
        ) : announcementId && !one ? (
          <EmptyBlock title={m4.annNotFoundTitle} text={m4.annNotFoundText} />
        ) : one ? (
          <>
            {/* Отправитель: кто и когда. Автор приходит из данных — админ или
                учитель; если имени нет, подписываемся школой, а не выдуманным
                отделом. */}
            <GlassCard radius={22} contentStyle={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: one.isFromAdmin ? "#2563EB" : tokens.accent,
                }}
              >
                <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                  <Path d="M9 21v-8h6v8" />
                </Svg>
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <Text numberOfLines={1} style={{ fontFamily: fonts.manrope800, fontSize: 12.5, color: tokens.ink1 }}>
                  {one.authorName ?? (one.isFromAdmin ? m.newsAuthorFallback : ann.authorSchool)}
                </Text>
                <Text style={{ fontFamily: fonts.manrope700, fontSize: 9.5, color: tokens.ink3 }}>
                  {fullDate(one.created_at, localeTag)}
                </Text>
              </View>
              {one.is_pinned ? (
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 9,
                    borderRadius: 999,
                    backgroundColor: tokens.chip(tokens.status.orange.rgb).bg,
                    borderWidth: 1,
                    borderColor: tokens.chip(tokens.status.orange.rgb).border,
                  }}
                >
                  <Text style={{ fontFamily: fonts.manrope800, fontSize: 9, color: tokens.status.orange.text }}>
                    {m.newsPinned}
                  </Text>
                </View>
              ) : null}
            </GlassCard>

            <Text style={{ fontFamily: fonts.unbounded600, fontSize: 17, lineHeight: 17 * 1.35, color: tokens.ink1 }}>
              {one.title}
            </Text>

            <Text style={{ fontFamily: fonts.manrope600, fontSize: 11.5, lineHeight: 11.5 * 1.6, color: tokens.ink2 }}>
              {one.body}
            </Text>

            <View style={{ marginTop: 6 }}>
              <PrimaryButton label={m4.annBackToList} onPress={() => navigation.goBack()} />
            </View>
          </>
        ) : list.length === 0 ? (
          <EmptyBlock title={m.newsEmptyTitle} text={m.newsEmptyText} />
        ) : (
          <>
            <SectionHeader title={format(m.newsCount, { n: String(list.length) })} />
            {list.map((a) => (
              <AnnouncementCard
                key={a.id}
                row={a}
                localeTag={localeTag}
                ann={ann}
                // push, а не navigate: мы уже на d27, и navigate лишь подменил
                // бы параметры — «назад» ушло бы мимо списка.
                onPress={() => navigation.push("d27", { announcementId: a.id })}
              />
            ))}
          </>
        )}
      </ScrollView>
    </AppBackground>
  );
}

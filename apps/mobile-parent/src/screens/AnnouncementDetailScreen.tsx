import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  getParentAnnouncementById,
  formatDate,
  formatDateTime,
  type ParentAnnouncement,
  type AnnouncementCategory,
  type Dictionary,
} from "@snr/core";
import { useAppLocale } from "../i18n";
import { useAsyncData } from "../hooks/useAsyncData";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState, EmptyState } from "../components/ScreenState";
import { colors, gradients, radii, shadow, spacing } from "../theme";
import type { MainStackParamList } from "../navigation/MainNavigator";

/** Экран #27 "Сообщение от администрации". Схема announcements гораздо
 *  беднее прототипа Claude Design (нет картинки-обложки как отдельного поля,
 *  нет structured date/time/location, нет счётчиков лайков/комментариев, нет
 *  вложений) — см. договорённые отклонения в шапке задачи МОБ-4. Единственное
 *  реальное "похожее на дату" поле — валидация-дедлайн `valid_until`.
 *  Категория → градиент/иконка hero-блока: та же мапа icon/color/gradient,
 *  что CATEGORY_META в AnnouncementsScreen.tsx, — чтобы у одного и того же
 *  объявления была одинаковая иконка/цвет и в списке, и на этом экране. */
const CATEGORY_HERO: Record<AnnouncementCategory, {
  gradient: readonly [string, string] | readonly [string, string, string];
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
}> = {
  general: { icon: "megaphone-outline", iconColor: colors.primary, gradient: gradients.primary },
  academic: { icon: "book-outline", iconColor: colors.success, gradient: gradients.tealCard },
  event: { icon: "calendar-outline", iconColor: colors.accentOrange, gradient: gradients.warmCard },
  urgent: { icon: "alert-circle-outline", iconColor: colors.danger, gradient: [colors.danger, colors.accentCoral] },
  reminder: { icon: "notifications-outline", iconColor: colors.accentCoral, gradient: [colors.primaryLight, colors.accentCoral] },
};

export default function AnnouncementDetailScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, "AnnouncementDetail">>();
  const { id } = route.params;

  const ann = useAsyncData<ParentAnnouncement | null>(
    () => getParentAnnouncementById(getSupabase(), id),
    [id],
  );

  function goToMessages() {
    // Этот экран — прямой Stack.Screen в MainNavigator (не вложен в
    // TabNavigator), поэтому его nav УЖЕ на уровне MainStack — .getParent()
    // увёл бы на уровень выше (RootStack). React Navigation резолвит
    // уникальное имя экрана рекурсивно вглубь дерева, так что просто
    // nav.navigate("Messages") находит вложенный таб-экран (см.
    // HomeworkDetailScreen.tsx — тот же паттерн).
    nav.navigate("Messages" as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={ann.refreshing} onRefresh={ann.refresh} tintColor={colors.primary} />}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Pressable
              onPress={() => nav.goBack()}
              style={({ pressed }) => [{
                width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff",
                alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, ...shadow.soft,
              }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>
              {d.announcements.title}
            </Text>
            {/* Нет реального действия для правого меню в этом скоупе — просто
                спейсер, симметричный кнопке "назад" (как в HomeworkDetailScreen). */}
            <View style={{ width: 38 }} />
          </View>

          {ann.error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={ann.refresh} />
          ) : ann.loading ? (
            <ScreenSkeleton />
          ) : !ann.data ? (
            <EmptyState icon="alert-circle-outline" title={d.parentMobile.errorGeneric} description={d.parentMobile.comingSoonSection} />
          ) : (
            <AnnouncementDetailContent announcement={ann.data} d={d} goToMessages={goToMessages} />
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function AnnouncementDetailContent({
  announcement,
  d,
  goToMessages,
}: {
  announcement: ParentAnnouncement;
  d: Dictionary;
  goToMessages: () => void;
}) {
  const hero = CATEGORY_HERO[announcement.category];
  const isUrgent = announcement.category === "urgent";
  // Локальная const для узкого TS-типа string (announcement.valid_until —
  // string | null) — тот же приём, что commentDate в HomeworkDetailScreen.
  const validUntil = announcement.valid_until;

  return (
    <>
      <View style={{ backgroundColor: colors.card, borderRadius: radii.xxl, padding: 15, marginBottom: 14, ...shadow.card }}>
        {/* Автор + дата */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primary + "22", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={announcement.isFromAdmin ? "business-outline" : "person-outline"} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "800", color: colors.textPrimary }}>
              {announcement.authorName ?? d.parentMobile.annSourceAdmin}
            </Text>
            <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted, marginTop: 2 }}>
              {formatDateTime(announcement.created_at)}
            </Text>
          </View>
          {isUrgent && (
            <Text
              style={{
                fontSize: 10, fontWeight: "800", color: colors.danger, backgroundColor: colors.dangerBg,
                borderRadius: 7, paddingVertical: 4, paddingHorizontal: 10, flexShrink: 0,
              }}
            >
              {d.parentMobile.annImportantBadge}
            </Text>
          )}
        </View>

        {/* Hero-блок по категории */}
        <LinearGradient
          colors={hero.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 130, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", marginBottom: 13 }}
        >
          <View
            style={{
              width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.78)",
              alignItems: "center", justifyContent: "center", ...shadow.soft,
            }}
          >
            <Ionicons name={hero.icon} size={27} color={hero.iconColor} />
          </View>
        </LinearGradient>

        {/* Заголовок + полный текст */}
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.textPrimary, letterSpacing: -0.3, marginBottom: 9 }}>
          {announcement.title}
        </Text>
        <Text style={{ fontSize: 12.5, lineHeight: 20, color: colors.textSecondary, marginBottom: validUntil ? 13 : 0 }}>
          {announcement.body}
        </Text>

        {/* Единственное реальное "похожее на дату" поле — valid_until.
            Полностью пропускается, если null (не показываем пустой блок). */}
        {validUntil && (
          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary + "0D",
              borderRadius: radii.lg, paddingVertical: 10, paddingHorizontal: 13,
            }}
          >
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary, flex: 1 }}>
              {d.announcements.validUntil.replace("{date}", formatDate(validUntil))}
            </Text>
          </View>
        )}
      </View>

      <Pressable onPress={goToMessages} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ height: 48, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
        >
          <Ionicons name="arrow-back" size={16} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 13.5, fontWeight: "700" }}>{d.parentMobile.annDetailBackToMessages}</Text>
        </LinearGradient>
      </Pressable>
    </>
  );
}

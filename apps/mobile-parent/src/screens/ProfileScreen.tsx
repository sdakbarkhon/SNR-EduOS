import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import type { Locale } from "@snr/core";
import { useAppLocale } from "../i18n";
import { useParentData } from "../context/ParentDataContext";
import { getSupabase } from "../lib/supabase";
import { ScreenSkeleton, ErrorState } from "../components/ScreenState";
import { colors, radii, shadow, spacing } from "../theme";
import type { ParentProfile } from "../lib/auth";
import type { MainStackParamList } from "../navigation/MainNavigator";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

const LANGS: { code: Locale; label: string }[] = [
  { code: "ru", label: "RU" },
  { code: "uz", label: "UZ" },
  { code: "en", label: "EN" },
];

export default function ProfileScreen({
  profile,
  onLoggedOut,
}: {
  profile: ParentProfile;
  onLoggedOut: () => void;
}) {
  const { locale, d, setLocale } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: parentCtx, loading, error, refresh, selectedChildId, selectChild } = useParentData();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function onLogout() {
    await getSupabase().auth.signOut();
    onLoggedOut();
  }

  function onEdit() {
    Alert.alert(d.parentMobile.parentProfEditSoon);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <Text style={{ fontSize: 23, fontWeight: "800", color: colors.textPrimary, marginBottom: 16 }}>{d.nav.profile}</Text>

          <View style={{ backgroundColor: colors.card, borderRadius: radii.xxl, padding: 16, marginBottom: 12, ...shadow.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 12 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{initials(profile.fullName)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16.5, fontWeight: "800", color: colors.textPrimary }}>{profile.fullName}</Text>
                {parentCtx?.parentPhone ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{parentCtx.parentPhone}</Text> : null}
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={{ fontSize: 10.5, fontWeight: "600", color: colors.textMuted, marginBottom: 3 }}>{d.parentMobile.parentProfEmailLabel}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: "600", color: colors.textPrimary }}>{email ?? d.common.none}</Text>
              </View>
              <Pressable onPress={onEdit} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, flexDirection: "row", alignItems: "center", gap: 5 }]}>
                <Ionicons name="create-outline" size={15} color={colors.primary} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>{d.parentMobile.parentProfEditBtn}</Text>
              </Pressable>
            </View>
          </View>

          {error ? (
            <ErrorState message={d.parentMobile.errorGeneric} retryLabel={d.common.retry} onRetry={refresh} />
          ) : loading ? (
            <ScreenSkeleton />
          ) : (
            <>
              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                {d.parentMobile.profileChildren}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 12, ...shadow.soft }}>
                {(parentCtx?.children ?? []).map((c, i) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      selectChild(c.id);
                      nav.navigate("ChildProfile", { childId: c.id });
                    }}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 10,
                      borderBottomWidth: i < (parentCtx?.children.length ?? 0) - 1 ? 1 : 0, borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: "#EFEAFF", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>{initials(c.fullName)}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary }}>{c.fullName}</Text>
                      {c.className ? <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 2 }}>{c.className}</Text> : null}
                    </View>
                    {c.id === selectedChildId && (
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
                {d.parentMobile.profileSettings}
              </Text>
              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 12, ...shadow.soft }}>
                <SettingsRow icon="document-text-outline" iconBg="#EFEAFF" iconColor={colors.primary} label={d.parentMobile.parentProfDocumentsRow} onPress={() => nav.navigate("Documents")} />
                <SettingsRow icon="notifications-outline" iconBg="#FFF3E4" iconColor={colors.accentOrange} label={d.parentMobile.parentProfNotificationsRow} onPress={() => nav.navigate("NotificationSettings")} />
                <SettingsRow icon="card-outline" iconBg={colors.successBg} iconColor={colors.success} label={d.parentMobile.parentProfPaymentMethodsRow} onPress={() => nav.navigate("PaymentMethods")} />
                <SettingsRow icon="shield-checkmark-outline" iconBg={colors.dangerBg} iconColor={colors.danger} label={d.parentMobile.parentProfSecurityRow} onPress={() => nav.navigate("Security")} last />
              </View>

              <View style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, marginBottom: 12, ...shadow.soft }}>
                <View style={{ paddingVertical: 11 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.textPrimary, marginBottom: 8 }}>{d.parentMobile.profileLanguageRow}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {LANGS.map((l) => (
                      <Pressable
                        key={l.code}
                        onPress={() => setLocale(l.code)}
                        style={{
                          paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999,
                          backgroundColor: locale === l.code ? colors.primary : colors.chipBg,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "700", color: locale === l.code ? "#fff" : colors.textSecondary }}>{l.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <Pressable
                onPress={onLogout}
                style={{ backgroundColor: colors.card, borderRadius: radii.xl, paddingHorizontal: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 11, ...shadow.soft }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.dangerBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                </View>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.danger }}>{d.parentMobile.notParentExitBtn}</Text>
              </Pressable>

              <Text style={{ textAlign: "center", fontSize: 10.5, fontWeight: "600", color: colors.textFaint, marginTop: 16 }}>
                {d.parentMobile.profileVersion.replace("{v}", "1.0.0")}
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SettingsRow({ icon, iconBg, iconColor, label, onPress, last }: {
  icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string; label: string; onPress: () => void; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, opacity: pressed ? 0.85 : 1,
      }]}
    >
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.textPrimary }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

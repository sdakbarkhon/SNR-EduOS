import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
  const [notifOn, setNotifOn] = useState(true);

  async function onLogout() {
    await getSupabase().auth.signOut();
    onLoggedOut();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <Text style={{ fontSize: 23, fontWeight: "800", color: colors.textPrimary, marginBottom: 16 }}>{d.nav.profile}</Text>

          <View style={{ backgroundColor: colors.card, borderRadius: radii.xxl, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 12, ...shadow.card }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>{initials(profile.fullName)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16.5, fontWeight: "800", color: colors.textPrimary }}>{profile.fullName}</Text>
              {parentCtx?.parentPhone ? <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 3 }}>{parentCtx.parentPhone}</Text> : null}
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
                <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: "#FFF3E4", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="notifications-outline" size={18} color={colors.accentOrange} />
                  </View>
                  <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "600", color: colors.textPrimary }}>{d.parentMobile.profileNotifRow}</Text>
                  <Pressable
                    onPress={() => setNotifOn((v) => !v)}
                    style={{ width: 46, height: 28, borderRadius: 14, backgroundColor: notifOn ? colors.primary : colors.border, justifyContent: "center" }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff", marginLeft: notifOn ? 21 : 3 }} />
                  </Pressable>
                </View>

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

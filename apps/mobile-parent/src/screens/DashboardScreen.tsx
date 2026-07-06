import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { format } from "@snr/core";
import { useAppLocale } from "../i18n";
import { getSupabase } from "../lib/supabase";
import { getMyChildren, type ParentChild } from "../lib/queries";
import type { ParentProfile } from "../lib/auth";

const COMING_SOON_SECTIONS = ["schedule", "grades", "homework", "attendance", "payments", "messages"] as const;

export default function DashboardScreen({
  profile,
  onLoggedOut,
}: {
  profile: ParentProfile;
  onLoggedOut: () => void;
}) {
  const { d } = useAppLocale();
  const [children, setChildren] = useState<ParentChild[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyChildren(getSupabase(), profile.id).then((rows) => {
      if (!cancelled) setChildren(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  async function onLogout() {
    await getSupabase().auth.signOut();
    onLoggedOut();
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F6FB" }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 20,
            paddingVertical: 14,
            backgroundColor: "#fff",
            borderBottomWidth: 1,
            borderBottomColor: "#EEF2FB",
          }}
        >
          <Image source={require("../../assets/icon.png")} style={{ width: 32, height: 32, borderRadius: 8 }} />
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#1A1A24", flex: 1 }}>
            {d.common.appName}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#1A1A24" }}>
            {format(d.parentMobile.greeting, { name: profile.fullName })}
          </Text>

          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#4A5568" }}>
              {d.parentMobile.myChildren}
            </Text>

            {children === null ? (
              <ActivityIndicator color="#F97316" />
            ) : children.length === 0 ? (
              <Text style={{ fontSize: 14, color: "#8A93A8" }}>{d.parent.noChildren}</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {children.map((child) => (
                  <View
                    key={child.id}
                    style={{
                      backgroundColor: "#fff",
                      borderRadius: 16,
                      padding: 16,
                      shadowColor: "#283C78",
                      shadowOpacity: 0.06,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 2,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "700", color: "#1A1A24" }}>
                      {child.fullName}
                    </Text>
                    {child.className ? (
                      <Text style={{ fontSize: 13, color: "#8A93A8", marginTop: 2 }}>
                        {child.className}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ gap: 10 }}>
            {COMING_SOON_SECTIONS.map((key) => (
              <View
                key={key}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  padding: 16,
                  opacity: 0.6,
                }}
              >
                <Text style={{ fontSize: 14, color: "#8A93A8" }}>{d.parentMobile.comingSoonSection}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onLogout}
            style={{
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              backgroundColor: "#FEE2E2",
            }}
          >
            <Text style={{ color: "#DC2626", fontWeight: "700", fontSize: 15 }}>
              {d.parentNav.logout}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

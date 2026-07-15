import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useAppLocale } from "../i18n";
import { colors, radii, shadow, spacing } from "../theme";
import { MOCK_DOCUMENTS, type MockDocument } from "../lib/mockProfileData";
import type { MainStackParamList } from "../navigation/MainNavigator";

const STATUS_META: Record<MockDocument["status"], { bg: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  uploaded: { bg: colors.successBg, color: colors.success, icon: "checkmark-circle-outline" },
  needs_update: { bg: colors.warningBg, color: colors.warning, icon: "alert-circle-outline" },
  missing: { bg: colors.dangerBg, color: colors.danger, icon: "close-circle-outline" },
};

/** Промт МОБ-6, Экран 3 — Документы. Полностью mock-flat: "Загрузить"
 *  переводит статус в состоянии экрана (не переживает перезапуск — в ТЗ нет
 *  ключа хранилища для документов). */
export default function DocumentsScreen() {
  const { d } = useAppLocale();
  const nav = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const [docs, setDocs] = useState<MockDocument[]>(MOCK_DOCUMENTS);
  const [view, setView] = useState<{ mode: "list" } | { mode: "preview"; doc: MockDocument } | { mode: "uploaded"; doc: MockDocument }>({ mode: "list" });

  function onUpload(doc: MockDocument) {
    setDocs((prev) => prev.map((x) => (x.id === doc.id ? { ...x, status: "uploaded" } : x)));
    setView({ mode: "uploaded", doc });
  }

  const statusLabel: Record<MockDocument["status"], string> = {
    uploaded: d.parentMobile.docStatusUploaded,
    needs_update: d.parentMobile.docStatusNeedsUpdate,
    missing: d.parentMobile.docStatusMissing,
  };

  if (view.mode === "uploaded") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg }}>
              <Ionicons name="checkmark-circle" size={56} color={colors.success} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: "800", color: colors.textPrimary, marginBottom: 8, textAlign: "center" }}>{d.parentMobile.docUploadSuccessTitle}</Text>
            <Text style={{ fontSize: 13.5, color: colors.textSecondary, textAlign: "center", marginBottom: 28 }}>{d.parentMobile.docUploadSuccessDesc}</Text>
            <Pressable onPress={() => setView({ mode: "list" })} style={{ backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: 13, paddingHorizontal: 32 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{d.parentMobile.checkoutBackBtn}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (view.mode === "preview") {
    const doc = view.doc;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Pressable onPress={() => setView({ mode: "list" })} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}>
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </Pressable>
              <Text numberOfLines={1} style={{ flex: 1, textAlign: "center", fontSize: 16.5, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.docPreviewTitle}</Text>
              <View style={{ width: 38 }} />
            </View>
            <View style={{ backgroundColor: colors.card, borderRadius: radii.xxl, aspectRatio: 3 / 4, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg, ...shadow.card }}>
              <Ionicons name="document-text-outline" size={64} color={colors.textFaint} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.textPrimary, textAlign: "center", marginBottom: 8 }}>{doc.title}</Text>
            {doc.status !== "uploaded" && (
              <Pressable
                onPress={() => onUpload(doc)}
                style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: radii.xl, paddingVertical: 14, alignItems: "center", marginTop: 12, opacity: pressed ? 0.9 : 1 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>{d.parentMobile.docUploadBtn}</Text>
              </Pressable>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 32 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <Pressable onPress={() => nav.goBack()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.soft }}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: colors.textPrimary }}>{d.parentMobile.docTitle}</Text>
            <View style={{ width: 38 }} />
          </View>

          <View style={{ gap: 10 }}>
            {docs.map((doc) => {
              const meta = STATUS_META[doc.status];
              return (
                <Pressable
                  key={doc.id}
                  onPress={() => setView({ mode: "preview", doc })}
                  style={({ pressed }) => [{
                    backgroundColor: colors.card, borderRadius: radii.xl, padding: 14,
                    flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.85 : 1, ...shadow.soft,
                  }]}
                >
                  <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: meta.bg, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: "700", color: colors.textPrimary, marginBottom: 4 }}>{doc.title}</Text>
                    <View style={{ backgroundColor: meta.bg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7, alignSelf: "flex-start" }}>
                      <Text style={{ fontSize: 9.5, fontWeight: "800", color: meta.color }}>{statusLabel[doc.status]}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

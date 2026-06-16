import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@snr/ui-tokens";

/** Каркас экрана: SafeArea + фон + заголовок + прокрутка. */
export function Screen({
  title,
  children,
  scroll = true,
}: {
  title?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const body = (
    <View style={{ padding: 16, gap: 16 }}>
      {title ? (
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary }}>{title}</Text>
      ) : null}
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.bgApp }}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

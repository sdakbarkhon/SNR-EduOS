import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { colors } from "@snr/ui-tokens";
import { cardStyle } from "./ui";

export function EmptyState({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: string;
}) {
  return (
    <View style={[cardStyle, { padding: 32, alignItems: "center", gap: 8 }]}>
      {icon}
      <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center" }}>{children}</Text>
    </View>
  );
}

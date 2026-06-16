import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { colors } from "@snr/ui-tokens";
import { cardStyle } from "./ui";

export function KpiCard({
  title,
  value,
  footer,
  icon,
}: {
  title: string;
  value: string;
  footer?: string;
  icon?: ReactNode;
}) {
  return (
    <View style={[cardStyle, { flex: 1, minHeight: 100, padding: 16, justifyContent: "space-between" }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {icon}
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{title}</Text>
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "600", marginTop: 8 }}>
        {value}
      </Text>
      {footer ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{footer}</Text>
      ) : null}
    </View>
  );
}

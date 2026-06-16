import { View } from "react-native";
import { colors } from "@snr/ui-tokens";

export function ProgressBar({
  value,
  color = colors.primary,
}: {
  value: number;
  color?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <View style={{ height: 8, borderRadius: 999, backgroundColor: colors.bgAppAlt, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${clamped}%`, backgroundColor: color, borderRadius: 999 }} />
    </View>
  );
}

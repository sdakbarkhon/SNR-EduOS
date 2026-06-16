import { Text, View } from "react-native";
import { statusColors, type StatusVariant } from "@snr/ui-tokens";

export function StatusChip({
  variant,
  label,
}: {
  variant: StatusVariant;
  label: string;
}) {
  const c = statusColors[variant];
  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

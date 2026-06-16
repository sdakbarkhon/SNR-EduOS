import { Text, View } from "react-native";
import { colors, type StatusVariant } from "@snr/ui-tokens";
import { StatusChip } from "./StatusChip";
import { SubjectIcon } from "./SubjectIcon";
import { cardStyle } from "./ui";

export function HomeworkCard({
  subject,
  title,
  due,
  status,
}: {
  subject: string | null;
  title: string;
  due?: string | null;
  status?: { variant: StatusVariant; label: string };
}) {
  return (
    <View style={[cardStyle, { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }]}>
      <SubjectIcon subject={subject} size={36} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>
          {title}
        </Text>
        {due ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{due}</Text> : null}
      </View>
      {status ? <StatusChip variant={status.variant} label={status.label} /> : null}
    </View>
  );
}

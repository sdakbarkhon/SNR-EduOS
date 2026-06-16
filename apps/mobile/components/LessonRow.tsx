import { Text, View } from "react-native";
import { colors, type StatusVariant } from "@snr/ui-tokens";
import { StatusChip } from "./StatusChip";
import { SubjectIcon } from "./SubjectIcon";
import { cardStyle } from "./ui";

export function LessonRow({
  time,
  duration,
  subject,
  title,
  room,
  teacher,
  colorBar,
  status,
}: {
  time: string;
  duration?: string;
  subject: string | null;
  title: string;
  room?: string | null;
  teacher?: string | null;
  colorBar?: string;
  status?: { variant: StatusVariant; label: string };
}) {
  const subtitle = teacher ?? (room ? `каб. ${room}` : null);
  return (
    <View
      style={[
        cardStyle,
        { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, overflow: "hidden" },
      ]}
    >
      {colorBar ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            top: "25%",
            width: 5,
            height: "50%",
            borderTopRightRadius: 4,
            borderBottomRightRadius: 4,
            backgroundColor: colorBar,
          }}
        />
      ) : null}

      <View style={{ width: 52, paddingLeft: colorBar ? 8 : 0 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
          {time}
        </Text>
        {duration ? (
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textMuted, marginTop: 1 }}>
            {duration}
          </Text>
        ) : null}
      </View>

      <SubjectIcon subject={subject} size={34} />

      <View style={{ flex: 1, paddingHorizontal: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {status ? <StatusChip variant={status.variant} label={status.label} /> : null}
    </View>
  );
}

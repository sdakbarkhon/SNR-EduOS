import { Text, View } from "react-native";
import {
  File,
  FileCode,
  FileText,
  Link2,
  Presentation,
  Video,
  type LucideIcon,
} from "lucide-react-native";
import { colors } from "@snr/ui-tokens";
import { cardStyle } from "./ui";

const TYPE_ICON: Record<string, LucideIcon> = {
  pdf: FileText,
  video: Video,
  link: Link2,
  presentation: Presentation,
  code: FileCode,
};

export function MaterialTile({
  title,
  type,
  meta,
}: {
  title: string;
  type?: string | null;
  meta?: string;
}) {
  const Icon = (type && TYPE_ICON[type]) || File;
  return (
    <View style={[cardStyle, { padding: 16, gap: 8 }]}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.bgAppAlt,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={colors.primary} />
      </View>
      <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: "500", color: colors.textPrimary }}>
        {title}
      </Text>
      {meta ? <Text style={{ fontSize: 12, color: colors.textMuted }}>{meta}</Text> : null}
    </View>
  );
}

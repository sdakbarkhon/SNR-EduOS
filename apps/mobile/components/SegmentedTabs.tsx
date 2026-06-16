import { Pressable, Text, View } from "react-native";
import { colors } from "@snr/ui-tokens";

export interface TabItem {
  key: string;
  label: string;
}

export function SegmentedTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 4,
        backgroundColor: colors.bgApp,
        borderRadius: 999,
        padding: 4,
        alignSelf: "flex-start",
      }}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 6,
              backgroundColor: active ? colors.bgCard : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                color: active ? colors.textPrimary : colors.textMuted,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

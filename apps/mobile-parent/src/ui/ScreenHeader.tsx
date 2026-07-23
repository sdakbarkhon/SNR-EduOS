/** Шапка экрана: круглая стеклянная кнопка «назад» + заголовок + опциональный
 *  элемент справа. paddingTop учитывает safe-area (вырез/статус-бар). */
import { type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { AppText } from "./AppText";
import { GlassIconButton } from "./GlassIconButton";
import { spacing } from "./theme";

export function ScreenHeader({
  title,
  onBack,
  right,
  eyebrow,
  style,
}: {
  title: string;
  onBack?: () => void;
  /** Элемент справа (кнопка-иконка, действие). */
  right?: ReactNode;
  /** Мелкая надпись-надзаголовок над title. */
  eyebrow?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ paddingTop: insets.top + spacing.sm }, styles.wrap, style]}>
      {onBack && <GlassIconButton icon={ArrowLeft} onPress={onBack} size={42} iconSize={20} />}
      <View style={styles.titleBox}>
        {eyebrow && (
          <AppText preset="eyebrow" style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        )}
        <AppText preset="screenTitle" numberOfLines={1}>
          {title}
        </AppText>
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: spacing.md,
  },
  titleBox: { flex: 1 },
  eyebrow: { marginBottom: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 8 },
});

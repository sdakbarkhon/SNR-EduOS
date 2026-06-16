import type { ViewStyle } from "react-native";
import { colors, radii } from "@snr/ui-tokens";

/** Базовый стиль карточки (мягкая тень дизайн-системы). */
export const cardStyle: ViewStyle = {
  backgroundColor: colors.bgCard,
  borderRadius: radii.card,
  shadowColor: "#28203C",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

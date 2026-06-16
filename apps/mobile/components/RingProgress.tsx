import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "@snr/ui-tokens";

export function RingProgress({
  value,
  size = 64,
  stroke = 8,
  color = colors.primary,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  const center = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={r} stroke={colors.bgAppAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ position: "absolute" }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
          {label ?? `${Math.round(clamped)}%`}
        </Text>
      </View>
    </View>
  );
}

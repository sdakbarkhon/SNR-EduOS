/**
 * Фон экрана liquid-glass: тёмный градиент (168°) + 3 радиальных glow-пятна.
 * Рендерится absoluteFill ПОЗАДИ контента; стеклянные карточки (GlassCard)
 * блюрят именно этот слой. Радиальные градиенты — через react-native-svg
 * (expo-linear-gradient умеет только линейные).
 */
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { gradients, glowBlobs, palette } from "./theme";

function parseRgba(s: string): { rgb: string; alpha: number } {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return { rgb: s, alpha: 1 };
  const parts = m[1].split(",").map((x) => x.trim());
  const [r, g, b, a = "1"] = parts;
  return { rgb: `rgb(${r},${g},${b})`, alpha: Number(a) };
}

export function ScreenBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={gradients.screenBg}
        locations={gradients.screenBgLocations}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {glowBlobs.map((b, i) => {
        const { rgb, alpha } = parseRgba(b.color);
        const pos = b as { top?: number; left?: number; right?: number; bottom?: number };
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              width: b.size,
              height: b.size,
              top: pos.top,
              left: pos.left,
              right: pos.right,
              bottom: pos.bottom,
            }}
          >
            <Svg width={b.size} height={b.size}>
              <Defs>
                <RadialGradient id={`glow${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={rgb} stopOpacity={alpha} />
                  <Stop offset="0.7" stopColor={rgb} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width={b.size} height={b.size} fill={`url(#glow${i})`} />
            </Svg>
          </View>
        );
      })}
    </View>
  );
}

/** Обёртка целого экрана: сплошной тёмный фон + ScreenBackground + safe-area
 *  контент сверху. Экраны кладут своё содержимое как children. */
export function ScreenContainer({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <ScreenBackground />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgSolid },
});

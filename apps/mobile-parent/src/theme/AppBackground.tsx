/**
 * Фон страницы v2 — перенос 1:1 из макета (строки 212–216):
 * линейный градиент bg-page (светлая 165°, тёмная 168°) + радиальные блобы
 * radial-gradient(closest-side, цвет, transparent 70%): светлая — 4 блоба,
 * тёмная — 3 (четвёртый убран CSS-оверрайдом тёмной темы).
 * Оборачивает контент каждого экрана.
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "./ThemeContext";
import { gradPoints, type BlobToken } from "./tokens";

/** rgba(r,g,b,a) → { hex, alpha } для стопов SVG-градиента. */
function splitRgba(color: string): { rgb: string; alpha: number } {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return { rgb: color, alpha: 1 };
  const parts = m[1].split(",").map((p) => p.trim());
  const [r, g, b] = parts;
  const alpha = parts.length > 3 ? parseFloat(parts[3]) : 1;
  return { rgb: `rgb(${r},${g},${b})`, alpha };
}

function Blob({ blob, index }: { blob: BlobToken; index: number }) {
  const { rgb, alpha } = splitRgba(blob.color);
  const half = blob.size / 2;
  return (
    <Svg
      pointerEvents="none"
      width={blob.size}
      height={blob.size}
      style={{
        position: "absolute",
        top: blob.top,
        bottom: blob.bottom,
        left: blob.left,
        right: blob.right,
      }}
    >
      <Defs>
        <RadialGradient id={`snr-blob-${index}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={rgb} stopOpacity={alpha} />
          <Stop offset="0.7" stopColor={rgb} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={half} cy={half} r={half} fill={`url(#snr-blob-${index})`} />
    </Svg>
  );
}

export function AppBackground({ children }: { children?: ReactNode }) {
  const { tokens } = useTheme();
  const { start, end } = gradPoints(tokens.bgPage.angle);
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={tokens.bgPage.colors as [string, string, ...string[]]}
        locations={tokens.bgPage.locations as [number, number, ...number[]] | undefined}
        start={start}
        end={end}
        style={StyleSheet.absoluteFill}
      />
      {tokens.blobs.map((blob, i) => (
        <Blob key={`${tokens.scheme}-${i}`} blob={blob} index={i} />
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
});

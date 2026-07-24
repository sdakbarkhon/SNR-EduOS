/**
 * Баррель графиков v2 (Заход 3, react-native-svg 15.15.4).
 * Здесь сведены три группы:
 *   • Кривые и полигоны — Gauge / Radar / Sparkline / ProgressBar.
 *   • Кольца и donuts — Ring / RingSegmented / MiniRing.
 *   • Календарь и таймлайны — AttendanceHeatmap (+легенда) / TimelineHorizontal /
 *     TimelineVertical.
 * Экраны импортируют графики ТОЛЬКО отсюда — либо через ре-экспорт из
 * `../ui` (см. `src/ui/index.ts`, секция «Графики»). Данные передаются
 * через props (presentational), тема — только через `useTheme()`.
 */

// ─── Кривые и полигоны ───────────────────────────────────────────────────────
export { Gauge, type GaugeProps } from "./Gauge";
export { Radar, type RadarProps } from "./Radar";
export { Sparkline, type SparklineProps } from "./Sparkline";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";

// ─── Кольца и donuts ─────────────────────────────────────────────────────────
export { Ring, type RingProps } from "./Ring";
export {
  RingSegmented,
  type RingSegmentedProps,
  type RingSegment,
} from "./RingSegmented";
export { MiniRing, type MiniRingProps } from "./MiniRing";

// ─── Календарь и таймлайны ───────────────────────────────────────────────────
export {
  AttendanceHeatmap,
  AttendanceHeatmapLegend,
  ATTENDANCE_LEGEND_FAMILIES,
  type AttendanceHeatmapProps,
  type AttendanceHeatmapLegendProps,
  type AttendanceLegendFamily,
} from "./AttendanceHeatmap";
export {
  TimelineHorizontal,
  type TimelineHorizontalProps,
  type TimelineHorizontalStep,
  type TimelineStepState,
} from "./TimelineHorizontal";
export {
  TimelineVertical,
  type TimelineVerticalProps,
  type TimelineVerticalStop,
  type TimelineStopState,
} from "./TimelineVertical";

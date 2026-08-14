/**
 * Баррель UI-кита v2 (библиотека компонентов макета «SNR EduOS v2 Light.dc.html»).
 * Собран интеграционным агентом после групп A (поверхности), B (контролы),
 * C (строки) + хром (таб-бар и шапки). Экраны импортируют ТОЛЬКО отсюда:
 * `import { GlassCard, StatusChip, ... } from "../ui";`
 */

// ─── Инфраструктура стекла (группа A) ────────────────────────────────────────
export {
  glassConfig,
  glassSurface,
  cssBlurToIntensity,
  boostAlpha,
  GlassBlur,
  type GlassSurface,
  type GlassBlurProps,
} from "./glass";

// ─── Поверхности (группа A) ──────────────────────────────────────────────────
export { GlassCard, type GlassCardProps } from "./GlassCard";
export { AccentCard, AccentInset, type AccentCardProps, type AccentInsetProps } from "./AccentCard";
export { Popover, type PopoverProps } from "./Popover";
export { BottomSheetFrame, type BottomSheetFrameProps } from "./BottomSheetFrame";
export { CenterModalFrame, type CenterModalFrameProps } from "./CenterModalFrame";
// ЗАХОД 5x (правка 3): DemoBannerGlass снят целиком — заменён на one-shot
// центр-модалку DemoNoticeModal (см. RootNavigator).
export { DemoNoticeModal, type DemoNoticeModalProps } from "./DemoNoticeModal";

// ─── Контролы (группа B) ─────────────────────────────────────────────────────
export { StatusChip, type StatusChipProps, type StatusFamily } from "./StatusChip";
export { PrimaryButton, type PrimaryButtonProps } from "./PrimaryButton";
export { SegmentPills, type SegmentPillsProps } from "./SegmentPills";
export { Toggle, type ToggleProps } from "./Toggle";
export { CountBadge, type CountBadgeProps } from "./CountBadge";
export { SectionHeader, type SectionHeaderProps } from "./SectionHeader";
export {
  QuickActionTile,
  QuickActionsGrid,
  type QuickActionTileProps,
  type QuickActionsGridProps,
} from "./QuickActionTile";
export { SubjectTile, type SubjectTileProps, type SubjectId } from "./SubjectTile";

// ─── Строки и составные (группа C) ───────────────────────────────────────────
export { Avatar, type AvatarProps } from "./Avatar";
export {
  ChildSwitcherCard,
  type ChildSwitcherCardProps,
  type ChildSwitcherStatus,
} from "./ChildSwitcherCard";
export {
  ChildPickerSheetContent,
  type ChildPickerSheetContentProps,
  type ChildPickerItem,
} from "./ChildPickerSheetContent";
export { ListRow, type ListRowProps } from "./ListRow";
export { LessonRow, type LessonRowProps } from "./LessonRow";
export { MetricsSplitRow, type MetricsSplitRowProps, type MetricCell } from "./MetricsSplitRow";
export { ChatBubble, type ChatBubbleProps } from "./ChatBubble";
export { StarRating, type StarRatingProps } from "./StarRating";

// ─── Хром (интеграция): таб-бар и шапки ──────────────────────────────────────
export { FloatingTabBar, type FloatingTabBarProps, type FloatingTabItem } from "./FloatingTabBar";
export { RootHeader, GlassCircleButton, type RootHeaderProps } from "./RootHeader";
export { InnerHeader, type InnerHeaderProps } from "./InnerHeader";
// ЗАХОД 5x (правка 4A): единый bottom-inset под FloatingTabBar для всех
// таб-экранов (замена хардкода paddingBottom: 118 в HomeScreen и др.).
export {
  TabScreenScroll,
  useTabBarBottomInset,
  FLOATING_TAB_BAR_HEIGHT,
  type TabScreenScrollProps,
} from "./TabScreenScroll";

// ─── Состояния экрана на настоящих данных (заход 2 переноса) ─────────────────
export { LoadingBlock, ErrorBlock, EmptyBlock } from "./DataStates";

// ─── Графики (Заход 3, react-native-svg) ─────────────────────────────────────
export * from "./charts";

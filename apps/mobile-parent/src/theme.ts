/** Промт МОБ-1 — токены дизайна, извлечены из прототипа Claude Design
 *  "SNR EduOS Parent App" (SNR EduOS.dc.html). Локально для mobile-parent —
 *  @snr/ui-tokens не используется здесь намеренно: там другая (более старая)
 *  палитра, использовать её значило бы разойтись с прототипом, который
 *  явно требуется повторить максимально точно. */
export const colors = {
  bg: "#EDEFF8",
  bgAlt: "#F7F8FC",
  card: "#ffffff",
  textPrimary: "#1A1D2E",
  textSecondary: "#8A90A6",
  textMuted: "#9CA1B5",
  textFaint: "#B7BBCC",
  border: "#F2F3F9",
  borderAlt: "#E9E2FF",
  primary: "#6D4EE6",
  primaryLight: "#9B7EF7",
  accentOrange: "#FF9F43",
  accentCoral: "#FF6B7A",
  success: "#17A567",
  successBg: "#E2F7EC",
  danger: "#F0446A",
  dangerBg: "#FFE9EE",
  warning: "#D98E1B",
  warningBg: "#FFE9C0",
  star: "#FFB43A",
  chipBg: "#F2F3F9",
  skeletonBase: "#ECEEF6",
  skeletonHighlight: "#F6F7FB",
} as const;

export const gradients = {
  brand: [colors.accentOrange, colors.accentCoral, colors.primary] as const,
  primary: [colors.primary, colors.primaryLight] as const,
  coral: [colors.accentCoral, "#FF9F6E"] as const,
  soft: ["#EFEAFF", "#E0F0FF"] as const,
  softGreen: ["#E9F9F1", "#E0F7FC"] as const,
  // Промт МОБ-3 — hero-карточки детальных экранов из прототипа.
  warmCard: [colors.accentCoral, "#FF8E63", "#FFB03A"] as const, // #10 средний балл
  tealCard: ["#00B8D9", "#00CBB8", "#3ED598"] as const, // #11/#16 успеваемость/индекс развития
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const shadow = {
  card: {
    shadowColor: "#2D286E",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  soft: {
    shadowColor: "#23285A",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
} as const;

export const statusStyles: Record<string, { bg: string; color: string; labelKey: string }> = {
  present: { bg: colors.successBg, color: colors.success, labelKey: "present" },
  absent_excused: { bg: colors.warningBg, color: colors.warning, labelKey: "absentExcused" },
  absent_unexcused: { bg: colors.dangerBg, color: colors.danger, labelKey: "absentUnexcused" },
};

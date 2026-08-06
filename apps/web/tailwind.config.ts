import type { Config } from "tailwindcss";
import { brand, colors, radii, shadows } from "@snr/ui-tokens";

// Тема Tailwind питается из общих дизайн-токенов (@snr/ui-tokens) — один источник.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "../../packages/core/src/**/*.{ts,tsx}",
    "../../packages/ui-tokens/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        "bg-app": colors.bgApp,
        "bg-card": colors.bgCard,
        "text-primary": colors.textPrimary,
        "text-muted": colors.textMuted,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        info: colors.info,
        "brand-blue": brand.blue,
        "brand-blue-hover": brand.blueHover,
        "brand-yellow": brand.yellow,
        "brand-navy": brand.navy,
        "brand-field": brand.fieldBg,
        "brand-ink": brand.ink,
        "brand-ink-muted": brand.inkMuted,
        "brand-logo-accent": brand.logoAccent,
        "brand-logo-from": brand.logoFrom,
        "brand-logo-to": brand.logoTo,
      },
      borderRadius: {
        card: `${radii.card}px`,
        chip: `${radii.chip}px`,
      },
      boxShadow: {
        card: shadows.card,
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        marquee: {
          "0%":   { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        },
        // K.4 — SNR-плитки вариантов ответа теста (QuizChoiceTile).
        "tile-pop": {
          "0%":   { transform: "scale(1)" },
          "50%":  { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)" },
        },
        "tile-shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "25%":      { transform: "translateX(-4px)" },
          "75%":      { transform: "translateX(4px)" },
        },
      },
      animation: {
        marquee: "marquee 18s linear forwards",
        "tile-pop": "tile-pop 300ms ease-in-out",
        "tile-shake": "tile-shake 200ms ease-in-out",
      },
    },
  },
  darkMode: "class",
  plugins: [require("@tailwindcss/typography")],
};

export default config;

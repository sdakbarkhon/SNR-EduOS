---
name: Luminous Glass Learning
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#943700'
  on-tertiary: '#ffffff'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system focuses on a light, airy, and optimistic atmosphere tailored for a modern EdTech ecosystem. The platform aims to reduce cognitive load by utilizing a "Glassmorphism" aesthetic—creating a sense of depth and focus through translucency. 

The visual narrative is built on the metaphor of "Clarity through Focus," where interactive elements emerge from a luminous, ethereal background. The interface feels friendly and approachable, utilizing soft shadows and high-quality blurs to maintain a professional yet inviting presence for students and educators alike.

## Colors
The palette is dominated by a vibrant **Vibrant Blue** used for primary actions and brand presence. This is supported by a luminous background gradient that blends soft lavender and light blue tones to prevent visual fatigue.

- **Primary:** Vibrant Blue (#2563eb) for CTA buttons, active states, and progress indicators.
- **Surface:** A semi-transparent White (#FFFFFF at 70% opacity) serves as the base for all glass panels.
- **Accents:** Use soft lavender and indigo gradients for secondary highlights or sidebar backgrounds to maintain the "airy" feel.
- **Feedback:** Success (Emerald), Warning (Amber), and Error (Rose) colors should be applied with high saturation but low opacity backgrounds to match the glass style.

## Typography
This design system utilizes **Inter** exclusively to ensure maximum legibility and a clean, systematic feel across both Latin and Cyrillic scripts. 

Hierarchy is established through weight and color rather than excessive size variations. Headlines should use a tighter letter-spacing and heavier weight to appear grounded against the soft glass backgrounds. For Russian text, ensure line heights are slightly increased (approx 1.6x) for body text to maintain readability of complex character structures.

## Layout & Spacing
The layout follows a **Fluid Grid** model with generous white space to emphasize the "Airy" brand personality. 

- **Desktop:** 12-column grid with 24px gutters. Max content width of 1440px.
- **Tablet:** 8-column grid with 20px gutters.
- **Mobile:** 4-column grid with 16px margins.

Spacing follows an 8px scale. Padding within glass cards should be consistent at `24px` (md) to ensure content doesn't feel cramped against the rounded corners. Use "safe areas" for floating glass navigation bars, ensuring they sit at least 16px away from the screen edges.

## Elevation & Depth
Depth is created through the interplay of translucency, blur, and light borders rather than heavy shadows.

- **Surface Level:** 70% white opacity with `backdrop-blur: 24px`.
- **Borders:** Every glass element must feature a `1px` solid white border at `30%` opacity to simulate a "specular highlight" on the edge of the glass.
- **Shadows:** Use extremely soft, large-radius shadows (e.g., `0 8px 32px rgba(0, 0, 0, 0.05)`) to lift cards off the background.
- **Z-Index Layers:** 
    1. Background Gradients (Base)
    2. Main Content Panels (Glass)
    3. Overlays/Modals (Higher blur, slightly higher opacity)
    4. Tooltips/Popovers (Solid or high-contrast glass)

## Shapes
The shape language is friendly and organic. Standard containers use a radius of **16px**, while larger dashboard cards or main containers scale up to **24px**. 

- **Small elements (Buttons, Inputs):** 12px - 16px radius.
- **Medium elements (Cards, Modals):** 20px radius.
- **Interactive Pill-shapes:** Use full rounding (capsule) for tags, chips, and search bars to contrast against the rectangular grid.

## Components

### Buttons
- **Primary:** Solid Vibrant Blue (#2563eb) with white text. Subtle 4px bottom shadow of the same color.
- **Glass/Ghost:** 70% White surface with 1px white border. Primary Blue text.
- **Active State:** On hover, primary buttons should use a slight gradient shift (Indigo to Blue).

### Cards
- **Construction:** Glassmorphism base (`bg-white/70`, `backdrop-blur-xl`).
- **Header:** Integrated headline with subtle 1px divider at 10% opacity.
- **Hover:** Cards should "lift" slightly (Y-axis -4px) and shadow opacity should increase.

### Input Fields
- **Style:** Semi-transparent white background (lighter than cards, ~40% opacity).
- **Focus State:** 2px solid Vibrant Blue border with a soft blue outer glow.
- **Labels:** Always placed above the field in `label-md` style.

### Sidebars & Navigation
- **Background:** Vertical gradient of Vibrant Blue to Indigo for the active sidebar or a deep glass panel.
- **Nav Items:** High-contrast white text for active states; 60% white for inactive.

### Chips & Tags
- **Style:** Pill-shaped, semi-transparent backgrounds with a subtle border. For AI-generated content (as seen in reference), use a light blue tint with a small icon prefix.
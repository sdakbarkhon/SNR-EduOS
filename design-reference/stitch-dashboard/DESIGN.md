---
name: Soft Academic Neomorphism
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#464554'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#494bd6'
  primary: '#4648d4'
  on-primary: '#ffffff'
  primary-container: '#6063ee'
  on-primary-container: '#fffbff'
  inverse-primary: '#c0c1ff'
  secondary: '#9d4300'
  on-secondary: '#ffffff'
  secondary-container: '#fd761a'
  on-secondary-container: '#5c2400'
  tertiary: '#006c49'
  on-tertiary: '#ffffff'
  tertiary-container: '#00885d'
  on-tertiary-container: '#000703'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  headline-md-mobile:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 24px
  gutter: 20px
  card-gap: 16px
  margin-page: 32px
---

## Brand & Style

This design system is engineered for educational environments, specifically targeting K-12 students through an approachable, playful, and high-trust interface. The brand personality is encouraging and gamified, utilizing friendly mascots and reward-based UI cues to drive engagement.

The aesthetic blends **Soft Minimalism** with **Neomorphism**. It moves away from the stark, flat surfaces of traditional SaaS and instead embraces tactile depth. By using multi-layered soft shadows, frosted glass components, and generous roundedness, the UI feels physical and "squishy," making it more engaging and less intimidating for younger users. The emotional response is one of safety, optimism, and clarity.

## Colors

The palette is rooted in a "Soft Pastel" logic where functional colors are paired with their ultra-desaturated, high-luminance counterparts for backgrounds. 

- **Primary (Indigo/Purple):** Used for core branding and high-priority actions.
- **Secondary (Orange):** Highlights progress, achievements, and gamification elements like "Fire" streaks.
- **Tertiary (Green/Blue):** Used for specific subject categorization (e.g., Math vs. Science) and success states.
- **Surface & Background:** The system uses a near-white neutral (`#F8FAFC`) as the base, while specific card containers use vibrant pastel gradients to differentiate content blocks without the harshness of high-saturation fills.

## Typography

The design system utilizes **Inter** for its exceptional legibility and neutral character, allowing the colorful UI elements to take center stage. 

Typography follows a strict hierarchy where headlines are consistently semi-bold or bold to provide clear landmarks in a content-heavy dashboard. Body text remains airy with generous line heights to accommodate younger readers. Label styles are used for metadata like "Room 305" or "10:00 AM," often paired with reduced opacity (60-70%) to create a secondary visual tier.

## Layout & Spacing

The layout utilizes a **Fluid Grid** model with high-density grouping but low-density overall feel. This is achieved through generous whitespace between major sections (32px+) while keeping related interactive elements tightly grouped (8-16px).

- **Desktop:** A three-column structure. A narrow left navigation bar (approx 200px), a wide central "Workspace" area, and a right-hand "Sidebar" for scheduling and achievements.
- **Tablet:** The right sidebar collapses into a bottom sheet or a hidden drawer, prioritizing the central workspace.
- **Mobile:** Single column flow. The navigation moves to a bottom bar.
- **Rhythm:** An 8px linear scale is strictly followed for all padding, margins, and component sizing to maintain mathematical harmony.

## Elevation & Depth

This system avoids traditional "drop shadows" in favor of **Neomorphic Depth**. 

- **Level 0 (Base):** Light grey background.
- **Level 1 (Cards):** White surfaces with subtle, large-radius shadows (Blur 20-30px, Opacity 4-8%) to suggest they are floating just above the surface.
- **Level 2 (Active/Floating):** Use of Backdrop Blurs (Glassmorphism) for overlays and navigation elements to maintain context of the layer beneath.
- **Gradients:** Linear gradients (Top-Left to Bottom-Right) are used on primary cards to create a sense of light source coming from the upper left, reinforcing the 3D feel.

## Shapes

The shape language is "Extra-Rounded." There are no sharp corners in this design system. 

The standard radius for interface cards is **24px (2xl)** or **32px (3xl)**, creating a friendly, organic aesthetic. Smaller components like buttons or input fields use a consistent **12-16px** radius. This high degree of rounding is essential to the soft-neomorphic style, as it mimics the look of molded plastic or soft materials rather than rigid digital boxes.

## Components

- **Buttons:** Primary buttons use vibrant gradients with rounded-pill shapes. They should have a subtle inner glow or top-edge highlight to appear tactile.
- **Chips & Badges:** Used for notifications and status (e.g., "Now," "New"). These use high-contrast fills with white text, or pastel backgrounds with saturated text.
- **Navigation Rail:** Left-aligned icons with vertical text labels. Active states should be indicated by a soft pastel background pill behind the icon.
- **Input Fields:** Search bars should be pill-shaped with a soft inner shadow (inset) to appear recessed into the surface.
- **Cards:** The most common element. Each card should have a white background, 3xl corner radius, and a thin 1px border that is only slightly darker than the surface background to define the edge.
- **Progress Indicators:** Circular and bar progress components use thick strokes (8px+) and rounded caps, utilizing the primary and secondary colors.
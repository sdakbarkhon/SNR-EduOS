---
name: Luminous Immersive EdTech
colors:
  surface: '#faf8ff'
  surface-dim: '#dad9e1'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3fa'
  surface-container: '#eeedf4'
  surface-container-high: '#e9e7ef'
  surface-container-highest: '#e3e1e9'
  on-surface: '#1a1b21'
  on-surface-variant: '#444651'
  inverse-surface: '#2f3036'
  inverse-on-surface: '#f1f0f7'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#712ae2'
  on-secondary: '#ffffff'
  secondary-container: '#8a4cfc'
  on-secondary-container: '#fffbff'
  tertiary: '#4b1c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e2c00'
  on-tertiary-container: '#f39461'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#773205'
  background: '#faf8ff'
  on-background: '#1a1b21'
  surface-variant: '#e3e1e9'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 42px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system is engineered to evoke a sense of "Immersive Intellectual Flow." It targets high-achieving students and modern educators who seek a workspace that feels both professionally structured and creatively inspiring. The visual DNA is defined by **Glassmorphism** and **Atmospheric Depth**, utilizing luminous gradients and noise-textured overlays to create a tactile, premium feel.

The style avoids flat, clinical interfaces in favor of a "Luminous Layers" approach. UI elements appear to float over an airy, expansive background, using translucency to maintain a sense of context and focus. The emotional response is one of clarity, momentum, and high-energy productivity.

## Colors
This design system utilizes a high-impact palette centered on deep spectral transitions.

- **Primary & Secondary Gradient:** A core transition from Deep Blue (#1E3A8A) to Bright Purple (#7C3AED). This is reserved for high-impact surfaces like hero cards and progress dashboards.
- **Accents (CTAs):** Vibrant Cyan (#06B6D4) and Bright Pink (#EC4899) are used exclusively for primary actions and critical interactive states to ensure maximum contrast against glass surfaces.
- **Background Ecosystem:** A luminous, airy gradient blending Pale Light Blue, Soft Lavender, and Pure White. This background should feel expansive and "infinite."
- **Functional Grays:** Use slate-based neutrals (Slate-50 to Slate-900) for text and subtle borders to maintain professional legibility.

## Typography
The system relies on **Inter** for its systematic clarity and modern geometric construction. 

- **Headlines:** Use tighter letter-spacing and heavier weights (Bold/ExtraBold) to create a strong visual anchor against the soft glass backgrounds.
- **Body Text:** Maintain generous line heights (1.5x) to ensure readability during long study sessions.
- **Labels:** Small labels use increased letter spacing and semi-bold weights to remain legible when placed over translucent glass or vibrant gradients.
- **Mobile Scaling:** Display sizes drop by approximately 25% on mobile to maintain hierarchy without overwhelming the viewport.

## Layout & Spacing
The layout philosophy is based on a **Fluid-Fixed Hybrid**. Content is housed within a central 12-column grid container (max 1280px), but the background gradients and glass "takeover" panels bleed to the edges of the viewport to maintain an immersive feel.

- **Rhythm:** An 8px base grid governs all padding and margins. 
- **Desktop:** Large 64px side margins provide breathing room, reinforcing the "airy" brand pillar.
- **Mobile:** Margins compress to 20px, and the 12-column grid collapses to a single-column stack. 
- **Sectioning:** Vertical spacing is intentionally generous (48px - 80px between sections) to avoid visual clutter and reduce cognitive load for learners.

## Elevation & Depth
Depth is the primary communicator of hierarchy in this design system. It is achieved through three specific techniques:

1.  **Glassmorphism Surfaces:** Containers use a 70% opacity white tint with a high-intensity backdrop-blur (20px-40px). This creates a sense of physical weight and premium quality.
2.  **Luminous Glows:** Instead of traditional black shadows, elevated elements use "Primary Glows"—soft, diffused shadows tinted with the primary blue or purple, at low (10-15%) opacity.
3.  **Texture:** A subtle 2% grain/noise overlay is applied to glass surfaces to prevent them from looking overly "digital" and to add a tactile, paper-like sophistication.
4.  **Z-Axis:** 
    - Base: Background gradients.
    - Level 1: Standard glass cards (No shadow, 1px white border at 20% opacity).
    - Level 2: Interactive elements (Soft color-tinted shadow).
    - Level 3: Modals and Pop-overs (Heavy blur, 1px white border, dark-tinted ambient shadow).

## Shapes
The shape language is extremely soft and approachable, using large radii to contrast with the technical nature of educational content.

- **Standard Containers:** Use a 24px radius (`rounded-lg`).
- **Feature/Hero Cards:** Use a 32px radius (`rounded-xl`) to emphasize their importance.
- **Interactive Elements:** Buttons and input fields follow a pill-shaped philosophy or high-radius (16px+) construction to maintain the "squishy," modern aesthetic.
- **Circular Elements:** Progress indicators and profile avatars are always perfect circles to provide geometric variety against the rectangular grid.

## Components
Consistent implementation of the following components ensures a unified immersive experience:

- **Buttons:** Primary CTAs use a solid gradient (Cyan to Blue) or (Pink to Purple) with a white label. They should have a subtle inner glow on the top edge. 
- **Glass Cards:** 70% white tint background, 1px semi-transparent white stroke, and 32px corner radius. Noise texture is mandatory for cards larger than 200px.
- **Progress Rings:** Use elegant, thin-stroke (4px-6px) circular rings. The background track should be a 10% opacity version of the accent color, with the active track using a vibrant gradient.
- **Input Fields:** Semi-transparent glass fills with a 1px bottom border that "lights up" with a Cyan or Pink glow when focused.
- **Chips/Badges:** Small, pill-shaped glass elements with high-contrast text. For status (e.g., "Completed"), use a solid vibrant fill with white text.
- **Lists:** Items are separated by subtle 1px horizontal lines (10% opacity slate) rather than boxes, unless the list item is interactive, in which case it should lift into a glass card on hover.
- **Full-Screen Takeovers:** When transitioning to a new module, use a sweeping gradient transition that occupies 100% of the viewport, with content fading in over the "luminous" background.
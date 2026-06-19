---
name: Luminous Learning
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
  on-surface-variant: '#414755'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005bc1'
  primary: '#0058bc'
  on-primary: '#ffffff'
  primary-container: '#0070eb'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#006577'
  on-tertiary: '#ffffff'
  tertiary-container: '#008096'
  on-tertiary-container: '#f9fdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
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
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  unit-xs: 4px
  unit-sm: 8px
  unit-md: 16px
  unit-lg: 24px
  unit-xl: 48px
---

## Brand & Style
The design system centers on a "Liquid Glass" aesthetic, engineered for a modern EdTech environment that feels luminous, breathable, and intellectually stimulating. The interface prioritizes clarity and depth, utilizing multi-layered translucency to guide student focus.

The visual DNA combines **Modernism** with **Glassmorphism**. Surfaces are treated as physical panes of frosted glass that catch and refract the vibrant gradients of the background. This approach creates an optimistic and high-tech atmosphere, suitable for an advanced educational operating system. The emotional response is one of clarity, progress, and digital sophistication.

## Colors
The palette is rooted in a **Vibrant Blue** primary for core actions and a **Vibrant Purple** accent for progression and creative highlights. 

The background strategy is essential for the Glassmorphism effect: use soft, large-scale gradients of Lavender and Cyan to provide color depth that "shines through" the translucent UI panes. 

**Functional Colors:**
- **Success/Complete:** Emerald Green for achievement milestones.
- **Active:** Bright Blue for current tasks and navigation states.
- **Upcoming:** Neutral Light Gray for future curriculum items to reduce cognitive load.

## Typography
The typography system uses **Inter** exclusively to maintain a systematic, utilitarian, and highly legible interface for the Russian language. 

Headlines use tighter letter spacing and bold weights to ground the airy glass layouts. Body text is set with generous line heights to ensure long-form educational content is comfortable to read. Labels use medium weights to differentiate from body text within dense dashboard views. All Cyrillic characters must be rendered with standard tracking; avoid condensed widths for educational content.

## Layout & Spacing
The design system employs a **Fluid Grid** model with high-density margins to allow the background gradients to frame the content. 

- **Desktop:** 12-column grid with 24px gutters. Content is housed in large glass containers with 40px internal padding.
- **Mobile:** 4-column grid. Glass containers should span full width with 16px side margins to maximize screen real estate.

Spacing is based on an 8px linear scale. Use `unit-xl` (48px) to separate major content sections and `unit-md` (16px) for internal component grouping.

## Elevation & Depth
Depth is achieved through the "Liquid Glass" stack rather than traditional shadow-based elevation.

1.  **Base Layer:** Soft Lavender/Cyan mesh gradients.
2.  **Surface Layer:** `bg-white/70` (70% opacity) with `backdrop-blur-xl`.
3.  **Detail Layer:** A 1px solid white inner border (stroke) at 50% opacity to simulate the edge of a glass pane.
4.  **Shadow Layer:** A very soft, diffused drop shadow (`color: rgba(0,0,0,0.04)`, `blur: 20px`, `y: 10px`) to lift the pane slightly off the background.

Interactive elements (hover states) should increase the opacity to `bg-white/90` and intensify the backdrop blur.

## Shapes
The shape language is friendly and modern. Main dashboard containers and large cards use a **24px radius** (`rounded-xl` in this system) to emphasize the soft, organic "liquid" nature of the brand.

Smaller UI elements like buttons and input fields follow the `rounded-lg` (16px) standard. Circular shapes are reserved strictly for avatars and icon backgrounds.

## Components
- **Buttons:** Primary buttons use the Vibrant Blue solid fill with white text. Secondary buttons use a glass-style background with a 1px white border and Blue text.
- **Glass Cards:** The primary vessel for content. Must include the `backdrop-blur-xl` and 1px white inner border. 
- **Input Fields:** Semi-transparent white fills (40% opacity) with a 1px border that turns Vibrant Blue on focus. Labels sit above the field in `label-md` styling.
- **Progress Chips:** Small, highly rounded capsules. Completed states use Green text with 10% Green background tint; Upcoming states use Gray.
- **Lists:** Clean rows separated by low-opacity (10%) neutral lines. Avoid heavy dividers to keep the "glass" look seamless.
- **Dashboard Widgets:** Use the 24px corner radius. Title headers within widgets should use `headline-md`.
---
version: alpha
name: Citadel Workplace Connect
description: Enterprise service desk portal — navy/steel palette, Plus Jakarta Sans typeface, per-desk accent coloring for IT/HR/Finance workflows.
colors:
  primary: "#1D2D5E"
  secondary: "#44546f"
  tertiary: "#0052cc"
  neutral: "#F8FAFC"
  danger: "#dc2626"
  success: "#059669"
  warning: "#d97706"
  info: "#0052cc"
  on-primary: "#FFFFFF"
  on-tertiary: "#FFFFFF"
  surface: "#FFFFFF"
  surface-subtle: "#F8FAFC"
  surface-muted: "#F3F4F6"
  border: "#E5E7EB"
  border-subtle: "#F3F4F6"
  text-primary: "#111827"
  text-secondary: "#44546f"
  text-tertiary: "#9CA3AF"
  brand-900: "#13214A"
  brand-700: "#1D2D5E"
  brand-500: "#4A8DB8"
  brand-300: "#5BBFE8"
  brand-100: "#D0E8F5"
  brand-50: "#EAF5FC"
  it-500: "#0052CC"
  it-100: "#DEEBFF"
  it-50: "#EFF6FF"
  hr-500: "#059669"
  hr-100: "#D1FAE5"
  hr-50: "#ECFDF5"
  fin-500: "#D97706"
  fin-100: "#FDE68A"
  fin-50: "#FFFBE0"
typography:
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.25
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: 700
    lineHeight: 1.3
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.9375rem
    lineHeight: 1.6
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.8125rem
    lineHeight: 1.5
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.6875rem
    fontWeight: 700
    letterSpacing: "0.08em"
  code:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    lineHeight: 1.5
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
elevation:
  sm: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)"
  md: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)"
  lg: "0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)"
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: 12px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 24px
  badge:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    padding: 4px
  badge-success:
    backgroundColor: "{colors.hr-100}"
    textColor: "#065F46"
    rounded: "{rounded.full}"
  badge-warning:
    backgroundColor: "#FEF3C7"
    textColor: "#92400E"
    rounded: "{rounded.full}"
  badge-danger:
    backgroundColor: "#FEE2E2"
    textColor: "#991B1B"
    rounded: "{rounded.full}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: 12px
  input-focus:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    padding: 12px
  nav-link:
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
  nav-link-active:
    textColor: "{colors.tertiary}"
---

## Overview

Citadel Workplace Connect (CWC 2.0) is an internal enterprise service desk covering IT Support, HR Services, and Group Finance. The visual identity draws from Citadel Group Technologies' navy/steel palette, using Per-Desk accent colors (IT blue, HR green, Finance amber) to provide contextual wayfinding. The typeface is Plus Jakarta Sans — geometric, modern, high x-height for corporate readability. The system targets 1,000+ employee scale with multi-role workflows (Employee, Approver, Agent, Admin).

## Colors

- **Primary (#1D2D5E):** Deep Citadel navy. Headers, hero backgrounds, high-emphasis surfaces. Conveys institutional trust.
- **Tertiary (#0052CC):** Action blue. Primary CTA buttons, active nav, links. Shared with IT desk accent — intentional double-duty.
- **HR Green (#059669):** HR desk accent, also doubles as the semantic "success" color.
- **Finance Amber (#D97706):** Finance desk accent, doubles as "warning" semantic.
- **Danger (#DC2626):** Errors, rejections, destructive actions only.
- **Surface (#FFFFFF) / Surface Subtle (#F8FAFC):** Layer backgrounds. Page bg is subtle, cards are surface-white.

## Typography

Plus Jakarta Sans for all UI text. JetBrains Mono for code/logs. Eight type sizes from 11px to 36px via CSS custom properties. Weight carries hierarchy (700–900 for headings, 600 for labels, 400 for body). Tight letter-spacing on display sizes (`-0.02em` on h1).

## Layout

1440px max-width container with responsive `px-6` gutters. 4px spacing baseline via `--space-*` tokens. Cards use 24px padding. Admin uses sticky 224px sidebar + content flow.

## Elevation & Depth

Three shadow levels (sm, md, lg). Cards default to shadow-sm with border. Modals at shadow-lg. Navy hero sections use `backdrop-blur-md` on glass overlays.

## Shapes

Consistent rounded corners: `6px` on inputs/badges, `10px` on buttons/cards, `16px` on large surfaces, `9999px` for pills/avatars.

## Components

- `button-primary` uses Citadel blue (#0052CC) with white text. Hover darkens to navy.
- `card` is the default content surface — white bg, 16px radius, 24px padding.
- Status badges map each RequestStatus to a Tailwind color pair (7+ distinct palettes). This is the primary status signal.
- SLAIndicator uses color-coded bands: green (safe), blue (paused), orange (warning), red (breached).

## Do's and Don'ts

- **Do** use per-desk accent color when content is desk-scoped (IT = blue, HR = green, FIN = amber).
- **Do** reference design tokens (`var(--color-*)`, `var(--radius-*)`) instead of raw hex in component CSS.
- **Don't** use `#0052cc` as a general accent outside of interactive contexts — it's the action color, not decorative.
- **Don't** introduce colors outside the palette. Extend tokens.css first.
- **Don't** nest component variants in the token spec. `button-primary-hover` is a sibling key.
/**
 * Tailwind v4 Theme Extension — Design Token Maps
 *
 * This file documents the mapping from CSS custom properties (tokens.css)
 * to Tailwind theme variables. The actual theme registration happens in
 * `index.css` via the `@theme` block, but this TS file serves as:
 *   1. A single source-of-truth reference for developers
 *   2. An importable config for tooling/testing that needs JS objects
 */

// ─── Colors ────────────────────────────────────────────────────────────────────

export const brand = {
  50:  "var(--color-brand-50)",
  100: "var(--color-brand-100)",
  300: "var(--color-brand-300)",
  500: "var(--color-brand-500)",
  700: "var(--color-brand-700)",
  900: "var(--color-brand-900)",
} as const;

export const it = {
  50:  "var(--color-it-50)",
  100: "var(--color-it-100)",
  500: "var(--color-it-500)",
} as const;

export const hr = {
  50:  "var(--color-hr-50)",
  100: "var(--color-hr-100)",
  500: "var(--color-hr-500)",
} as const;

export const fin = {
  50:  "var(--color-fin-50)",
  100: "var(--color-fin-100)",
  500: "var(--color-fin-500)",
} as const;

export const semantic = {
  success: "var(--color-success)",
  warning: "var(--color-warning)",
  danger:  "var(--color-danger)",
  info:    "var(--color-info)",
} as const;

export const text = {
  primary:   "var(--color-text-primary)",
  secondary: "var(--color-text-secondary)",
  tertiary:  "var(--color-text-tertiary)",
} as const;

export const surface = {
  DEFAULT: "var(--color-surface)",
  subtle:  "var(--color-surface-subtle)",
  muted:   "var(--color-surface-muted)",
} as const;

export const cwcBorder = {
  DEFAULT: "var(--color-border)",
  subtle:  "var(--color-border-subtle)",
} as const;

export const colors = {
  brand,
  it,
  hr,
  fin,
  semantic,
  text,
  surface,
  "cwc-border": cwcBorder,
} as const;

// ─── Spacing ───────────────────────────────────────────────────────────────────

export const spacing = {
  1:  "var(--space-1)",
  2:  "var(--space-2)",
  3:  "var(--space-3)",
  4:  "var(--space-4)",
  5:  "var(--space-5)",
  6:  "var(--space-6)",
  8:  "var(--space-8)",
  10: "var(--space-10)",
  12: "var(--space-12)",
  16: "var(--space-16)",
} as const;

// ─── Border Radius ────────────────────────────────────────────────────────────

export const radius = {
  sm:   "var(--radius-sm)",
  md:   "var(--radius-md)",
  lg:   "var(--radius-lg)",
  xl:   "var(--radius-xl)",
  full: "var(--radius-full)",
} as const;

// ─── Shadow ────────────────────────────────────────────────────────────────────

export const shadow = {
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
} as const;

// ─── Font Size ─────────────────────────────────────────────────────────────────

export const fontSize = {
  xs:   "var(--text-xs)",
  sm:   "var(--text-sm)",
  base: "var(--text-base)",
  lg:   "var(--text-lg)",
  xl:   "var(--text-xl)",
  "2xl": "var(--text-2xl)",
  "3xl": "var(--text-3xl)",
  "4xl": "var(--text-4xl)",
} as const;

// ─── Font Family ───────────────────────────────────────────────────────────────

export const fontFamily = {
  sans: "var(--font-sans)",
  mono: "var(--font-mono)",
} as const;

// ─── Full theme object ─────────────────────────────────────────────────────────

const themeExtend = {
  colors,
  spacing,
  borderRadius: { cwc: radius },
  boxShadow: { cwc: shadow },
  fontSize,
  fontFamily,
} as const;

export default themeExtend;
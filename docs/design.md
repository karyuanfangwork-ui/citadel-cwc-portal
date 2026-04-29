# CWC 2.0 — Design System Reference

**Product:** Citadel Workplace Connect (CWC 2.0)  
**Stack:** React 19 + TypeScript + Tailwind CSS v4 + CSS custom properties  
**Last updated:** 2026-04-28

---

## 1. Brand Identity

The visual language is **clean, professional, enterprise-grade** — a corporate service desk that communicates trust and clarity. The palette centres on a deep Citadel navy with steel-blue accents. Surfaces are near-white with very subtle grey tiers to create hierarchy without heavy borders.

---

## 2. Color Tokens

Defined in `frontend/src/styles/tokens.css` as CSS custom properties.

### Brand

| Token | Value | Usage |
|---|---|---|
| `--color-brand-900` | `#13214a` | Hero gradients (darkest) |
| `--color-brand-700` | `#1D2D5E` | Primary brand / nav accent |
| `--color-brand-500` | `#4A8DB8` | Steel blue mid-tone |
| `--color-brand-300` | `#5BBFE8` | Sky blue highlight |
| `--color-brand-100` | `#d0e8f5` | Tinted backgrounds |
| `--color-brand-50`  | `#eaf5fc` | Subtle brand wash |

### Service Desk Accents

| Domain | 500 (text/icon) | 100 (bg) | 50 (subtle bg) |
|---|---|---|---|
| IT Support | `#0052cc` | `#deebff` | `#eff6ff` |
| HR Services | `#059669` | `#d1fae5` | `#ecfdf5` |
| Group Finance | `#d97706` | `#fde68a` | `#fffbeb` |

### Semantic Status

| Token | Value |
|---|---|
| `--color-success` | `#059669` |
| `--color-warning` | `#d97706` |
| `--color-danger`  | `#dc2626` |
| `--color-info`    | `#0052cc` |

### Text

| Token | Value | Role |
|---|---|---|
| `--color-text-primary`   | `#111827` | Body copy, headings |
| `--color-text-secondary` | `#44546f` | Labels, sub-text |
| `--color-text-tertiary`  | `#9ca3af` | Placeholders, meta |

### Surface & Border

| Token | Value | Role |
|---|---|---|
| `--color-surface`        | `#ffffff` | Cards, modals |
| `--color-surface-subtle` | `#f8fafc` | Page background |
| `--color-surface-muted`  | `#f3f4f6` | Input fills, row alt |
| `--color-border`         | `#e5e7eb` | Card borders, dividers |
| `--color-border-subtle`  | `#f3f4f6` | Hairline separators |

---

## 3. Typography

Fonts loaded via Google Fonts in `frontend/index.html`.

| Role | Family | Weights |
|---|---|---|
| UI / Body (`--font-sans`) | Plus Jakarta Sans | 400 500 600 700 800 900 |
| Code / Mono (`--font-mono`) | JetBrains Mono | 500 |

### Scale

| Token | px | Usage |
|---|---|---|
| `--text-xs`  | 11px | Fine print, badges |
| `--text-sm`  | 13px | Table cells, labels |
| `--text-base`| 15px | Default body |
| `--text-lg`  | 17px | Section sub-heads |
| `--text-xl`  | 20px | Card titles |
| `--text-2xl` | 24px | Page sub-headings |
| `--text-3xl` | 30px | Page titles |
| `--text-4xl` | 36px | Hero metrics |

**Rules:**
- Headings: `font-bold` (700) or `font-semibold` (600)
- Body: `font-normal` (400) or `font-medium` (500) for emphasis
- All caps label style: `text-xs font-medium tracking-wide text-gray-500` — used in table headers and section labels

---

## 4. Spacing

4 px base grid, token-driven.

| Token | px |
|---|---|
| `--space-1`  | 4  |
| `--space-2`  | 8  |
| `--space-3`  | 12 |
| `--space-4`  | 16 |
| `--space-5`  | 20 |
| `--space-6`  | 24 |
| `--space-8`  | 32 |
| `--space-10` | 40 |
| `--space-12` | 48 |
| `--space-16` | 64 |

---

## 5. Border Radius

| Token | px | Usage |
|---|---|---|
| `--radius-sm`   | 6    | Inputs, small elements |
| `--radius-md`   | 10   | Cards, panels, buttons |
| `--radius-lg`   | 16   | Large cards, modals |
| `--radius-xl`   | 20   | Hero sections |
| `--radius-full` | 9999 | Badges, avatars, pills |

---

## 6. Shadows

Soft, low-opacity shadows — avoid heavy drop shadows.

| Token | Value |
|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)` |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04)` |

---

## 7. Layout

- **Max content width:** `1200px` (dashboards) / `1440px` (admin tables)
- **Page padding:** `px-4 sm:px-8 py-4 sm:py-8`
- **Grid system:** Tailwind CSS grid (`grid-cols-*`, `gap-4` / `gap-6`)
- **Top nav height:** 64px (`h-16`), `sticky top-0 z-50`, `bg-white/80 backdrop-blur-md`
- **Nav border:** `border-b border-[#f0f2f5]`

### Navigation Bar

- Logo: `corporate_fare` Material Symbol in `#0052cc` icon box + bold title text
- Links: `text-sm font-semibold`, active state `text-[#0052cc] border-b-2 border-[#0052cc]`, inactive `text-[#44546f] border-transparent`
- Search input: `bg-[#f0f2f5]`, borderless, `rounded-lg`, focus ring `ring-[#0052cc]/20`
- Right actions: icon buttons `bg-[#f0f2f5] rounded-lg h-10 w-10`

---

## 8. Component Patterns

### Cards

```
bg-white rounded-xl border border-gray-200 p-5
```
- No heavy shadows on flat cards — border + white surface on subtle background provides visual lift
- Metric cards: icon box `w-12 h-12 rounded-lg` + value `text-2xl font-bold text-gray-900` + label `text-sm text-gray-500`

### Hero / Banner Sections

```css
background: linear-gradient(135deg, var(--color-brand-900), var(--color-brand-700), var(--color-brand-500));
border-radius: var(--radius-xl);
```
- Decorative translucent circles (`rgba(255,255,255,0.05)`) for depth
- White text on gradient

### Data Tables

```
bg-white rounded-xl border border-gray-200 overflow-hidden
thead: bg-gray-50 border-b border-gray-200
th: text-left px-4 py-3 font-medium text-gray-600
td: px-4 py-3
```
- Row hover: `hover:bg-gray-50`
- No vertical dividers between columns

### Status Badges

Tailwind colour pairs, applied via `STATUS_CONFIG` in `frontend/constants.tsx`:

| Status | Text | Background |
|---|---|---|
| Submitted | `text-blue-700` | `bg-blue-100` |
| In Review | `text-indigo-700` | `bg-indigo-100` |
| Action Required | `text-orange-700` | `bg-orange-100` |
| Approved | `text-emerald-700` | `bg-emerald-100` |
| Rejected | `text-red-700` | `bg-red-100` |

Badge shape: `rounded-full px-2 py-0.5 text-xs font-semibold`

### Tab Bar

```
flex gap-1 bg-gray-100 rounded-lg p-1 w-fit
button active: bg-white rounded-md shadow-sm text-gray-900
button inactive: text-gray-600 hover:text-gray-900
```

Count pill inside tab: domain-coloured `bg-*-100 text-*-700 text-xs font-semibold px-1.5 py-0.5 rounded-full`

### Buttons

| Variant | Classes |
|---|---|
| Primary | `bg-[#0052cc] text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors` |
| Secondary | `text-gray-600 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-50 transition-colors` |
| Ghost / Icon | `bg-[#f0f2f5] rounded-lg h-10 w-10 flex items-center justify-center` |

### Inputs

```
bg-[#f0f2f5] border-none rounded-lg text-sm pl-10 pr-4 py-1.5
focus: ring-2 ring-[#0052cc]/20 outline-none
```
- Left icon offset via `pl-10` with absolutely positioned Material Symbol

### Skeleton / Loading States

- Pulse animation on grey boxes matching the shape of expected content
- `background: var(--color-border)` + `animation: pulse 1.5s ease-in-out infinite`

---

## 9. Icons

**Library:** Google Material Symbols Outlined  
**Usage:** `<span className="material-symbols-outlined">icon_name</span>`  
**Sizes:** `text-base` (16px) · `text-xl` (20px) · `text-2xl` (24px)

### Domain Icons

| Domain | Icon |
|---|---|
| IT Support | `devices` |
| HR Services | `groups` |
| Group Finance | `payments` |

---

## 10. Responsive Breakpoints

Tailwind defaults used throughout:
- `sm`: 640px — show/hide secondary nav items and search
- `md`: 768px — switch from mobile stacked to full grid layouts
- Max widths clamped at `1200px` / `1440px` at page level

---

## 11. Design Principles

1. **Clarity over decoration** — data is the hero; chrome is minimal
2. **Surface hierarchy without borders** — use background tiers (`surface` → `surface-subtle` → `surface-muted`) instead of lines
3. **Consistent domain colour coding** — IT=blue, HR=green, Finance=amber is applied everywhere (badges, icons, charts, cards)
4. **Soft depth** — low-opacity shadows and `backdrop-blur` for floating elements; no heavy drop shadows on static cards
5. **Accessible contrast** — never pure black; `text-primary` (`#111827`) on white surfaces

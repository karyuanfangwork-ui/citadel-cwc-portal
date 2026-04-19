# Dashboard Redesign & Design Token System

**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** `frontend/pages/Dashboard.tsx`, new `frontend/src/styles/tokens.css`, `frontend/index.css`

---

## 1. Problem Statement

The current dashboard has no design token system. Colors (`#0052cc`, `#101418`, `#44546f`), spacing, radii, and typography are all hardcoded inline across every component. This makes the system hard to maintain, theme, or evolve. The dashboard itself also lacks personalization and information density — it shows no user-specific stats, and the search hero is generic.

---

## 2. Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Aesthetic direction | Elevated Clean (light) | Builds on existing Atlassian-blue identity, modern SaaS feel |
| Layout | Hero Banner + Stats + Desks + Table | Personal stats strip gives instant situational awareness |
| Color palette | Atlassian Blue (Evolved) | Preserves brand identity, zero user relearning cost |
| Typography | Plus Jakarta Sans | Distinctive, legible, pairs well with JetBrains Mono for refs |

---

## 3. Design Token System

### 3.1 File Location

Create: `frontend/src/styles/tokens.css`  
Import in: `frontend/index.css` (after the existing `@import "tailwindcss"`)

### 3.2 Token Specification

```css
:root {
  /* ── BRAND ── */
  --color-brand-900: #0747a6;
  --color-brand-700: #0052cc;   /* primary CTA, links, active states */
  --color-brand-500: #0065ff;
  --color-brand-300: #4c9aff;
  --color-brand-100: #deebff;
  --color-brand-50:  #eff6ff;

  /* ── SERVICE DESK ACCENTS ── */
  --color-it-500:  #0052cc;
  --color-it-100:  #deebff;
  --color-it-50:   #eff6ff;

  --color-hr-500:  #059669;
  --color-hr-100:  #d1fae5;
  --color-hr-50:   #ecfdf5;

  --color-fin-500: #d97706;
  --color-fin-100: #fde68a;
  --color-fin-50:  #fffbeb;

  /* ── SEMANTIC STATUS ── */
  --color-success: #059669;
  --color-warning: #d97706;
  --color-danger:  #dc2626;
  --color-info:    #0052cc;

  /* ── TEXT ── */
  --color-text-primary:   #111827;
  --color-text-secondary: #44546f;
  --color-text-tertiary:  #9ca3af;

  /* ── SURFACE & BORDER ── */
  --color-surface:        #ffffff;
  --color-surface-subtle: #f8fafc;
  --color-surface-muted:  #f3f4f6;
  --color-border:         #e5e7eb;
  --color-border-subtle:  #f3f4f6;

  /* ── SPACING (4px base) ── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* ── BORDER RADIUS ── */
  --radius-sm:   6px;
  --radius-md:   10px;
  --radius-lg:   16px;
  --radius-xl:   20px;
  --radius-full: 9999px;

  /* ── SHADOW ── */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.04);

  /* ── TYPOGRAPHY ── */
  --font-sans: 'Plus Jakarta Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 15px;
  --text-lg:   17px;
  --text-xl:   20px;
  --text-2xl:  24px;
  --text-3xl:  30px;
  --text-4xl:  36px;
}
```

### 3.3 Font Loading

Add to `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
```

Add to `tokens.css`:
```css
body {
  font-family: var(--font-sans);
}
```

---

## 4. Dashboard Layout Spec

### 4.1 Page Structure (top to bottom)

```
<page max-width: 1200px, padding: var(--space-8)>
  <HeroBanner />
  <StatsStrip />          ← NEW
  <SectionHeader "Service Desks" />
  <ServiceDeskCards />
  <SectionHeader "Recent Requests" + "View all →" />
  <RecentRequestsTable />
  <FooterCTAs />
</page>
```

### 4.2 Hero Banner

- **Container:** `border-radius: var(--radius-xl)`, gradient `linear-gradient(135deg, #0747a6 0%, #0052cc 60%, #0065ff 100%)`
- **Decorative circles:** Two `position:absolute` pseudo-elements (`::before`, `::after`) with `rgba(255,255,255,0.05)` and `rgba(255,255,255,0.04)` — no performance cost
- **Eyebrow:** Today's date formatted as "Tuesday, 14 April 2026" — `font-size: var(--text-xs)`, `color: rgba(255,255,255,0.6)`, `letter-spacing: 2px`, uppercase
- **Title:** `"Good morning/afternoon/evening, {firstName}."` + secondary line `"How can we help you today?"` — greeting derived from time of day + `user.name` from `AuthContext`; `font-size: var(--text-4xl)`, `font-weight: 900`, white
- **Search bar:** `background: rgba(255,255,255,0.12)`, `backdrop-filter: blur(8px)`, `border: 1.5px solid rgba(255,255,255,0.2)`, `border-radius: var(--radius-lg)`. On `:focus-within` border brightens. Search button is solid white with brand-700 text.
- **Quick tags:** "Common:" label + 4 pill chips (VPN Setup, Reset Password, Payroll Calendar, Annual Leave). Chips are `background: rgba(255,255,255,0.1)`, `border-radius: var(--radius-full)`. Non-functional in this phase — static links.

### 4.3 Stats Strip

Three equal-width cards in a `display: grid; grid-template-columns: repeat(3, 1fr)` layout.

Each stat card:
- `background: var(--color-surface)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`
- Hover: `box-shadow: var(--shadow-md)`, `transform: translateY(-1px)`
- Icon square: `44×44px`, `border-radius: var(--radius-md)`, tinted background

| Stat | Icon bg | Number color | Label |
|---|---|---|---|
| Open Requests | `--color-it-50` | `--color-brand-700` | "Open Requests" |
| Action Required | `--color-fin-50` | `--color-warning` | "Action Required" |
| Resolved All Time | `--color-hr-50` | `--color-success` | "Resolved All Time" |

**Data:** Derived from `requestService.getAllRequests()` response already fetched for the Recent Requests table. Count from the same payload — no extra API call.

- Open = requests where `status` is not in `[RESOLVED, COMPLETED, REIMBURSEMENT_CLOSED, ONBOARDING_COMPLETED, ...]`
- Action Required = `status === ACTION_REQUIRED`
- Resolved = requests where `status` is in the resolved set

### 4.4 Service Desk Cards

Three equal cards in `display: grid; grid-template-columns: repeat(3, 1fr)`.

Each card (`<Link>`):
- `border-radius: var(--radius-lg)`, `box-shadow: var(--shadow-sm)`
- `::before` pseudo-element: `height: 3px` color bar at top — IT blue, HR green, Finance amber
- Hover: `box-shadow: var(--shadow-lg)`, `translateY(-2px)`, `border-color: transparent`
- Icon: `48×48px` square, tinted background matching desk color
- Diagonal arrow `↗` bottom-right, animates on hover (`translate(2px,-2px)` + color → brand-700)

### 4.5 Recent Requests Table

- Container: `border-radius: var(--radius-lg)`, `overflow: hidden`, `box-shadow: var(--shadow-sm)`
- Header row: section title + "View all →" link
- Table head: `background: var(--color-surface-muted)`, `font-size: var(--text-xs)`, uppercase, `letter-spacing: 0.08em`
- Row dividers: `border-top: 1px solid var(--color-border-subtle)` on `td`
- Row hover: `background: var(--color-surface-subtle)`
- Reference column: `font-family: var(--font-mono)`, `color: var(--color-brand-700)`
- Status badges: `border-radius: var(--radius-full)`, pill shape. Colors sourced from `STATUS_CONFIG` but using token variables, not raw Tailwind classes.

### 4.6 Footer CTAs

- Centered row: "Can't find what you're looking for?" label + two ghost buttons
- Ghost button hover: `border-color: var(--color-brand-700)`, `color: var(--color-brand-700)`, `background: var(--color-brand-50)`

---

## 5. What Is NOT Changing

- All existing API calls and data fetching logic — unchanged
- Routing — unchanged
- `STATUS_CONFIG` in `constants.tsx` — unchanged (badge colors reference it)
- Header (`App.tsx`) — unchanged in this phase
- All other pages — unchanged

---

## 6. Files Affected

| File | Change |
|---|---|
| `frontend/src/styles/tokens.css` | **CREATE** — full token system |
| `frontend/index.css` | Add `@import './src/styles/tokens.css'` |
| `frontend/index.html` | Add Google Fonts `<link>` tags |
| `frontend/pages/Dashboard.tsx` | **REWRITE** — new layout with hero, stats, redesigned cards/table |

---

## 7. Out of Scope

- Migrating other pages to use tokens (follow-up work)
- Making quick-tag chips functional (search integration)
- Stats strip "Resolved All Time" vs date-ranged filtering
- Dark mode token variant

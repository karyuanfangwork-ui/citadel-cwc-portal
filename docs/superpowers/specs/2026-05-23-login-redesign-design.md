# Login Page Redesign — Design Spec
**Date:** 2026-05-23
**Status:** Approved

## Overview

Redesign `frontend/src/pages/Login.tsx` to reflect all 5 platform modules (IT Support, HR Services, Group Finance, CRM, Credit Assessment). The current design only lists 3 modules. The new design uses Option A: gradient split layout with an animated module spotlight on the left panel and a white form panel on the right.

## Layout

Two-column split, full viewport height (`min-h-screen`):

- **Left panel** — dark gradient (`#0f172a → #1e1b4b → #0c1445`), fixed width `420px` on desktop, full width on mobile (stacks above form)
- **Right panel** — white (`#fff` / `var(--color-surface)`), flex-grow, centers the form

Responsive: on mobile (`< md`), left panel collapses to a compact brand header above the form. The animated module spotlight is hidden on mobile; a static subtitle replaces it.

## Left Panel — Content

### Brand lockup (top)
Existing logo mark SVG + "CITADEL / WORKPLACE CONNECT" wordmark. No change from current.

### Hero headline (middle)
```
One platform,
every workflow.
```
Headline font: `var(--text-3xl)`, weight 900, white. "every workflow." accented in `#60a5fa`.

Subtext: `"IT · HR · Finance · CRM · Credit"` in muted `rgba(255,255,255,0.55)`.

### Animated module spotlight (below hero)

Cycles through all 5 modules automatically every **2.5 seconds**. Uses `setInterval` in a `useEffect` with cleanup. No external animation library.

**Structure per cycle:**
1. **Dot progress bar** — 5 dots, active dot expands (`w-8`) and takes the module's accent color
2. **Spotlight card** — rounded card with subtle glass bg (`rgba(255,255,255,0.09)`), shows:
   - Module icon (Material Symbol, `24px`)
   - Module name (bold, accent-colored)
   - Module description (muted)
3. **Mini list** — remaining 4 modules listed as compact rows with their colored dots and names

**Module definitions:**

| Module | Icon | Accent color |
|---|---|---|
| IT Support | `devices` | `#60a5fa` |
| HR Services | `groups` | `#34d399` |
| Group Finance | `payments` | `#f59e0b` |
| CRM | `handshake` | `#a78bfa` |
| Credit Assessment | `monitoring` | `#f87171` |

Transition: no CSS animation library — just React state swap. A `opacity` CSS transition (`0.3s`) on the spotlight card provides a soft fade between modules.

### Footer (bottom)
Existing copyright text. No change.

## Right Panel — Form

White background. Form centered, `max-width: 380px`. Content unchanged from current implementation:
- Logo lockup (shown on mobile, hidden on desktop since left panel handles branding)
- "Welcome back" heading + "Sign in to CWC" subtext
- Email + Password inputs (existing `FormInput` component, unchanged)
- Forgot password link
- Sign In button (existing gradient button, unchanged)
- Error state (unchanged)

## Component Structure

All changes are contained within `Login.tsx`. No new files needed.

- Extract module data as a `const MODULES` array at the top of the file
- Add `useEffect` + `useState` for `activeIndex` cycling in `BrandPanel`
- Replace the current static 3-item desk cards with the animated spotlight + mini list

```tsx
const MODULES = [
  { icon: 'devices',    name: 'IT Support',        desc: 'Hardware, software & access requests', color: '#60a5fa' },
  { icon: 'groups',     name: 'HR Services',        desc: 'Leave, onboarding & people requests',  color: '#34d399' },
  { icon: 'payments',   name: 'Group Finance',      desc: 'Reimbursements & payment requests',    color: '#f59e0b' },
  { icon: 'handshake',  name: 'CRM',                desc: 'Customer relationship management',     color: '#a78bfa' },
  { icon: 'monitoring', name: 'Credit Assessment',  desc: 'Risk scoring & credit decisions',      color: '#f87171' },
];
```

## What Does NOT Change

- Auth logic (`login`, `navigate`, `handleSubmit`)
- `FormInput` component
- Form field structure and validation
- Error handling
- CSS design tokens (`var(--color-*)`, `var(--text-*)`, etc.)
- Responsive stacking behavior (left panel on top for mobile)
- Copyright footer

## Decorative Background

Keep the two existing decorative circle `div`s in the left panel. No change.

The left panel gradient changes slightly from the current `160deg, #0d1830 → #1D2D5E → #2a4a7f` to `135deg, #0f172a → #1e1b4b → #0c1445` for a cooler/deeper indigo tone that better complements the module accent colors.

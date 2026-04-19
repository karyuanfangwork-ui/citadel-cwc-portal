# Login & Register Redesign

**Date:** 2026-04-14
**Status:** Approved
**Scope:** `frontend/src/pages/Login.tsx`, `frontend/src/pages/Register.tsx`

---

## 1. Problem Statement

Both Login and Register pages are generic centered-card layouts on a plain gray background. They use hardcoded colors (`#0052cc`), no design tokens, and look completely disconnected from the redesigned dashboard. They give no indication of what the platform does before a user signs in.

---

## 2. Decision: Split Panel Layout

| Decision | Choice | Rationale |
|---|---|---|
| Layout | Split Panel (A) | Brand panel tells the platform story before login; more distinctive than card-on-hero |
| Brand panel width | 400px fixed | Enough room for desk cards; leaves adequate form space |
| Form panel | Scrollable on Register | Brand panel stays fixed; form grows for extra fields |
| Token usage | All existing tokens from `tokens.css` | No new colors introduced |

---

## 3. Layout Architecture

```
<div class="min-h-screen flex">
  <BrandPanel />        ← fixed 400px, identical on both pages
  <FormPanel />         ← flex-1, scrollable, different content per page
</div>
```

Both pages share **identical** brand panel markup and styling. Only the headline and descriptor text differ between Login and Register.

---

## 4. Brand Panel Spec

**Container:**
- `width: 400px`, `flex-shrink: 0`, `min-height: 100vh`
- `background: linear-gradient(160deg, var(--color-brand-900) 0%, var(--color-brand-700) 100%)`
- `padding: var(--space-10) var(--space-8)`
- Two decorative circles: `::before` top-right `200×200px rgba(255,255,255,0.05)`, `::after` bottom-left `160×160px rgba(255,255,255,0.04)`
- `display: flex; flex-direction: column; justify-content: space-between`

**Logo row (top):**
- Icon: `36×36px`, `background: rgba(255,255,255,0.15)`, `border-radius: var(--radius-sm)`, `corporate_fare` Material Symbol in white
- Wordmark: `"HELP CENTER"`, `font-size: var(--text-sm)`, `font-weight: 800`, white, `letter-spacing: 0.5px`
- `margin-bottom: var(--space-10)`

**Headline:**
- Login: `"Your enterprise support hub."`
- Register: `"Join your team on Help Center."`
- `font-size: var(--text-3xl)`, `font-weight: 900`, white, `line-height: 1.15`
- Secondary span: `color: rgba(255,255,255,0.55)`, `font-weight: 400`

**Descriptor:**
- Login: `"One place for IT, HR, and Finance requests. Get help fast, track your requests, and stay informed."`
- Register: `"Create your account to start raising requests across IT, HR, and Finance — and track them in real time."`
- `font-size: var(--text-sm)`, `color: rgba(255,255,255,0.6)`, `line-height: 1.6`, `margin-bottom: var(--space-8)`

**Service desk cards (3 items):**
- Container: `display: flex; flex-direction: column; gap: var(--space-2)`
- Each card: `background: rgba(255,255,255,0.09)`, `border: 1px solid rgba(255,255,255,0.1)`, `border-radius: var(--radius-md)`, `padding: var(--space-2) var(--space-3)`
- Icon square `28×28px`, `border-radius: var(--radius-sm)`:
  - IT: `background: rgba(0,82,204,0.35)`, `devices` icon
  - HR: `background: rgba(5,150,105,0.35)`, `groups` icon
  - Finance: `background: rgba(217,119,6,0.35)`, `payments` icon
- Name: `font-size: var(--text-sm)`, `font-weight: 700`, white
- Description: `font-size: var(--text-xs)`, `color: rgba(255,255,255,0.55)`

**Footer (bottom):**
- `"© 2026 CWC Enterprise Help Center"`
- `font-size: var(--text-xs)`, `color: rgba(255,255,255,0.35)`

---

## 5. Form Panel Spec

**Container:**
- `flex: 1`, `background: var(--color-surface)`, `overflow-y: auto`
- `display: flex; align-items: center; justify-content: center`
- `padding: var(--space-12) var(--space-12)`
- Register: `align-items: flex-start; padding-top: var(--space-10)` (content starts near top due to length)

**Inner form wrapper:** `width: 100%; max-width: 380px`

**Heading:** `font-size: var(--text-2xl)`, `font-weight: 900`, `--color-text-primary`
- Login: `"Welcome back"`
- Register: `"Create your account"`

**Subtext:** `font-size: var(--text-sm)`, `--color-text-secondary`, `margin-bottom: var(--space-6)`
- Login: `"Sign in to continue · "` + link `"Create an account"`
- Register: `"Already have an account? "` + link `"Sign in"`

**Input fields:**
- Label: `font-size: var(--text-xs)`, `font-weight: 700`, `--color-text-primary`, `margin-bottom: var(--space-1)`
- Input wrapper: `position: relative` for icon prefix
- Icon: `position: absolute; left: 12px; top: 50%; transform: translateY(-50%)` — Material Symbol, `font-size: 18px`, `--color-text-tertiary`
- Input: `padding: 11px 14px 11px 40px` (with icon) or `11px 14px` (without)
- Border: `1.5px solid var(--color-border)`, `border-radius: var(--radius-md)`
- Background: `var(--color-surface-subtle)`
- Focus: `border-color: var(--color-brand-700)`, `box-shadow: 0 0 0 3px var(--color-brand-100)`, `background: var(--color-surface)`
- `font-size: var(--text-sm)`, `font-family: var(--font-sans)`

**Field icons:**
- Email: `mail` Material Symbol
- Password / Confirm Password: `lock` Material Symbol
- First Name, Last Name, Department, Job Title: no icon

**Submit button:**
- `width: 100%`, `padding: 13px`
- `background: linear-gradient(135deg, var(--color-brand-700) 0%, var(--color-brand-500) 100%)`
- `border-radius: var(--radius-md)`, `font-size: var(--text-sm)`, `font-weight: 800`, white
- Hover: `opacity: 0.92`, `transform: translateY(-1px)`
- Disabled: `opacity: 0.5`, `cursor: not-allowed`
- Loading: spinner + text (`"Signing in..."` / `"Creating account..."`)
- Text: Login `"Sign in →"`, Register `"Create account →"`

**Error state:**
- `background: #fef2f2`, `border: 1px solid #fecaca`, `border-radius: var(--radius-md)`
- `padding: var(--space-2) var(--space-3)`, `font-size: var(--text-sm)`, `color: var(--color-danger)`
- Renders above the first field when `error` state is non-empty

---

## 6. Login Page Fields

1. Email address (icon: `mail`, type: `email`, autocomplete: `email`, required)
2. Password (icon: `lock`, type: `password`, autocomplete: `current-password`, required)
3. Submit: `"Sign in →"`

**Demo credentials box** (below button):
- `background: var(--color-surface-subtle)`, `border: 1px solid var(--color-border)`, `border-radius: var(--radius-md)`, `padding: var(--space-3) var(--space-4)`
- Label: `"DEMO CREDENTIALS"`, `font-size: var(--text-xs)`, `font-weight: 600`, `--color-text-tertiary`, uppercase
- Three rows: Admin / Agent / User with credential badge
- Credential badge: `font-family: var(--font-mono)`, `font-size: var(--text-xs)`, `color: var(--color-brand-700)`, `background: var(--color-brand-50)`, `border-radius: 4px`, `padding: 2px 7px`

---

## 7. Register Page Fields

**Row 1 (grid 2-col, gap `var(--space-3)`):**
1. First Name (no icon, required)
2. Last Name (no icon, required)

**Row 2:** Email address (icon: `mail`, required)

**Row 3:** Password (icon: `lock`, required, placeholder: `"At least 8 characters"`)

**Row 4:** Confirm Password (icon: `lock`, required)

**Horizontal divider** (`1px solid var(--color-border)`, `margin: var(--space-2) 0 var(--space-5)`)

**Row 5 (grid 2-col, gap `var(--space-3)`):**
5. Department (no icon, optional — label includes `"(optional)"` in muted text)
6. Job Title (no icon, optional)

**Submit:** `"Create account →"`

**Existing validation logic unchanged:**
- Password must be ≥ 8 characters
- Password and Confirm Password must match
- Both checked before API call

---

## 8. What Is NOT Changing

- All auth logic (`login()`, `register()`, `useAuth()`) — unchanged
- Routing — unchanged
- `AuthContext` — unchanged
- All other pages — unchanged
- No new dependencies

---

## 9. Files Affected

| File | Change |
|---|---|
| `frontend/src/pages/Login.tsx` | **REWRITE** — split panel layout, token-based inline styles |
| `frontend/src/pages/Register.tsx` | **REWRITE** — split panel layout, token-based inline styles |

---

## 10. Out of Scope

- Forgot password flow
- Social/SSO login
- Email verification
- Hiding demo credentials box in production

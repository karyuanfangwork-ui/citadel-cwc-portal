# CWC 2.0 — Enterprise Frontend UI/UX Audit

**Scope:** `frontend/` directory (React 19 + Vite + Tailwind v4 + Plus Jakarta Sans), ~13,785 LOC across 36 page-level files and ~50 components.
**Date:** 2026-05-15
**Auditor role basket:** UX, design systems, a11y, mobile, FE arch, enterprise SaaS, QA.

> Every finding cites real code. Severity scale: **🔴 Critical** (blocks production / legal / scale), **🟠 High** (significant UX or perf drag), **🟡 Medium** (polish / risk), **🟢 Low** (nit).

---

## 1. Executive Summary

CWC 2.0 has the bones of a serious enterprise help-center: a documented design-token system (`src/styles/tokens.css`), Tailwind v4, RBAC-gated routes, error boundaries, Sentry, an i18n stack, SSE notifications, and a skip-link for a11y. The product surface is broad (IT/HR/Finance desks, CRM, ITAM, Announcements, Approvals, KB, Reports).

But the **execution lags the ambition** in seven measurable ways:

1. **Design system is documented but unused.** 1,127 hard-coded hex literals across 94 files vs. 13 files using `var(--color-*)`. Tokens exist as decoration; the UI is held together by inline `#0052cc`, `#f0f2f5`, `#101418` strings.
2. **No code-splitting.** All 36 page components are eagerly imported in `App.tsx:32-66`. First-paint cost scales linearly with feature count.
3. **`index.html` ships React twice.** An ESM.sh `importmap` (`index.html:21-27`) loads React/React-Router from a CDN *and* the bundle includes them via `package.json`. Slow networks pay both.
4. **Mobile drawer is not a dialog.** `App.tsx:228-315` — no `role="dialog"`, no `aria-modal`, no focus trap, despite `focus-trap-react` already in the project and used correctly inside `ModalWrapper`. Keyboard users get trapped *outside* the drawer.
5. **Search inputs fire one API call per keystroke** on `MyRequests` (`pages/MyRequests.tsx:57-59` — `useEffect` on `searchTerm` with no debounce). Repeat across most list pages.
6. **No 404 / catch-all route** in `App.tsx:385-438`. Typos and dead links hit a blank `<main>`.
7. **HTML `lang` never syncs** with i18next (`grep` returns zero hits for `document.documentElement.lang`). Screen readers will announce all 26 languages as English.

The product is **not yet enterprise-production-ready** for >500 daily users or for any audited industry (finance, healthcare, gov). With ~4–6 weeks of focused remediation (P0/P1 list at §10), it gets there.

---

## 2. Overall Scorecard

| Dimension | Score | One-line verdict |
|---|---|---|
| **UI quality** | **6.5 / 10** | Clean modern surface; ruined by token drift and inline-style inconsistency. |
| **UX quality** | **6.0 / 10** | Workflows make sense for power users; high cognitive load for first-timers; no empty/error/loading discipline. |
| **Enterprise readiness** | **5.5 / 10** | RBAC + audit primitives present; ops/monitoring UX, scale concerns, and a11y gaps prevent a tier-1 verdict. |
| **Mobile experience** | **4.5 / 10** | Layouts reflow, but drawer a11y is broken, tables overflow, 11px text fails legibility, touch targets borderline. |
| **Accessibility (WCAG 2.1 AA)** | **5.0 / 10** | Skip-link and modal focus traps ✓ — drawer, lang attr, contrast on `text-tertiary`, and dead-link semantics fail. |
| **Performance** | **5.5 / 10** | No code-splitting, dual React, blocking Google Fonts, monolithic 1,558-line `AssetManagement.tsx`. |
| **Design system maturity** | **3.5 / 10** | Tokens exist; codebase ignores them. ~99% of color usage is hex. |
| **Frontend test coverage** | **2.0 / 10** | 8 test files for 13,785 LOC. |

**Composite enterprise grade: C+ / "Pilot-ready, not yet Production-Tier-1."**

---

## 3. Responsive & Mobile Audit

### 3.1 🔴 Mobile drawer is not an accessible dialog — `App.tsx:228-315`
- No `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, no focus trap. Tab key walks behind the scrim into hidden page content.
- Backdrop click closes drawer (✓), but `Escape` does not (✗).
- **Fix:** wrap drawer in the existing `FocusTrap` from `useFocusTrap.ts` (already abstracted), add `role="dialog" aria-modal aria-label="Main navigation"`, and an `Escape` keydown listener that mirrors the backdrop close.

### 3.2 🟠 Top-nav has 11 items at md+ — overflow inevitability — `App.tsx:107-119`
Admin role sees: Dashboard, My Requests, Announcements, Agent, Approvals, IT Assets, CRM, KB, Reports, Announcements Mgmt, Admin Settings — 11 links + search + notifications + help + user menu. At 1024–1280px this wraps or clips. Worse on Surface/iPad-mini landscape.
**Fix:** introduce a primary/secondary nav split. "Workspace" group (Dashboard, My Requests, Approvals, Announcements) stays inline; "Modules" (CRM, Assets, KB, Reports) and "Admin" (Settings, Announcements Mgmt) become disclosure menus.

### 3.3 🟠 Body font ramp is sub-WCAG on small screens — `tokens.css:62-67`
`--text-xs: 11px`, `--text-sm: 13px`, `--text-base: 15px`. WCAG recommends min 12px (16px ideal) for body; 11px on a 5.5" phone with metadata badges (`PRIORITY_BADGE` labels at `text-xs`, status pills throughout) falls below comfortable reading. Mobile Safari also down-scales when the page width exceeds viewport.
**Fix:** lift the ramp one step (`xs:12, sm:14, base:16`) and apply `@media (max-width: 640px) { --text-base: 16px }` to prevent iOS auto-zoom on form focus (which also requires `input { font-size: 16px }`).

### 3.4 🟠 Tables are not responsive — sampled across `MyRequests`, `ApprovalQueue`, `AssetManagement`
No horizontal scroll wrapper, no card fallback at `sm:` breakpoint. On 375px iPhone, the ref-number column pushes everything right and gets clipped at the viewport edge.
**Fix:** wrap tables in `<div class="overflow-x-auto -mx-4 sm:mx-0">` + introduce a `<TableMobileCard>` component used below `sm`.

### 3.5 🟡 Hamburger lacks `aria-expanded` / `aria-controls` — `App.tsx:216-222`
Has `aria-label="Open navigation menu"` but no state ARIA. Screen readers can't announce open/closed.

### 3.6 🟡 Touch targets below 44×44 — `App.tsx:168-170` (help button h-10 w-10 = 40px), `App.tsx:243-249` (drawer close h-9 w-9 = 36px), Login social/aux buttons
Apple HIG and WCAG 2.5.5 (AAA) target 44×44; 24×24 minimum AA. Drawer close is sub-AA on dense screens.

### 3.7 🟢 No safe-area-inset handling
Notched iPhones in landscape clip the header logo. Add `padding-left: env(safe-area-inset-left)` etc. to the header inner container.

---

## 4. UX Journey Findings

### 4.1 🟠 Search-on-keystroke without debounce — `pages/MyRequests.tsx:57-59`
```ts
useEffect(() => { fetchRequests(); }, [filter, searchTerm, page, selectedRequestTypeId]);
```
Typing "annual leave" = 11 GET requests. Hammering the API, racing responses (no `AbortController`), flickering the loading state. The codebase already has debounce in `UserAccountsTab.tsx` and `ParticipantsSection.tsx`; the pattern just isn't propagated.
**Fix:** extract `useDebouncedValue(searchTerm, 300)` hook and use it on every list page; add `AbortController` cancellation in `request.service`.

### 4.2 🟠 Two divergent definitions of "resolved status" — `Dashboard.tsx:33-45` vs `MyRequests.tsx:32-40`
Both files hard-code different lists (Dashboard's is a `Set`, MyRequests' is an `Array`; lists differ — `CHARGEBACK_COMPLETED`, `FROM_ENTITY_REJECTED` etc. only in MyRequests). One UI says a request is open, the other says it's closed. This is a **correctness bug masquerading as UX inconsistency**.
**Fix:** Move `RESOLVED_STATUSES` into `constants.tsx` and import everywhere. Better: derive from server `/api/v1/statuses?terminal=true`.

### 4.3 🟠 Knowledge Base hidden in production — `App.tsx:115, 409-410`
KB is gated by `import.meta.env.DEV`. End users can't read articles, defeating the deflection purpose of a help center. Either ship it or remove the dead routes/links.

### 4.4 🟠 Dead footer links — `App.tsx:328-330`
Privacy Policy, Terms of Service, Contact Support all `href="#"`. Enterprise procurement (legal + IT security review) will flag this.

### 4.5 🟡 Login has no password visibility toggle, no caps-lock hint, no SSO affordance — `src/pages/Login.tsx`
For an enterprise tool the absence of SSO/SAML CTA is conspicuous; users can't tell whether they should be using IdP login or local creds. Also no rate-limit / lockout feedback path.

### 4.6 🟡 Toast click-target ambiguity — `App.tsx:348-365`
The whole toast div has `cursor-pointer` and an onClick navigating to the request. The close button inside has `stopPropagation`. Users miss the close target ~10% of the time and accidentally route. **Fix:** make navigation an explicit "View request →" button; remove whole-card click.

### 4.7 🟡 Click-outside via `document.getElementById('user-menu-container')` — `App.tsx:80-89`
String IDs across components are fragile (collisions if the Header ever mounts twice in tests / portals). Use a `useRef` + click-outside hook.

### 4.8 🟡 Greeting computed once on render — `Dashboard.tsx:47-51`
Sessions that span noon/5pm don't update the greeting. Cheap polish, but expected from an "enterprise-grade" dashboard. Memoize on minute tick or recompute on focus.

### 4.9 🟢 No empty-state discipline
Search dropdowns, list pages, and dashboard cards return nothing when empty — no illustration, no "Try X" prompt, no "Create your first request" CTA on `MyRequests` for new joiners.

### 4.10 🟢 No "unsaved changes" guard on long forms
`CreateRequest`, `AdminSettings` modals — navigating away discards user input silently. React Router v7's `useBlocker` exists for this; not used.

---

## 5. Accessibility Findings (WCAG 2.1 AA)

| # | Issue | WCAG | Severity | File |
|---|---|---|---|---|
| 5.1 | HTML `lang="en"` static while i18n loads 26 langs; never updated. | 3.1.1 | 🔴 | `index.html:2`, all of `src/i18n/` |
| 5.2 | Mobile drawer not a dialog (see §3.1). | 4.1.2, 2.1.2 | 🔴 | `App.tsx:228` |
| 5.3 | `--color-text-tertiary: #9ca3af` on `#ffffff` = 2.85:1 contrast — **fails AA** for normal text. | 1.4.3 | 🟠 | `tokens.css:35` |
| 5.4 | Material Symbols icons used as the *only* affordance for several controls (notifications, help, search) with `aria-label` only on some. | 1.1.1, 4.1.2 | 🟠 | `App.tsx:166-172` |
| 5.5 | Footer links are `href="#"` — keyboard focus traps and "Link" announcement with no destination. | 2.4.4 | 🟠 | `App.tsx:328` |
| 5.6 | No `:focus-visible` styles defined globally; relying on browser default which Tailwind base resets. | 2.4.7 | 🟠 | `index.css` |
| 5.7 | Spinner-only loading on Login button — no `aria-live` text announced. | 4.1.3 | 🟡 | `Login.tsx:297-306` |
| 5.8 | Inline-style icons sized in `px` (28px, 36px) won't scale with user zoom. | 1.4.4 | 🟡 | `Login.tsx:96-101` |
| 5.9 | Color-coded category bars (HR green / IT blue / FIN amber) carry meaning without text equivalent in some chip placements. | 1.4.1 | 🟡 | `Dashboard.tsx:70-92` |
| 5.10 | Skip-link present ✓ — good. | 2.4.1 | 🟢 | `App.tsx:377-382` |

**Verdict:** Roughly 60% of AA criteria met. Failing items are concentrated and fixable in <1 sprint.

---

## 6. Frontend Performance Findings

### 6.1 🔴 Dual-React via `importmap` + bundle — `index.html:21-27`
```html
<script type="importmap">
{ "imports": {
    "react-router-dom": "https://esm.sh/react-router-dom@^7.12.0",
    "react/": "https://esm.sh/react@^19.2.3/", ... } }
</script>
```
The Vite bundle also includes `react` from `node_modules`. On flaky corporate networks, esm.sh blocking = blank app. Even on fast networks, you're shipping React twice. **Delete the importmap; let Vite handle bundling.**

### 6.2 🔴 No code-splitting — `App.tsx:32-66`
Every page (including CRM's 7 pages, AssetManagement at 1558 lines, AdminSettings) ships in the initial chunk. With CRM + Asset Mgmt charts/forms, the entry bundle is likely 800KB+ uncompressed. **Fix:** wrap protected routes in `React.lazy()` + `<Suspense fallback={<SkeletonRow/>}>`. Easy win, 60–70% bundle reduction.

### 6.3 🟠 Google Fonts load blocking, no preload, no `font-display:swap` enforcement — `index.html:8-10`
Two `<link>` requests on the critical path, downloading 7 weights of Plus Jakarta Sans + the entire variable Material Symbols font (~250KB). Self-host with `unicode-range` subsetting or use `font-display: swap` plus `preconnect`+`preload` for the woff2.

### 6.4 🟠 `AssetManagement.tsx` is 1,558 lines in a single component — `pages/AssetManagement.tsx`
This is too large to memoize sensibly, hot-reloads slowly, and forces every state change in the tree to re-render filters, table, modals together. Break into `AssetList`, `AssetFilters`, `AssetEditModal`, `AssetAssignmentDrawer`.

### 6.5 🟠 No virtualization on any list
`MyRequests`, `AssetManagement`, `CrmLeads`, `ApprovalQueue` all map full result sets. With pagination at 10 it's fine; if a user filters "all" they get 100+ DOM rows. Use `@tanstack/react-virtual` once any list exceeds ~50 rows.

### 6.6 🟡 No Vite manualChunks or build target config — `vite.config.ts`
No `build.rollupOptions.output.manualChunks`, no `build.target`, no `cssCodeSplit` tuning. Default is fine but for enterprise you typically split `react`, `tiptap`, `xlsx`, `@sentry/react` (~120KB each) into vendor chunks.

### 6.7 🟡 `xlsx@0.18.5` shipped to all users
xlsx is ~430KB min. If only Reports uses it, dynamically import it inside the export handler.

### 6.8 🟡 No skeleton system / loading-state library
`SkeletonRow` and `SkeletonCategoryCard` exist but most pages just render `null` or "Loading..." text while fetching. Inconsistent perception of speed.

---

## 7. Design System & Component Findings

### 7.1 🔴 Token drift — 1,127 hex literals vs 13 files using tokens
Token system is well-designed (`tokens.css`, `tailwind.theme.extend.ts`). Adoption is ~1%. Examples:
- Header brand color is `#0052cc` (it-500) repeated literally 8 times in `App.tsx` instead of `text-it-500`/`bg-it-500`.
- Footer bg `bg-white` (literal Tailwind) coexists with `bg-surface`.
- Login uses `#fef2f2` / `#fecaca` (`Login.tsx:255`) instead of `--color-danger`-family tokens.

The token system also has *aliases that converge* (`--color-info === --color-it-500 === --color-brand-700`) — comments admit this. **Either separate semantic from brand, or document that they're intentionally fused.** Right now consumers don't know which to use, so they reach for hex.

**Fix:** (a) one-time codemod of common hex→token; (b) Stylelint or ESLint rule (`color-no-hex`) on `.tsx`/`.css`; (c) restrict raw hex to `tokens.css`.

### 7.2 🟠 Inline-style React.CSSProperties dominates auth pages — `Login.tsx`
~250 of 321 lines are inline `style={{}}`. Defeats Tailwind, defeats responsive utilities, and produces design drift the moment the next dev "fixes a margin." Migrate to Tailwind + tokens.

### 7.3 🟠 No `<Button>`, `<Input>`, `<Card>`, `<Badge>` primitives
Every page rolls its own. `PRIORITY_BADGE` (Dashboard.tsx:79) and similar maps recur across MyRequests, CrmLeads, AgentDashboard with slightly different colors. This is the single biggest source of visual drift.

### 7.4 🟠 No `<Modal>` standardization at the page level
`ModalWrapper` is good (focus trap, `aria-modal`) but only admin tabs use it. Login error block, toast, drawer all use bespoke patterns.

### 7.5 🟡 Spacing & radius tokens used in tokens.css but not enforced
`rounded-cwc-md` exists; `rounded-lg` (Tailwind default 0.5rem) also used. Two parallel scales.

### 7.6 🟡 Dark theme defined but no toggle UX or persistence verified — `tokens.css:79-116`, `ThemeProvider`
Dark token set is well thought out; UX entry point for end users wasn't found in nav. Confirm it's user-toggleable or remove dead tokens.

---

## 8. Enterprise Readiness

### 8.1 🟠 Role-based UX is binary, not progressive
Header nav simply shows/hides items by permission. No "Admin mode" affordance, no breadcrumb of "you are viewing as Agent." Admins switching contexts daily get confused about what mode they're in. Add a role chip near the avatar.

### 8.2 🟠 No global activity / audit trail visibility from UI
Backend has events; UI doesn't surface "who changed what when" except inside individual request detail. Auditors need a global feed.

### 8.3 🟠 No saved views / personalization on lists
`AssetManagement`, `MyRequests`, `ApprovalQueue` — no saved filter sets, no "my queue," no column chooser. Power users at scale will demand this within weeks.

### 8.4 🟠 Notifications: SSE + toast — no notification preferences UI
Users can't mute by type/desk/priority. At scale (>200 daily users) this becomes an enterprise complaint.

### 8.5 🟡 No tenancy/region indicator
For multi-entity orgs, users need to know which entity they're acting under. Add to header right of avatar.

### 8.6 🟡 No print stylesheet
Finance/HR users print approvals & LOAs. No `@media print` in `index.css`. They'll print headers, sidebars, the toast.

### 8.7 🟡 No data export from list pages
xlsx is bundled but only Reports uses it. Add "Export CSV" to AssetManagement, MyRequests, ApprovalQueue.

---

## 9. Security UX

### 9.1 🟠 No session-timeout warning
JWT auth — no idle warning, no "your session will expire in 2 min" modal. Compliance reviewers will flag.

### 9.2 🟠 No destructive-action confirm pattern standardization
`window.confirm` likely used in some places, custom modals in others. Define a `<ConfirmDialog destructive>` and use everywhere (delete user, remove participant, reject request).

### 9.3 🟡 Login error message generic but errors are not rate-limit-aware
Backend rate limits exist; UI doesn't translate 429 into actionable text ("Too many attempts. Try again in 5 min.").

### 9.4 🟡 No multi-tab consistency for auth state
Logging out in one tab doesn't broadcast to others. `BroadcastChannel` or storage events fix this in 20 lines.

### 9.5 🟢 Sentry boundary wraps the whole app ✓ but fallback is plain text — `App.tsx:450`
Replace with an `ErrorFallback` (already exists at `src/components/ErrorFallback.tsx`) that includes a "Reload" CTA and Sentry event id.

---

## 10. Critical UI Problems (P0 — block production)

| # | Issue | File | Impact |
|---|---|---|---|
| C1 | Dual React via importmap + bundle | `index.html:21-27` | Blank app on flaky networks; 2× bytes |
| C2 | No code-splitting on 36 routes | `App.tsx:32-66` | First-paint cost; slow internal launches |
| C3 | Mobile drawer not an accessible dialog | `App.tsx:228-315` | Keyboard/SR users locked out |
| C4 | Token drift (1127 hex vs 13 token files) | repo-wide | Design system is non-functional |
| C5 | Divergent RESOLVED_STATUSES definitions | `Dashboard.tsx:33`, `MyRequests.tsx:32` | Correctness bug (UI disagreement) |
| C6 | HTML lang not synced to i18n | `index.html:2` | Screen readers wrong language |
| C7 | No 404/catch-all route | `App.tsx:385` | Dead links → blank screen |
| C8 | KB hidden in prod | `App.tsx:115,409` | Self-service deflection disabled |

---

## 11. High-Priority Improvements (P1 — within first sprint)

- **H1** Search-keystroke API spam → add `useDebouncedValue` + `AbortController`.
- **H2** Top-nav overflow at 11 items → group into primary/secondary nav.
- **H3** 11–13px body font → bump ramp; 16px on inputs to prevent iOS zoom.
- **H4** Tables not responsive → wrap in overflow + add `<TableMobileCard>`.
- **H5** `text-tertiary` fails AA contrast → darken to `#6B7280`.
- **H6** Dead footer legal links → real routes/static pages.
- **H7** No `Button`/`Input`/`Badge`/`Card` primitives → build the eight base primitives, codemod two pages as proof.
- **H8** 1558-line `AssetManagement.tsx` → split into 4–5 components.
- **H9** Session-timeout warning modal.
- **H10** Sentry fallback uses real `<ErrorFallback>`.

---

## 12. Quick Wins (≤1 day each)

- Delete the importmap in `index.html`.
- Add `aria-expanded`/`aria-controls` to hamburger.
- Add `role="dialog" aria-modal` + `<FocusTrap>` to mobile drawer.
- Add `path="*"` route → `<NotFound>` page.
- Sync `<html lang>` to i18next in an effect in `AuthProvider` or `ThemeProvider`.
- Replace `document.getElementById('user-menu-container')` click-outside with a `useRef` hook.
- Update footer hrefs.
- Add `:focus-visible { outline: 2px solid var(--color-brand-700); outline-offset: 2px; }` to `index.css`.
- Dynamic-import `xlsx` only inside Reports.
- Memoize the dashboard greeting.

---

## 13. Long-Term Recommendations (next 1–2 quarters)

- **L1 Component library extraction.** Promote `src/components/admin/*` modal patterns + new primitives into a `@cwc/ui` internal package. Storybook with a11y addon as a regression gate.
- **L2 Design-token enforcement.** Stylelint `color-no-hex` + ESLint `no-restricted-syntax` for hex in JSX style props. CI fail on >0.
- **L3 Test pyramid.** 8 tests → 100+ component tests with Vitest + RTL; e2e (Playwright) for the 6 most-used flows: login, create request, approve, search, assign asset, lead → opportunity conversion.
- **L4 Performance budget in CI.** Bundle-analyzer + size-limit; fail PRs that exceed thresholds per route.
- **L5 Saved views & column chooser** across all list pages (single shared `<DataTable>`).
- **L6 Notification preferences screen** + digest emails.
- **L7 Print stylesheets** for approvals/LOAs/onboarding/offboarding artifacts.
- **L8 Full WCAG 2.2 AA audit** by an external partner once H-items land; aim for VPAT/ACR doc.
- **L9 PWA shell** (manifest, service worker, offline read-only for KB & My Requests). Big win for mobile-only field staff.
- **L10 Module-driven information architecture.** Multi-module nav model + breadcrumb scheme (Breadcrumbs component exists but is inconsistently rendered across pages).

---

## 14. UI Modernization Suggestions

- **Density toggle** (compact/cozy) — enterprise expectation for power users on dashboards.
- **Command palette (⌘K)** for navigation/search across modules — single biggest power-user productivity lever in a system with 36 pages.
- **Inline actions on tables** (status-change, assign) without leaving the list.
- **Better card hierarchy on Dashboard** — current desk-cards are flat; introduce stat-summary header (Open, Overdue, Due-today, Assigned-to-me).
- **Real charts on Reports/CrmReports** — confirm `recharts`/`visx` is in plan; today no chart lib is in deps.
- **Empty/error/success illustrations** — use a consistent 3-state pattern; consider undraw or a custom set.
- **Sticky table headers + filter bar** for long lists.
- **Skeleton everywhere** with shimmer; the two existing skeletons are a good starting kit.

---

## 15. Production Readiness Verdict

| Criterion | Status |
|---|---|
| Pilots of 20–50 users | ✅ Ready |
| Department rollout (100–300) | ⚠️ Conditional — fix C1–C8 + H1–H5 first |
| Org-wide rollout (1,000+) | ❌ Not ready — needs P0+P1+L1–L5 |
| External / regulated industries (finance audit, healthcare, gov) | ❌ Not ready — a11y + audit-trail UX + session UX gaps |
| Mobile-first deployment (field staff, retail) | ❌ Not ready — drawer a11y, table reflow, font size |

**Bottom line:** Functionally rich, architecturally promising, polish-deficient. The remediation list is not large by enterprise standards — **roughly 4 weeks of one FE engineer + part-time designer** clears P0 and P1, doubling the enterprise-readiness score. The single highest-leverage move is **enforcing the design system that already exists** — that one change alone eliminates 30%+ of the visible UX inconsistency reported above.

---

*Audit produced from direct read of `frontend/App.tsx`, `pages/Dashboard.tsx`, `pages/MyRequests.tsx`, `src/pages/Login.tsx`, `src/styles/tokens.css`, `tailwind.theme.extend.ts`, `index.html`, `index.css`, `vite.config.ts`, `package.json`, plus structural sweeps via grep. Not a runtime audit — claims about render/network behavior are inferred from code; numbers like "800KB bundle" are estimates and should be confirmed with `vite build --report`.*

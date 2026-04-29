# CWC 2.0 UX Audit Remediation — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix all critical UX/UI issues identified in the April 2026 audit, raising production readiness from 55% to 80%+.

**Architecture:** Incremental improvements against existing codebase. No rewrites — refactor in-place. Each phase is independently shippable. Phases are ordered by ROI: Quick Wins first, then Critical Fixes, then Premium Upgrades.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Plus Jakarta Sans, Vite, Design Tokens (`tokens.css`), DESIGN.md spec

**Base Directory:** `/Users/fangkaryuan/cwc2.0/citadel-cwc-portal/frontend/`

---

## Phase 0 — Design Token Sync (Prerequisite)

All subsequent tasks depend on Tailwind consuming the existing `tokens.css` token system. Currently the app uses a mix of `var(--color-*)`, Tailwind arbitrary values (`text-[#0052cc]`), and inline hex. This phase wires tokens into Tailwind theme so all downstream tasks use a single source of truth.

### Task 0.1: Extend Tailwind theme with design tokens

**Objective:** Make every `tokens.css` variable available as a Tailwind utility class (`bg-brand-700`, `text-tertiary`, `rounded-lg`, etc.) so new code uses semantic classes instead of arbitrary hex.

**Files:**
- Create: `frontend/tailwind.theme.extend.ts`
- Modify: `frontend/vite.config.ts` (import theme extend if needed — check Tailwind v4 auto-import)
- Verify: `frontend/src/styles/tokens.css` (already exists, no change)

**Step 1: Create Tailwind theme extension map**

Create `frontend/tailwind.theme.extend.ts`:
```ts
// Maps CSS custom properties from tokens.css into Tailwind theme values.
// Usage: bg-brand-700, text-it-500, rounded-md, shadow-sm, etc.
import resolveConfig from 'tailwindcss/resolveConfig';

export const tokenColors = {
  brand: {
    50: 'var(--color-brand-50)',
    100: 'var(--color-brand-100)',
    300: 'var(--color-brand-300)',
    500: 'var(--color-brand-500)',
    700: 'var(--color-brand-700)',
    900: 'var(--color-brand-900)',
  },
  it: {
    50: 'var(--color-it-50)',
    100: 'var(--color-it-100)',
    500: 'var(--color-it-500)',
  },
  hr: {
    50: 'var(--color-hr-50)',
    100: 'var(--color-hr-100)',
    500: 'var(--color-hr-500)',
  },
  fin: {
    50: 'var(--color-fin-50)',
    100: 'var(--color-fin-100)',
    500: 'var(--color-fin-500)',
  },
  surface: 'var(--color-surface)',
  'surface-subtle': 'var(--color-surface-subtle)',
  'surface-muted': 'var(--color-surface-muted)',
  border: 'var(--color-border)',
  'border-subtle': 'var(--color-border-subtle)',
  'text-primary': 'var(--color-text-primary)',
  'text-secondary': 'var(--color-text-secondary)',
  'text-tertiary': 'var(--color-text-tertiary)',
  tertiary: 'var(--color-brand-700)', // Action color matches brand-700 / it-500
  danger: 'var(--color-danger)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
};

export const tokenSpacing = {
  1: 'var(--space-1)',
  2: 'var(--space-2)',
  3: 'var(--space-3)',
  4: 'var(--space-4)',
  5: 'var(--space-5)',
  6: 'var(--space-6)',
  8: 'var(--space-8)',
  10: 'var(--space-10)',
  12: 'var(--space-12)',
  16: 'var(--space-16)',
};

export const tokenRadius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  full: 'var(--radius-full)',
};

export const tokenShadow = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
};

export const tokenFontSize = {
  xs: 'var(--text-xs)',
  sm: 'var(--text-sm)',
  base: 'var(--text-base)',
  lg: 'var(--text-lg)',
  xl: 'var(--text-xl)',
  '2xl': 'var(--text-2xl)',
  '3xl': 'var(--text-3xl)',
  '4xl': 'var(--text-4xl)',
};
```

**Step 2: Wire into Tailwind v4 CSS config**

In `frontend/index.css`, add `@theme` block after imports:
```css
@import "tailwindcss";
@import "./src/styles/tokens.css";

@theme {
  --color-brand-50: var(--color-brand-50);
  --color-brand-100: var(--color-brand-100);
  --color-brand-300: var(--color-brand-300);
  --color-brand-500: var(--color-brand-500);
  --color-brand-700: var(--color-brand-700);
  --color-brand-900: var(--color-brand-900);
  --color-it-50: var(--color-it-50);
  --color-it-100: var(--color-it-100);
  --color-it-500: var(--color-it-500);
  --color-hr-50: var(--color-hr-50);
  --color-hr-100: var(--color-hr-100);
  --color-hr-500: var(--color-hr-500);
  --color-fin-50: var(--color-fin-50);
  --color-fin-100: var(--color-fin-100);
  --color-fin-500: var(--color-fin-500);
  --color-surface: var(--color-surface);
  --color-surface-subtle: var(--color-surface-subtle);
  --color-surface-muted: var(--color-surface-muted);
  --color-cwc-border: var(--color-border);
  --color-cwc-border-subtle: var(--color-border-subtle);
  --color-text-primary: var(--color-text-primary);
  --color-text-secondary: var(--color-text-secondary);
  --color-text-tertiary: var(--color-text-tertiary);
  --color-tertiary: var(--color-brand-700);
  --color-danger: var(--color-danger);
  --color-success: var(--color-success);
  --color-warning: var(--color-warning);
  --radius-cwc-sm: var(--radius-sm);
  --radius-cwc-md: var(--radius-md);
  --radius-cwc-lg: var(--radius-lg);
  --radius-cwc-xl: var(--radius-xl);
  --shadow-cwc-sm: var(--shadow-sm);
  --shadow-cwc-md: var(--shadow-md);
  --shadow-cwc-lg: var(--shadow-lg);
}
```

This makes `bg-brand-700`, `text-text-secondary`, `rounded-cwc-md`, `shadow-cwc-sm` etc. available as first-class Tailwind utilities.

**Step 3: Verify token classes work**

Add a test element in `App.tsx` temporarily:
```tsx
<div className="bg-brand-700 text-surface rounded-cwc-md p-4 shadow-cwc-sm">
  Token test — should be navy bg with white text
</div>
```

Run: `cd frontend && npm run dev`
Expected: Navy background, white text, medium rounded corners, small shadow.

**Step 4: Remove test element and commit**

```bash
cd frontend
git add index.css tailwind.theme.extend.ts
git commit -m "feat: wire design tokens into Tailwind theme utilities"
```

**Status:** [ ] Not started

---

## Phase 1 — Quick Wins (1–2 days each, high ROI)

### Task 1.1: Add breadcrumbs to all major pages

**Objective:** Users can orient themselves in deep workflow screens. Auditors noted complete absence except CreateRequest and ArticleDetail.

**Files:**
- Create: `frontend/src/components/Breadcrumbs.tsx`
- Modify: `frontend/pages/RequestDetail.tsx`
- Modify: `frontend/pages/MyRequests.tsx`
- Modify: `frontend/pages/KnowledgeBase.tsx`
- Modify: `frontend/pages/AgentDashboard.tsx`
- Modify: `frontend/pages/Reports.tsx`
- Modify: `frontend/pages/AdminSettings.tsx`
- Modify: `frontend/pages/CreateRequest.tsx` (already has partial — standardize)

**Step 1: Create Breadcrumbs component**

Create `frontend/src/components/Breadcrumbs.tsx`:
```tsx
import React from 'react';
import { Link } from 'react-router-dom';

interface Crumb {
  label: string;
  to?: string; // undefined = current page (non-clickable)
}

interface BreadcrumbsProps {
  items: Crumb[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => (
  <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-4">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && (
          <span className="material-symbols-outlined text-text-tertiary" style={{ fontSize: 16 }}>
            chevron_right
          </span>
        )}
        {item.to ? (
          <Link
            to={item.to}
            className="text-text-secondary hover:text-brand-700 transition-colors font-medium"
          >
            {item.label}
          </Link>
        ) : (
          <span className="text-text-primary font-semibold">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

export default Breadcrumbs;
```

**Step 2: Add to RequestDetail.tsx**

Inside the main container div (after `max-w-[1440px] mx-auto px-6 py-8`), add:
```tsx
import Breadcrumbs from '../src/components/Breadcrumbs';

// Inside render, before <RequestHeader>:
<Breadcrumbs items={[
  { label: 'Home', to: '/' },
  { label: 'My Requests', to: '/my-requests' },
  { label: request.referenceNumber },
]} />
```

**Step 3: Add to MyRequests.tsx**

```tsx
<Breadcrumbs items={[
  { label: 'Home', to: '/' },
  { label: 'My Requests' },
]} />
```

**Step 4: Add to remaining pages similarly**

- AgentDashboard: Home > Agent Dashboard
- Reports: Home > Reports
- AdminSettings: Home > Admin Console
- KnowledgeBase: Home > Knowledge Base
- ArticleDetail: Home > Knowledge Base > [Article Title]
- CreateRequest: Home > [Desk Name] > [Category Name] > New Request

**Step 5: Verify visually**

Run: `cd frontend && npm run dev`
Check: each page shows breadcrumb trail, links navigate correctly, current page is bold/non-clickable.

**Step 6: Commit**

```bash
git add src/components/Breadcrumbs.tsx pages/RequestDetail.tsx pages/MyRequests.tsx pages/AgentDashboard.tsx pages/Reports.tsx pages/AdminSettings.tsx pages/KnowledgeBase.tsx pages/ArticleDetail.tsx pages/CreateRequest.tsx
git commit -m "feat: add breadcrumbs to all major pages for navigation context"
```

**Status:** [ ] Not started

---

### Task 1.2: Add ARIA labels to icon-only buttons

**Objective:** All icon-only buttons have `aria-label` for screen readers. Audit found only 3 files using ARIA attributes across 102 components.

**Files:**
- Modify: `frontend/App.tsx` (header: notification bell, help button, hamburger, logout)
- Modify: `frontend/src/components/NotificationDropdown.tsx` (review existing `aria-label` and extend)
- Modify: `frontend/pages/Dashboard.tsx` (search button)
- Modify: `frontend/pages/MyRequests.tsx` (filter buttons need aria-pressed)
- Modify: `frontend/src/components/ToastContainer.tsx` (dismiss buttons)

**Step 1: Audit all icon-only buttons**

Search for `<button` elements with a `material-symbols-outlined` child and no text content. These need `aria-label`.

**Step 2: Add aria-label to App.tsx header buttons**

```tsx
// Notification bell (line ~105)
<button aria-label="Notifications" className="relative ...">

// Help button (line ~106)
<button aria-label="Help" className="hidden sm:flex ...">

// Logout button (line ~116)
<button aria-label="Sign out" onClick={handleLogout} ...>

// Hamburger menu (line ~126)
<button aria-label="Open navigation menu" className="md:hidden ..." onClick={() => setMobileMenuOpen(true)}>
```

**Step 3: Add aria-pressed to filter toggles in MyRequests**

```tsx
<button
  aria-pressed={filter === 'open'}
  aria-label="Show open requests"
  className={`...`}
>
```

**Step 4: Verify with accessibility devtools**

Run: `cd frontend && npm run dev`
Open Chrome DevTools > Accessibility panel. Verify all buttons have accessible names. No "unlabeled" warnings.

**Step 5: Commit**

```bash
git add App.tsx src/components/NotificationDropdown.tsx pages/Dashboard.tsx pages/MyRequests.tsx src/components/ToastContainer.tsx
git commit -m "a11y: add aria-label to all icon-only buttons and aria-pressed to filter toggles"
```

**Status:** [ ] Not started

---

### Task 1.3: Add focus traps to modals

**Objective:** All 29+ lazy-loaded modals trap keyboard focus when open, preventing tab escape to background. Required for WCAG 2.1.

**Files:**
- Modify: `frontend/package.json` (add dependency)
- Create: `frontend/src/components/ModalWrapper.tsx`
- Modify: All modal components to use ModalWrapper (can be done incrementally — start with the 5 most-used)

**Step 1: Install focus-trap dependency**

Run: `cd frontend && npm install focus-trap-react`
This is a lightweight (3KB) dependency used by Radix UI internally.

**Step 2: Create ModalWrapper component**

Create `frontend/src/components/ModalWrapper.tsx`:
```tsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FocusTrap from 'focus-trap-react';

interface ModalWrapperProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({
  open, onClose, title, children, maxWidth = '560px',
}) => {
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      prevFocus.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
      if (prevFocus.current) prevFocus.current.focus();
    };
  }, [open]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <FocusTrap active={open}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="bg-surface rounded-cwc-lg shadow-cwc-lg p-6 max-h-[90vh] overflow-y-auto"
          style={{ maxWidth, width: '100%', margin: '0 16px' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">{title}</h2>
            <button
              aria-label="Close dialog"
              onClick={onClose}
              className="rounded-cwc-md p-1.5 hover:bg-surface-muted transition-colors text-text-tertiary"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          {children}
        </div>
      </div>
    </FocusTrap>,
    document.body
  );
};

export default ModalWrapper;
```

**Step 3: Wrap the 5 most-used modals**

Modify these modals to use `<ModalWrapper>` instead of their current portal/overlay pattern:
1. `frontend/src/components/request/modals/ResolutionModal.tsx`
2. `frontend/src/components/request/modals/RejectionModal.tsx`
3. `frontend/src/components/request/modals/LOAApprovalModal.tsx`
4. `frontend/src/components/request/modals/ManagerDecisionModal.tsx`
5. `frontend/src/components/request/modals/ScheduleInterviewModal.tsx`

For each:
- Replace the outer `<div className="fixed inset-0...">` with `<ModalWrapper open={open} onClose={onClose} title="...">`
- Remove the manual overlay div and close button from the modal body
- Keep the form/content inner JSX unchanged

**Step 4: Verify keyboard trap**

Run: `cd frontend && npm run dev`
Open any request → click "Resolve" → press Tab repeatedly. Focus must cycle within the modal only. Press Escape, modal closes. Tab back into the page.

**Step 5: Commit**

```bash
git add package.json package-lock.json src/components/ModalWrapper.tsx src/components/request/modals/ResolutionModal.tsx src/components/request/modals/RejectionModal.tsx src/components/request/modals/LOAApprovalModal.tsx src/components/request/modals/ManagerDecisionModal.tsx src/components/request/modals/ScheduleInterviewModal.tsx
git commit -m "a11y: add ModalWrapper with focus trap, apply to 5 primary modals"
```

**Status:** [ ] Not started

---

### Task 1.4: Convert high-impact inline styles to Tailwind token classes

**Objective:** Reduce the 220 inline `style={{}}` instances by converting the highest-traffic pages. Focus on Dashboard hero and KnowledgeBase first (most visible to users).

**Files:**
- Modify: `frontend/pages/Dashboard.tsx` (hero section, stats strip, desk cards)
- Modify: `frontend/pages/KnowledgeBase.tsx` (nearly all inline styles)
- Modify: `frontend/pages/CreateRequest.tsx` (KB article sidebar)

**Step 1: Convert Dashboard hero section**

Replace the hero `style={{}}` block (~lines 125–195) with Tailwind token classes:
```tsx
// BEFORE (example):
<div style={{
  background: 'linear-gradient(160deg, #0d1830 0%, #1D2D5E 55%, #2a4a7f 100%)',
  padding: 'var(--space-12) var(--space-8)',
}}>

// AFTER:
<section className="bg-gradient-to-br from-brand-900 via-brand-700 to-[#2a4a7f] py-12 px-4 sm:px-8">
```

Convert the search bar from inline to:
```tsx
<div className="flex items-center gap-3 bg-white/12 backdrop-blur-sm border border-white/20 rounded-cwc-lg px-3 py-3 max-w-[560px] transition-colors focus-within:border-white/50">
  <span className="material-symbols-outlined text-white/50 text-xl">search</span>
  <input
    type="text"
    placeholder="Search for hardware, leave requests, expenses..."
    className="flex-1 bg-transparent border-none outline-none text-white text-base font-sans"
  />
  <button className="bg-surface text-brand-700 rounded-cwc-md px-5 py-1.5 text-sm font-extrabold whitespace-nowrap hover:bg-white/90 transition-colors">
    Search
  </button>
</div>
```

**Step 2: Convert KnowledgeBase.tsx**

Replace all `style={{ fontSize: 32, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}` etc. with:
```tsx
<h1 className="text-3xl font-bold text-brand-900 mb-2">Knowledge Base</h1>
<p className="text-text-secondary mb-6 text-lg">Browse articles, guides, and FAQs...</p>
<input className="w-full max-w-[480px] px-4 py-2.5 border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 outline-none" />
```

**Step 3: Verify visual parity**

Run: `cd frontend && npm run dev`
Compare before/after screenshots of Dashboard hero and KnowledgeBase. Must be pixel-close.

**Step 4: Commit**

```bash
git add pages/Dashboard.tsx pages/KnowledgeBase.tsx pages/CreateRequest.tsx
git commit -m "refactor: convert Dashboard hero and KnowledgeBase inline styles to Tailwind token classes"
```

**Status:** [ ] Not started

---

### Task 1.5: Add skeleton loaders to service desk pages

**Objective:** ITSupport, HRServices, GroupFinance pages show skeleton cards instead of bare spinner during data fetch.

**Files:**
- Modify: `frontend/pages/ITSupport.tsx`
- Modify: `frontend/pages/HRServices.tsx`
- Modify: `frontend/pages/GroupFinance.tsx`
- Already exists: `frontend/src/components/SkeletonRow.tsx`

**Step 1: Extract shared skeleton card component**

Create `frontend/src/components/SkeletonCategoryCard.tsx`:
```tsx
import React from 'react';

const SkeletonCategoryCard = () => (
  <div className="bg-surface border border-cwc-border rounded-cwc-lg p-6 animate-pulse">
    <div className="flex items-center gap-4 mb-3">
      <div className="w-12 h-12 rounded-cwc-md bg-surface-muted" />
      <div className="flex-1">
        <div className="h-4 w-32 bg-surface-muted rounded mb-2" />
        <div className="h-3 w-48 bg-surface-muted rounded" />
      </div>
    </div>
  </div>
);

export default SkeletonCategoryCard;
```

**Step 2: Replace spinners in ITSupport.tsx**

```tsx
// REPLACE the loading block (around line 67-74):
if (loading) {
  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <div className="h-8 w-48 bg-surface-muted rounded-cwc-md mb-6 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2, 3, 4, 5].map(i => <SkeletonCategoryCard key={i} />)}
      </div>
    </div>
  );
}
```

**Step 3: Apply same pattern to HRServices.tsx and GroupFinance.tsx**

Identical structure — same skeleton card grid.

**Step 4: Verify**

Run: `cd frontend && npm run dev`
Navigate to /it-support, /hr-services, /group-finance. Should see skeleton cards while data loads, not bare spinner.

**Step 5: Commit**

```bash
git add src/components/SkeletonCategoryCard.tsx pages/ITSupport.tsx pages/HRServices.tsx pages/GroupFinance.tsx
git commit -m "ux: add skeleton loaders to IT/HR/Finance service desk pages"
```

**Status:** [ ] Not started

---

### Task 1.6: Fix MyRequests client-side filtering → server-side

**Objective:** MyRequests currently fetches all requests then filters client-side. At 1,000+ employees and 10,000+ tickets, this breaks. Move filter params to API query.

**Files:**
- Modify: `frontend/pages/MyRequests.tsx`

**Step 1: Refactor fetchRequests to send filter params to API**

Replace the current pattern (lines ~58-97):
```tsx
// BEFORE: fetches all, then filters client-side
const data = await requestService.getAllRequests(filters);
let filteredRequests = data.requests || [];
if (filter === 'open') {
  const closedStatuses = [...]; // big array
  filteredRequests = filteredRequests.filter(r => !closedStatuses.includes(r.status));
}
```

With:
```tsx
// AFTER: send status filters to server
const filters: any = { page, limit, searcherId: user?.id };

if (searchTerm) filters.search = searchTerm;
if (selectedRequestTypeId) filters.requestTypeId = selectedRequestTypeId;

if (filter === 'open') {
  filters.excludedStatuses = RESOLVED_STATUSES.join(',');
} else if (filter === 'all') {
  // no status filter — fetch all for this user
} else if (filter === 'pending_approval' && approvalRole) {
  filters.status = PENDING_APPROVAL_STATUSES[approvalRole].join(',');
}

const data = await requestService.getAllRequests(filters);
setRequests(data.requests || []);
setTotalPages(data.totalPages || 1);
setTotal(data.total || 0);
```

**Note:** Backend may need a corresponding `excludedStatuses` query param. If the backend doesn't support it yet, a fallback is to send the full list of open statuses as `status=` param instead. Check `backend/src/controllers/request.controller.ts` for supported query params.

**Step 2: Verify pagination works correctly**

Run: `cd frontend && npm run dev`
Create >10 requests. Verify pagination changes. Verify "Open" filter shows only non-resolved. Verify page count updates correctly.

**Step 3: Commit**

```bash
git add pages/MyRequests.tsx
git commit -m "perf: move MyRequests filtering from client-side to server-side query params"
```

**Status:** [ ] Not started

---

### Task 1.7: Add user-friendly error boundary messages

**Objective:** Replace raw `err.message` exposure with friendly, actionable error text. Audit found ~15 instances of `setError(err.message || 'Failed to load...')`.

**Files:**
- Create: `frontend/src/utils/errorMessages.ts`
- Modify: `frontend/pages/ITSupport.tsx`
- Modify: `frontend/pages/HRServices.tsx`
- Modify: `frontend/pages/GroupFinance.tsx`
- Modify: `frontend/pages/Dashboard.tsx`
- Modify: `frontend/pages/KnowledgeBase.tsx`
- Modify: `frontend/pages/MyRequests.tsx`
- Modify: `frontend/pages/CreateRequest.tsx`

**Step 1: Create error message map**

Create `frontend/src/utils/errorMessages.ts`:
```ts
const ERROR_MESSAGES: Record<number, string> = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You don\'t have permission to access this. Contact your administrator.',
  404: 'The requested resource was not found. It may have been deleted or moved.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Our team has been notified. Please try again later.',
  502: 'The service is temporarily unavailable. Please try again in a few moments.',
  503: 'The service is under maintenance. Please try again later.',
};

export function friendlyMessage(error: any, fallback: string): string {
  const status = error?.response?.status;
  if (status && ERROR_MESSAGES[status]) return ERROR_MESSAGES[status];
  if (error?.message?.includes('Network Error')) return 'Unable to connect to the server. Check your internet connection.';
  if (error?.message?.includes('timeout')) return 'The request took too long. Please try again.';
  return fallback;
}
```

**Step 2: Replace error catches in ITSupport.tsx**

```tsx
// BEFORE:
catch (err: any) {
  setError(err.message || 'Failed to load service desk');
}

// AFTER:
import { friendlyMessage } from '../src/utils/errorMessages';
catch (err: any) {
  setError(friendlyMessage(err, 'Unable to load IT Support categories. Please refresh or contact IT.'));
}
```

**Step 3: Apply to remaining pages with appropriate fallback messages**

- HRServices: `'Unable to load HR Services. Please try again.'`
- GroupFinance: `'Unable to load Group Finance categories. Please try again.'`
- Dashboard: `'Unable to load your dashboard. Please refresh the page.'`
- KnowledgeBase: `'Unable to load articles. Please try again.'`
- MyRequests: `'Unable to load requests. Please refresh.'`
- CreateRequest: `'Unable to load request form. Please try again.'`

**Step 4: Verify**

Deliberately break an API endpoint (e.g., temporarily change a URL) and navigate to each page. Verify friendly error messages appear, not raw stack traces.

**Step 5: Commit**

```bash
git add src/utils/errorMessages.ts pages/ITSupport.tsx pages/HRServices.tsx pages/GroupFinance.tsx pages/Dashboard.tsx pages/KnowledgeBase.tsx pages/MyRequests.tsx pages/CreateRequest.tsx
git commit -m "ux: replace raw API error messages with user-friendly fallbacks"
```

**Status:** [ ] Not started

---

### Task 1.8: Add aria-live to ToastContainer and skip-navigation link

**Objective:** Screen readers announce toast notifications. Skip-nav link lets keyboard users jump past the header.

**Files:**
- Modify: `frontend/src/components/ToastContainer.tsx`
- Modify: `frontend/App.tsx` (add skip-nav)

**Step 1: Add aria-live to ToastContainer**

Find the toast container div and add `aria-live="polite"` and `role="status"`:
```tsx
<div
  role="status"
  aria-live="polite"
  aria-label="Notifications"
  className="fixed bottom-4 right-4 z-[200] ..."
>
```

**Step 2: Add skip-navigation link in App.tsx**

Before the `<header>` element, add:
```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:bg-brand-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-cwc-md focus:text-sm focus:font-bold"
>
  Skip to main content
</a>
```

And add `id="main-content"` to the main content wrapper.

**Step 3: Verify**

Run: `cd frontend && npm run dev`
Press Tab on page load — skip link should appear. Trigger a toast, inspect DOM for `aria-live="polite"`.

**Step 4: Commit**

```bash
git add src/components/ToastContainer.tsx App.tsx
git commit -m "a11y: add aria-live to toasts and skip-navigation link"
```

**Status:** [ ] Not started

---

### Task 1.9: Add mobile-responsive login page

**Objective:** Login brand panel (`width: 420px`, fixed) breaks on phones. Stack vertically on <768px.

**Files:**
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Register.tsx` (same layout)

**Step 1: Replace fixed-width brand panel with responsive layout**

```tsx
// BEFORE:
const brandPanelStyle: React.CSSProperties = {
  width: '420px',
  flexShrink: 0,
  minHeight: '100vh',
  ...
};

// AFTER — remove the fixed width; use Tailwind responsive classes on parent:
// On the parent flex container:
<div className="flex flex-col md:flex-row min-h-screen">
  {/* Brand panel — full-width on mobile, 420px sidebar on desktop */}
  <div className="w-full md:w-[420px] flex-shrink-0 min-h-[280px] md:min-h-screen"
       style={{ background: 'linear-gradient(160deg, #0d1830 0%, #1D2D5E 55%, #2a4a7f 100%)', ... }}>
    <BrandPanel ... />
  </div>

  {/* Form panel — takes remaining space */}
  <div className="flex-1 flex items-center justify-center p-6 md:p-12">
    ...
  </div>
</div>
```

**Step 2: Verify on mobile viewport**

Run: `cd frontend && npm run dev`
Open Chrome DevTools → toggle to iPhone 14 viewport (390px). Brand panel should stack on top (truncated height). Form below. Full-width inputs.

**Step 3: Commit**

```bash
git add src/pages/Login.tsx src/pages/Register.tsx
git commit -m "fix: make login/register responsive — stack layout on mobile"
```

**Status:** [ ] Not started

---

### Task 1.10: Sync WCAG badge contrast from DESIGN.md to STATUS_CONFIG

**Objective:** The DESIGN.md lint fixed badge contrast with darker text colors (#065F46, #92400E, #991B1B). The frontend `constants.tsx` STATUS_CONFIG still uses the old Tailwind classes that fail WCAG AA.

**Files:**
- Modify: `frontend/constants.tsx`

**Step 1: Update STATUS_CONFIG badge colors**

Audit all entries that use `bg-*-100` + `text-*-700` combinations. The Tailwind default `text-*-700` on `bg-*-100` typically passes, but `text-*-500` on `bg-*-100` does not (these appear in some statuses). Search and fix any instances using `*-500` text on `*-100` bg.

Common patterns to fix:
- `text-emerald-700 bg-emerald-100` → OK (4.6:1)
- `text-orange-700 bg-orange-100` → OK
- `text-red-700 bg-red-100` → OK
- Any `text-*-500 bg-*-100` → change to `text-*-700 bg-*-100`

Do a programmatic search:
```bash
grep -n 'text-.*-500.*bg-.*-100' constants.tsx
```

**Step 2: Verify with contrast checker**

Use a browser contrast checker tool or audit tab. All badge text-on-bg pairs must meet 4.5:1 AA ratio.

**Step 3: Commit**

```bash
git add constants.tsx
git commit -m "a11y: fix WCAG badge contrast in STATUS_CONFIG — use -700 text on -100 bg"
```

**Status:** [ ] Not started

---

## Phase 2 — Critical Fixes (3–5 days each)

### Task 2.1: Add responsive breakpoints across all pages

**Objective:** Make all pages usable at 320px–1440px. Currently pages use `max-w-[1440px]` and `px-6` with no responsive grid adaptations below `sm:`.

**Files:**
- Modify: `frontend/App.tsx` (header + mobile drawer)
- Modify: `frontend/pages/Dashboard.tsx` (hero → stack, cards → single column)
- Modify: `frontend/pages/MyRequests.tsx` (table → card list on mobile)
- Modify: `frontend/pages/AgentDashboard.tsx` (table → card list)
- Modify: `frontend/pages/RequestDetail.tsx` (two-column → single column)
- Modify: `frontend/pages/AdminSettings.tsx` (sidebar → tab bar)
- Modify: `frontend/pages/Reports.tsx` (grid → stack)

**Sub-tasks:**

**2.1a: Mobile slide-out drawer in App.tsx**

Replace the current `mobileMenuOpen` dropdown with a slide-out drawer:
```tsx
{/* Mobile drawer — slides from left */}
<div className={`fixed inset-0 z-[60] md:hidden ${mobileMenuOpen ? '' : 'pointer-events-none'}`}>
  {/* Backdrop */}
  <div
    className={`fixed inset-0 bg-black/40 transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
    onClick={() => setMobileMenuOpen(false)}
  />
  {/* Panel */}
  <aside className={`fixed top-0 left-0 bottom-0 w-72 bg-surface shadow-cwc-lg transform transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="p-4 border-b border-cwc-border flex items-center justify-between">
      <span className="text-lg font-bold text-brand-700">Menu</span>
      <button aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} className="p-2">
        <span className="material-symbols-outlined">close</span>
      </button>
    </div>
    <nav className="p-4 space-y-1">
      {navLinks.map(link => (
        <Link
          key={link.to}
          to={link.to}
          className={`block px-4 py-3 rounded-cwc-md text-sm font-semibold transition-colors ${
            isActive(link.to) ? 'bg-brand-50 text-brand-700' : 'text-text-secondary hover:bg-surface-muted'
          }`}
          onClick={() => setMobileMenuOpen(false)}
        >
          {link.label}
        </Link>
      ))}
    </nav>
    {/* User section */}
    {isAuthenticated && user && (
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cwc-border">
        <p className="text-sm font-semibold text-text-primary">{user.firstName} {user.lastName}</p>
        <button onClick={handleLogout} className="mt-2 text-sm text-danger font-semibold">Sign out</button>
      </div>
    )}
  </aside>
</div>
```

**2.1b: Make Request Detail responsive**

At `<768px`, change from 2-col layout to single column:
```tsx
// BEFORE:
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

// AFTER:
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Main column — always full width on mobile */}
  <div className="lg:col-span-2">...</div>
  {/* Sidebar — full width on mobile, right column on desktop */}
  <div className="lg:col-span-1">...</div>
</div>
```

**2.1c: Make Agent Dashboard table responsive**

Wrap the table in an overflow container:
```tsx
<div className="overflow-x-auto -mx-6 px-6">
  <table className="min-w-[800px] w-full">...</table>
</div>
```

**2.1d: Admin sidebar → horizontal tab bar on mobile**

```tsx
// Mobile: horizontal scrollable tabs
<aside className="w-full md:w-56 flex-shrink-0 sticky top-20 md:block">
  <nav className="md:bg-surface md:rounded-2xl md:border md:border-cwc-border md:shadow-cwc-sm overflow-hidden">
    {/* Desktop: vertical list */}
    <div className="hidden md:block">
      {sidebar items...}
    </div>
    {/* Mobile: horizontal scrollable tab bar */}
    <div className="md:hidden flex overflow-x-auto gap-1 p-2 border-b border-cwc-border">
      {ADMIN_TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => admin.setActiveTab(tab.id)}
          className={`whitespace-nowrap px-3 py-2 rounded-cwc-md text-xs font-bold transition-colors ${
            admin.activeTab === tab.id ? 'bg-brand-50 text-brand-700' : 'text-text-secondary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </nav>
</aside>
```

**Verification:** Test every page at 375px (iPhone SE), 768px (iPad), 1440px (desktop).

**Status:** [ ] Not started

---

### Task 2.2: Abstract workflow action modals into a config-driven framework

**Objective:** 29 separate modal files is unmaintainable. Create a single `WorkflowActionModal` driven by a config map. New workflow steps = one config entry, not one new file.

**Files:**
- Create: `frontend/src/components/request-detail/WorkflowActionModal.tsx`
- Create: `frontend/src/utils/workflowModalConfig.ts`
- Modify: `frontend/src/components/request-detail/ActionSidebar.tsx` (use new modal)
- Deprecate: 29 individual modal files (keep for now, remove imports)

**Step 1: Define modal config schema**

Create `frontend/src/utils/workflowModalConfig.ts`:
```ts
export type FieldType = 'text' | 'textarea' | 'select' | 'date' | 'file' | 'number' | 'checkbox';

export interface ModalFieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  accept?: string; // for file type
}

export interface ModalConfig {
  title: string;
  description?: string;
  fields: ModalFieldConfig[];
  submitLabel: string;
  submitColor?: 'primary' | 'danger' | 'warning';
  confirmationMessage?: string; // show before final submit
}

// Each workflow action maps to a config
export const WORKFLOW_MODAL_CONFIG: Record<string, ModalConfig> = {
  APPROVE: {
    title: 'Approve Request',
    fields: [
      { name: 'comment', label: 'Comment', type: 'textarea', placeholder: 'Optional approval note...' },
    ],
    submitLabel: 'Approve',
    submitColor: 'primary',
  },
  REJECT: {
    title: 'Reject Request',
    fields: [
      { name: 'reason', label: 'Rejection Reason', type: 'textarea', required: true, placeholder: 'Explain why this is being rejected...' },
    ],
    submitLabel: 'Reject',
    submitColor: 'danger',
  },
  SUBMIT_FOR_APPROVAL: {
    title: 'Submit for Approval',
    fields: [
      { name: 'comment', label: 'Note to Approver', type: 'textarea', placeholder: 'Any context for the approver...' },
    ],
    submitLabel: 'Submit',
  },
  PROCUREMENT: {
    title: 'Procurement In Progress',
    fields: [
      { name: 'vendor', label: 'Vendor', type: 'text', required: true },
      { name: 'estimatedCost', label: 'Estimated Cost (MYR)', type: 'number', required: true },
      { name: 'poNumber', label: 'PO Number', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
    ],
    submitLabel: 'Confirm Procurement',
  },
  HARDWARE_ORDERED: {
    title: 'Mark Hardware as Ordered',
    fields: [
      { name: 'orderRef', label: 'Order Reference', type: 'text', required: true },
      { name: 'estimatedDelivery', label: 'Estimated Delivery', type: 'date', required: true },
    ],
    submitLabel: 'Confirm Order',
  },
  // ... add all 29 action configs
};
```

**Step 2: Create generic WorkflowActionModal**

Create `frontend/src/components/request-detail/WorkflowActionModal.tsx`:
```tsx
import React, { useState } from 'react';
import ModalWrapper from '../ModalWrapper';
import { WORKFLOW_MODAL_CONFIG, ModalConfig } from '../../utils/workflowModalConfig';

interface Props {
  actionType: string;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => Promise<void>;
}

const WorkflowActionModal: React.FC<Props> = ({ actionType, open, onClose, onSubmit }) => {
  const config = WORKFLOW_MODAL_CONFIG[actionType];
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!config) return null; // Fallback: unknown action types still use old modals

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await onSubmit(formData);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: ModalConfig['fields'][0]) => {
    const value = formData[field.name] ?? '';
    const baseClass = "w-full px-3 py-2.5 border border-cwc-border rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 focus:border-brand-700 outline-none transition-all";

    switch (field.type) {
      case 'textarea':
        return <textarea {...} className={baseClass} />;
      case 'select':
        return <select {...} className={baseClass} />;
      case 'date':
        return <input type="date" {...} className={baseClass} />;
      case 'file':
        return <input type="file" {...} className={baseClass} />;
      case 'checkbox':
        return <input type="checkbox" ... />;
      default:
        return <input type="text" {...} className={baseClass} />;
    }
  };

  return (
    <ModalWrapper open={open} onClose={onClose} title={config.title}>
      {config.description && <p className="text-sm text-text-secondary mb-4">{config.description}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {config.fields.map(field => (
          <div key={field.name}>
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              {field.label} {field.required && <span className="text-danger">*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-surface-muted rounded-cwc-md transition-colors">Cancel</button>
          <button
            type="submit"
            disabled={submitting}
            className={`px-4 py-2.5 text-sm font-bold rounded-cwc-md transition-colors ${
              config.submitColor === 'danger' ? 'bg-danger text-white hover:bg-red-700' :
              config.submitColor === 'warning' ? 'bg-warning text-white hover:bg-amber-600' :
              'bg-brand-700 text-white hover:bg-brand-900'
            } ${submitting ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {submitting ? 'Processing...' : config.submitLabel}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default WorkflowActionModal;
```

**Step 3: Update ActionSidebar to use WorkflowActionModal**

Instead of 29 `lazy()` imports and a massive switch statement, use:
```tsx
const [activeAction, setActiveAction] = useState<string | null>(null);

// On action click:
setActiveAction(action.type);

// Render:
{activeAction && WORKFLOW_MODAL_CONFIG[activeAction] ? (
  <WorkflowActionModal
    actionType={activeAction}
    open={!!activeAction}
    onClose={() => setActiveAction(null)}
    onSubmit={(data) => handleWorkflowAction(activeAction, data)}
  />
) : activeAction ? (
  // Legacy modals for actions not yet in config
  <LegacyModalSwitch actionType={activeAction} ... />
) : null}
```

**Step 4: Migrate actions incrementally**

Start with APPROVE, REJECT, SUBMIT_FOR_APPROVAL, PROCUREMENT. Add others to `workflowModalConfig.ts` as needed. Delete old modal files only when migrated.

**Status:** [ ] Not started

---

### Task 2.3: Add optimistic UI updates for key mutations

**Objective:** Ticket creation, comments, and approvals feel instant instead of blocking.

**Files:**
- Modify: `frontend/pages/CreateRequest.tsx` (optimistic redirect)
- Modify: `frontend/src/components/request-detail/ActivityFeed.tsx` (optimistic comment append)
- Modify: `frontend/src/components/request-detail/ActionSidebar.tsx` (optimistic status change)

**Step 1: Optimistic comment in ActivityFeed**

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!comment.trim()) return;

  // Optimistic append
  const tempId = `temp-${Date.now()}`;
  const optimisticActivity = {
    id: tempId,
    activityType: 'COMMENT',
    message: comment,
    authorName: `${currentUser.firstName} ${currentUser.lastName}`,
    authorRole: null,
    isSystemGenerated: false,
    isInternal,
    createdAt: new Date().toISOString(),
  };

  setActivities(prev => [...prev, optimisticActivity]);
  setComment('');
  setIsInternal(false);

  try {
    await onSubmitComment(comment, isInternal);
    // Replace temp entry with server response (or just leave it — timestamps may differ minimally)
  } catch {
    // Rollback: remove the optimistic entry
    setActivities(prev => prev.filter(a => a.id !== tempId));
    // Show error toast
  }
};
```

**Step 2: Optimistic approval in ActionSidebar**

After clicking "Approve", immediately:
1. Update the local request status to the next status
2. Show a success toast
3. If the API fails, revert status and show error

**Step 3: Verify**

Submit a comment — it should appear instantly. If API is slow (add 2s delay), the comment still appears immediately. If API errors, comment disappears with error toast.

**Status:** [ ] Not started

---

### Task 2.4: Add error monitoring (Sentry integration)

**Objective:** Production errors are invisible. Add Sentry to capture unhandled exceptions and API failures.

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/services/sentry.ts`
- Modify: `frontend/src/main.tsx` (init Sentry before React)

**Step 1: Install Sentry**

```bash
cd frontend && npm install @sentry/react
```

**Step 2: Create Sentry init module**

Create `frontend/src/services/sentry.ts`:
```ts
import * as Sentry from '@sentry/react';

export function initSentry() {
  if (import.meta.env.PROD) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      environment: import.meta.env.MODE,
    });
  }
}
```

**Step 3: Initialize in main.tsx**

```tsx
import { initSentry } from './services/sentry';
initSentry();
```

**Step 4: Wrap App in Sentry ErrorBoundary**

```tsx
import * as Sentry from '@sentry/react';

// Replace React.ErrorBoundary with Sentry's:
const App = () => (
  <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
    <AuthProvider>
      ...
    </AuthProvider>
  </Sentry.ErrorBoundary>
);
```

**Step 5: Commit**

```bash
git add package.json package-lock.json src/services/sentry.ts src/main.tsx App.tsx
git commit -m "infra: add Sentry error monitoring for production"
```

**Status:** [ ] Not started

---

## Phase 3 — Premium Upgrades (1–2 weeks each)

### Task 3.1: Multi-step ticket creation wizard

**Objective:** Replace the 590-line single-form with a 4-step wizard: (1) Desk+Category, (2) Request Type, (3) Details, (4) Review & Submit.

**Files:**
- Create: `frontend/src/components/create-request/WizardStepper.tsx`
- Create: `frontend/src/components/create-request/StepDeskCategory.tsx`
- Create: `frontend/src/components/create-request/StepRequestType.tsx`
- Create: `frontend/src/components/create-request/StepDetails.tsx`
- Create: `frontend/src/components/create-request/StepReview.tsx`
- Create: `frontend/src/components/create-request/useCreateRequestWizard.ts`
- Refactor: `frontend/pages/CreateRequest.tsx`

**Step 1: Create wizard state hook**

```tsx
// useCreateRequestWizard.ts
export type WizardStep = 'desk' | 'type' | 'details' | 'review';

export function useCreateRequestWizard() {
  const [step, setStep] = useState<WizardStep>('desk');
  const [selectedDesk, setSelectedDesk] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({ summary: '', description: '', urgency: 'MEDIUM', customFields: {} });

  const canProceed = useMemo(() => {
    switch (step) {
      case 'desk': return !!selectedDesk && !!selectedCategory;
      case 'type': return !!selectedType;
      case 'details': return !!formData.summary;
      case 'review': return true;
    }
  }, [step, selectedDesk, selectedCategory, selectedType, formData]);

  return { step, setStep, canProceed, selectedDesk, setSelectedDesk, ... };
}
```

**Step 2: Create WizardStepper visual component**

A horizontal progress bar showing 4 steps with active/completed/upcoming states.

**Step 3: Build step components and wire into CreateRequest.tsx**

Each step renders its component. "Next" / "Back" buttons at the bottom. Final step shows review summary + submit.

**Status:** [ ] Not started

---

### Task 3.2: Unified Approver Queue page

**Objective:** Single `/approvals` page showing all pending approval items for the current user, with bulk actions.

**Files:**
- Create: `frontend/pages/ApprovalQueue.tsx`
- Modify: `frontend/App.tsx` (add route)
- Create: `frontend/src/services/approval.service.ts`

**Features:**
- Table of all requests pending the current user's approval role
- One-click Approve/Reject inline (no need to open each ticket)
- Bulk select with bulk approve/reject
- Filter by desk type, priority, SLA status

**Status:** [ ] Not started

---

### Task 3.3: Dark mode support

**Objective:** Use the existing design token system to add `dark:` variants, toggled via user preference.

**Files:**
- Modify: `frontend/src/styles/tokens.css` (add dark mode palette)
- Create: `frontend/src/context/ThemeContext.tsx`
- Create: `frontend/src/hooks/useTheme.ts`
- Modify: All page components (add `dark:` classes incrementally)
- Modify: `frontend/App.tsx` (theme toggle button)

**Step 1: Define dark token palette in tokens.css**

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-brand-900: #0a1225;
    --color-brand-700: #1a2744;
    --color-surface: #1a1a2e;
    --color-surface-subtle: #16213e;
    --color-surface-muted: #1f2937;
    --color-border: #374151;
    --color-border-subtle: #1f2937;
    --color-text-primary: #f1f5f9;
    --color-text-secondary: #94a3b8;
    --color-text-tertiary: #6b7280;
  }
}
```

**Step 2: Create ThemeContext with manual override**

```tsx
// ThemeContext.tsx
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  
  useEffect(() => {
    const resolved = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};
```

**Step 3: Add toggle to header**

A sun/moon icon in App.tsx header.

**Status:** [ ] Not started

---

### Task 3.4: i18n setup (internationalization foundation)

**Objective:** Lay the groundwork so CWC can be deployed in multilingual environments.

**Files:**
- Modify: `frontend/package.json` (add `i18next`, `react-i18next`)
- Create: `frontend/src/i18n/en.json`
- Create: `frontend/src/i18n/config.ts`
- Modify: `frontend/src/main.tsx` (init i18n)
- Modify: `frontend/pages/Dashboard.tsx` (pilot: extract all strings to i18n keys)

**Step 1: Install i18next**

```bash
cd frontend && npm install i18next react-i18next i18next-browser-languagedetector
```

**Step 2: Create English locale file**

Extract all user-facing strings from Dashboard.tsx as the pilot:
```json
{
  "dashboard": {
    "greeting": "Good {{period}}, {{name}}.",
    "search_placeholder": "Search for hardware, leave requests, expenses...",
    "stat_open": "Open Requests",
    "stat_action": "Action Required",
    "stat_resolved": "Resolved All Time"
  }
}
```

**Step 3: Use `useTranslation()` in Dashboard**

```tsx
const { t } = useTranslation();
// Replace: `Good ${period}, ${firstName}.` → t('dashboard.greeting', { period, name: firstName })
```

**Status:** [ ] Not started

---

## Tracking Summary

| Phase | Task | Priority | Effort | Status | Depends on |
|-------|------|----------|--------|--------|-------------|
| 0 | 0.1 Tailwind theme token sync | P0 | 4h | [ ] | — |
| 1 | 1.1 Breadcrumbs | P1 | 1d | [ ] | 0.1 |
| 1 | 1.2 ARIA labels | P1 | 2h | [ ] | — |
| 1 | 1.3 Focus traps (5 modals) | P1 | 1d | [ ] | — |
| 1 | 1.4 Inline styles → Tailwind | P1 | 1d | [ ] | 0.1 |
| 1 | 1.5 Skeleton loaders | P1 | 2h | [ ] | — |
| 1 | 1.6 Server-side filtering | P1 | 3h | [ ] | — |
| 1 | 1.7 Friendly error messages | P1 | 4h | [ ] | — |
| 1 | 1.8 aria-live + skip-nav | P1 | 1h | [ ] | — |
| 1 | 1.9 Mobile login | P1 | 4h | [ ] | — |
| 1 | 1.10 Badge WCAG contrast | P1 | 1h | [ ] | — |
| 2 | 2.1 Responsive breakpoints | P0 | 3d | [ ] | 0.1, 1.9 |
| 2 | 2.2 Modal framework | P1 | 5d | [ ] | 1.3 |
| 2 | 2.3 Optimistic UI | P1 | 3d | [ ] | — |
| 2 | 2.4 Sentry integration | P1 | 4h | [ ] | — |
| 3 | 3.1 Multi-step wizard | P2 | 2w | [ ] | 2.2 |
| 3 | 3.2 Approver queue | P2 | 1w | [ ] | — |
| 3 | 3.3 Dark mode | P2 | 2w | [ ] | 0.1 |
| 3 | 3.4 i18n foundation | P2 | 1w | [ ] | — |

**Total estimated effort:** ~8 weeks (1 person), ~3 weeks (3 parallel agents)

**Production readiness progression:**
- Current: 55%
- After Phase 1: ~68%
- After Phase 2: ~78%
- After Phase 3: ~85%+

**Recommended execution order (by impact):**
1. Phase 0 → Task 0.1 (enables everything else)
2. Quick wins in any order (1.2, 1.5, 1.8, 1.10 can be parallel)
3. Task 2.1 (mobile — most critical gap)
4. Task 1.1 (breadcrumbs — high visibility)
5. Task 1.3 → 2.2 (focus traps then modal framework — sequential dependency)
6. Remaining Phase 2 tasks (2.3, 2.4)
7. Phase 3 tasks in priority order (3.1 > 3.2 > 3.3 > 3.4)
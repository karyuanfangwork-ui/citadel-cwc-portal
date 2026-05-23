# Sidebar & Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the sidebar into 4 clear nav groups, add direct ITSM service desk links, add a "New Request" CTA, fix duplicate Announcements, and clean up the Dashboard hero.

**Architecture:** Three focused file changes — `navConfig.ts` (data), `LeftRail.tsx` (shell rendering), `Dashboard.tsx` (page layout). No new components needed; all changes are additive edits to existing files.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, React Router v7, Material Symbols icons

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/components/layout/navConfig.ts` | Add `service-desks` group, rename `secondary`→`tools`, rename "Agent"→"Support Queue", rename "Announcements" (admin)→"Manage Announcements", move Reports/Insights to `admin` group |
| `frontend/src/components/layout/LeftRail.tsx` | Register `service-desks` in `groups` array + `groupLabels`, add "New Request" CTA above nav groups |
| `frontend/pages/Dashboard.tsx` | Replace hero section (lines 145–189) with compact greeting row; remove `searchQuery` state and `handleSearch`; remove `useNavigate` if unused after removal |

---

## Task 1: Restructure navConfig.ts

**Files:**
- Modify: `frontend/src/components/layout/navConfig.ts`

This is pure data — no tests needed. The change is a straightforward replacement of the nav array.

- [ ] **Step 1: Replace the full navConfig array**

Open `frontend/src/components/layout/navConfig.ts` and replace the entire file content with:

```ts
import { hasPermission, hasAnyPermission, hasAnyRole } from '@/src/utils/permissions';
import { isFeatureEnabled } from '@/src/lib/featureFlags';

export type NavLinkConfig = {
  to: string;
  label: string;
  icon: string;
  group: 'primary' | 'service-desks' | 'tools' | 'admin';
  show: boolean;
};

export const buildNavLinks = (user: any): NavLinkConfig[] => [
  // ── Main ──────────────────────────────────────────────────────────
  { to: '/',              label: 'Dashboard',     icon: 'space_dashboard', group: 'primary', show: true },
  { to: '/my-requests',   label: 'My Requests',   icon: 'assignment',      group: 'primary', show: true },
  { to: '/inbox',         label: 'Inbox',         icon: 'inbox',           group: 'primary', show: true },
  { to: '/announcements', label: 'Announcements', icon: 'campaign',        group: 'primary', show: true },
  { to: '/approvals',     label: 'Approvals',     icon: 'approval',        group: 'primary', show: hasAnyPermission(user, ['request:approve', 'credit:approve']) },
  { to: '/agent',         label: 'Support Queue', icon: 'support_agent',   group: 'primary', show: hasAnyRole(user, ['ADMIN', 'AGENT']) },

  // ── Service Desks ─────────────────────────────────────────────────
  { to: '/it',      label: 'IT Support',    icon: 'computer',       group: 'service-desks', show: true },
  { to: '/hr',      label: 'HR Services',   icon: 'groups',         group: 'service-desks', show: true },
  { to: '/finance', label: 'Group Finance', icon: 'payments',       group: 'service-desks', show: true },

  // ── Tools ─────────────────────────────────────────────────────────
  { to: '/assets', label: 'IT Assets',     icon: 'devices',      group: 'tools', show: hasAnyPermission(user, ['asset:read']) },
  { to: '/crm',    label: 'CRM',           icon: 'group',        group: 'tools', show: hasAnyPermission(user, ['crm:read']) },
  { to: '/credit', label: 'Credit',        icon: 'account_balance', group: 'tools', show: hasAnyPermission(user, ['credit:read']) },
  { to: '/kb',     label: 'Knowledge Base', icon: 'menu_book',   group: 'tools', show: isFeatureEnabled('kb') },

  // ── Admin ─────────────────────────────────────────────────────────
  { to: '/reports',             label: 'Reports',              icon: 'assessment', group: 'admin', show: hasPermission(user, 'report:read') },
  { to: '/insights',            label: 'Insights',             icon: 'insights',   group: 'admin', show: hasPermission(user, 'report:read') },
  { to: '/admin/settings',      label: 'Admin Settings',       icon: 'settings',   group: 'admin', show: hasPermission(user, 'admin:access') },
  { to: '/admin/audit',         label: 'Audit Trail',          icon: 'history',    group: 'admin', show: hasPermission(user, 'admin:access') },
  { to: '/admin/announcements', label: 'Manage Announcements', icon: 'campaign',   group: 'admin', show: hasPermission(user, 'announcement:write') },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors. If you see errors about the `group` type in `LeftRail.tsx`, that's expected — Task 2 fixes them.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/navConfig.ts
git commit -m "feat(nav): restructure nav into 4 groups, add service desks, fix duplicate Announcements"
```

---

## Task 2: Update LeftRail.tsx — new groups + New Request CTA

**Files:**
- Modify: `frontend/src/components/layout/LeftRail.tsx`

- [ ] **Step 1: Update `groupLabels` and `groups` array**

In `LeftRail.tsx`, find these two lines:

```ts
const groupLabels: Record<string, string> = {
  primary: 'Main',
  secondary: 'Modules',
  admin: 'Admin',
};
```

and

```ts
const groups = ['primary', 'secondary', 'admin'] as const;
```

Replace both with:

```ts
const groupLabels: Record<string, string> = {
  primary: 'Main',
  'service-desks': 'Service Desks',
  tools: 'Tools',
  admin: 'Admin',
};

const groups = ['primary', 'service-desks', 'tools', 'admin'] as const;
```

- [ ] **Step 2: Add "New Request" CTA above the nav groups**

In `LeftRail.tsx`, find the opening of the `<nav>` element:

```tsx
<nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
  {groups.map((group) => {
```

Replace that opening with:

```tsx
<nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
  {/* New Request CTA */}
  <div className="px-2 pb-1">
    <Link
      to="/it"
      title="New Request"
      className={`flex items-center gap-2 rounded-cwc-md bg-brand-700 text-white text-sm font-bold h-9 transition-colors hover:bg-brand-800 ${
        expanded ? 'px-3' : 'px-0 justify-center'
      }`}
    >
      <span className="material-symbols-outlined text-lg flex-shrink-0">add_circle</span>
      <span
        className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${
          expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
        }`}
      >
        New Request
      </span>
    </Link>
  </div>

  {groups.map((group) => {
```

> Note: The "New Request" CTA links to `/it` (IT Support) as the default service desk entry point — a reasonable starting point that navigates to the full service desk list. This can be changed to a dedicated `/new-request` picker page if one is built later.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/LeftRail.tsx
git commit -m "feat(nav): add New Request CTA and register service-desks/tools/admin groups in LeftRail"
```

---

## Task 3: Clean up Dashboard hero

**Files:**
- Modify: `frontend/pages/Dashboard.tsx`

The hero section occupies lines 145–189. Remove it and the associated state/handler. Replace with a compact single-line greeting.

- [ ] **Step 1: Remove `searchQuery` state and `handleSearch`**

Find and delete these lines (around line 94 and 98–103):

```ts
const [searchQuery, setSearchQuery] = useState('');
```

and

```ts
const handleSearch = () => {
  const q = searchQuery.trim();
  if (q) {
    navigate(`/search?q=${encodeURIComponent(q)}`);
  }
};
```

- [ ] **Step 2: Remove `useNavigate` import if it's no longer used**

Check if `navigate` is used anywhere else in the file (search for `navigate(`). If the only use was `handleSearch`, remove `useNavigate` from the import and the `const navigate = useNavigate();` line.

```bash
grep -n "navigate(" frontend/pages/Dashboard.tsx
```

If the only remaining hits are inside service desk card `onMouseEnter`/`onMouseLeave` handlers (which don't use navigate), remove the hook. If `navigate` is used elsewhere (e.g. for routing on row click), keep it.

- [ ] **Step 3: Replace the hero section**

Find the entire hero `<section>` block (lines ~145–189):

```tsx
      {/* ── HERO ── */}
      <section className="bg-gradient-to-br from-brand-900 via-brand-700 to-[#2a4a7f] rounded-xl py-12 px-4 sm:px-8 relative overflow-hidden mb-6">
```

...through its closing `</section>` tag. Replace the entire block with this compact greeting row:

```tsx
      {/* ── GREETING ── */}
      <div className="flex items-baseline gap-3 mb-6 pt-2">
        <div>
          <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-0.5">{formatDate()}</p>
          <h1 className="text-2xl font-black text-text-primary leading-tight">
            {greeting}{' '}
            <span className="text-text-secondary font-normal text-lg">How can we help you today?</span>
          </h1>
        </div>
      </div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 5: Start the dev server and verify the dashboard visually**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 and confirm:
- No hero banner / search bar present on Dashboard
- Compact greeting + date line shows at top
- Stats row (Open Requests, Action Required, Resolved) appears immediately below
- Service Desks cards (IT / HR / Finance) are visible without scrolling on a standard browser window
- Sidebar shows: Main, Service Desks (IT Support / HR Services / Group Finance), Tools, Admin groups
- "New Request" button is visible at top of sidebar
- No duplicate "Announcements" in the admin sidebar section

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/Dashboard.tsx
git commit -m "feat(dashboard): remove hero search banner, add compact greeting row"
```

---

## Task 4: Final verification

- [ ] **Step 1: Full TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 2: Verify nav for each role**

Log in as:
- `user@helpdesk.com` / `abc@123` (END_USER) — should see: Main + Service Desks. Should NOT see: Admin, IT Assets, Reports, Insights
- `it@test.local` / `abc@123` (AGENT) — should see: Support Queue in Main, Service Desks, IT Assets in Tools
- `admin@test.local` / `abc@123` (ADMIN) — should see all groups including Admin with "Manage Announcements" (not "Announcements")

- [ ] **Step 3: Commit final state if any last fixes were made**

```bash
git add -p
git commit -m "fix(nav): post-review cleanup"
```

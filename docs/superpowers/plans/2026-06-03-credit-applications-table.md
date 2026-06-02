# Credit Applications Smart Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal kanban board on `/credit/applications` with a sortable Smart Data Table that surfaces SLA urgency, follows the CWC design system, and preserves a view-toggle back to kanban.

**Architecture:** All changes are confined to `CreditApplicationList.tsx` (render + local state) and a new utility test file for the sort comparator. The existing `getSLAInfo()` and `STATE_COLORS` utilities are reused without modification. The `.credit-table` CSS class already exists in `credit-tables.css` and is imported.

**Tech Stack:** React 19, TypeScript, Tailwind v4 + CWC tokens (`tokens.css`), Vitest + Testing Library, Material Symbols icons.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/pages/CreditApplicationList.tsx` | Modify | Add sort state, view toggle, SLA strip, table render |
| `frontend/src/utils/__tests__/creditSort.test.ts` | Create | Unit tests for the sort comparator |
| `frontend/src/styles/credit-tables.css` | No change | `.credit-table` sticky header + zebra rules already present |

---

## Task 1: Unit-test the sort comparator

**Files:**
- Create: `frontend/src/utils/__tests__/creditSort.test.ts`

The sort comparator is a pure function — test it before writing it.

- [ ] **Step 1.1: Create the test file**

```typescript
// frontend/src/utils/__tests__/creditSort.test.ts
import { describe, it, expect } from 'vitest';
import { sortApplications } from '../creditSort';
import type { CreditApplication } from '../../services/credit.service';

const base = {
  id: '1', productType: 'TERM_LOAN', productName: 'Term Loan',
  requestedAmount: 0, currency: 'MYR', state: 'DRAFT', status: 'DRAFT',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  borrowerProfile: null, rm: null,
} satisfies Partial<CreditApplication> as CreditApplication;

const make = (overrides: Partial<CreditApplication>): CreditApplication => ({ ...base, ...overrides });

describe('sortApplications', () => {
  describe('amount column', () => {
    it('sorts ascending', () => {
      const apps = [make({ id: 'a', requestedAmount: 5000 }), make({ id: 'b', requestedAmount: 1000 })];
      const result = sortApplications(apps, 'amount', 'asc');
      expect(result.map(a => a.id)).toEqual(['b', 'a']);
    });

    it('sorts descending', () => {
      const apps = [make({ id: 'a', requestedAmount: 1000 }), make({ id: 'b', requestedAmount: 5000 })];
      const result = sortApplications(apps, 'amount', 'desc');
      expect(result.map(a => a.id)).toEqual(['b', 'a']);
    });
  });

  describe('sla column', () => {
    const old = new Date(Date.now() - 10 * 86400000).toISOString(); // 10 days ago → overdue
    const recent = new Date(Date.now() - 1 * 86400000).toISOString(); // 1 day ago → ok

    it('puts overdue first when ascending', () => {
      const apps = [
        make({ id: 'ok',      createdAt: recent, state: 'KYC_REVIEW', status: 'KYC_REVIEW' }),
        make({ id: 'overdue', createdAt: old,    state: 'KYC_REVIEW', status: 'KYC_REVIEW' }),
      ];
      const result = sortApplications(apps, 'sla', 'asc');
      expect(result[0].id).toBe('overdue');
    });

    it('puts healthy first when descending', () => {
      const apps = [
        make({ id: 'ok',      createdAt: recent, state: 'KYC_REVIEW', status: 'KYC_REVIEW' }),
        make({ id: 'overdue', createdAt: old,    state: 'KYC_REVIEW', status: 'KYC_REVIEW' }),
      ];
      const result = sortApplications(apps, 'sla', 'desc');
      expect(result[0].id).toBe('ok');
    });

    it('puts no-SLA (DRAFT) last regardless of direction', () => {
      const apps = [
        make({ id: 'draft',   createdAt: old,    state: 'DRAFT', status: 'DRAFT' }),
        make({ id: 'overdue', createdAt: old,    state: 'KYC_REVIEW', status: 'KYC_REVIEW' }),
      ];
      const result = sortApplications(apps, 'sla', 'asc');
      expect(result[result.length - 1].id).toBe('draft');
    });
  });

  it('returns a new array (does not mutate input)', () => {
    const apps = [make({ id: 'a' }), make({ id: 'b' })];
    const result = sortApplications(apps, 'amount', 'asc');
    expect(result).not.toBe(apps);
  });
});
```

- [ ] **Step 1.2: Run — expect FAIL (module not found)**

```bash
cd frontend && npm test -- src/utils/__tests__/creditSort.test.ts
```

Expected output contains: `Cannot find module '../creditSort'`

---

## Task 2: Implement the sort utility

**Files:**
- Create: `frontend/src/utils/creditSort.ts`

- [ ] **Step 2.1: Create the utility**

```typescript
// frontend/src/utils/creditSort.ts
import type { CreditApplication, ApplicationState } from '../services/credit.service';

export type SortColumn = 'amount' | 'sla';
export type SortDir = 'asc' | 'desc';

// Mirrors getSLAInfo logic — returns remaining days (negative = overdue, null = no SLA)
function slaRemainingDays(createdAt: string, state: ApplicationState): number | null {
  const slaMap: Partial<Record<ApplicationState, number>> = {
    DRAFT: 7, SUBMITTED: 3, KYC_REVIEW: 5, UNDERWRITING: 7, CREDIT_ASSESSMENT: 5,
    COMMITTEE_REVIEW: 3, OFFER: 5, ACCEPTED: 3,
  };
  const limit = slaMap[state];
  if (!limit) return null;
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return limit - days;
}

export function sortApplications(
  apps: CreditApplication[],
  column: SortColumn,
  dir: SortDir,
): CreditApplication[] {
  const sorted = [...apps];

  sorted.sort((a, b) => {
    if (column === 'amount') {
      const diff = (a.requestedAmount ?? 0) - (b.requestedAmount ?? 0);
      return dir === 'asc' ? diff : -diff;
    }

    // sla: null (no SLA) always last
    const aState = (a.state || a.status) as ApplicationState;
    const bState = (b.state || b.status) as ApplicationState;
    const aRem = slaRemainingDays(a.createdAt, aState);
    const bRem = slaRemainingDays(b.createdAt, bState);

    if (aRem === null && bRem === null) return 0;
    if (aRem === null) return 1;
    if (bRem === null) return -1;

    const diff = aRem - bRem;
    return dir === 'asc' ? diff : -diff;
  });

  return sorted;
}
```

- [ ] **Step 2.2: Run tests — expect PASS**

```bash
cd frontend && npm test -- src/utils/__tests__/creditSort.test.ts
```

Expected: `✓ 6 tests passed`

- [ ] **Step 2.3: Commit**

```bash
git add frontend/src/utils/creditSort.ts frontend/src/utils/__tests__/creditSort.test.ts
git commit -m "feat(credit): add sortApplications utility with SLA + amount sort"
```

---

## Task 3: Add sort state and view toggle to CreditApplicationList

**Files:**
- Modify: `frontend/pages/CreditApplicationList.tsx`

- [ ] **Step 3.1: Add imports at the top of the file**

After the existing imports, add:

```typescript
import { sortApplications, type SortColumn, type SortDir } from '../src/utils/creditSort';
```

- [ ] **Step 3.2: Add state declarations inside the component (after existing state)**

After the `const { isCollapsed, toggle: toggleCollapse }` line, add:

```typescript
const [sortCol, setSortCol] = useState<SortColumn>('sla');
const [sortDir, setSortDir] = useState<SortDir>('asc');
const [view, setView] = useState<'table' | 'kanban'>(() => {
  return (localStorage.getItem('credit-applications-view') as 'table' | 'kanban') ?? 'table';
});

const handleSort = (col: SortColumn) => {
  if (sortCol === col) {
    setSortDir(d => d === 'asc' ? 'desc' : 'asc');
  } else {
    setSortCol(col);
    setSortDir('asc');
  }
};

const handleViewChange = (v: 'table' | 'kanban') => {
  setView(v);
  localStorage.setItem('credit-applications-view', v);
};

const sortedApplications = sortApplications(applications, sortCol, sortDir);
```

- [ ] **Step 3.3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `CreditApplicationList.tsx`.

---

## Task 4: Build the SLA urgency strip helper

**Files:**
- Modify: `frontend/pages/CreditApplicationList.tsx`

- [ ] **Step 4.1: Add a helper function just above the component declaration (after `getSLAInfo`)**

```typescript
function getSLAStrip(apps: CreditApplication[]) {
  let overdue = 0, urgent = 0, ok = 0;
  apps.forEach(app => {
    const state = (app.state || app.status) as ApplicationState;
    const info = getSLAInfo(app.createdAt, state);
    if (info.color === '#dc2626') overdue++;
    else if (info.color === '#ea580c') urgent++;
    else if (info.color === '#16a34a') ok++;
  });
  return { overdue, urgent, ok };
}
```

---

## Task 5: Render the table view

**Files:**
- Modify: `frontend/pages/CreditApplicationList.tsx`

This task replaces the entire `{/* Kanban Board */}` block with a conditional render: table when `view === 'table'`, existing kanban when `view === 'kanban'`.

- [ ] **Step 5.1: Add view toggle to the filter bar**

Replace the closing `</div>` of the filters `<div className="flex items-center gap-3 mb-5 flex-wrap">` block with this (add the toggle as the last child before the closing tag):

```tsx
          {/* View toggle */}
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => handleViewChange('table')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${view === 'table' ? 'bg-brand-700 text-white border-brand-700' : 'bg-surface border-border text-text-secondary hover:bg-gray-50'}`}
              style={{ fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>table_rows</span> Table
            </button>
            <button
              onClick={() => handleViewChange('kanban')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${view === 'kanban' ? 'bg-brand-700 text-white border-brand-700' : 'bg-surface border-border text-text-secondary hover:bg-gray-50'}`}
              style={{ fontFamily: 'var(--font-sans)', cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>view_column</span> Kanban
            </button>
          </div>
```

- [ ] **Step 5.2: Replace the `{/* Kanban Board */}` block**

Find the block that starts with `{/* Kanban Board */}` and ends just before `{/* Pagination */}`. Replace it entirely with:

```tsx
        {/* Table / Kanban view */}
        {loading ? (
          <div aria-busy="true" aria-label="Loading applications" className="space-y-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-14 bg-surface-muted rounded-lg" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : view === 'table' ? (
          <>
            {/* SLA urgency strip */}
            {(() => {
              const strip = getSLAStrip(applications);
              return (
                <div className="flex items-center gap-4 flex-wrap px-4 py-2 mb-3 rounded-lg text-xs"
                  style={{ background: '#fff8f0', border: '1px solid #fde8c8' }}>
                  <span className="font-bold uppercase tracking-wide text-text-secondary" style={{ fontSize: 10 }}>SLA Status</span>
                  {strip.overdue > 0 && (
                    <span className="flex items-center gap-1 font-bold px-2.5 py-1 rounded-full"
                      style={{ background: '#fef2f2', color: 'var(--color-danger)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>
                      {strip.overdue} Overdue
                    </span>
                  )}
                  {strip.urgent > 0 && (
                    <span className="flex items-center gap-1 font-bold px-2.5 py-1 rounded-full"
                      style={{ background: '#fff7ed', color: '#c2410c' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                      {strip.urgent} Due within 24h
                    </span>
                  )}
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full"
                    style={{ background: '#f0fdf4', color: 'var(--color-success)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
                    {strip.ok} On track
                  </span>
                </div>
              );
            })()}

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table className="credit-table w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Borrower</th>
                      <th>Product</th>
                      <th
                        onClick={() => handleSort('amount')}
                        className="cursor-pointer hover:text-brand-700 select-none"
                      >
                        Amount
                        <span className="material-symbols-outlined align-middle ml-0.5"
                          style={{ fontSize: 12, color: sortCol === 'amount' ? 'var(--color-brand-700)' : undefined }}>
                          {sortCol === 'amount' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </th>
                      <th>Stage / Status</th>
                      <th
                        onClick={() => handleSort('sla')}
                        className="cursor-pointer hover:text-brand-700 select-none"
                      >
                        SLA
                        <span className="material-symbols-outlined align-middle ml-0.5"
                          style={{ fontSize: 12, color: sortCol === 'sla' ? 'var(--color-brand-700)' : undefined }}>
                          {sortCol === 'sla' ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                        </span>
                      </th>
                      <th>RM</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedApplications.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-text-secondary">
                          <span className="material-symbols-outlined text-3xl block opacity-20 mb-2">search_off</span>
                          No applications found
                        </td>
                      </tr>
                    )}
                    {sortedApplications.map(app => {
                      const state = (app.state || app.status) as ApplicationState;
                      const badge = STATE_COLORS[state] || STATE_COLORS.DRAFT;
                      const sla = getSLAInfo(app.createdAt, state);
                      const isOverdue = sla.color === '#dc2626';
                      const borrowerName = app.borrowerProfile
                        ? (app.borrowerProfile.account?.name ||
                           (app.borrowerProfile.contact
                             ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}`
                             : app.borrowerProfile.name) ||
                           'Unnamed Borrower')
                        : '—';
                      const daysAgo = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400000);
                      const createdLabel = daysAgo === 0 ? 'Today' : `${daysAgo}d ago`;

                      return (
                        <tr
                          key={app.id}
                          onClick={() => navigate(`/credit/applications/${app.id}`)}
                          className="cursor-pointer"
                          style={isOverdue ? { background: '#fff8f8' } : undefined}
                        >
                          <td>
                            <div className="font-bold text-text-primary" style={{ fontSize: 12 }}>{borrowerName}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                              #{app.id.slice(-8).toUpperCase()}
                            </div>
                          </td>
                          <td style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                            {PRODUCT_LABELS[app.productType || app.productName || ''] || '—'}
                          </td>
                          <td>
                            <div className="font-black text-text-primary" style={{ fontSize: 13 }}>
                              {formatCurrency(app.requestedAmount, app.currency)}
                            </div>
                          </td>
                          <td>
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: badge.bg, color: badge.text }}>
                              {(STATE_LABELS[state] || state.replace(/_/g, ' '))}
                            </span>
                          </td>
                          <td>
                            <span className="font-semibold" style={{ fontSize: 11, color: sla.color }}>
                              {isOverdue && (
                                <span className="material-symbols-outlined align-middle mr-0.5" style={{ fontSize: 12 }}>warning</span>
                              )}
                              {sla.text}
                            </span>
                          </td>
                          <td>
                            {app.rm ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold"
                                style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-700)' }}>
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white font-black"
                                  style={{ background: 'var(--color-brand-500)', fontSize: 8 }}>
                                  {app.rm.firstName?.[0] ?? '?'}
                                </span>
                                {app.rm.firstName}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>—</span>
                            )}
                          </td>
                          <td style={{ color: 'var(--color-text-tertiary)', fontSize: 11 }}>{createdLabel}</td>
                          <td>
                            <span className="material-symbols-outlined" style={{ color: 'var(--color-text-tertiary)', fontSize: 18 }}>
                              chevron_right
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* ── Kanban (existing) ── */
          <div aria-busy="false" className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ alignItems: 'flex-start' }}>
            {grouped.map(col => {
              const collapsed = isCollapsed(col.key);
              if (collapsed) {
                return (
                  <CollapsedColumnPill
                    key={col.key}
                    label={col.label}
                    color={col.color}
                    count={col.items.length}
                    onClick={() => toggleCollapse(col.key)}
                  />
                );
              }
              return (
                <div key={col.key} className="min-w-[260px] md:min-w-[280px] flex-1 snap-start">
                  <div className="flex items-center gap-2 mb-3 group">
                    <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    <span className="text-sm font-bold text-text-secondary uppercase tracking-wider" style={{ color: col.color }}>{col.label}</span>
                    <span className="text-xs font-bold text-text-secondary bg-bg-subtle px-1.5 py-0.5 rounded-full ml-auto">{col.items.length}</span>
                    <ColumnCollapseToggle onClick={() => toggleCollapse(col.key)} />
                  </div>
                  <div className="space-y-3">
                    {col.items.length === 0 && (
                      <div className="text-center py-4 text-text-secondary">
                        <span className="material-symbols-outlined text-xl block opacity-20">playlist_add</span>
                        <p className="text-xs mt-1">No applications</p>
                      </div>
                    )}
                    {col.items.map(app => {
                      const state = (app.state || app.status) as ApplicationState;
                      const badge = STATE_COLORS[state] || STATE_COLORS.DRAFT;
                      const sla = getSLAInfo(app.createdAt, state);
                      return (
                        <div key={app.id} onClick={() => navigate(`/credit/applications/${app.id}`)}
                          className="bg-bg-surface border border-border rounded-xl p-3.5 cursor-pointer hover:border-brand-300 hover:shadow-sm transition-all"
                          style={{ borderLeft: `3px solid ${col.color}` }}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.text }}>
                              {state.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] font-semibold ml-auto" style={{ color: sla.color }}>{sla.text}</span>
                          </div>
                          <p className="text-sm font-bold text-text-primary truncate mb-0.5">
                            {app.borrowerProfile ? (app.borrowerProfile.account?.name || (app.borrowerProfile.contact ? `${app.borrowerProfile.contact.firstName} ${app.borrowerProfile.contact.lastName}` : app.borrowerProfile.name) || 'Unnamed Borrower') : PRODUCT_LABELS[app.productType || app.productName || ''] || '—'}
                          </p>
                          <p className="text-xs text-text-secondary truncate">{PRODUCT_LABELS[app.productType || app.productName || ''] || app.productName || '—'}</p>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                            <span className="text-sm font-black text-text-primary">{formatCurrency(app.requestedAmount, app.currency)}</span>
                            {app.rm && <span className="text-[10px] text-text-secondary">RM: {app.rm.firstName}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
```

- [ ] **Step 5.3: Add `STATE_LABELS` import to the top of the file**

The file already imports from `creditUtils`. Add `STATE_LABELS` to that import:

```typescript
import { formatCurrency, formatDate, STATE_COLORS, STATE_LABELS, getSmartDefaults } from './credit/creditUtils';
```

- [ ] **Step 5.4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 5.5: Commit**

```bash
git add frontend/pages/CreditApplicationList.tsx
git commit -m "feat(credit): replace kanban with smart data table (view toggle preserved)"
```

---

## Task 6: Add hover row highlight via CSS

**Files:**
- Modify: `frontend/src/styles/credit-tables.css`

The existing `.credit-table` rules cover sticky header and zebra striping. Add overdue row colouring.

- [ ] **Step 6.1: Append to `credit-tables.css`**

```css
/* Overdue row highlight */
.credit-table tbody tr.row-overdue td {
  background-color: #fff8f8;
}

.credit-table tbody tr.row-overdue:hover td {
  background-color: #fde8e8;
}
```

- [ ] **Step 6.2: Update the overdue row in the table render to use this class**

In `CreditApplicationList.tsx`, on the `<tr>` element inside the table, change the inline style to a class:

```tsx
<tr
  key={app.id}
  onClick={() => navigate(`/credit/applications/${app.id}`)}
  className={`cursor-pointer${isOverdue ? ' row-overdue' : ''}`}
>
```

Remove the `style={isOverdue ? { background: '#fff8f8' } : undefined}` prop.

- [ ] **Step 6.3: Verify TypeScript and run all tests**

```bash
cd frontend && npx tsc --noEmit && npm test
```

Expected: no TS errors, all tests pass.

- [ ] **Step 6.4: Commit**

```bash
git add frontend/src/styles/credit-tables.css frontend/pages/CreditApplicationList.tsx
git commit -m "style(credit): overdue row highlight via credit-table CSS class"
```

---

## Task 7: Manual smoke test

- [ ] **Step 7.1: Start the dev servers**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 7.2: Open http://localhost:5173/credit/applications**

Verify:
- Table view loads by default (not kanban)
- Rows sorted by SLA ascending (overdue at top, drafts at bottom)
- Overdue rows have a subtle red background tint
- SLA urgency strip shows correct counts
- Clicking **Amount** column header sorts ascending → descending → ascending
- Clicking **SLA** column header toggles direction; active column shows navy arrow icon
- Clicking **Kanban** toggle switches to existing kanban; clicking **Table** switches back
- View preference persists after page refresh (localStorage key `credit-applications-view`)
- Clicking any row navigates to `/credit/applications/:id`
- Borrower filter banner still appears when `?borrowerProfileId=` is in the URL
- **+ New Application** modal still opens and creates an application correctly

- [ ] **Step 7.3: Final commit (if any last-minute fixes were needed)**

```bash
git add -p
git commit -m "fix(credit): smoke test corrections"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|---|---|
| Replace kanban with sortable table | Task 5 |
| Sort by Amount (asc/desc) | Tasks 2, 5 |
| Sort by SLA urgency (default asc) | Tasks 2, 5 |
| SLA urgency strip (overdue / urgent / on-track counts) | Tasks 4, 5 |
| Overdue row red tint | Tasks 5, 6 |
| State badges from `STATE_COLORS` | Task 5 |
| Stage group label below badge | Task 5 |
| RM navy pill with initial avatar | Task 5 |
| View toggle Table / Kanban | Task 5 |
| View preference persisted to localStorage | Task 3 |
| CWC design tokens throughout | Tasks 5, 6 |
| Existing kanban preserved (view toggle) | Task 5 |
| No backend changes | ✓ confirmed — API params unchanged |

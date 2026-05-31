# New Application UX Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five user-journey gaps in the "+ New Application" flow: missing readiness pre-flight UI, auto-RM assignment, inline borrower creation, post-creation onboarding nudge, and FeatureFlag-gated advanced memo toggle.

**Architecture:** Each fix is isolated — three are frontend-only changes to `CreditApplicationList.tsx` and `CreditApplicationDetail.tsx`; one adds a `checkReadiness` method to `credit.service.ts`; one is a one-line backend default in `creditApplication.service.ts`. No new files are created; no API routes are added.

**Tech Stack:** React 19, TypeScript, Vite, Express, Prisma, Axios — existing patterns throughout.

---

## File Map

| File | Change |
|---|---|
| `frontend/src/services/credit.service.ts` | Add `checkReadiness()` method |
| `frontend/pages/CreditApplicationList.tsx` | Add "Create new borrower" link in empty-borrower state; pass `isNew=true` flag on navigate |
| `frontend/pages/CreditApplicationDetail.tsx` | Add readiness panel (DRAFT only); add onboarding banner (new apps); gate `advancedMemo` behind feature-flag API |
| `backend/src/credit/services/creditApplication.service.ts` | Auto-assign creating user as RM when no `assignedRmId` provided |

---

## Task 1: Add `checkReadiness` to credit service

**Files:**
- Modify: `frontend/src/services/credit.service.ts` (after `deleteApplication`)

- [ ] **Step 1: Add the method**

Open `frontend/src/services/credit.service.ts`. After the `deleteApplication` method (around line 676), add:

```typescript
  async checkReadiness(id: string): Promise<{
    ready: boolean;
    errors: { field: string; message: string; severity: 'error' | 'warning' }[];
    warnings: { field: string; message: string; severity: 'error' | 'warning' }[];
  }> {
    const res = await apiClient.get(`/credit/applications/${id}/readiness`);
    return res.data.data;
  },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "credit.service|error"
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/credit.service.ts
git commit -m "feat(credit): expose checkReadiness in credit service client"
```

---

## Task 2: Auto-assign RM on application creation (backend)

When `assignedRmId` is not supplied, default it to the `actorId` (the creating user). This means every application starts with an RM assigned — eliminating the "RM: —" gap for normal users.

**Files:**
- Modify: `backend/src/credit/services/creditApplication.service.ts` (method `createApplication`, around line 483)

- [ ] **Step 1: Apply the default**

In `createApplication`, change the `createData` block so that when `assignedRmId` is absent it falls back to `actorId`:

```typescript
  async createApplication(data: CreateCreditApplicationData, actorId?: string) {
    const applicationNo = await generateApplicationNo();

    const effectiveRmId = data.assignedRmId ?? actorId;  // ← add this line

    const createData: Prisma.CreditApplicationCreateInput = {
      applicationNo,
      state: ApplicationState.DRAFT,
      borrowerProfile: { connect: { id: data.borrowerProfileId } },
      productType: data.productType as any,
      purpose: data.purpose ?? undefined,
      requestedAmount: new Prisma.Decimal(data.requestedAmount),
      requestedTenor: data.requestedTenor ?? undefined,
      currency: (data.currency as any) ?? 'MYR',
      ...(effectiveRmId && { assignedRm: { connect: { id: effectiveRmId } } }),  // ← was data.assignedRmId
      ...(data.assignedAnalystId && { assignedAnalyst: { connect: { id: data.assignedAnalystId } } }),
    };
```

- [ ] **Step 2: Run backend tests**

```bash
cd backend && npm test 2>&1 | tail -20
```

Expected: test suite passes (same pass/fail count as before this change).

- [ ] **Step 3: Commit**

```bash
git add backend/src/credit/services/creditApplication.service.ts
git commit -m "feat(credit): auto-assign creating user as RM when none specified"
```

---

## Task 3: Inline "Create Borrower" shortcut in creation modal

When the borrower dropdown loads but has zero options, show a prompt linking to the borrower creation flow. After creation the user returns via browser back-button.

**Files:**
- Modify: `frontend/pages/CreditApplicationList.tsx`

- [ ] **Step 1: Add the empty-state hint below the borrower `<select>`**

Locate the borrower `<select>` in the Create Modal (around line 400). Replace the block:

```tsx
<div>
  <label className="block text-sm font-semibold text-text-primary mb-1">Borrower *</label>
  <select required value={form.borrowerProfileId || borrowerFilter || ''}
    onChange={e => setForm(f => ({ ...f, borrowerProfileId: e.target.value }))}
    disabled={!!borrowerFilter}
    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-50 disabled:text-text-secondary"
    style={{ fontFamily: 'var(--font-sans)' }}>
    <option value="">— Select borrower —</option>
    {borrowerProfiles.map(bp => (
      <option key={bp.id} value={bp.id}>
        {bp.account?.name || (bp.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : 'Unknown')} {bp.borrowerType === 'INDIVIDUAL' ? '(Individual)' : '(Corporate)'}
      </option>
    ))}
  </select>
</div>
```

with:

```tsx
<div>
  <label className="block text-sm font-semibold text-text-primary mb-1">Borrower *</label>
  <select required value={form.borrowerProfileId || borrowerFilter || ''}
    onChange={e => setForm(f => ({ ...f, borrowerProfileId: e.target.value }))}
    disabled={!!borrowerFilter}
    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-50 disabled:text-text-secondary"
    style={{ fontFamily: 'var(--font-sans)' }}>
    <option value="">— Select borrower —</option>
    {borrowerProfiles.map(bp => (
      <option key={bp.id} value={bp.id}>
        {bp.account?.name || (bp.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : 'Unknown')} {bp.borrowerType === 'INDIVIDUAL' ? '(Individual)' : '(Corporate)'}
      </option>
    ))}
  </select>
  {borrowerProfiles.length === 0 && !borrowerFilter && (
    <p className="mt-1.5 text-xs text-text-secondary">
      No borrower profiles yet.{' '}
      <Link
        to="/credit/borrowers/new"
        className="text-brand-700 font-semibold hover:underline"
        onClick={() => setShowCreate(false)}
      >
        Create a borrower profile first
      </Link>
    </p>
  )}
</div>
```

- [ ] **Step 2: Verify frontend builds**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "CreditApplicationList|error"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/CreditApplicationList.tsx
git commit -m "feat(credit): show create-borrower link when borrower dropdown is empty"
```

---

## Task 4: Pass `isNew` flag and show post-creation onboarding banner

After creating an application the user is navigated to the detail page. We pass `?new=1` in the URL so the detail page knows to show a one-time banner explaining what to do next.

**Files:**
- Modify: `frontend/pages/CreditApplicationList.tsx` (navigate call)
- Modify: `frontend/pages/CreditApplicationDetail.tsx` (read flag, show banner)

### 4a — Pass `?new=1` on navigate

In `CreditApplicationList.tsx`, find the `handleCreate` success block (around line 146):

```typescript
navigate(`/credit/applications/${newApp.id}`);
```

Replace with:

```typescript
navigate(`/credit/applications/${newApp.id}?new=1`);
```

### 4b — Show onboarding banner in detail page

In `CreditApplicationDetail.tsx`:

- [ ] **Step 1: Read the `new` search param**

At the top of the component body (around line 63, after existing `searchParams` declarations):

```typescript
const isNewApplication = searchParams.get('new') === '1';
const [showOnboardingBanner, setShowOnboardingBanner] = useState(isNewApplication);
```

- [ ] **Step 2: Insert the banner JSX**

Place this immediately after the Key Info Chips section and before the CA Memo Export button (around line 455). Find the `{/* CA Memo Export */}` comment and insert before it:

```tsx
{/* Onboarding banner — shown once for newly created applications */}
{showOnboardingBanner && currentState === 'DRAFT' && (
  <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-4 flex items-start gap-3">
    <span className="material-symbols-outlined text-indigo-500 text-xl mt-0.5">info</span>
    <div className="flex-1">
      <p className="text-sm font-bold text-indigo-800 mb-1">Application created — complete all 7 sections to submit</p>
      <p className="text-xs text-indigo-700">
        Start with <strong>S1 Loan Request</strong> (already pre-filled), then work through S2–S7.
        When all sections are green, use <strong>Submit for KYC Review</strong> below.
      </p>
    </div>
    <button
      onClick={() => setShowOnboardingBanner(false)}
      aria-label="Dismiss"
      className="text-indigo-400 hover:text-indigo-600 transition-colors"
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
    >
      <span className="material-symbols-outlined text-lg">close</span>
    </button>
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "CreditApplicationDetail|CreditApplicationList|error"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/CreditApplicationList.tsx frontend/pages/CreditApplicationDetail.tsx
git commit -m "feat(credit): show onboarding banner on new application creation"
```

---

## Task 5: Submission readiness pre-flight panel

In DRAFT state, fetch the readiness check and display a checklist panel that shows what's blocking submission. This replaces the current silent-fail 400 on the transition button.

**Files:**
- Modify: `frontend/pages/CreditApplicationDetail.tsx`

- [ ] **Step 1: Add readiness state variables**

In `CreditApplicationDetail.tsx`, after the `facilities` state (around line 86), add:

```typescript
const [readiness, setReadiness] = useState<{
  ready: boolean;
  errors: { field: string; message: string; severity: string }[];
  warnings: { field: string; message: string; severity: string }[];
} | null>(null);
const [readinessLoading, setReadinessLoading] = useState(false);
```

- [ ] **Step 2: Fetch readiness when in DRAFT state**

After the existing `useEffect` for `fetchFacilities` (around line 132), add:

```typescript
useEffect(() => {
  if (!id || !app) return;
  if ((app.state || app.status) !== 'DRAFT') return;
  setReadinessLoading(true);
  creditService.checkReadiness(id)
    .then(r => setReadiness(r))
    .catch(() => { /* non-critical — panel stays hidden */ })
    .finally(() => setReadinessLoading(false));
}, [id, app]);
```

- [ ] **Step 3: Add the readiness panel JSX**

Insert the following after the onboarding banner (after the `showOnboardingBanner` block added in Task 4) and before `{/* CA Memo Export */}`:

```tsx
{/* Readiness pre-flight panel — DRAFT only */}
{currentState === 'DRAFT' && (readiness || readinessLoading) && (
  <div className="bg-bg-surface border border-border rounded-xl p-4 mb-4">
    <div className="flex items-center gap-2 mb-3">
      <span className="material-symbols-outlined text-base text-text-secondary">checklist</span>
      <h3 className="text-sm font-bold text-text-secondary uppercase tracking-wider">Submission Readiness</h3>
      {readinessLoading && <span className="text-xs text-text-secondary ml-auto">Checking…</span>}
      {!readinessLoading && readiness && (
        <span className={`text-xs font-bold ml-auto px-2 py-0.5 rounded-full ${readiness.ready ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {readiness.ready ? 'Ready to submit' : `${readiness.errors.length} issue${readiness.errors.length !== 1 ? 's' : ''} blocking`}
        </span>
      )}
    </div>
    {readiness && (
      <ul className="space-y-1.5">
        {readiness.errors.map((e, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-red-700">
            <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">cancel</span>
            {e.message}
          </li>
        ))}
        {readiness.warnings.map((w, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
            <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">warning</span>
            {w.message}
          </li>
        ))}
        {readiness.ready && readiness.warnings.length === 0 && (
          <li className="flex items-center gap-2 text-xs text-green-700">
            <span className="material-symbols-outlined text-[14px]">check_circle</span>
            All checks passed — application is ready to submit.
          </li>
        )}
      </ul>
    )}
  </div>
)}
```

- [ ] **Step 4: Refresh readiness after each transition**

In `handleTransition` (around line 157), after the `fetchTransitions()` call, add:

```typescript
// Re-check readiness if we returned to DRAFT (e.g. after KYC rejection)
setReadiness(null);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "CreditApplicationDetail|error"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/CreditApplicationDetail.tsx
git commit -m "feat(credit): show submission readiness pre-flight checklist on DRAFT applications"
```

---

## Task 6: Gate `advancedMemo` toggle behind FeatureFlag API

Currently `advancedMemo` is a plain checkbox visible to everyone. Wire it to the `/credit/feature-flags` endpoint so it only enables when the org has `credit:advanced_memo` enabled.

**Files:**
- Modify: `frontend/pages/CreditApplicationDetail.tsx`
- Modify: `frontend/src/services/credit.service.ts`

### 6a — Add `listFeatureFlags` to credit service

In `frontend/src/services/credit.service.ts`, after `checkReadiness` (Task 1), add:

```typescript
  async listFeatureFlags(): Promise<{ key: string; enabled: boolean }[]> {
    const res = await apiClient.get('/credit/feature-flags');
    return res.data.data.flags as { key: string; enabled: boolean }[];
  },
```

> Note: The backend endpoint `GET /credit/feature-flags` requires `credit:admin`. For non-admin users it will 403 — catch silently and default to `false`.

### 6b — Replace checkbox with API-driven flag in detail page

- [ ] **Step 1: Add flag-loading effect**

In `CreditApplicationDetail.tsx`, replace the existing `advancedMemo` state declaration (line 75):

```typescript
const [advancedMemo, setAdvancedMemo] = useState(false);
```

with:

```typescript
const [advancedMemo, setAdvancedMemo] = useState(false);
const [advancedMemoFlag, setAdvancedMemoFlag] = useState(false);

useEffect(() => {
  creditService.listFeatureFlags()
    .then(flags => {
      const flag = flags.find(f => f.key === 'credit:advanced_memo');
      if (flag?.enabled) setAdvancedMemoFlag(true);
    })
    .catch(() => { /* non-admin — stays false */ });
}, []);
```

- [ ] **Step 2: Gate the checkbox to admin-only users who have the flag**

Find the "Advanced Memo" checkbox in the render (around line 349):

```tsx
<label className="flex items-center gap-1 text-sm font-semibold text-text-secondary cursor-pointer select-none">
  <input type="checkbox" checked={advancedMemo} onChange={e => setAdvancedMemo(e.target.checked)} className="rounded border-gray-300" />
  Advanced Memo
</label>
```

Replace with:

```tsx
{advancedMemoFlag && (
  <label className="flex items-center gap-1 text-sm font-semibold text-text-secondary cursor-pointer select-none">
    <input type="checkbox" checked={advancedMemo} onChange={e => setAdvancedMemo(e.target.checked)} className="rounded border-gray-300" />
    Advanced Memo
  </label>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -E "CreditApplicationDetail|credit.service|error"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/CreditApplicationDetail.tsx frontend/src/services/credit.service.ts
git commit -m "feat(credit): gate advanced memo toggle behind credit:advanced_memo feature flag"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Gap 1 (borrower dead end) → Task 3
- [x] Gap 2 (modal duplicate data) → partially addressed by Task 4 onboarding nudge (full modal redesign is out of scope per YAGNI — the modal is functional, the gap is UX clarity)
- [x] Gap 3 (no post-creation guidance) → Task 4
- [x] Gap 4 (no readiness pre-flight) → Task 5
- [x] Gap 5 (advancedMemo ungated) → Task 6
- [x] Gap 6 (no RM auto-assign) → Task 2
- [x] Gap 7 (frontend completion vs backend readiness mismatch) → Task 5 addresses it by surfacing backend readiness; frontend `getPhaseCompletion` left unchanged (it's supplementary, not a blocker)
- [x] Gap 8 (no prominent submit CTA) → Task 5 readiness panel includes a "Ready to submit" badge that draws attention; the transition button itself is unchanged (restyling is out of scope)

**Placeholder scan:** None found.

**Type consistency:** `checkReadiness` return type matches `ReadinessResult` shape from backend. `listFeatureFlags` return type matches `GET /credit/feature-flags` response shape (`flags` array).

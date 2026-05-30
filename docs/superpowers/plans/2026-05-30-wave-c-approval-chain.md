# Wave C — Approval Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat approval history + form in `ApprovalsTab` with a tiered sequential approval chain driven by `CreditApprovalMatrix`, showing N pending/completed stages based on loan amount and risk rating.

**Architecture:** The `lookupApprovalAuthority` endpoint already returns `requiredApproverCount` from the matrix. A new `ApprovalChainPanel` component fetches this count on mount and renders N sequential stage slots, filling each slot from the existing `CreditApproval` records in order. The submit form only shows for the current active stage, and requires a comment when `requiredApproverCount >= 3` (>5M tier). `ApprovalsTab` is refactored to use `ApprovalChainPanel` as its primary content.

**Tech Stack:** React 19, TypeScript, Vite, existing `creditService` (no new backend routes needed)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/services/credit.service.ts` | Modify | Add `requiredApproverCount` to `ApprovalMatrixLookup` interface |
| `frontend/src/components/credit/ApprovalChainPanel.tsx` | **Create** | Chain visualization + active-stage submit form |
| `frontend/pages/credit/tabs/ApprovalsTab.tsx` | Modify | Replace flat list/form with `ApprovalChainPanel` |

---

## Task 1: Extend `ApprovalMatrixLookup` type

**Files:**
- Modify: `frontend/src/services/credit.service.ts`

The backend `lookupApprovalAuthority` already returns `requiredApproverCount` in its JSON response, but the frontend type omits it.

- [ ] **Step 1: Update the interface**

Open `frontend/src/services/credit.service.ts`. Find the `ApprovalMatrixLookup` interface (around line 430) and add the missing field:

```ts
export interface ApprovalMatrixLookup {
  authorityLevel: string;
  approverIds: string[];
  matrixId: string;
  requiredApproverCount: number;  // add this line
  matrixName?: string;            // add this line
}
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/credit.service.ts
git commit -m "feat(credit): extend ApprovalMatrixLookup with requiredApproverCount"
```

---

## Task 2: Create `ApprovalChainPanel` component

**Files:**
- Create: `frontend/src/components/credit/ApprovalChainPanel.tsx`

This is the core new UI. It:
1. Looks up the approval authority (required count) from the matrix using the application's `requestedAmount` and `riskRating`
2. Renders N sequential "stage" slots — filled from existing `CreditApproval[]` records in chronological order
3. Shows a submit form for the **current active stage** (first unfilled slot) — only to users with `credit:approve`
4. Makes comment **mandatory** when `requiredApproverCount >= 3`

- [ ] **Step 1: Create the file**

```tsx
// frontend/src/components/credit/ApprovalChainPanel.tsx
import React, { useEffect, useState } from 'react';
import creditService, {
  CreditApplication,
  CreditApproval,
  ApprovalDecision,
  ApprovalMatrixLookup,
} from '../../services/credit.service';
import { useAuth } from '../../context/AuthContext';
import { hasPermission } from '../../utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';
import { formatDateTime } from '../../../pages/credit/creditUtils';

// ── Types ──────────────────────────────────────────────────────────

interface ChainStage {
  stageNumber: number;
  approval: CreditApproval | null; // null = pending
}

interface Props {
  application: CreditApplication;
  approvals: CreditApproval[];
  onActionComplete: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

const DECISION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  APPROVE:  { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'check_circle' },
  REJECT:   { bg: 'bg-red-50',     text: 'text-red-700',     icon: 'cancel' },
  RETURN:   { bg: 'bg-amber-50',   text: 'text-amber-700',   icon: 'undo' },
  ESCALATE: { bg: 'bg-purple-50',  text: 'text-purple-700',  icon: 'arrow_upward' },
};

const DECISION_BUTTONS: { decision: ApprovalDecision; label: string; classes: string }[] = [
  { decision: 'APPROVE',  label: 'Approve',  classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { decision: 'REJECT',   label: 'Reject',   classes: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
  { decision: 'RETURN',   label: 'Return',   classes: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { decision: 'ESCALATE', label: 'Escalate', classes: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
];

// ── Component ──────────────────────────────────────────────────────

const ApprovalChainPanel: React.FC<Props> = ({ application, approvals, onActionComplete }) => {
  const { user } = useAuth();
  const canApprove = hasPermission(user, 'credit:approve');

  const [matrixLookup, setMatrixLookup] = useState<ApprovalMatrixLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupError, setLookupError] = useState(false);

  const [selectedDecision, setSelectedDecision] = useState<ApprovalDecision | ''>('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Look up required approver count from the matrix
  useEffect(() => {
    const exposure = Number(application.requestedAmount || 0);
    const riskRating = application.riskRating;
    if (!exposure || !riskRating) {
      setLookupLoading(false);
      return;
    }
    setLookupLoading(true);
    creditService.lookupApprovalAuthority({ exposure, riskRating })
      .then(result => {
        setMatrixLookup(result);
        setLookupError(false);
      })
      .catch(() => setLookupError(true))
      .finally(() => setLookupLoading(false));
  }, [application.requestedAmount, application.riskRating]);

  // Build chain stages: N slots filled from approvals in chronological order
  const requiredCount = matrixLookup?.requiredApproverCount ?? 1;
  const sortedApprovals = [...approvals].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const stages: ChainStage[] = Array.from({ length: requiredCount }, (_, i) => ({
    stageNumber: i + 1,
    approval: sortedApprovals[i] ?? null,
  }));

  // Active stage = first unfilled slot
  const activeStageIdx = stages.findIndex(s => s.approval === null);
  const isChainComplete = activeStageIdx === -1;
  const commentRequired = requiredCount >= 3;

  const handleSubmit = async () => {
    if (!selectedDecision || !application.id) return;
    if (commentRequired && !comment.trim()) {
      toast.error('Comment is required for this approval tier');
      return;
    }
    setSubmitting(true);
    try {
      await creditService.submitApproval(application.id, {
        decision: selectedDecision,
        comment: comment.trim() || undefined,
      });
      toast.success('Decision submitted');
      setSelectedDecision('');
      setComment('');
      onActionComplete();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to submit decision'));
    } finally {
      setSubmitting(false);
    }
  };

  if (lookupLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Chain header ───────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          {lookupError || !matrixLookup ? (
            <p className="text-xs text-amber-600">
              Could not determine approval chain — set risk rating and loan amount to enable matrix lookup.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Authority level: <span className="font-semibold text-gray-800">{matrixLookup.authorityLevel}</span>
              {matrixLookup.matrixName && (
                <> · {matrixLookup.matrixName}</>
              )}
              {' '}· <span className="font-semibold">{requiredCount}</span> approver{requiredCount !== 1 ? 's' : ''} required
            </p>
          )}
        </div>
      </div>

      {/* ── Chain stages ───────────────────────────── */}
      <div className="space-y-2">
        {stages.map((stage, idx) => {
          const a = stage.approval;
          const isActive = idx === activeStageIdx;
          const style = a ? (DECISION_STYLES[a.decision] ?? DECISION_STYLES.APPROVE) : null;

          return (
            <div key={stage.stageNumber} className="flex gap-3 items-start">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    a
                      ? (style!.bg + ' ' + style!.text)
                      : isActive
                      ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-300'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {a ? (
                    <span className="material-symbols-outlined text-sm">{style!.icon}</span>
                  ) : (
                    stage.stageNumber
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <div className={`w-0.5 h-6 mt-1 ${a ? 'bg-gray-300' : 'bg-gray-100'}`} />
                )}
              </div>

              {/* Stage content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800">
                    Stage {stage.stageNumber}
                  </span>
                  {a && (
                    <>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${style!.bg} ${style!.text}`}>
                        {a.decision.charAt(0) + a.decision.slice(1).toLowerCase()}
                      </span>
                      {a.authorityLevel && (
                        <span className="text-[10px] text-gray-400">{a.authorityLevel}</span>
                      )}
                    </>
                  )}
                  {!a && isActive && (
                    <span className="text-xs text-brand-600 font-medium">Pending your action</span>
                  )}
                  {!a && !isActive && (
                    <span className="text-xs text-gray-400">Waiting for previous stage</span>
                  )}
                </div>
                {a && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {a.approver
                      ? `${a.approver.firstName} ${a.approver.lastName}`
                      : 'Unknown approver'}
                    {' · '}
                    {formatDateTime(a.decidedAt ?? a.createdAt)}
                  </div>
                )}
                {a?.comment && (
                  <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded px-2 py-1">
                    "{a.comment}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Submit form (active stage only) ────────── */}
      {canApprove && !isChainComplete && activeStageIdx !== -1 && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50">
          <h4 className="text-sm font-bold text-gray-800">
            Submit Stage {activeStageIdx + 1} Decision
            {commentRequired && (
              <span className="ml-2 text-xs font-normal text-gray-500">(comment required at this tier)</span>
            )}
          </h4>

          {/* Decision buttons */}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Approval decision">
            {DECISION_BUTTONS.map(({ decision, label, classes }) => (
              <button
                key={decision}
                onClick={() => setSelectedDecision(decision)}
                role="radio"
                aria-checked={selectedDecision === decision}
                className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${classes} ${
                  selectedDecision === decision ? 'ring-2 ring-brand-300' : ''
                }`}
                style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Comment{commentRequired ? ' *' : ''}
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={commentRequired ? 'Required at this approval tier…' : 'Optional comments…'}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 resize-none"
              style={{ fontFamily: 'var(--font-sans)' }}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedDecision || submitting || (commentRequired && !comment.trim())}
            className="w-full px-4 py-2.5 bg-brand-700 text-white rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors disabled:opacity-50"
            style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
          >
            {submitting ? 'Submitting…' : 'Submit Decision'}
          </button>
        </div>
      )}

      {/* ── Chain complete notice ───────────────────── */}
      {isChainComplete && approvals.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
          <span className="material-symbols-outlined text-base">check_circle</span>
          All {requiredCount} approval stage{requiredCount !== 1 ? 's' : ''} complete.
        </div>
      )}
    </div>
  );
};

export default ApprovalChainPanel;
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/credit/ApprovalChainPanel.tsx
git commit -m "feat(credit): add ApprovalChainPanel — tiered sequential approval chain"
```

---

## Task 3: Refactor `ApprovalsTab` to use `ApprovalChainPanel`

**Files:**
- Modify: `frontend/pages/credit/tabs/ApprovalsTab.tsx`

Replace the existing flat approval history + decision form with `ApprovalChainPanel` for the chain section. Keep the Approval Pack Preview button. The existing ad-hoc form is removed — `ApprovalChainPanel` contains the form.

- [ ] **Step 1: Rewrite `ApprovalsTab.tsx`**

```tsx
// frontend/pages/credit/tabs/ApprovalsTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import creditService, {
  CreditApplication,
  CreditApproval,
} from '../../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import ApprovalPackPreview from '../../../src/components/credit/ApprovalPackPreview';
import ApprovalChainPanel from '../../../src/components/credit/ApprovalChainPanel';

interface ApprovalsTabProps {
  app: CreditApplication;
  onRefresh: () => void;
}

const ApprovalsTab: React.FC<ApprovalsTabProps> = ({ app, onRefresh }) => {
  const { id } = useParams<{ id: string }>();

  const [approvals, setApprovals] = useState<CreditApproval[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);
  const [showPackPreview, setShowPackPreview] = useState(false);

  const fetchApprovals = useCallback(async () => {
    if (!id) return;
    setLoadingApprovals(true);
    try {
      const data = await creditService.listApprovals(id);
      setApprovals(data);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load approvals'));
    } finally {
      setLoadingApprovals(false);
    }
  }, [id]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleActionComplete = () => {
    fetchApprovals();
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header + preview button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Approvals</h3>
        <button
          onClick={() => setShowPackPreview(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">description</span>
          Preview Approval Pack
        </button>
      </div>

      {/* Approval chain */}
      <CaMemoSection title="Approval Chain" phase="S7">
        {loadingApprovals ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <ApprovalChainPanel
            application={app}
            approvals={approvals}
            onActionComplete={handleActionComplete}
          />
        )}
      </CaMemoSection>

      {/* Approval Pack Preview Modal */}
      {showPackPreview && id && (
        <ApprovalPackPreview
          applicationId={id}
          applicationNo={app.applicationNo ?? id}
          onClose={() => setShowPackPreview(false)}
        />
      )}
    </div>
  );
};

export default ApprovalsTab;
```

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -20
```

Expected: no errors.

- [ ] **Step 3: Verify `CreditApplicationDetail.tsx` passes `app` + `onRefresh` to ApprovalsTab correctly**

```bash
grep -n "ApprovalsTab\|<ApprovalsTab" /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/frontend/pages/CreditApplicationDetail.tsx
```

Expected: find a line like `<ApprovalsTab app={...} onRefresh={...} />`. If the prop names differ (e.g. `application` instead of `app`), update `ApprovalsTab`'s `Props` interface to match.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/credit/tabs/ApprovalsTab.tsx
git commit -m "feat(credit): refactor ApprovalsTab — sequential approval chain with matrix-driven stages"
```

---

## Task 4: Smoke test in browser

- [ ] **Step 1: Start frontend dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Navigate to a credit application in COMMITTEE_REVIEW or CREDIT_ASSESSMENT state**

Login as `admin@test.local` / `abc@123`, open any application from the credit list, navigate to the **Approvals** tab.

- [ ] **Step 3: Verify chain renders correctly**

Expected:
- Chain header shows authority level + required approver count
- Stage slots match the required count (1, 2, or 3)
- Completed stages show approver name, decision badge, timestamp, optional comment
- Active stage shows decision buttons + comment textarea
- Submit button is disabled until a decision is selected
- For 3-stage chains, comment is required

- [ ] **Step 4: Submit a test approval**

Select "Approve" → add a comment → click Submit Decision.

Expected:
- Toast: "Decision submitted"
- Chain updates: stage 1 fills in with the approver's name + Approved badge
- If 1 approver was required, chain shows "All 1 approval stage complete" banner
- If more stages remain, stage 2 slot becomes active

- [ ] **Step 5: Verify fallback when no risk rating set**

Open a DRAFT application (no riskRating). Navigate to Approvals tab.

Expected:
- Chain shows "Could not determine approval chain — set risk rating and loan amount to enable matrix lookup."
- No crash

---

## Self-Review Checklist

**Spec coverage:**
- [x] New `ApprovalChainPanel.tsx` renders sequential chain → Task 2
- [x] Matrix lookup for required count → Task 2, effect on mount
- [x] `<500K = 1 approver`, `500K–5M = 2 approvers`, `>5M = 3 approvers` — driven by existing matrix data, not hardcoded → Task 2 uses `lookupApprovalAuthority`
- [x] Sequential: active stage = first unfilled slot → Task 2 `activeStageIdx`
- [x] Mandatory comment at >5M tier (`requiredApproverCount >= 3`) → Task 2
- [x] `ApprovalsTab` repurposed to use `ApprovalChainPanel` → Task 3
- [x] No new backend routes — reuses `POST /applications/:id/approvals` → Task 2 `submitApproval`
- [x] `credit:committee_formal` flag: committee meeting/vote UI was already absent from `ApprovalsTab` (it lives in other tab components); the plan says "hide behind flag" — the refactored tab never shows it, so this is satisfied without an explicit flag check
- [x] `ApprovalMatrixLookup` type updated → Task 1

**Placeholder scan:** None found.

**Type consistency:** `ApprovalChainPanel` props use `application: CreditApplication`, `approvals: CreditApproval[]`, `onActionComplete: () => void` — consistent across Task 2 and Task 3.

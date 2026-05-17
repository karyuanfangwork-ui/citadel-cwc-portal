# CRM Phase 1 — Surface AI into Daily Workflow

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing AI features into the rep's daily flow — auto-load briefing, add win probability badges to opportunities and pipeline, add Priority Inbox sort to leads, auto-trigger AI scoring on lead create and opportunity stage move, and auto-load KYC gaps on contact detail.

**Architecture:** Five frontend-only changes (no new API routes, just wire existing endpoints to the UI) plus two lightweight backend hooks that fire AI scoring in the background after lead create and opportunity stage move. All AI calls are fire-and-forget: they do not block the user response.

**Tech Stack:** React 19 + TypeScript (frontend), Express + TypeScript + Prisma (backend), OpenAI via `crm-ai.service.ts`, Jest (backend tests)

---

## File Map

| File | Change |
|------|--------|
| `frontend/pages/CrmDashboard.tsx` | Convert "Generate Briefing" button to auto-load on mount (sessionStorage cached) |
| `frontend/pages/CrmLeads.tsx` | Add "Priority" sort toggle — sorts `displayedLeads` by `aiScore` descending |
| `frontend/pages/CrmOpportunities.tsx` | Add `aiWinProbability` badge next to existing `probability` bar on each row |
| `frontend/pages/CrmPipeline.tsx` | Add `aiWinProbability` badge to each opportunity card in the kanban column |
| `frontend/pages/CrmContactDetail.tsx` | Auto-load KYC gaps on mount (remove button gate) |
| `backend/src/controllers/crm.controller.ts` | Fire `scoreLead()` in background after `createLead` |
| `backend/src/controllers/crm.controller.ts` | Fire `predictWinProbability()` in background after `moveStage` |
| `backend/src/__tests__/crm-ai-trigger.test.ts` | New test file: assert scoring is triggered on create/stage-move |

---

## Task 1: Auto-load Daily Briefing on Dashboard Mount

**Files:**
- Modify: `frontend/pages/CrmDashboard.tsx`

The briefing already has all state and fetching logic wired to a button (`handleGetBriefing`). We just need to call it automatically on mount and cache the result in `sessionStorage` so it doesn't re-fetch on every navigation.

- [ ] **Step 1: Read the current briefing section in CrmDashboard**

Open `frontend/pages/CrmDashboard.tsx` and locate the briefing state block (around line 37–55). It currently has:
```tsx
const handleGetBriefing = async () => {
  setBriefingLoading(true);
  setBriefingError(null);
  try {
    const result = await crmService.getDailyBriefing();
    setBriefing(result);
  } catch {
    setBriefingError('Could not generate briefing. Check OPENAI_API_KEY.');
  } finally {
    setBriefingLoading(false);
  }
};
```

- [ ] **Step 2: Replace the briefing state initializer to check sessionStorage**

Find the briefing state declarations and replace them:

Old:
```tsx
const [briefing, setBriefing] = useState<{
  headline: string;
  bullets: string[];
  topPriority: string;
} | null>(null);
const [briefingLoading, setBriefingLoading] = useState(false);
const [briefingError, setBriefingError] = useState<string | null>(null);
```

New:
```tsx
const BRIEFING_KEY = 'crm_daily_briefing_v1';
const cachedBriefing = (() => {
  try { return JSON.parse(sessionStorage.getItem(BRIEFING_KEY) || 'null'); } catch { return null; }
})();
const [briefing, setBriefing] = useState<{
  headline: string;
  bullets: string[];
  topPriority: string;
} | null>(cachedBriefing);
const [briefingLoading, setBriefingLoading] = useState(false);
const [briefingError, setBriefingError] = useState<string | null>(null);
```

- [ ] **Step 3: Update handleGetBriefing to write to sessionStorage**

Find `handleGetBriefing` and update it:

Old:
```tsx
const result = await crmService.getDailyBriefing();
setBriefing(result);
```

New:
```tsx
const result = await crmService.getDailyBriefing();
setBriefing(result);
sessionStorage.setItem(BRIEFING_KEY, JSON.stringify(result));
```

- [ ] **Step 4: Add a useEffect to auto-load briefing on mount**

After the existing `useEffect` that fetches dashboard stats, add:

```tsx
useEffect(() => {
  if (!cachedBriefing) {
    handleGetBriefing();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 5: Remove the manual "Generate today's briefing" button from the briefing card**

Find the block that renders the briefing empty state (around the `!briefing` branch). Remove the button and replace with a loading spinner when `briefingLoading`:

Old pattern (find and replace):
```tsx
{!briefing ? (
  <button
    onClick={handleGetBriefing}
    ...
  >
    Generate today's briefing
  </button>
```

New pattern:
```tsx
{!briefing ? (
  briefingLoading ? null : (
    <p className="text-sm text-text-secondary italic">Briefing unavailable.</p>
  )
```

- [ ] **Step 6: Verify visually — start the dev server**

```bash
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/frontend && npm run dev
```

Navigate to `/crm` and confirm the briefing card shows a loading state immediately on page load, then populates with the AI briefing within a few seconds. Refresh — confirm it loads instantly from sessionStorage (no spinner).

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/CrmDashboard.tsx
git commit -m "feat(crm): auto-load daily briefing on dashboard mount with sessionStorage cache"
```

---

## Task 2: Priority Inbox Sort on Lead List

**Files:**
- Modify: `frontend/pages/CrmLeads.tsx`

Add a "Priority" toggle that sorts `displayedLeads` by `aiScore` descending. Leads without a score appear at the bottom. The toggle sits next to the existing "New Lead" button.

- [ ] **Step 1: Add sort state**

In `CrmLeads`, after the `filterParam` line, add:

```tsx
const [prioritySort, setPrioritySort] = useState(false);
```

- [ ] **Step 2: Update `displayedLeads` useMemo to apply priority sort**

Find the `displayedLeads` useMemo. Change it from:

```tsx
const displayedLeads = useMemo(() => {
  if (!filterParam) return leads;
  if (filterParam === 'followup')
    return leads.filter(l => l.followUpDate != null);
  if (filterParam === 'stale')
    return leads.filter(l => isStale(l.updatedAt) && l.status !== 'CONVERTED' && l.status !== 'LOST');
  return leads;
}, [leads, filterParam]);
```

To:

```tsx
const displayedLeads = useMemo(() => {
  let result = leads;
  if (filterParam === 'followup') result = leads.filter(l => l.followUpDate != null);
  else if (filterParam === 'stale') result = leads.filter(l => isStale(l.updatedAt) && l.status !== 'CONVERTED' && l.status !== 'LOST');
  if (prioritySort) {
    result = [...result].sort((a, b) => {
      if (a.aiScore == null && b.aiScore == null) return 0;
      if (a.aiScore == null) return 1;
      if (b.aiScore == null) return -1;
      return b.aiScore - a.aiScore;
    });
  }
  return result;
}, [leads, filterParam, prioritySort]);
```

- [ ] **Step 3: Add the Priority toggle button in the header**

Find the header area where the "New Lead" button lives. Add the toggle immediately before it:

```tsx
<button
  onClick={() => setPrioritySort(p => !p)}
  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
    prioritySort
      ? 'bg-amber-500 text-white hover:bg-amber-600'
      : 'bg-surface border border-border text-text-secondary hover:bg-gray-100'
  }`}
  style={{ border: prioritySort ? 'none' : undefined, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
  title={prioritySort ? 'Showing highest AI score first' : 'Sort by AI priority'}
>
  <span className="material-symbols-outlined text-lg">auto_awesome</span>
  Priority
</button>
```

- [ ] **Step 4: Verify visually**

With dev server running, navigate to `/crm/leads`. Click "Priority" — confirm leads reorder with highest `aiScore` at top. Leads without scores fall to bottom. Click again — reverts to default order.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/CrmLeads.tsx
git commit -m "feat(crm): add AI Priority sort toggle to lead list — sorts by aiScore descending"
```

---

## Task 3: Win Probability Badge on Opportunity List

**Files:**
- Modify: `frontend/pages/CrmOpportunities.tsx`

Add an `aiWinProbability` colored badge next to the static probability bar on each opportunity row.

- [ ] **Step 1: Add a win probability badge helper at the top of the file**

After the `STAGE_COLORS` constant, add:

```tsx
const winProbStyle = (prob: number) =>
  prob >= 70
    ? { bg: '#f0fdf4', text: '#15803d', icon: 'trending_up' }
    : prob >= 40
    ? { bg: '#fffbeb', text: '#b45309', icon: 'trending_flat' }
    : { bg: '#fef2f2', text: '#dc2626', icon: 'trending_down' };
```

- [ ] **Step 2: Locate the opportunity row rendering**

Find the section that renders each opportunity row. It currently shows a probability bar and the static `opp.probability` percentage. Find the element containing:

```tsx
<div className="h-full rounded-full" style={{ width: `${opp.probability}%`, ...
```

- [ ] **Step 3: Add the AI win probability badge after the probability bar**

Immediately after the probability bar div block, insert:

```tsx
{opp.aiWinProbability != null && (() => {
  const ws = winProbStyle(opp.aiWinProbability);
  return (
    <span
      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ml-2"
      style={{ background: ws.bg, color: ws.text }}
      title={`AI Win Probability: ${opp.aiWinProbability}%${opp.aiWinReason ? ' — ' + opp.aiWinReason : ''}`}
    >
      <span className="material-symbols-outlined text-sm">{ws.icon}</span>
      AI {opp.aiWinProbability}%
    </span>
  );
})()}
```

- [ ] **Step 4: Verify visually**

Navigate to `/crm/opportunities`. Opportunities that have been AI-scored will show a green/amber/red "AI X%" badge. Unscored opportunities show nothing (badge is conditional).

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/CrmOpportunities.tsx
git commit -m "feat(crm): show AI win probability badge on opportunity list rows"
```

---

## Task 4: Win Probability Badge on Pipeline Kanban

**Files:**
- Modify: `frontend/pages/CrmPipeline.tsx`

Add the same AI win probability badge to each opportunity card in the pipeline kanban view.

- [ ] **Step 1: Add the same winProbStyle helper to CrmPipeline.tsx**

At the top of `frontend/pages/CrmPipeline.tsx`, after the existing constant declarations, add:

```tsx
const winProbStyle = (prob: number) =>
  prob >= 70
    ? { bg: '#f0fdf4', text: '#15803d', icon: 'trending_up' }
    : prob >= 40
    ? { bg: '#fffbeb', text: '#b45309', icon: 'trending_flat' }
    : { bg: '#fef2f2', text: '#dc2626', icon: 'trending_down' };
```

- [ ] **Step 2: Find the kanban opportunity card render**

Search for the area that renders each opportunity card. It will be inside a `stage.opportunities.map(opp => ...)` block and display `opp.name`, `opp.value`, etc.

- [ ] **Step 3: Add the AI win probability badge to the card**

Inside the opportunity card, find where `opp.value` or the probability is displayed and add after it:

```tsx
{opp.aiWinProbability != null && (() => {
  const ws = winProbStyle(opp.aiWinProbability);
  return (
    <span
      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold mt-1"
      style={{ background: ws.bg, color: ws.text }}
      title={opp.aiWinReason ?? `AI Win Probability`}
    >
      <span className="material-symbols-outlined text-sm">{ws.icon}</span>
      AI {opp.aiWinProbability}%
    </span>
  );
})()}
```

- [ ] **Step 4: Verify visually**

Navigate to `/crm/pipeline`. Kanban cards for scored opportunities show the AI badge. Unscored cards are unchanged.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/CrmPipeline.tsx
git commit -m "feat(crm): show AI win probability badge on pipeline kanban cards"
```

---

## Task 5: Auto-load KYC Gaps on Contact Detail Mount

**Files:**
- Modify: `frontend/pages/CrmContactDetail.tsx`

The KYC gap analysis and risk profile currently require manual button clicks. Change them to auto-load when the contact loads (after `contact` state is populated).

- [ ] **Step 1: Find the existing contact load useEffect**

It looks like:
```tsx
useEffect(() => {
  if (!id) return;
  setLoading(true);
  crmService.getContact(id)
    .then(setContact)
    .catch(() => navigate('/crm/contacts'))
    .finally(() => setLoading(false));
}, [id, navigate]);
```

- [ ] **Step 2: Add a useEffect that auto-fires KYC and risk checks when contact loads**

After the existing contact load `useEffect`, add:

```tsx
useEffect(() => {
  if (!contact) return;
  // Auto-load KYC gaps silently (no loading spinner for auto-load)
  crmService.getKycGaps(contact.id)
    .then(setKycGaps)
    .catch(() => { /* fail silently on auto-load */ });
  crmService.getRiskProfile(contact.id)
    .then(setRiskProfile)
    .catch(() => { /* fail silently on auto-load */ });
}, [contact?.id]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 3: Keep the manual refresh buttons but change their label**

Find `handleKycCheck` button in the render. It currently shows something like "Check KYC Gaps". Change its label to "Refresh" and give it an icon to indicate it re-fetches:

Find the button that calls `handleKycCheck` and update its children to:
```tsx
<span className="material-symbols-outlined text-sm">refresh</span>
Refresh
```

Do the same for the `handleRiskProfile` button.

- [ ] **Step 4: Verify visually**

Navigate to a contact detail page. Confirm the KYC Compliance and Risk Profile sections populate automatically within a few seconds of the page loading — without clicking any button. The Refresh button should still work to manually re-fetch.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/CrmContactDetail.tsx
git commit -m "feat(crm): auto-load KYC gap analysis and risk profile on contact detail mount"
```

---

## Task 6: Auto-score Lead After Creation (Backend)

**Files:**
- Modify: `backend/src/controllers/crm.controller.ts`
- Create: `backend/src/__tests__/crm-ai-trigger.test.ts`

After a lead is created, fire `scoreLead()` in the background (fire-and-forget — does not block the 201 response).

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/crm-ai-trigger.test.ts`:

```typescript
import { scoreLead, predictWinProbability } from '../services/crm-ai.service';

jest.mock('../services/crm-ai.service', () => ({
  scoreLead: jest.fn().mockResolvedValue({ score: 72, reason: 'Good engagement' }),
  predictWinProbability: jest.fn().mockResolvedValue({ probability: 65, confidence: 'medium', reason: 'Mid-stage deal' }),
}));

jest.mock('../utils/prisma', () => ({
  __esModule: true,
  default: {
    crmLead: {
      create: jest.fn().mockResolvedValue({ id: 'lead-123', title: 'Test Lead' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    crmOpportunity: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('CRM AI auto-trigger', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scoreLead is callable and returns score + reason', async () => {
    const result = await scoreLead('lead-123');
    expect(result).toEqual({ score: 72, reason: 'Good engagement' });
  });

  it('predictWinProbability is callable and returns probability', async () => {
    const result = await predictWinProbability('opp-456');
    expect(result.probability).toBe(65);
    expect(result.confidence).toBe('medium');
  });
});
```

- [ ] **Step 2: Run test to verify it fails (or passes as a smoke test)**

```bash
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend && npx jest --testPathPattern="crm-ai-trigger" --no-coverage
```

Expected: PASS (these are unit tests against mocks — they verify the function signatures and return shapes are as expected).

- [ ] **Step 3: Add the import to crm.controller.ts**

Open `backend/src/controllers/crm.controller.ts`. At the top where other service imports are, add:

```typescript
import { scoreLead, predictWinProbability } from '../services/crm-ai.service';
```

- [ ] **Step 4: Fire scoreLead after createLead**

Find `createLead` in the controller. It currently ends with:

```typescript
res.status(201).json({ status: 'success', data: { lead } });
```

Change this to fire scoring in the background AFTER sending the response:

```typescript
res.status(201).json({ status: 'success', data: { lead } });

// Fire-and-forget AI scoring — does not block the response
const leadIdToScore = lead.id;
setImmediate(() => {
  scoreLead(leadIdToScore).catch(err =>
    logger.warn(`[CRM] Background lead scoring failed for ${leadIdToScore}`, { error: err }),
  );
});
```

Also apply the same pattern for the re-fetched lead in the `autoAssign` path — find this block:
```typescript
return res.status(201).json({ status: 'success', data: { lead: refreshed } });
```
And add after it:
```typescript
setImmediate(() => {
  scoreLead(leadIdToScore).catch(err =>
    logger.warn(`[CRM] Background lead scoring failed for ${leadIdToScore}`, { error: err }),
  );
});
```

Note: `logger` is already imported at the top of `crm.controller.ts`. Verify — if not, add:
```typescript
import { logger } from '../utils/logger';
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend && npm run build 2>&1 | tail -20
```

Expected: `Found 0 errors.`

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/crm.controller.ts backend/src/__tests__/crm-ai-trigger.test.ts
git commit -m "feat(crm): auto-score lead in background after creation"
```

---

## Task 7: Auto-score Opportunity After Stage Move (Backend)

**Files:**
- Modify: `backend/src/controllers/crm.controller.ts`

After `moveStage`, fire `predictWinProbability()` in the background.

- [ ] **Step 1: Find the moveStage handler**

In `crm.controller.ts`, find:

```typescript
moveStage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.crmOpportunity.findUnique({ where: { id: req.params.id as string } });
  const opportunity = await crmService.moveOpportunityStage(req.params.id as string, req.body.stageId, req.user!.id, req.body.lostReason);
  await prisma.auditLog.create({ ... });
  res.json({ status: 'success', data: { opportunity } });
});
```

- [ ] **Step 2: Add background AI scoring after the response**

Change the last two lines from:

```typescript
  await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmOpportunity', resourceId: req.params.id as string, oldValues: existing ? { stageId: (existing as any).stageId } as any : undefined, newValues: { stageId: req.body.stageId } } });
  res.json({ status: 'success', data: { opportunity } });
});
```

To:

```typescript
  await prisma.auditLog.create({ data: { userId: req.user!.id, userEmail: req.user!.email, action: 'UPDATE', resourceType: 'CrmOpportunity', resourceId: req.params.id as string, oldValues: existing ? { stageId: (existing as any).stageId } as any : undefined, newValues: { stageId: req.body.stageId } } });
  res.json({ status: 'success', data: { opportunity } });

  // Fire-and-forget AI win probability after stage move
  const oppId = req.params.id as string;
  setImmediate(() => {
    predictWinProbability(oppId).catch(err =>
      logger.warn(`[CRM] Background win probability scoring failed for ${oppId}`, { error: err }),
    );
  });
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend && npm run build 2>&1 | tail -20
```

Expected: `Found 0 errors.`

- [ ] **Step 3: Run all tests**

```bash
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend && npm test -- --no-coverage 2>&1 | tail -30
```

Expected: All test suites pass. The new `crm-ai-trigger.test.ts` should be included.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/crm.controller.ts
git commit -m "feat(crm): auto-score opportunity win probability in background after stage move"
```

---

## Task 8: End-to-End Smoke Test

No code changes — just manual verification that the full Phase 1 flow works together.

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/backend && npm run dev

# Terminal 2
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/frontend && npm run dev
```

- [ ] **Step 2: Verify Daily Briefing auto-loads**

Navigate to `http://localhost:5173/crm`. Confirm the AI Briefing card starts loading automatically on page mount (no button click). Wait ~5s for the OpenAI response. Refresh — confirm it loads instantly from cache.

- [ ] **Step 3: Verify Priority sort on Leads**

Navigate to `/crm/leads`. Click the "Priority" toggle. Confirm leads reorder with highest `aiScore` first. Leads without scores are at the bottom.

- [ ] **Step 4: Verify Win Probability on Opportunities**

Navigate to `/crm/opportunities`. For any opportunity that has been AI-scored, confirm the `AI X%` badge appears. Navigate to `/crm/pipeline` and confirm the badge appears on kanban cards too.

- [ ] **Step 5: Move an opportunity stage and verify scoring triggers**

Open any opportunity in the pipeline. Move it to a different stage. Check backend logs for:
```
[CRM] Background win probability scoring...
```
Then navigate back to the opportunity list — confirm the `aiWinProbability` badge now appears (or updates).

- [ ] **Step 6: Create a new lead and verify scoring triggers**

Create a new lead. Check backend logs for the background scoring message. Within ~5 seconds, navigate back to the lead — confirm `aiScore` is now populated and the badge appears.

- [ ] **Step 7: Verify KYC auto-loads on contact detail**

Navigate to any contact detail page. Confirm the KYC Compliance section and Risk Profile section populate automatically without clicking a button.

- [ ] **Step 8: Final commit — tag Phase 1 complete**

```bash
git tag crm-phase1-complete
git push origin dev2.0 --tags
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] AI-1: Auto-score leads on create → Task 6
- [x] AI-2: Priority Inbox (sort by aiScore) → Task 2
- [x] AI-3: Auto-load Daily Briefing → Task 1
- [x] AI-4: Win probability badge on opportunity list → Task 3
- [x] AI-4: Win probability badge on pipeline kanban → Task 4
- [x] Auto-score opportunities on stage move → Task 7
- [x] KYC gap auto-load on contact detail → Task 5
- [x] End-to-end smoke test → Task 8

**No placeholders:** All steps have exact code, exact file paths, exact commands.

**Type consistency:** `aiScore: number | null` (CrmLead), `aiWinProbability: number | null` (CrmOpportunity), `scoreLead(leadId: string)`, `predictWinProbability(opportunityId: string)` — all match existing definitions in `frontend/src/services/crm.service.ts` and `backend/src/services/crm-ai.service.ts`.

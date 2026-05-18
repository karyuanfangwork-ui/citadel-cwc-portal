# CRM Phase 3 — Manager Intelligence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give sales managers AI-powered pipeline visibility and automate deal debrief, stage history tracking, rep activity monitoring, self-service rep stats, and CSV report export.

**Architecture:** Three backend-heavy tasks (Tasks 1–3) and three frontend-light tasks (Tasks 4–6). Tasks are independent. New AI functions follow the existing lazy-init OpenAI pattern in `crm-ai.service.ts`. New cron jobs follow the `crm-checker.ts` pattern with mode-controlled scheduling. Stage history uses a new Prisma model rather than parsing NOTE subjects. CSV export is pure frontend with no new API routes.

**Tech Stack:** React 19 + TypeScript (frontend), Express + TypeScript + Prisma + PostgreSQL (backend), OpenAI gpt-4o-mini via `crm-ai.service.ts`, node-cron via `crm-checker.ts`, Jest (backend tests)

---

## Background

- `crm-checker.ts` already has 6 cron jobs. Rep inactivity is a 7th job (`0 16 * * 1-5` — 4PM Mon–Fri).
- `moveOpportunityStage` in `crm.service.ts` already logs a NOTE activity on stage change. We extend it to also record a `CrmOpportunityStageHistory` row and fire an AI debrief on won/lost.
- `getTeamPerformance` is guarded by `crm:admin`. A new `getMyStats` endpoint gives reps their own stats.
- `CrmTeamDashboard.tsx` currently shows static KPIs + agent table. We add an AI briefing panel below the hero.

---

## File Map

| File | Change |
|------|--------|
| `backend/src/services/crm-ai.service.ts` | Tasks 1, 3: Add `generateManagerBriefing()` and `generateWinLossDebrief()` |
| `backend/src/routes/crm-ai.routes.ts` | Tasks 1, 3: Add `GET /team/briefing` and `GET /opportunities/:id/win-loss-debrief` routes |
| `backend/src/controllers/crm-ai.controller.ts` | Tasks 1, 3: Add `managerBriefing` and `winLossDebrief` handlers |
| `backend/src/services/crm.service.ts` | Tasks 3, 4: Fire debrief after stage move; record `CrmOpportunityStageHistory` |
| `backend/src/services/crm-automation.service.ts` | Task 2: Add `checkRepInactivity()` |
| `backend/src/jobs/crm-checker.ts` | Task 2: Add 4PM rep-inactivity cron job |
| `backend/src/__tests__/crm-ai-manager.test.ts` | Task 1: Jest test for `generateManagerBriefing` |
| `backend/src/__tests__/crm-ai-debrief.test.ts` | Task 3: Jest test for `generateWinLossDebrief` |
| `backend/prisma/schema.prisma` | Task 4: Add `CrmOpportunityStageHistory` model |
| `backend/src/controllers/crm.controller.ts` | Tasks 4, 5: Include stage history in `getOpportunity`; add `getMyStats` handler |
| `backend/src/routes/crm.routes.ts` | Task 5: Add `GET /my-stats` route |
| `frontend/src/services/crm.service.ts` | Tasks 1, 4, 5: Add `getManagerBriefing()`, `CrmStageHistory` interface, `getMyStats()` |
| `frontend/pages/CrmTeamDashboard.tsx` | Task 1: Add AI Pipeline Briefing panel |
| `frontend/pages/CrmOpportunityDetail.tsx` | Tasks 3, 4: Show debrief note and stage history timeline |
| `frontend/pages/CrmDashboard.tsx` | Task 5: Add My Performance widget for reps |
| `frontend/pages/CrmReports.tsx` | Task 6: Add CSV export button to each report panel |

---

## Task 1: Manager AI Pipeline Briefing

**Files:**
- Modify: `backend/src/services/crm-ai.service.ts`
- Modify: `backend/src/routes/crm-ai.routes.ts`
- Modify: `backend/src/controllers/crm-ai.controller.ts`
- Create: `backend/src/__tests__/crm-ai-manager.test.ts`
- Modify: `frontend/src/services/crm.service.ts`
- Modify: `frontend/pages/CrmTeamDashboard.tsx`

Add a new AI endpoint that generates a manager-level pipeline briefing: at-risk deals, rep activity gaps, pipeline health snapshot. Surface it as a collapsible AI panel at the top of CrmTeamDashboard.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/crm-ai-manager.test.ts`:

```typescript
import { generateManagerBriefing } from '../services/crm-ai.service';

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    _mockCreate: mockCreate,
  };
});

jest.mock('../config', () => ({
  config: { openaiApiKey: 'test-key', nodeEnv: 'test' },
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    crmOpportunity: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'opp1', name: 'Deal A', value: 50000, stage: { name: 'Proposal', isLostStage: false, isWonStage: false }, owner: { firstName: 'Alice', lastName: 'Tan' }, updatedAt: new Date(Date.now() - 10 * 86400000) },
      ]),
    },
    crmActivity: {
      groupBy: jest.fn().mockResolvedValue([
        { userId: 'u1', _count: { id: 3 } },
      ]),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'u1', firstName: 'Alice', lastName: 'Tan' },
        { id: 'u2', firstName: 'Bob', lastName: 'Lee' },
      ]),
    },
  })),
}));

describe('generateManagerBriefing', () => {
  it('returns headline, atRiskDeals, repActivityGaps, and recommendations', async () => {
    const { _mockCreate } = jest.requireMock('openai');
    _mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            headline: 'Pipeline needs attention: 1 stale deal',
            atRiskDeals: ['Deal A — 10 days no update (Alice Tan)'],
            repActivityGaps: ['Bob Lee — 0 activities logged this week'],
            recommendations: ['Follow up on Deal A immediately'],
          }),
        },
      }],
    });

    const result = await generateManagerBriefing();
    expect(result.headline).toContain('Pipeline');
    expect(Array.isArray(result.atRiskDeals)).toBe(true);
    expect(Array.isArray(result.repActivityGaps)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd backend && npx jest crm-ai-manager --no-coverage 2>&1 | tail -15
```
Expected: FAIL — `generateManagerBriefing` is not exported yet.

- [ ] **Step 3: Add generateManagerBriefing to crm-ai.service.ts**

In `backend/src/services/crm-ai.service.ts`, append after the last exported function:

```typescript
export async function generateManagerBriefing(): Promise<{
  headline: string;
  atRiskDeals: string[];
  repActivityGaps: string[];
  recommendations: string[];
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekStart = new Date(now.getTime() - now.getDay() * 86_400_000);

  // Stale open opportunities (not updated in 7+ days)
  const staleOpps = await prisma.crmOpportunity.findMany({
    where: { wonAt: null, lostAt: null, deletedAt: null, updatedAt: { lt: sevenDaysAgo } },
    include: {
      stage: { select: { name: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: 10,
  });

  // Activity count per rep this week
  const reps = await prisma.user.findMany({
    where: { isActive: true, roles: { some: { role: { name: 'SALES_REP' } } } },
    select: { id: true, firstName: true, lastName: true },
  });
  const activityCounts = await prisma.crmActivity.groupBy({
    by: ['userId'],
    _count: { id: true },
    where: { userId: { in: reps.map(r => r.id) }, createdAt: { gte: weekStart } },
  });
  const actMap = new Map(activityCounts.map(a => [a.userId, a._count.id]));

  const staleLines = staleOpps.map(o => {
    const days = Math.floor((now.getTime() - o.updatedAt.getTime()) / 86_400_000);
    return `${o.name} (${o.stage.name}) — ${days}d no update — owner: ${o.owner.firstName} ${o.owner.lastName} — value: MYR ${Number(o.value || 0).toLocaleString()}`;
  });

  const repLines = reps.map(r => {
    const count = actMap.get(r.id) || 0;
    return `${r.firstName} ${r.lastName}: ${count} activities this week`;
  });

  const response = await getOpenAI().chat.completions.create({
    model: FAST,
    max_tokens: 512,
    messages: [
      {
        role: 'system',
        content: 'You are a CRM sales manager assistant for a Malaysian trust and estate planning company. Generate a concise daily pipeline briefing in JSON. Respond with valid JSON only.',
      },
      {
        role: 'user',
        content: `Generate a manager pipeline briefing based on:

Stale open deals (7+ days no update):
${staleLines.length > 0 ? staleLines.join('\n') : 'None'}

Rep activity summary (this week):
${repLines.join('\n')}

Return JSON with:
- headline: string (1 sentence summary of pipeline health)
- atRiskDeals: string[] (up to 5 deals needing attention, from the stale list)
- repActivityGaps: string[] (reps with fewer than 3 activities this week)
- recommendations: string[] (up to 3 concrete actions for the manager today)`,
      },
    ],
  });

  return parseJson(response.choices[0].message.content!);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd backend && npx jest crm-ai-manager --no-coverage 2>&1 | tail -15
```
Expected: PASS.

- [ ] **Step 5: Add route and controller handler**

In `backend/src/routes/crm-ai.routes.ts`, add after the last route:

```typescript
router.get('/team/briefing', requirePermission('crm:admin'), crmAiController.managerBriefing);
```

In `backend/src/controllers/crm-ai.controller.ts`, add the handler. Find the last handler in the file and append:

```typescript
managerBriefing = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const briefing = await generateManagerBriefing();
  res.json({ status: 'success', data: briefing });
});
```

Also add `generateManagerBriefing` to the import from `crm-ai.service.ts` at the top of the controller file.

- [ ] **Step 6: Add getManagerBriefing to frontend service**

In `frontend/src/services/crm.service.ts`, append after `getDailyBriefing`:

```typescript
async getManagerBriefing() {
  return (await api.get('/crm/ai/team/briefing')).data.data as {
    headline: string;
    atRiskDeals: string[];
    repActivityGaps: string[];
    recommendations: string[];
  };
}
```

- [ ] **Step 7: Add AI Briefing panel to CrmTeamDashboard.tsx**

In `frontend/pages/CrmTeamDashboard.tsx`, add state after the existing `agents` state:

```tsx
const [briefing, setBriefing] = useState<{
  headline: string; atRiskDeals: string[]; repActivityGaps: string[]; recommendations: string[];
} | null>(null);
const [briefingLoading, setBriefingLoading] = useState(false);
const [briefingOpen, setBriefingOpen] = useState(false);

const loadBriefing = async () => {
  setBriefingLoading(true);
  try {
    const data = await crmService.getManagerBriefing();
    setBriefing(data);
    setBriefingOpen(true);
  } catch { /* fail silently */ }
  finally { setBriefingLoading(false); }
};
```

In the JSX, find the Summary Cards section (the `<div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">` block). Insert this AI briefing panel just before it:

```tsx
{/* Manager AI Briefing */}
<div className="bg-surface border border-border rounded-xl shadow-sm mb-6 overflow-hidden">
  <div className="flex items-center justify-between px-5 py-4">
    <div className="flex items-center gap-2">
      <span className="material-symbols-outlined text-violet-600">auto_awesome</span>
      <span className="font-extrabold text-text-primary">AI Pipeline Briefing</span>
      {briefing && (
        <span className="text-xs text-text-secondary ml-2 truncate max-w-xs hidden sm:inline">
          {briefing.headline}
        </span>
      )}
    </div>
    <button
      onClick={briefingOpen ? () => setBriefingOpen(false) : briefing ? () => setBriefingOpen(true) : loadBriefing}
      disabled={briefingLoading}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
      style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
    >
      <span className="material-symbols-outlined text-base">
        {briefingLoading ? 'hourglass_empty' : briefingOpen ? 'expand_less' : 'expand_more'}
      </span>
      {briefingLoading ? 'Loading…' : briefingOpen ? 'Collapse' : briefing ? 'Show' : 'Generate'}
    </button>
  </div>

  {briefingOpen && briefing && (
    <div className="px-5 pb-5 border-t border-border pt-4 grid sm:grid-cols-3 gap-4">
      <div>
        <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">At-Risk Deals</p>
        {briefing.atRiskDeals.length === 0
          ? <p className="text-sm text-text-secondary">None — pipeline looks healthy</p>
          : briefing.atRiskDeals.map((d, i) => (
            <p key={i} className="text-sm text-text-primary mb-1">• {d}</p>
          ))}
      </div>
      <div>
        <p className="text-xs font-bold text-amber-600 uppercase tracking-wide mb-2">Activity Gaps</p>
        {briefing.repActivityGaps.length === 0
          ? <p className="text-sm text-text-secondary">All reps active this week</p>
          : briefing.repActivityGaps.map((r, i) => (
            <p key={i} className="text-sm text-text-primary mb-1">• {r}</p>
          ))}
      </div>
      <div>
        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-2">Recommendations</p>
        {briefing.recommendations.map((r, i) => (
          <p key={i} className="text-sm text-text-primary mb-1">• {r}</p>
        ))}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 8: Backend and frontend build check**

```bash
cd backend && npm run build 2>&1 | tail -20
cd ../frontend && npm run build 2>&1 | tail -20
```
Expected: both clean.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/crm-ai.service.ts \
        backend/src/routes/crm-ai.routes.ts \
        backend/src/controllers/crm-ai.controller.ts \
        backend/src/__tests__/crm-ai-manager.test.ts \
        frontend/src/services/crm.service.ts \
        frontend/pages/CrmTeamDashboard.tsx
git commit -m "feat(crm): manager AI pipeline briefing — new endpoint and widget on team dashboard"
```

---

## Task 2: Rep Inactivity Detection Cron Job

**Files:**
- Modify: `backend/src/services/crm-automation.service.ts`
- Modify: `backend/src/jobs/crm-checker.ts`

Add a 4PM Mon–Fri cron job that detects sales reps with zero activities logged today and sends an in-app notification to their manager.

- [ ] **Step 1: Read the existing checkLeadAging pattern**

Run:
```bash
grep -n "checkLeadAging\|checkStaleDeals\|checkOverdueFollowUps\|sendNotification\|userId.*manager" backend/src/services/crm-automation.service.ts | head -20
```
This shows the exact function signature and notification call pattern used. Use it as the model for `checkRepInactivity`.

- [ ] **Step 2: Add checkRepInactivity to crm-automation.service.ts**

Find the last exported function in `backend/src/services/crm-automation.service.ts`. Append after it:

```typescript
export async function checkRepInactivity(): Promise<void> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Find all active sales reps
  const reps = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: 'SALES_REP' } } },
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  if (reps.length === 0) return;

  // Count today's activities per rep
  const activityCounts = await prisma.crmActivity.groupBy({
    by: ['userId'],
    _count: { id: true },
    where: { userId: { in: reps.map(r => r.id) }, createdAt: { gte: todayStart } },
  });
  const actMap = new Map(activityCounts.map(a => [a.userId, a._count.id]));

  // Find managers to notify
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { name: 'SALES_MANAGER' } } },
    },
    select: { id: true },
  });

  const inactiveReps = reps.filter(r => (actMap.get(r.id) || 0) === 0);
  if (inactiveReps.length === 0) return;

  const repNames = inactiveReps.map(r => `${r.firstName} ${r.lastName}`).join(', ');
  const message = `Rep inactivity alert: ${repNames} ${inactiveReps.length === 1 ? 'has' : 'have'} logged 0 CRM activities today.`;

  // Notify each manager
  await Promise.all(
    managers.map(manager =>
      prisma.notification.create({
        data: {
          userId: manager.id,
          title: 'Rep Inactivity Alert',
          message,
          type: 'WARNING',
          link: '/crm/team',
        },
      }).catch(() => {})  // non-fatal
    )
  );

  logger.info(`[CRM] Rep inactivity check: ${inactiveReps.length} inactive rep(s) notified to ${managers.length} manager(s)`);
}
```

Note: `logger` and `prisma` are already imported at the top of `crm-automation.service.ts`. Check the import section and add any missing imports.

- [ ] **Step 3: Add the cron job to crm-checker.ts**

In `backend/src/jobs/crm-checker.ts`, find the existing cron job registrations (the `cron.schedule(...)` calls). Follow the exact same pattern. Add after the last job:

```typescript
// Rep Inactivity Check — 4:00 PM Mon–Fri
tasks.push(
  cron.schedule('0 16 * * 1-5', async () => {
    logger.info('[CRM] Running rep inactivity check');
    await checkRepInactivity().catch(err =>
      logger.error('[CRM] Rep inactivity check failed', { error: err })
    );
  }, { timezone: 'Asia/Kuala_Lumpur' })
);
```

Also add `checkRepInactivity` to the import from `crm-automation.service.ts` at the top of the file.

- [ ] **Step 4: Backend build check**

```bash
cd backend && npm run build 2>&1 | tail -20
```
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/crm-automation.service.ts \
        backend/src/jobs/crm-checker.ts
git commit -m "feat(crm): rep inactivity detection cron job — notifies manager at 4PM if rep has 0 activities"
```

---

## Task 3: AI Win/Loss Debrief

**Files:**
- Modify: `backend/src/services/crm-ai.service.ts`
- Create: `backend/src/__tests__/crm-ai-debrief.test.ts`
- Modify: `backend/src/routes/crm-ai.routes.ts`
- Modify: `backend/src/controllers/crm-ai.controller.ts`
- Modify: `backend/src/services/crm.service.ts`
- Modify: `frontend/src/services/crm.service.ts`
- Modify: `frontend/pages/CrmOpportunityDetail.tsx`

When an opportunity moves to a Won or Lost stage, auto-generate an AI debrief (key factors, lessons, follow-on actions) and save it as a NOTE on the opportunity. Also add a manual trigger button on the opportunity detail.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/crm-ai-debrief.test.ts`:

```typescript
import { generateWinLossDebrief } from '../services/crm-ai.service';

jest.mock('openai', () => {
  const mockCreate = jest.fn();
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    })),
    _mockCreate: mockCreate,
  };
});

jest.mock('../config', () => ({
  config: { openaiApiKey: 'test-key', nodeEnv: 'test' },
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    crmOpportunity: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'opp1',
        name: 'Deal A',
        value: 100000,
        wonAt: new Date(),
        lostAt: null,
        lostReason: null,
        stage: { name: 'Closed Won', isWonStage: true, isLostStage: false },
        account: { name: 'Acme Corp' },
        owner: { firstName: 'Alice', lastName: 'Tan' },
        activities: [
          { activityType: 'CALL', subject: 'Discovery call', description: 'Client keen' },
        ],
        notes: [],
      }),
    },
  })),
}));

describe('generateWinLossDebrief', () => {
  it('returns outcome, keyFactors, lessonsLearned, and followOnActions', async () => {
    const { _mockCreate } = jest.requireMock('openai');
    _mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            outcome: 'WON',
            summary: 'Deal closed after 3 touchpoints',
            keyFactors: ['Strong referral', 'Competitive pricing'],
            lessonsLearned: ['Early discovery call set the tone'],
            followOnActions: ['Schedule trust documentation meeting'],
          }),
        },
      }],
    });

    const result = await generateWinLossDebrief('opp1');
    expect(result.outcome).toBe('WON');
    expect(Array.isArray(result.keyFactors)).toBe(true);
    expect(Array.isArray(result.lessonsLearned)).toBe(true);
    expect(Array.isArray(result.followOnActions)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd backend && npx jest crm-ai-debrief --no-coverage 2>&1 | tail -15
```
Expected: FAIL — `generateWinLossDebrief` not found.

- [ ] **Step 3: Add generateWinLossDebrief to crm-ai.service.ts**

Append after `generateManagerBriefing` (from Task 1):

```typescript
export async function generateWinLossDebrief(opportunityId: string): Promise<{
  outcome: 'WON' | 'LOST';
  summary: string;
  keyFactors: string[];
  lessonsLearned: string[];
  followOnActions: string[];
}> {
  const opp = await prisma.crmOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      stage: { select: { name: true, isWonStage: true, isLostStage: true } },
      account: { select: { name: true } },
      owner: { select: { firstName: true, lastName: true } },
      activities: { orderBy: { createdAt: 'asc' }, take: 20, select: { activityType: true, subject: true, description: true } },
      notes: { orderBy: { createdAt: 'asc' }, take: 10, select: { content: true } },
    },
  });

  const outcome = opp.wonAt ? 'WON' : 'LOST';
  const activitySummary = opp.activities
    .map(a => `${a.activityType}: ${a.subject}${a.description ? ` — ${a.description}` : ''}`)
    .join('\n') || 'No activities recorded';
  const notesSummary = opp.notes.map(n => n.content).join('\n') || 'No notes';

  const response = await getOpenAI().chat.completions.create({
    model: FAST,
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: 'You are a CRM analyst for a Malaysian trust and estate planning company. Generate a concise win/loss debrief in JSON. Respond with valid JSON only.',
      },
      {
        role: 'user',
        content: `Generate a win/loss debrief for this opportunity:

Opportunity: ${opp.name}
Outcome: ${outcome}
Value: MYR ${Number(opp.value || 0).toLocaleString()}
Account: ${opp.account?.name || 'N/A'}
Owner: ${opp.owner.firstName} ${opp.owner.lastName}
Lost Reason: ${opp.lostReason || 'N/A'}

Activity History:
${activitySummary}

Notes:
${notesSummary}

Return JSON with:
- outcome: "${outcome}"
- summary: string (2-3 sentence narrative of what happened)
- keyFactors: string[] (up to 4 factors that determined the outcome)
- lessonsLearned: string[] (up to 3 lessons for the team)
- followOnActions: string[] (up to 3 next steps — e.g. re-engage in 6 months, referral ask, etc.)`,
      },
    ],
  });

  return parseJson(response.choices[0].message.content!);
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd backend && npx jest crm-ai-debrief --no-coverage 2>&1 | tail -15
```
Expected: PASS.

- [ ] **Step 5: Add route and controller handler**

In `backend/src/routes/crm-ai.routes.ts`, add:

```typescript
router.get('/opportunities/:id/win-loss-debrief', requirePermission('crm:read'), crmAiController.winLossDebrief);
```

In `backend/src/controllers/crm-ai.controller.ts`, append:

```typescript
winLossDebrief = asyncHandler(async (req: AuthRequest, res: Response) => {
  const debrief = await generateWinLossDebrief(req.params.id as string);
  res.json({ status: 'success', data: debrief });
});
```

Add `generateWinLossDebrief` to the import from `crm-ai.service.ts`.

- [ ] **Step 6: Auto-trigger debrief when opportunity is closed**

In `backend/src/services/crm.service.ts`, find `moveOpportunityStage` (line ~234). After the `return updated;` but still inside the `$transaction` callback, the transaction has already committed. The debrief should run after the transaction returns. Find the closing of the `$transaction` call and add a fire-and-forget call:

```typescript
// After: return prisma.$transaction(async (tx) => { ... });
// Replace the entire function return with:

  const result = await prisma.$transaction(async (tx) => {
    // ... existing transaction body unchanged ...
  });

  // Fire-and-forget AI debrief when deal closes
  const closedStage = await prisma.crmPipelineStage.findUnique({ where: { id: stageId } });
  if (closedStage?.isWonStage || closedStage?.isLostStage) {
    setImmediate(() => {
      generateWinLossDebrief(opportunityId)
        .then(async (debrief) => {
          const content = `**AI Win/Loss Debrief**\n\n${debrief.summary}\n\n**Key Factors:**\n${debrief.keyFactors.map(f => `• ${f}`).join('\n')}\n\n**Lessons Learned:**\n${debrief.lessonsLearned.map(l => `• ${l}`).join('\n')}\n\n**Follow-On Actions:**\n${debrief.followOnActions.map(a => `• ${a}`).join('\n')}`;
          await prisma.crmNote.create({ data: { content, opportunityId, authorId: userId } });
        })
        .catch(err => logger.warn('[CRM] Win/loss debrief failed', { error: err }));
    });
  }

  return result;
```

Add `import { generateWinLossDebrief } from './crm-ai.service';` at the top of `crm.service.ts` (backend).

- [ ] **Step 7: Add getWinLossDebrief to frontend service**

In `frontend/src/services/crm.service.ts`, append after `getWinProbability`:

```typescript
async getWinLossDebrief(opportunityId: string) {
  return (await api.get(`/crm/ai/opportunities/${opportunityId}/win-loss-debrief`)).data.data as {
    outcome: 'WON' | 'LOST';
    summary: string;
    keyFactors: string[];
    lessonsLearned: string[];
    followOnActions: string[];
  };
}
```

- [ ] **Step 8: Add manual debrief trigger in CrmOpportunityDetail.tsx**

In `frontend/pages/CrmOpportunityDetail.tsx`, add state after the existing `winData` state block (line ~38):

```tsx
const [debrief, setDebrief] = useState<{
  outcome: 'WON' | 'LOST'; summary: string; keyFactors: string[];
  lessonsLearned: string[]; followOnActions: string[];
} | null>(null);
const [debriefLoading, setDebriefLoading] = useState(false);

const handleGetDebrief = async () => {
  if (!id) return;
  setDebriefLoading(true);
  try {
    const result = await crmService.getWinLossDebrief(id);
    setDebrief(result);
  } catch { /* fail silently */ }
  finally { setDebriefLoading(false); }
};
```

In the overview tab JSX (find `{activeTab === 'overview'`), add the debrief panel after the win probability section. Show it only when `isWon || isLost`:

```tsx
{(isWon || isLost) && (
  <div className="mt-4 pt-4 border-t border-border">
    <AiInsightCard
      title={`AI ${isWon ? 'Win' : 'Loss'} Debrief`}
      loading={debriefLoading}
      onRefresh={handleGetDebrief}
    >
      {!debrief ? (
        <button
          onClick={handleGetDebrief}
          className="text-sm text-violet-600 hover:underline"
        >
          Generate debrief
        </button>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-text-primary">{debrief.summary}</p>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase mb-1">Key Factors</p>
            {debrief.keyFactors.map((f, i) => <p key={i} className="text-text-primary">• {f}</p>)}
          </div>
          <div>
            <p className="text-xs font-bold text-text-secondary uppercase mb-1">Lessons Learned</p>
            {debrief.lessonsLearned.map((l, i) => <p key={i} className="text-text-primary">• {l}</p>)}
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Follow-On Actions</p>
            {debrief.followOnActions.map((a, i) => <p key={i} className="text-emerald-700 font-medium">• {a}</p>)}
          </div>
        </div>
      )}
    </AiInsightCard>
  </div>
)}
```

- [ ] **Step 9: Build check**

```bash
cd backend && npm run build 2>&1 | tail -20
cd ../frontend && npm run build 2>&1 | tail -20
```
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/crm-ai.service.ts \
        backend/src/services/crm.service.ts \
        backend/src/routes/crm-ai.routes.ts \
        backend/src/controllers/crm-ai.controller.ts \
        backend/src/__tests__/crm-ai-debrief.test.ts \
        frontend/src/services/crm.service.ts \
        frontend/pages/CrmOpportunityDetail.tsx
git commit -m "feat(crm): AI win/loss debrief — auto-generated note on close, manual trigger on opportunity detail"
```

---

## Task 4: Stage Progression History

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/services/crm.service.ts`
- Modify: `backend/src/controllers/crm.controller.ts`
- Modify: `frontend/src/services/crm.service.ts`
- Modify: `frontend/pages/CrmOpportunityDetail.tsx`

Add a `CrmOpportunityStageHistory` model. Record a row on every `moveOpportunityStage` call. Surface a "Stage History" tab on the opportunity detail page.

- [ ] **Step 1: Add the model to schema.prisma**

In `backend/prisma/schema.prisma`, add a new model after `CrmOpportunity`:

```prisma
model CrmOpportunityStageHistory {
  id              String         @id @default(cuid())
  opportunityId   String
  opportunity     CrmOpportunity @relation(fields: [opportunityId], references: [id])
  fromStageName   String?
  toStageName     String
  movedByUserId   String
  movedAt         DateTime       @default(now())

  @@index([opportunityId])
}
```

Also add the relation back-reference on `CrmOpportunity`. Find `model CrmOpportunity {` and add inside it:

```prisma
  stageHistory    CrmOpportunityStageHistory[]
```

- [ ] **Step 2: Run migration**

```bash
cd backend && npx prisma migrate dev --name add-opportunity-stage-history
```
Expected: migration created and applied.

- [ ] **Step 3: Record stage history in moveOpportunityStage**

In `backend/src/services/crm.service.ts`, find `moveOpportunityStage`. Inside the `$transaction` callback, after the existing `tx.crmActivity.create(...)` call (the NOTE activity), add:

```typescript
// Record stage history
await tx.crmOpportunityStageHistory.create({
  data: {
    opportunityId,
    fromStageName: opportunity.stage.name,
    toStageName: newStage.name,
    movedByUserId: userId,
  },
});
```

- [ ] **Step 4: Include stage history in getOpportunity**

In `backend/src/controllers/crm.controller.ts`, find `getOpportunity` (look for the handler that calls `prisma.crmOpportunity.findUnique`). In the `include` block, add:

```typescript
stageHistory: {
  orderBy: { movedAt: 'asc' },
  select: {
    id: true,
    fromStageName: true,
    toStageName: true,
    movedByUserId: true,
    movedAt: true,
  },
},
```

- [ ] **Step 5: Add CrmStageHistory interface to frontend service**

In `frontend/src/services/crm.service.ts`, add after `CrmNote`:

```typescript
export interface CrmStageHistory {
  id: string;
  fromStageName: string | null;
  toStageName: string;
  movedByUserId: string;
  movedAt: string;
}
```

Also update `CrmOpportunity` interface to include:
```typescript
stageHistory?: CrmStageHistory[];
```

- [ ] **Step 6: Add Stage History tab to CrmOpportunityDetail.tsx**

In `frontend/pages/CrmOpportunityDetail.tsx`, update the `activeTab` type and add a new tab button. Find:

```tsx
const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes'>('overview');
```
Replace with:
```tsx
const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'notes' | 'history'>('overview');
```

Find the tab buttons JSX (the row of buttons for overview/activities/notes). Add a fourth button:

```tsx
<button
  onClick={() => setActiveTab('history')}
  className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'history' ? 'bg-brand-700 text-white' : 'bg-surface border border-border text-text-secondary hover:bg-gray-100'}`}
  style={{ border: activeTab === 'history' ? 'none' : undefined, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
>
  Stage History
</button>
```

Add the tab panel. Find the `{activeTab === 'notes' && ...}` block and after its closing `)}`, add:

```tsx
{activeTab === 'history' && (
  <div className="space-y-1">
    {(!opp.stageHistory || opp.stageHistory.length === 0) ? (
      <p className="text-sm text-text-secondary py-4">No stage changes recorded yet.</p>
    ) : (
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
        {opp.stageHistory.map((h, i) => (
          <div key={h.id} className="relative flex gap-4 pb-4 pl-10">
            <div className="absolute left-2.5 w-3 h-3 rounded-full bg-brand-700 border-2 border-white shadow-sm mt-1" />
            <div className="bg-surface border border-border rounded-lg px-4 py-3 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {h.fromStageName && (
                  <>
                    <span className="text-xs font-bold text-text-secondary bg-gray-100 px-2 py-0.5 rounded">{h.fromStageName}</span>
                    <span className="material-symbols-outlined text-sm text-text-tertiary">arrow_forward</span>
                  </>
                )}
                <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">{h.toStageName}</span>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                {new Date(h.movedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

Also update the import at the top of `CrmOpportunityDetail.tsx` to include `CrmStageHistory`:
```tsx
import crmService, { CrmOpportunity, CrmActivity, CrmActivityType, CrmStageHistory } from '../src/services/crm.service';
```

- [ ] **Step 7: Build check**

```bash
cd backend && npm run build 2>&1 | tail -20
cd ../frontend && npm run build 2>&1 | tail -20
```
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma \
        backend/prisma/migrations/ \
        backend/src/services/crm.service.ts \
        backend/src/controllers/crm.controller.ts \
        frontend/src/services/crm.service.ts \
        frontend/pages/CrmOpportunityDetail.tsx
git commit -m "feat(crm): stage progression history — new model, recorded on every stage move, timeline tab on opportunity detail"
```

---

## Task 5: Self-Service Rep Stats

**Files:**
- Modify: `backend/src/controllers/crm.controller.ts`
- Modify: `backend/src/routes/crm.routes.ts`
- Modify: `frontend/src/services/crm.service.ts`
- Modify: `frontend/pages/CrmDashboard.tsx`

Add a `GET /api/v1/crm/my-stats` endpoint any CRM user can call to see their own performance. Add a "My Performance" widget to CrmDashboard that is visible to all roles (not just admin).

- [ ] **Step 1: Add getMyStats controller handler**

In `backend/src/controllers/crm.controller.ts`, find `getTeamPerformance` (line ~550). Add a new handler after it:

```typescript
getMyStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now.getTime() - now.getDay() * 86_400_000);
  weekStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    openLeads,
    openDeals,
    pipelineValue,
    wonThisMonth,
    staleLeads,
    activitiesThisWeek,
  ] = await Promise.all([
    prisma.crmLead.count({ where: { ownerId: userId, status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null } }),
    prisma.crmOpportunity.count({ where: { ownerId: userId, wonAt: null, lostAt: null, deletedAt: null } }),
    prisma.crmOpportunity.aggregate({ _sum: { value: true }, where: { ownerId: userId, wonAt: null, lostAt: null, deletedAt: null } }),
    prisma.crmOpportunity.aggregate({ _count: true, _sum: { value: true }, where: { ownerId: userId, wonAt: { gte: monthStart }, deletedAt: null } }),
    prisma.crmLead.count({ where: { ownerId: userId, status: { notIn: ['CONVERTED', 'LOST'] }, deletedAt: null, activities: { none: { createdAt: { gte: sevenDaysAgo } } } } }),
    prisma.crmActivity.count({ where: { userId, createdAt: { gte: weekStart } } }),
  ]);

  res.json({
    status: 'success',
    data: {
      openLeads,
      openDeals,
      pipelineValue: Number(pipelineValue._sum.value || 0),
      wonThisMonth: { count: wonThisMonth._count, value: Number(wonThisMonth._sum.value || 0) },
      staleLeads,
      activitiesThisWeek,
    },
  });
});
```

- [ ] **Step 2: Add the route**

In `backend/src/routes/crm.routes.ts`, find where `getTeamPerformance` is mounted. Add alongside it:

```typescript
router.get('/my-stats', requirePermission('crm:read'), crmController.getMyStats);
```

- [ ] **Step 3: Add getMyStats to frontend service**

In `frontend/src/services/crm.service.ts`, add after `getTeamPerformance`:

```typescript
async getMyStats() {
  return (await api.get('/crm/my-stats')).data.data as {
    openLeads: number;
    openDeals: number;
    pipelineValue: number;
    wonThisMonth: { count: number; value: number };
    staleLeads: number;
    activitiesThisWeek: number;
  };
}
```

- [ ] **Step 4: Add My Performance widget to CrmDashboard.tsx**

In `frontend/pages/CrmDashboard.tsx`, add state in the component:

```tsx
const [myStats, setMyStats] = useState<{
  openLeads: number; openDeals: number; pipelineValue: number;
  wonThisMonth: { count: number; value: number }; staleLeads: number; activitiesThisWeek: number;
} | null>(null);
const [myStatsLoading, setMyStatsLoading] = useState(true);

useEffect(() => {
  crmService.getMyStats()
    .then(setMyStats)
    .catch(() => {})
    .finally(() => setMyStatsLoading(false));
}, []);
```

Find a suitable location in the dashboard JSX — after the global stats section but before the activity feed. Insert:

```tsx
{/* My Performance */}
<div className="bg-surface border border-border rounded-xl shadow-sm mb-6 overflow-hidden">
  <div className="px-5 py-4 border-b border-border">
    <h2 className="font-extrabold text-text-primary">My Performance</h2>
    <p className="text-xs text-text-secondary mt-0.5">Your personal pipeline stats</p>
  </div>
  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
    {myStatsLoading ? (
      Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-surface p-4">
          <div style={{ height: 24, width: '60%', background: 'var(--color-border)', borderRadius: 4, marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 10, width: '80%', background: 'var(--color-border)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      ))
    ) : myStats ? (
      [
        { label: 'Open Leads', value: myStats.openLeads, icon: 'lightbulb', color: '#92400e' },
        { label: 'Open Deals', value: myStats.openDeals, icon: 'handshake', color: '#1d4ed8' },
        { label: 'Pipeline', value: formatCurrency(myStats.pipelineValue), icon: 'payments', color: '#065f46' },
        { label: 'Won This Month', value: `${myStats.wonThisMonth.count} deals`, icon: 'emoji_events', color: '#166534' },
        { label: 'Stale Leads', value: myStats.staleLeads, icon: 'hourglass_empty', color: myStats.staleLeads > 0 ? '#dc2626' : '#6b7280' },
        { label: 'Activities (wk)', value: myStats.activitiesThisWeek, icon: 'event', color: '#6d28d9' },
      ].map(s => (
        <div key={s.label} className="bg-surface p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="material-symbols-outlined text-base" style={{ color: s.color }}>{s.icon}</span>
            <span className="text-xs text-text-secondary font-semibold">{s.label}</span>
          </div>
          <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
        </div>
      ))
    ) : null}
  </div>
</div>
```

- [ ] **Step 5: Build check**

```bash
cd backend && npm run build 2>&1 | tail -20
cd ../frontend && npm run build 2>&1 | tail -20
```
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/crm.controller.ts \
        backend/src/routes/crm.routes.ts \
        frontend/src/services/crm.service.ts \
        frontend/pages/CrmDashboard.tsx
git commit -m "feat(crm): self-service rep stats — my-stats endpoint and My Performance widget on dashboard"
```

---

## Task 6: CSV Export for All Reports

**Files:**
- Modify: `frontend/pages/CrmReports.tsx`

Add a CSV export button to each of the 7 report panels. Pure frontend — no new API routes. When clicked, converts the currently loaded report data to CSV and triggers a browser download.

- [ ] **Step 1: Add the CSV utility function**

In `frontend/pages/CrmReports.tsx`, find the utility functions section near the top (after the `interface` definitions, around line 69). Add:

```tsx
function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const body = rows.map(r =>
    keys.map(k => {
      const v = r[k];
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    }).join(',')
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Add export button to LeadConversionPanel**

In `LeadConversionPanel` (line ~168), find the panel's header or the data display. After data is loaded, show an export button. Find the return JSX and add a button alongside the report title or summary cards:

```tsx
{report && (
  <button
    onClick={() => downloadCsv([{
      totalLeads: report.totalLeads,
      converted: report.converted,
      lost: report.lost,
      conversionRate: report.conversionRate,
      avgDaysToConvert: report.avgDaysToConvert,
    }], 'lead-conversion-report.csv')}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface border border-border text-text-secondary hover:bg-gray-100 transition-colors"
    style={{ border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
  >
    <span className="material-symbols-outlined text-sm">download</span>
    Export CSV
  </button>
)}
```

Add this button to the panel's header area (alongside the date range row or the "Run Report" button).

- [ ] **Step 3: Add export button to SalesPerformancePanel**

In `SalesPerformancePanel` (line ~225), add export button after report loads. The `report.reps` array is the data:

```tsx
{report && (
  <button
    onClick={() => downloadCsv(
      report.reps.map(r => ({
        name: r.name,
        email: r.email,
        leadsCreated: r.leadsCreated,
        dealsWon: r.dealsWon,
        dealsLost: r.dealsLost,
        totalValue: r.totalValue,
        activitiesLogged: r.activitiesLogged,
      })),
      'sales-performance-report.csv'
    )}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-surface border border-border text-text-secondary hover:bg-gray-100 transition-colors"
    style={{ border: '1px solid var(--color-border)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
  >
    <span className="material-symbols-outlined text-sm">download</span>
    Export CSV
  </button>
)}
```

- [ ] **Step 4: Add export buttons to remaining panels**

Apply the same pattern to `PipelineForecastPanel`, `ActivitySummaryPanel`, `LeadAgingPanel`, `WinLossPanel`, and `KycCompliancePanel`. For each:

1. Identify the main data array in the report (e.g. `report.stages` for pipeline, `report.reps` for activity summary, `report.leads` for lead aging, `report.summary` rows for win/loss, `report.contacts` for KYC).
2. After data loads, add the export button in the panel's header row.
3. Pass the relevant array to `downloadCsv` with a descriptive filename.

Use these filenames:
- `PipelineForecastPanel` → `'pipeline-forecast-report.csv'`
- `ActivitySummaryPanel` → `'activity-summary-report.csv'`
- `LeadAgingPanel` → `'lead-aging-report.csv'`
- `WinLossPanel` → `'win-loss-report.csv'`
- `KycCompliancePanel` → `'kyc-compliance-report.csv'`

**To identify the data shape:** Read each panel function (lines 168–567) and find the `report` state variable and the `.map(...)` call that renders table rows — those fields are what to export.

- [ ] **Step 5: TypeScript check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/CrmReports.tsx
git commit -m "feat(crm): CSV export for all 7 report panels"
```

---

## Spec Coverage Checklist

| Phase 3 Item | Status |
|---|---|
| Manager AI Pipeline Briefing widget | ✅ Task 1 |
| Rep inactivity detection (notify manager at 4PM) | ✅ Task 2 |
| AI win/loss debrief on opportunity close | ✅ Task 3 |
| Stage progression history | ✅ Task 4 |
| Self-service rep stats (no crm:admin required) | ✅ Task 5 |
| CSV export for all reports | ✅ Task 6 |

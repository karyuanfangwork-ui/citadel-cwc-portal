# CRM Phase 2 — Daily Workflow Transformation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce daily rep friction with a Quick Log FAB, AI-suggested follow-up dates, overdue badges on contacts, a structured lost reason modal, and duplicate detection warnings on lead/contact create.

**Architecture:** Five frontend-only or frontend-light changes plus one backend AI service extension and one Prisma schema migration. Tasks are independent and can be executed in any order. No new API routes are added — all changes go through existing `/api/v1/crm/*` endpoints. AI calls remain fire-and-forget; duplicate detection is client-side (fuzzy match via existing listLeads/listContacts search).

**Tech Stack:** React 19 + TypeScript + Vite (frontend), Express + TypeScript + Prisma + PostgreSQL (backend), OpenAI gpt-4o-mini via `crm-ai.service.ts`, Jest (backend tests)

---

## Scope Note

Phase 2 item "AI Lead Priority Inbox" is **already complete** from Phase 1 — `CrmLeads.tsx` has the `prioritySort` toggle that sorts by `aiScore`. This plan covers the remaining 5 items.

---

## File Map

| File | Change |
|------|--------|
| `frontend/pages/CrmLeadDetail.tsx` | Tasks 1, 2, 4: FAB button + auto-analyze; accept follow-up button; structured lost reason modal |
| `backend/src/services/crm-ai.service.ts` | Task 2: Add `suggestedFollowUpDays` to `analyzeActivityNote` return type and prompt |
| `backend/src/__tests__/crm-ai-followup.test.ts` | Task 2: Jest test for new field |
| `backend/prisma/schema.prisma` | Task 3: Add `followUpDate` / `followUpNote` to `CrmContact` model |
| `backend/src/controllers/crm.controller.ts` | Task 3: Handle `followUpDate` in `createContact` and `updateContact` |
| `frontend/src/services/crm.service.ts` | Task 3: Add `followUpDate` / `followUpNote` to `CrmContact` interface |
| `frontend/pages/CrmContacts.tsx` | Tasks 3, 6: Urgency badge on contact rows + duplicate detection |
| `frontend/pages/CrmLeads.tsx` | Task 5: Duplicate detection warning in create modal |

---

## Task 1: Quick Log FAB on Lead Detail

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`

The existing "Log Activity" button lives in the header. When a rep is scrolled deep into activity history, they must scroll back up to reach it. Add a fixed FAB at bottom-right. After saving a CALL, MEETING, or WHATSAPP activity with a description, auto-trigger AI analysis on the new activity so the rep gets instant insight.

- [ ] **Step 1: Capture the created activity in handleAddActivity**

In `CrmLeadDetail.tsx`, find `handleAddActivity` (line ~167). The current code discards the return value of `createActivity`. Replace the function body:

```tsx
const handleAddActivity = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!id) return;
  try {
    setSaving(true);
    const activity = await crmService.createActivity({ ...activityForm, leadId: id });
    setShowAddActivity(false);
    setActivityForm({ activityType: 'CALL' });
    reload();
    if (
      ['CALL', 'MEETING', 'WHATSAPP'].includes(activityForm.activityType ?? '') &&
      activityForm.description?.trim()
    ) {
      handleAnalyzeNote(activity.id);
    }
  } catch (e) { console.error(e); }
  finally { setSaving(false); }
};
```

- [ ] **Step 2: Add the FAB button**

Find the final `</>` closing tag of the component's return JSX (line ~830). Insert this just before it:

```tsx
{/* Quick Log FAB */}
<button
  onClick={() => { setShowAddActivity(true); setActivityForm({ activityType: 'CALL' }); }}
  className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-700 text-white shadow-lg hover:bg-brand-800 active:scale-95 transition-all flex items-center justify-center"
  style={{ border: 'none', cursor: 'pointer' }}
  title="Quick Log Activity"
>
  <span className="material-symbols-outlined text-2xl">add</span>
</button>
```

- [ ] **Step 3: TypeScript build check**

Run from the repo root:
```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/CrmLeadDetail.tsx
git commit -m "feat(crm): add quick log FAB with auto-AI analysis on lead detail"
```

---

## Task 2: AI-Suggested Follow-Up Date

**Files:**
- Modify: `backend/src/services/crm-ai.service.ts`
- Create: `backend/src/__tests__/crm-ai-followup.test.ts`
- Modify: `frontend/pages/CrmLeadDetail.tsx`

Extend `analyzeActivityNote` to return `suggestedFollowUpDays: number | null`. In the activity analysis panel in CrmLeadDetail, show a one-click "Set follow-up in X days" button that writes the date to the lead via `updateLead`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/__tests__/crm-ai-followup.test.ts`:

```typescript
import { analyzeActivityNote } from '../services/crm-ai.service';

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

jest.mock('@prisma/client', () => {
  const mockActivity = {
    id: 'act1',
    activityType: 'CALL',
    subject: 'Discovery call',
    description: 'Client interested, follow up next week',
    lead: { id: 'lead1', title: 'Test Lead', status: 'CONTACTED' },
    opportunity: null,
  };
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      crmActivity: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockActivity),
      },
    })),
  };
});

describe('analyzeActivityNote — suggestedFollowUpDays', () => {
  it('returns suggestedFollowUpDays when AI includes it', async () => {
    const { _mockCreate } = jest.requireMock('openai');
    _mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            sentiment: 'positive',
            nextAction: 'Follow up in 5 days with proposal',
            suggestedStatusChange: null,
            keyFacts: ['client interested'],
            suggestedFollowUpDays: 5,
          }),
        },
      }],
    });

    const result = await analyzeActivityNote('act1');
    expect(result.suggestedFollowUpDays).toBe(5);
  });

  it('returns null suggestedFollowUpDays when not warranted', async () => {
    const { _mockCreate } = jest.requireMock('openai');
    _mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            sentiment: 'neutral',
            nextAction: 'No specific action needed',
            suggestedStatusChange: null,
            keyFacts: [],
            suggestedFollowUpDays: null,
          }),
        },
      }],
    });

    const result = await analyzeActivityNote('act1');
    expect(result.suggestedFollowUpDays).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd backend && npx jest crm-ai-followup --no-coverage 2>&1 | tail -20
```
Expected: FAIL — property `suggestedFollowUpDays` does not exist on the return type.

- [ ] **Step 3: Extend analyzeActivityNote return type**

In `backend/src/services/crm-ai.service.ts`, find the `analyzeActivityNote` function signature at line ~33. Replace the return type:

```typescript
export async function analyzeActivityNote(activityId: string): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  nextAction: string;
  suggestedStatusChange: string | null;
  keyFacts: string[];
  suggestedFollowUpDays: number | null;
}>
```

- [ ] **Step 4: Update the OpenAI prompt**

In the same function, find the `content` string inside the `user` message (the block starting with `Analyze this CRM activity note`). Replace it entirely:

```typescript
content: `Analyze this CRM activity note and return JSON with these fields:
- sentiment: "positive" | "neutral" | "negative"
- nextAction: string (recommended next step for the sales agent, 1 sentence)
- suggestedStatusChange: string | null (e.g. "QUALIFIED", "CONTACTED" — only if clearly warranted, else null)
- keyFacts: string[] (up to 3 key facts mentioned: names, amounts, dates, decisions)
- suggestedFollowUpDays: number | null (days from today to schedule a follow-up — e.g. 3, 5, 7 — only if a concrete follow-up is warranted based on the note content, else null)

Activity type: ${activity.activityType}
Subject: ${activity.subject}
Notes: ${activity.description || '(no notes)'}
Context: ${entityContext}`,
```

- [ ] **Step 5: Run the test to confirm it passes**

```bash
cd backend && npx jest crm-ai-followup --no-coverage 2>&1 | tail -20
```
Expected: PASS — 2 tests pass.

- [ ] **Step 6: Run the full test suite to check for regressions**

```bash
cd backend && npm test --no-coverage 2>&1 | tail -30
```
Expected: all previously passing tests still pass.

- [ ] **Step 7: Update the analyzedNotes state type in CrmLeadDetail**

In `frontend/pages/CrmLeadDetail.tsx`, find the `analyzedNotes` state declaration. It currently has a type like:
```tsx
useState<Record<string, { sentiment: string; nextAction: string; suggestedStatusChange: string | null; keyFacts: string[] }>>
```
Add `suggestedFollowUpDays: number | null` to the type:
```tsx
const [analyzedNotes, setAnalyzedNotes] = useState<Record<string, {
  sentiment: string;
  nextAction: string;
  suggestedStatusChange: string | null;
  keyFacts: string[];
  suggestedFollowUpDays: number | null;
}>>({});
```

- [ ] **Step 8: Add the accept follow-up button in the activity analysis panel**

In `CrmLeadDetail.tsx`, find the `<AiInsightCard title="Note Analysis"` block (around line 500). Inside the card's children, find the closing `</AiInsightCard>` tag for this block. Just before it, insert:

```tsx
{analyzedNotes[a.id]!.suggestedFollowUpDays != null && (
  <button
    onClick={async () => {
      const days = analyzedNotes[a.id]!.suggestedFollowUpDays!;
      const date = new Date(Date.now() + days * 86_400_000)
        .toISOString().slice(0, 10);
      await crmService.updateLead(lead!.id, { followUpDate: date });
      reload();
    }}
    className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
    style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
  >
    <span className="material-symbols-outlined text-sm">event_available</span>
    Set follow-up in {analyzedNotes[a.id]!.suggestedFollowUpDays} day{analyzedNotes[a.id]!.suggestedFollowUpDays === 1 ? '' : 's'}
  </button>
)}
```

- [ ] **Step 9: TypeScript build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/crm-ai.service.ts \
        backend/src/__tests__/crm-ai-followup.test.ts \
        frontend/pages/CrmLeadDetail.tsx
git commit -m "feat(crm): AI-suggested follow-up date — extend analyzeActivityNote and add one-click accept button"
```

---

## Task 3: Overdue Follow-Up Badge on Contacts

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/controllers/crm.controller.ts`
- Modify: `frontend/src/services/crm.service.ts`
- Modify: `frontend/pages/CrmContacts.tsx`

Add `followUpDate` and `followUpNote` to the `CrmContact` model and surface an overdue/due-today badge on the contacts list — matching the existing behaviour in `CrmLeads.tsx`.

- [ ] **Step 1: Check if the fields already exist**

```bash
grep -n "followUpDate\|followUpNote" backend/prisma/schema.prisma
```
If the output shows lines inside the `CrmContact` model, skip Steps 2 and 3. If no output or output only from other models, continue.

- [ ] **Step 2: Add fields to the CrmContact model**

In `backend/prisma/schema.prisma`, find `model CrmContact {`. Add these two lines after `isPrimary` (or before `isActive`):

```prisma
  followUpDate      DateTime?
  followUpNote      String?
```

- [ ] **Step 3: Run the migration**

```bash
cd backend && npx prisma migrate dev --name add-contact-followup-fields
```
Expected: migration file created under `prisma/migrations/` and applied to the local DB. If the local DB is not running, use `npx prisma db push` instead (no migration file).

- [ ] **Step 4: Update createContact to handle followUpDate**

In `backend/src/controllers/crm.controller.ts`, find `createContact` (line ~170). Replace the entire method:

```typescript
createContact = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.body.accountId) {
    const account = await prisma.crmAccount.findUnique({ where: { id: req.body.accountId } });
    if (!account) throw new AppError('Account not found', 404);
  }
  const { dateOfBirth, pdpaConsentDate, followUpDate, ...rest } = req.body;
  const contact = await prisma.crmContact.create({
    data: {
      ...rest,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      pdpaConsentDate: pdpaConsentDate ? new Date(pdpaConsentDate) : undefined,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
    },
    include: { account: { select: { id: true, name: true } } },
  });
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id, userEmail: req.user!.email,
      action: 'CREATE', resourceType: 'CrmContact', resourceId: contact.id,
      newValues: req.body,
    },
  });
  res.status(201).json({ status: 'success', data: { contact } });
});
```

- [ ] **Step 5: Update updateContact to handle followUpDate**

Find `updateContact` (line ~186). Replace it:

```typescript
updateContact = asyncHandler(async (req: AuthRequest, res: Response) => {
  const existing = await prisma.crmContact.findUnique({ where: { id: req.params.id as string } });
  if (!existing) throw new AppError('Contact not found', 404);
  const { dateOfBirth, pdpaConsentDate, followUpDate, ...rest } = req.body;
  const data: any = { ...rest };
  if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  if (pdpaConsentDate !== undefined) data.pdpaConsentDate = pdpaConsentDate ? new Date(pdpaConsentDate) : null;
  if (followUpDate !== undefined) data.followUpDate = followUpDate ? new Date(followUpDate) : null;
  const contact = await prisma.crmContact.update({
    where: { id: req.params.id as string },
    data,
    include: { account: { select: { id: true, name: true } } },
  });
  await prisma.auditLog.create({
    data: {
      userId: req.user!.id, userEmail: req.user!.email,
      action: 'UPDATE', resourceType: 'CrmContact', resourceId: contact.id,
      oldValues: existing as any, newValues: req.body,
    },
  });
  res.json({ status: 'success', data: { contact } });
});
```

- [ ] **Step 6: Add fields to CrmContact interface in the frontend service**

In `frontend/src/services/crm.service.ts`, find `export interface CrmContact` (line ~28). Add two fields (preserve all existing fields — only append these):

```typescript
  followUpDate: string | null;
  followUpNote: string | null;
```

- [ ] **Step 7: Add urgency badge helpers to CrmContacts.tsx**

In `frontend/pages/CrmContacts.tsx`, after the import statements (before `const CrmContacts`), add:

```tsx
const isTodayDate = (d: string) => new Date(d).toDateString() === new Date().toDateString();
const isOverdueDate = (d: string) => new Date(d) < new Date(new Date().toDateString());

type ContactUrgencyBadge = { label: string; bg: string; text: string; icon: string } | null;

const getContactUrgencyBadge = (c: CrmContact): ContactUrgencyBadge => {
  if (!c.followUpDate) return null;
  if (isOverdueDate(c.followUpDate) && !isTodayDate(c.followUpDate))
    return { label: 'Overdue', bg: '#fef2f2', text: '#dc2626', icon: 'error' };
  if (isTodayDate(c.followUpDate))
    return { label: 'Due Today', bg: '#fffbeb', text: '#b45309', icon: 'schedule' };
  return null;
};
```

- [ ] **Step 8: Render the badge in the contacts table row**

In `CrmContacts.tsx`, find the Name column `<td>` (around line 112):

```tsx
<td style={{ padding: 'var(--space-4) var(--space-5)' }}>
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-indigo-600">{c.firstName?.[0]}{c.lastName?.[0]}</span>
    </div>
    <span className="text-sm font-bold text-text-primary">{c.firstName} {c.lastName}</span>
  </div>
</td>
```

Replace with:

```tsx
<td style={{ padding: 'var(--space-4) var(--space-5)' }}>
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
      <span className="text-sm font-bold text-indigo-600">{c.firstName?.[0]}{c.lastName?.[0]}</span>
    </div>
    <div>
      <span className="text-sm font-bold text-text-primary">{c.firstName} {c.lastName}</span>
      {(() => {
        const badge = getContactUrgencyBadge(c);
        return badge ? (
          <span
            className="ml-2 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: badge.bg, color: badge.text }}
          >
            <span className="material-symbols-outlined text-xs">{badge.icon}</span>
            {badge.label}
          </span>
        ) : null;
      })()}
    </div>
  </div>
</td>
```

- [ ] **Step 9: Backend and frontend build check**

```bash
cd backend && npm run build 2>&1 | tail -20
cd ../frontend && npm run build 2>&1 | tail -20
```
Expected: both exit cleanly with no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add backend/prisma/schema.prisma \
        backend/prisma/migrations/ \
        backend/src/controllers/crm.controller.ts \
        frontend/src/services/crm.service.ts \
        frontend/pages/CrmContacts.tsx
git commit -m "feat(crm): add followUpDate to contacts schema and overdue badge on contacts list"
```

---

## Task 4: Structured Lost Reason Modal

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`

Replace the browser `prompt()` in `handleMarkLost` with a modal that has a dropdown of 8 predefined loss categories plus an optional free-text note field.

- [ ] **Step 1: Add lost reason state variables**

In `CrmLeadDetail.tsx`, find the block of `useState` declarations near the top of the component. Add:

```tsx
const [showLostModal, setShowLostModal] = useState(false);
const [lostCategory, setLostCategory] = useState('');
const [lostNote, setLostNote] = useState('');
```

- [ ] **Step 2: Replace handleMarkLost with a two-part handler**

Find `handleMarkLost` (line ~193). Replace it:

```tsx
const handleMarkLost = () => {
  setLostCategory('');
  setLostNote('');
  setShowLostModal(true);
};

const handleConfirmLost = async () => {
  if (!id || !lostCategory) return;
  const lostReason = lostNote.trim()
    ? `${lostCategory}: ${lostNote.trim()}`
    : lostCategory;
  try {
    await crmService.updateLead(id, { status: 'LOST' as any, lostReason });
    setShowLostModal(false);
    reload();
  } catch (e) { console.error(e); }
};
```

- [ ] **Step 3: Add the Lost Reason modal JSX**

In `CrmLeadDetail.tsx`, find the `{/* Add Note modal */}` comment (around line 637). Insert the lost reason modal just before it:

```tsx
{/* Lost Reason modal */}
{showLostModal && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center"
    onClick={() => setShowLostModal(false)}
  >
    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
    <div
      className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-text-primary">Mark as Lost</h2>
        <button
          onClick={() => setShowLostModal(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined text-text-secondary">close</span>
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1">
            Reason *
          </label>
          <select
            value={lostCategory}
            onChange={e => setLostCategory(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200"
            style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}
          >
            <option value="">Select a reason…</option>
            {[
              'Price too high',
              'Chose competitor',
              'Not ready / timing',
              'No budget',
              'Lost contact',
              'Product not suitable',
              'Internal decision not reached',
              'Other',
            ].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1">
            Additional notes (optional)
          </label>
          <textarea
            rows={3}
            value={lostNote}
            onChange={e => setLostNote(e.target.value)}
            placeholder="Any additional context…"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-brand-200"
            style={{ fontFamily: 'var(--font-sans)' }}
          />
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-5">
        <button
          type="button"
          onClick={() => setShowLostModal(false)}
          className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-gray-100 transition-colors"
          style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirmLost}
          disabled={!lostCategory}
          className="px-4 py-2 text-sm font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
        >
          Mark as Lost
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: TypeScript build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/CrmLeadDetail.tsx
git commit -m "feat(crm): replace prompt() with structured lost reason modal on lead detail"
```

---

## Task 5: Duplicate Detection on Lead Create

**Files:**
- Modify: `frontend/pages/CrmLeads.tsx`

When the rep types an email or phone number in the "New Lead" modal and tabs away, search for existing leads with the same value and show a dismissible amber warning banner inside the modal. Creation is not blocked — it's a soft warning.

- [ ] **Step 1: Add duplicate warning state**

In `CrmLeads.tsx`, find the state block (around line 71). Add:

```tsx
const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
```

- [ ] **Step 2: Add the duplicate check function**

After the state declarations and before the JSX `return`, add:

```tsx
const checkDuplicateLead = async (field: 'contactEmail' | 'contactPhone', value: string) => {
  if (!value.trim()) { setDuplicateWarning(null); return; }
  try {
    const data = await crmService.listLeads({ search: value.trim(), limit: 5 });
    const matches = data.leads.filter(l =>
      field === 'contactEmail'
        ? l.contactEmail?.toLowerCase() === value.trim().toLowerCase()
        : l.contactPhone?.replace(/\s/g, '') === value.trim().replace(/\s/g, '')
    );
    if (matches.length > 0) {
      const label = field === 'contactEmail' ? 'email' : 'phone';
      setDuplicateWarning(
        `Possible duplicate: "${matches[0].title}" (${matches[0].status}) already has this ${label}.`
      );
    } else {
      setDuplicateWarning(null);
    }
  } catch { setDuplicateWarning(null); }
};
```

- [ ] **Step 3: Replace the dynamic input map with explicit inputs**

In `CrmLeads.tsx`, find the create modal form (around line 319). There is a `.map()` that renders 5 fields:
```tsx
[
  { key: 'title', label: 'Lead Title *', required: true },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'contactEmail', label: 'Contact Email', type: 'email' },
  { key: 'contactPhone', label: 'Contact Phone' },
  { key: 'companyName', label: 'Company Name' },
].map(f => ( ... ))
```

Replace the entire `.map()` block with explicit JSX so that `onBlur` can be attached to the email and phone inputs:

```tsx
<div>
  <label className="block text-sm font-semibold text-text-primary mb-1">Lead Title *</label>
  <input
    required type="text"
    value={(form as any).title || ''}
    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
  />
</div>
<div>
  <label className="block text-sm font-semibold text-text-primary mb-1">Contact Name</label>
  <input
    type="text"
    value={(form as any).contactName || ''}
    onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
  />
</div>
<div>
  <label className="block text-sm font-semibold text-text-primary mb-1">Contact Email</label>
  <input
    type="email"
    value={(form as any).contactEmail || ''}
    onChange={e => setForm(prev => ({ ...prev, contactEmail: e.target.value }))}
    onBlur={e => checkDuplicateLead('contactEmail', e.target.value)}
    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
  />
</div>
<div>
  <label className="block text-sm font-semibold text-text-primary mb-1">Contact Phone</label>
  <input
    type="text"
    value={(form as any).contactPhone || ''}
    onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
    onBlur={e => checkDuplicateLead('contactPhone', e.target.value)}
    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
  />
</div>
<div>
  <label className="block text-sm font-semibold text-text-primary mb-1">Company Name</label>
  <input
    type="text"
    value={(form as any).companyName || ''}
    onChange={e => setForm(prev => ({ ...prev, companyName: e.target.value }))}
    className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200 transition-all"
  />
</div>
```

- [ ] **Step 4: Add the duplicate warning banner**

In the create modal form, find the submit/cancel buttons row (`<div className="flex justify-end gap-3 pt-2">`). Insert the warning banner just above it:

```tsx
{duplicateWarning && (
  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
    <div className="flex-1">{duplicateWarning}</div>
    <button
      type="button"
      onClick={() => setDuplicateWarning(null)}
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      className="text-amber-600 hover:text-amber-800 shrink-0"
    >
      <span className="material-symbols-outlined text-base">close</span>
    </button>
  </div>
)}
```

- [ ] **Step 5: Clear the warning when the modal closes**

Find `handleCreate` (line ~117). After `setShowCreate(false)`, add `setDuplicateWarning(null)`.

Find the `onClick={() => setShowCreate(false)}` on the modal backdrop (line ~311). Replace with:
```tsx
onClick={() => { setShowCreate(false); setDuplicateWarning(null); }}
```

Find the `onClick={() => setShowCreate(false)}` on the close icon button (line ~316). Replace with:
```tsx
onClick={() => { setShowCreate(false); setDuplicateWarning(null); }}
```

- [ ] **Step 6: TypeScript build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/CrmLeads.tsx
git commit -m "feat(crm): duplicate detection warning on lead create modal"
```

---

## Task 6: Duplicate Detection on Contact Create

**Files:**
- Modify: `frontend/pages/CrmContacts.tsx`

Same pattern as Task 5 — warn on email or phone blur if an existing contact matches.

- [ ] **Step 1: Add duplicate warning state**

In `CrmContacts.tsx`, find the state block (around line 8). Add:

```tsx
const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
```

- [ ] **Step 2: Add the duplicate check function**

After the state declarations and before the JSX `return`, add:

```tsx
const checkDuplicateContact = async (field: 'email' | 'phone', value: string) => {
  if (!value.trim()) { setDuplicateWarning(null); return; }
  try {
    const data = await crmService.listContacts({ search: value.trim(), limit: 5 });
    const matches = data.contacts.filter(c =>
      field === 'email'
        ? c.email?.toLowerCase() === value.trim().toLowerCase()
        : c.phone?.replace(/\s/g, '') === value.trim().replace(/\s/g, '')
    );
    if (matches.length > 0) {
      setDuplicateWarning(
        `Possible duplicate: "${matches[0].firstName} ${matches[0].lastName}" already has this ${field}.`
      );
    } else {
      setDuplicateWarning(null);
    }
  } catch { setDuplicateWarning(null); }
};
```

- [ ] **Step 3: Wire onBlur to the email and phone inputs**

In `CrmContacts.tsx`, find the email input in the create form (line ~176):
```tsx
<input type="email" value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
```
Add `onBlur={e => checkDuplicateContact('email', e.target.value)}` to this element.

Find the phone input (line ~182):
```tsx
<input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
```
Add `onBlur={e => checkDuplicateContact('phone', e.target.value)}` to this element.

- [ ] **Step 4: Add the duplicate warning banner**

In the create form, find `<div className="flex justify-end gap-3 pt-2">` (the submit/cancel row, around line 217). Insert just above it:

```tsx
{duplicateWarning && (
  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
    <div className="flex-1">{duplicateWarning}</div>
    <button
      type="button"
      onClick={() => setDuplicateWarning(null)}
      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      className="text-amber-600 hover:text-amber-800 shrink-0"
    >
      <span className="material-symbols-outlined text-base">close</span>
    </button>
  </div>
)}
```

- [ ] **Step 5: Clear the warning on all modal close paths**

In `CrmContacts.tsx`, find every place `setShowCreate(false)` is called (there are ~4: backdrop click, close button, cancel button, and after successful creation). Add `setDuplicateWarning(null)` alongside each one.

Specifically:
- Line ~149 `onClick={() => { setShowCreate(false); setForm({}); }}` → add `setDuplicateWarning(null);`
- Line ~155 close button `onClick` → add `setDuplicateWarning(null);`
- Line ~43 inside `handleCreate` after `setShowCreate(false)` → add `setDuplicateWarning(null);`
- Line ~219 Cancel button `onClick` → add `setDuplicateWarning(null);`

- [ ] **Step 6: TypeScript build check**

```bash
cd frontend && npm run build 2>&1 | tail -20
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/CrmContacts.tsx
git commit -m "feat(crm): duplicate detection warning on contact create modal"
```

---

## Spec Coverage Checklist

| Phase 2 Item | Status |
|---|---|
| Quick Log FAB — 1-tap activity logging with auto AI analysis | ✅ Task 1 |
| AI Lead Priority Inbox | ✅ Already done in Phase 1 (aiScore sort toggle) |
| AI-suggested follow-up date — one-click accept | ✅ Task 2 |
| Overdue follow-up badge on all list views | ✅ Leads: Phase 1; Contacts: Task 3 |
| Structured lost reason dropdown + note | ✅ Task 4 |
| Duplicate detection on lead/contact create | ✅ Tasks 5 & 6 |

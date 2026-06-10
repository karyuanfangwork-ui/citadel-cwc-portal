# Credit Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all Critical and High findings from `docs/2026-06-10-credit-module-enterprise-audit.md` so the credit module is safe for production lending decisions.

**Architecture:** Surgical fixes to existing services/components — no restructuring. Backend fixes are TDD'd against the (to-be-repaired) Jest harness; frontend fixes verified by tsc + manual smoke per task. Every task is independently shippable and committed separately.

**Tech Stack:** Node/Express/TypeScript/Prisma/PostgreSQL backend (`backend/`), React 19 + Vite frontend (`frontend/`), Jest for backend tests.

**Source of truth for findings:** `docs/2026-06-10-credit-module-enterprise-audit.md`. Every task references its finding number (F#) from the Top-25 list.

**Executor protocol:** Each task's Step 1 is "read the cited file range." Audit line numbers were verified on 2026-06-10 @ f12e389 — confirm symbols before editing; if a file has drifted, match by symbol name, not line number.

---

## SPRINT 1 — CRITICALS (production disqualifiers)

### Task 0: Repair the backend test harness (prerequisite)

**Files:**
- Inspect/Modify: `backend/package.json`, `backend/jest.config.*`
- Test: `backend/src/credit/services/__tests__/harness.smoke.test.ts` (create)

- [ ] **Step 1:** Run `cd backend && npm test` — capture the failure (prior audit noted "backend test runner misconfigured").
- [ ] **Step 2:** Create the smoke test:

```ts
// backend/src/credit/services/__tests__/harness.smoke.test.ts
describe('test harness', () => {
  it('runs TypeScript tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3:** Fix whatever blocks `npm test` (typically: missing `ts-jest`/`transform` config, or `testMatch` not covering `src/**/__tests__`). Adjust `jest.config` only — do not change tsconfig used by the build.
- [ ] **Step 4:** Run `npm test -- harness.smoke` → expect PASS.
- [ ] **Step 5:** Commit: `git commit -m "test: repair backend jest harness, add smoke test"`

For service tests below, mock Prisma with a plain object (`jest.mock('../../utils/prisma', ...)` or constructor injection if the service already takes a client). Follow whichever mocking pattern Task 0's investigation finds in the 2 existing test files.

---

### Task 1: Register the dead background jobs (F21)

**Files:**
- Modify: `backend/src/credit/services/scheduler.service.ts` (registrations at :33-34)
- Read: `backend/src/credit/jobs/creditSlaChecker.ts:32`, `backend/src/credit/jobs/amlRescreenChecker.ts:33`, `backend/src/credit/jobs/auditRetention.job.ts`

- [ ] **Step 1:** Read scheduler.service.ts to learn the exact registration idiom used for `credit.monitor` and `credit.loo_expiry` (BullMQ repeatable job).
- [ ] **Step 2:** Read the three job files' exported entry points (`startCreditSlaChecker`, `startAmlRescreenChecker`, audit retention's export) and confirm their signatures.
- [ ] **Step 3:** Register all three in scheduler.service.ts using the same idiom, e.g. (adapt to the actual helper):

```ts
registerJob('credit.sla_checker', '*/15 * * * *', runCreditSlaChecker);   // every 15 min
registerJob('credit.aml_rescreen', '0 2 * * *', runAmlRescreenChecker);   // daily 02:00
registerJob('credit.audit_retention', '0 3 * * *', runAuditRetention);    // daily 03:00
```

If the job files export `startX()` wrappers that self-schedule (setInterval style), instead invoke them from the same bootstrap that calls the scheduler — match the existing pattern, don't double-schedule.

- [ ] **Step 4:** Start dev server (`npm run dev`), grep startup logs for all three job names registering. Trigger SLA checker manually once (call its run function from a scratch script or temporarily short interval) and verify `CreditSlaBreach` rows appear for a seeded overdue application.
- [ ] **Step 5:** Commit: `git commit -m "fix(credit): register SLA checker, AML rescreen, audit retention jobs — were never scheduled"`

---

### Task 2: Authenticate committee votes (F1 — vote forgery)

**Files:**
- Modify: `backend/src/credit/controllers/committee.controller.ts:193-197`, `backend/src/credit/services/committee.service.ts:319-342`
- Test: `backend/src/credit/services/__tests__/committee.vote.test.ts` (create)

- [ ] **Step 1:** Read `castVote` controller + service. Current behavior: trusts `req.body.memberId`; no agenda↔meeting check; ABSENT members can vote.
- [ ] **Step 2:** Write failing tests:

```ts
// committee.vote.test.ts — adapt mock style from Task 0
describe('castVote security', () => {
  it('rejects when memberId does not belong to the authenticated user', async () => {
    // member row userId = 'other-user'; caller req.user.id = 'attacker'
    await expect(castVote({ agendaItemId, memberId, userId: 'attacker', vote: 'APPROVE' }))
      .rejects.toThrow(/not your committee membership/i);
  });
  it('rejects when agenda item belongs to a different meeting than the member', async () => {
    await expect(castVote({ agendaItemId: 'item-meeting-B', memberId: 'member-meeting-A', userId, vote: 'APPROVE' }))
      .rejects.toThrow(/agenda item is not part of/i);
  });
  it('rejects votes from members marked ABSENT', async () => {
    await expect(castVote({ agendaItemId, memberId: 'absent-member', userId, vote: 'APPROVE' }))
      .rejects.toThrow(/absent/i);
  });
});
```

- [ ] **Step 3:** Run → expect FAIL (current code accepts all three).
- [ ] **Step 4:** Implement in `committee.service.ts` castVote (before the vote upsert):

```ts
const member = await prisma.committeeMember.findUnique({
  where: { id: memberId }, include: { meeting: true },
});
if (!member || member.userId !== userId) {
  throw new ForbiddenError('memberId is not your committee membership');
}
const agendaItem = await prisma.committeeAgendaItem.findUnique({ where: { id: agendaItemId } });
if (!agendaItem || agendaItem.meetingId !== member.meetingId) {
  throw new BadRequestError('agenda item is not part of this member\'s meeting');
}
if (member.attendance === 'ABSENT') {
  throw new BadRequestError('absent members cannot vote');
}
```

Pass `userId: req.user.id` from the controller; stop reading `memberId` as authority (it may remain as a hint, but ownership is now enforced). Use the codebase's actual error classes (check how committee.service throws today) and actual model/field names from `schema.prisma:4424-4495`.

- [ ] **Step 5:** Run tests → PASS. Also re-run existing committee tests if any.
- [ ] **Step 6:** Smoke: vote via CommitteeMobileVote as the correct member still works.
- [ ] **Step 7:** Commit: `git commit -m "fix(credit): enforce vote ownership, meeting scope, and attendance in castVote"`

---

### Task 3: Validate disbursement amount against approved total (F22)

**Files:**
- Modify: `backend/src/credit/services/disbursement.service.ts` (`createOrder`, near the readiness checks at :45-110)
- Test: `backend/src/credit/services/__tests__/disbursement.amount.test.ts` (create)

- [ ] **Step 1:** Read `createOrder` and the facility model usage (approvedAmount vs amount fields — same convention as `policyLimit.service.ts:125-127`).
- [ ] **Step 2:** Failing test:

```ts
it('rejects totalAmount exceeding sum of approved facility amounts', async () => {
  // facilities: approvedAmount 100_000 + 50_000
  await expect(createOrder({ applicationId, totalAmount: 200_000, requestedById }))
    .rejects.toThrow(/exceeds approved/i);
});
it('accepts totalAmount equal to approved total', async () => {
  await expect(createOrder({ applicationId, totalAmount: 150_000, requestedById })).resolves.toBeDefined();
});
```

- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement in `createOrder` after the existing readiness gate:

```ts
const facilities = await prisma.creditFacility.findMany({ where: { applicationId } });
const approvedTotal = facilities.reduce(
  (sum, f) => sum + Number(f.approvedAmount ?? f.amount), 0);
if (Number(totalAmount) > approvedTotal) {
  throw new BadRequestError(
    `Disbursement amount ${totalAmount} exceeds approved facility total ${approvedTotal}`);
}
```

(Confirm the facility model name/relation in schema; reuse the exact `approvedAmount ?? amount` convention.)

- [ ] **Step 5:** Run → PASS.
- [ ] **Step 6:** Frontend guard (same rule, better UX): in `frontend/pages/credit/tabs/DisbursementTab.tsx:86` extend the `>0` check to also compare against the approved total already available on the application object; show inline error.
- [ ] **Step 7:** `cd frontend && npx tsc --noEmit` → clean (ignore pre-existing errors elsewhere).
- [ ] **Step 8:** Commit: `git commit -m "fix(credit): block disbursement orders exceeding approved facility total"`

---

### Task 4: Single source of truth for borrower exposure (F2)

**Files:**
- Create: `backend/src/credit/services/exposureCompute.service.ts`
- Modify: `backend/src/credit/services/approvalAction.service.ts:149-151`, `backend/src/credit/services/creditAutoException.service.ts:50`, `backend/src/credit/services/relatedPartyGroup.service.ts:236-240`
- Test: `backend/src/credit/services/__tests__/exposureCompute.test.ts` (create)

- [ ] **Step 1:** Read the live computation the borrower Exposure tab already uses (`backend/src/credit/routes/financial.routes.ts:66` — `GET /credit/borrowers/:id/exposure`). That logic is the correct one; this task extracts and reuses it.
- [ ] **Step 2:** Failing test:

```ts
it('computes exposure from facilities of APPROVED/OFFER/ACCEPTED/DISBURSED/ACTIVE apps', async () => {
  const result = await computeBorrowerExposure(borrowerProfileId);
  expect(result.totalExposure).toBe(150_000); // approvedAmount ?? amount across qualifying apps
});
it('keeps BorrowerProfile.totalExposure in sync after refresh', async () => {
  await refreshBorrowerExposure(borrowerProfileId);
  expect(prismaMock.borrowerProfile.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ totalExposure: 150_000 }) }));
});
```

- [ ] **Step 3:** Run → FAIL (module doesn't exist).
- [ ] **Step 4:** Implement `exposureCompute.service.ts`:

```ts
import prisma from '../../utils/prisma';

const EXPOSURE_STATES = ['APPROVED', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE'] as const;

export async function computeBorrowerExposure(borrowerProfileId: string) {
  const apps = await prisma.creditApplication.findMany({
    where: { borrowerProfileId, state: { in: [...EXPOSURE_STATES] } },
    include: { facilities: true },
  });
  const totalExposure = apps.flatMap(a => a.facilities)
    .reduce((sum, f) => sum + Number(f.approvedAmount ?? f.amount), 0);
  return { totalExposure };
}

export async function refreshBorrowerExposure(borrowerProfileId: string) {
  const { totalExposure } = await computeBorrowerExposure(borrowerProfileId);
  await prisma.borrowerProfile.update({
    where: { id: borrowerProfileId }, data: { totalExposure } });
  return totalExposure;
}
```

Match the exact include path/field names from financial.routes.ts:66 — if that route also counts guarantees or excludes facilities differently, mirror it exactly so the two views can never diverge.

- [ ] **Step 5:** Replace stale reads: in `approvalAction.service.ts:149-151` and `creditAutoException.service.ts:50`, call `computeBorrowerExposure()` instead of reading `borrowerProfile.totalExposure`. In `relatedPartyGroup.service.ts:236-240`, sum `computeBorrowerExposure()` per member (keep per-currency table as is).
- [ ] **Step 6:** Sync hook: call `refreshBorrowerExposure(app.borrowerProfileId)` at the end of `creditApplication.service.ts transition()` whenever the new state enters or leaves `EXPOSURE_STATES` (approve, accept, disburse, activate, close, withdraw from active).
- [ ] **Step 7:** Run tests → PASS. Run full backend suite.
- [ ] **Step 8:** Commit: `git commit -m "fix(credit): compute borrower exposure live; sync stored field on state transitions"`

---

### Task 5: Mask and audit the borrower's own NRIC (F3)

**Files:**
- Modify: `backend/src/credit/services/borrowerProfile.service.ts:297` (contact include), `backend/src/credit/controllers/borrowerProfile.controller.ts:52-60`
- Modify: `frontend/pages/BorrowerProfileDetail.tsx:369`
- Test: `backend/src/credit/services/__tests__/borrowerProfile.pii.test.ts` (create)

- [ ] **Step 1:** Read how directors do it correctly: masked display + reveal endpoint with `PiiReadLogService.logPiiAccess` (`director.service.ts:189`, `director.routes.ts:50-58`) and the frontend `NricReveal` component (`BorrowerProfileDetail.tsx:42-71`).
- [ ] **Step 2:** Failing test:

```ts
it('getBorrowerProfile masks contact NRIC (returns last 4 only)', async () => {
  const profile = await getBorrowerProfile(id);
  expect(profile.contact.nricPassport).toMatch(/^\*+\d{4}$/);
});
```

- [ ] **Step 3:** Run → FAIL (returns raw).
- [ ] **Step 4:** In `borrowerProfile.service.ts` getBorrowerProfile, mask before returning (reuse the mask helper directors use; if it's inline, extract `maskNric(value)` into the shared util):

```ts
if (profile.contact?.nricPassport) {
  profile.contact = { ...profile.contact, nricPassport: maskNric(profile.contact.nricPassport) };
}
```

- [ ] **Step 5:** Add reveal endpoint mirroring the director pattern: `GET /credit/borrowers/:id/contact-nric/reveal` → returns plaintext + `logPiiAccess(...)`. Register in the borrower routes file next to the existing exposure route, same permission as Task 12 will set for the other reveal routes.
- [ ] **Step 6:** Frontend: replace the plaintext render at `BorrowerProfileDetail.tsx:369` with the existing `NricReveal` component pointed at the new endpoint. Also fix NricReveal's silent error swallow (`:54`): show a toast on failure.
- [ ] **Step 7:** Backend test PASS; `npx tsc --noEmit` clean; smoke the reveal in the UI and confirm a PII read-log row is written.
- [ ] **Step 8:** Commit: `git commit -m "fix(credit): mask borrower NRIC, add audited reveal endpoint matching director pattern"`

---

### Task 6: Fix My Work KPI counts (F5)

**Files:**
- Modify: `backend/src/credit/services/dashboard.service.ts:317-439` (`getMyWorkDashboard`)
- Modify: `frontend/pages/credit/CreditDashboard.tsx:295-323` (KPI card links)
- Test: `backend/src/credit/services/__tests__/dashboard.myWork.test.ts` (create)

- [ ] **Step 1:** Read getMyWorkDashboard: lists use `take: 10` (:347, :377) and counts are `.length` (:432-433).
- [ ] **Step 2:** Failing test:

```ts
it('returns true counts even when list is capped at 10', async () => {
  // 25 assigned apps in mock
  const result = await getMyWorkDashboard(userId);
  expect(result.myAssignedCount).toBe(25);
  expect(result.myAssigned).toHaveLength(10);
});
```

- [ ] **Step 3:** Run → FAIL (returns 10).
- [ ] **Step 4:** Add parallel `prisma.creditApplication.count({ where: <same where as the list query> })` for both KPIs (extract each `where` into a local const shared by findMany and count; run via `Promise.all` with the existing queries). Set `myApprovalCount`/`myAssignedCount` from the counts.
- [ ] **Step 5:** Run → PASS.
- [ ] **Step 6:** Frontend: make the KPI cards useful — replace the self-link/no-op (`CreditDashboard.tsx:296,305` `onClick={() => {}}`) with `setActiveTab('approval')` / scroll-to "My Recent Cases". Remove nothing else.
- [ ] **Step 7:** Commit: `git commit -m "fix(credit): true count() for My Work KPIs; KPI cards navigate to their tab"`

---

### Task 7: Scope the Approval Inbox to actual authority (F6)

**Files:**
- Modify: `backend/src/credit/services/dashboard.service.ts:448-558` (`getApprovalInbox`, esp. `appsWithoutDecision` at :482-506)
- Test: `backend/src/credit/services/__tests__/dashboard.inbox.test.ts` (create)

- [ ] **Step 1:** Read `getApprovalInbox` and `approvalMatrix.service.ts:67-119` (matrix lookup) plus the level→role mapping in `approvalAction.service.ts:69-79`.
- [ ] **Step 2:** Failing tests:

```ts
it('excludes applications the user has no authority over', async () => {
  // user roles: CREDIT_ANALYST (no credit:approve) → inbox empty
  const result = await getApprovalInbox(analystUser);
  expect(result.totalPending).toBe(0);
});
it('includes only applications whose required authority level matches a role the user holds', async () => {
  const result = await getApprovalInbox(managerUser); // CREDIT_MANAGER
  expect(result.items.map(i => i.id)).toEqual(['app-within-manager-authority']);
});
```

- [ ] **Step 3:** Run → FAIL (today both see everything).
- [ ] **Step 4:** Implement: (a) early-return empty inbox if user lacks `credit:approve`; (b) for each candidate app, resolve required authority via the existing matrix lookup (exposure × rating × branch — reuse `approvalMatrix.service` lookup, do NOT reimplement) and keep it only if the user's roles map to that level via the same `AUTHORITY_HIERARCHY`/level→role mapping `approvalAction.service.ts:45-79` uses (export those constants from approvalAction or move them to a shared `authority.util.ts` and import in both — do not duplicate). Keep the existing RM/SOD exclusion.
- [ ] **Step 5:** Run → PASS. Verify the existing "approval_requested" notification fan-out (`creditNotification.service.ts:180-211`) can reuse the same filter — if trivial (<20 lines), apply it there too in this task; otherwise leave a follow-up note in the plan backlog section.
- [ ] **Step 6:** Commit: `git commit -m "fix(credit): scope approval inbox to user's actual approval authority"`

---

### Task 8: Repair in-tab financial statement entry (F4)

**Files:**
- Modify: `frontend/pages/credit/tabs/FinancialsTab.tsx:144-260` (`LineItemEditor`, `StatementModal`)

- [ ] **Step 1:** Read `StatementModal` (init `lineItems = []` at :203, loads items only when editing at :209-217) and `LineItemEditor` (:144-183, renders `items.map` with no add-row), plus the template defs `BS_LINE_ITEMS/PL_LINE_ITEMS/CF_LINE_ITEMS` (:95-134).
- [ ] **Step 2:** Seed the template on create: when opening for a NEW statement (or an existing one with zero items), initialize from the template for the selected statement type:

```tsx
const templateFor = (type: StatementType) =>
  (type === 'BALANCE_SHEET' ? BS_LINE_ITEMS : type === 'PROFIT_LOSS' ? PL_LINE_ITEMS : CF_LINE_ITEMS)
    .map((def, i) => ({ lineKey: def.key, label: def.label, amount: '', sortOrder: i }));

// in StatementModal init:
const [lineItems, setLineItems] = useState(
  existing?.lineItems?.length ? existing.lineItems : templateFor(statementType));
```

(Re-seed when the user changes statement type and no amounts have been entered yet.)

- [ ] **Step 3:** Add an "Add row" button to `LineItemEditor` appending `{ lineKey: '', label: '', amount: '', sortOrder: items.length }` with editable label, and a per-row remove. Show `label` (fallback to `lineKey`) in the row header — fixes the raw-key display issue (:169).
- [ ] **Step 4:** On save, skip rows with empty amount rather than persisting blanks (preserve current save shape at :237-242).
- [ ] **Step 5:** `npx tsc --noEmit` clean. Manual smoke: Add Statement → template rows appear → enter 3 values → save → reopen → values persist → Compute path unaffected.
- [ ] **Step 6:** Commit: `git commit -m "fix(credit): seed statement template rows and add-row control in FinancialsTab editor"`

---

## SPRINT 2 — HIGHS

### Task 9: Server-side quick filters + sort on the application listing (F8)

**Files:**
- Modify: `backend/src/credit/services/creditApplication.service.ts` (list query), its controller/route for `GET /credit/applications`
- Modify: `frontend/pages/CreditApplicationList.tsx:42-75 (quick filter defs), :160-161 (client filter/sort), :257-260 (kanban grouping)`
- Test: `backend/src/credit/services/__tests__/creditApplication.list.test.ts` (create)

- [ ] **Step 1:** Read the existing list endpoint (where-clause construction, pagination) and the 6 quick filters' client predicates (`mine`, `pendingApproval`, `overdueSla`, `inCommittee`, `offers`).
- [ ] **Step 2:** Failing tests (one per new param):

```ts
it('filters assignedToMe=true to apps where user is RM or analyst', ...);
it('filters states=[A,B] (multi-state)', ...);
it('filters overdueSla=true using CreditSlaBreach (unresolved breaches)', ...);
it('sorts by createdAt/amount across the full result set', ...);
```

- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Backend: extend the list endpoint with `assignedToMe` (`OR: [{assignedRmId: userId},{assignedAnalystId: userId}]`), `states` (array → `state: { in }`), `overdueSla` (join/EXISTS on unresolved `CreditSlaBreach` — authoritative table, NOT the createdAt heuristic), `sortBy`/`sortDir` whitelisted to `amount|createdAt|state`. Keep existing params intact.
- [ ] **Step 5:** Run → PASS.
- [ ] **Step 6:** Frontend: map each quick-filter chip to server params (delete `applyQuickFilter` client logic); pass `sortBy/sortDir` from the column headers; **derive kanban from the same fetched (already filtered) list** so chips affect both views; pagination footer now naturally shows filtered totals. Keep the client SLA *display* strip but compute it from the server's breach flag per row (add `hasOpenSlaBreach` to the list payload) instead of the createdAt math at :77-89 — delete the duplicated map in `creditSort.ts:8-17`.
- [ ] **Step 7:** `npx tsc --noEmit`; smoke: "My Applications" with >1 page of data returns items beyond page 1; kanban respects "Overdue SLA".
- [ ] **Step 8:** Commit: `git commit -m "fix(credit): server-side quick filters, multi-state, true SLA filter and sort on application list"`

---

### Task 10: Fix the /credit/applications/new dead-end (F9)

**Files:**
- Modify: `frontend/App.tsx` (add route before the `:id` route), `frontend/pages/CreditApplicationList.tsx:107` (param read), `frontend/pages/BorrowerProfileDetail.tsx:242,601` + `frontend/pages/credit/CreditDashboard.tsx:235` (callers)
- Modify: `frontend/pages/CreditApplicationDetail.tsx:347-367` (remove interstitial)

- [ ] **Step 1:** Read the interstitial (`isIdPlaceholder` at :185, :347-367) and the create modal open mechanism in CreditApplicationList.
- [ ] **Step 2:** Standardize the param: callers currently send `borrowerId`, the list reads `borrowerProfileId`. Pick `borrowerProfileId` everywhere; update the two BorrowerProfileDetail callers.
- [ ] **Step 3:** In CreditApplicationList, support `?create=1`: on mount, if present, open the create modal (pre-locking the borrower when `borrowerProfileId` is also present — that lock already exists at :733), then strip `create` from the URL.
- [ ] **Step 4:** In App.tsx add an explicit redirect route ABOVE the `:id` route:

```tsx
<Route path="/credit/applications/new"
  element={<NavigateWithSearch to="/credit/applications" extra={{ create: '1' }} />} />
```

(If no `NavigateWithSearch` helper exists, write a 10-line component that merges current search params + `extra` into the target.) Remove the interstitial branch in CreditApplicationDetail (:347-367) and the now-dead `isIdPlaceholder` handling for `'new'`.

- [ ] **Step 5:** `npx tsc --noEmit`; smoke all three entry points: dashboard CTA → modal opens; borrower profile → modal opens with borrower locked; list button → unchanged.
- [ ] **Step 6:** Commit: `git commit -m "fix(credit): /applications/new opens create modal with borrower prefill; remove dead-end interstitial"`

---

### Task 11: Scope, gate, and log document downloads (F10)

**Files:**
- Modify: `backend/src/credit/routes/creditDocument.routes.ts` (download route), `backend/src/credit/services/creditDocument.service.ts:519-537` (`getDownloadUrl`)
- Test: `backend/src/credit/services/__tests__/creditDocument.download.test.ts` (create)

- [ ] **Step 1:** Read the download route/service and the existing scoping middleware (`rmScope.middleware.ts`, `assertBorrowerAccess.middleware.ts`) to see their contracts, plus how other routes mount them.
- [ ] **Step 2:** Failing tests:

```ts
it('blocks download of AV-flagged documents (isAvClean === false)', async () => {
  await expect(getDownloadUrl(infectedDocId, user)).rejects.toThrow(/failed virus scan/i);
});
it('writes an audit event on successful download', async () => {
  await getDownloadUrl(cleanDocId, user);
  expect(auditSpy).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'DOCUMENT_DOWNLOADED' }));
});
```

- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement in `getDownloadUrl`: block `isAvClean === false` (allow `null` = unscanned for now — full auto-scan pipeline is backlog); append a `DOCUMENT_DOWNLOADED` CreditAuditEvent **via AuditChainService** (not a raw create — see Task 13) with docId, applicationId/borrowerProfileId, userId. Mount the appropriate existing scoping middleware (`assertBorrowerAccess` for borrower-linked docs) on the download route, following the mount pattern used on borrower routes.
- [ ] **Step 5:** Run → PASS; smoke a normal download from DocumentsTab still works.
- [ ] **Step 6:** Commit: `git commit -m "fix(credit): scope document downloads, block AV-flagged files, audit-log downloads"`

---

### Task 12: Tighten PII reveal permissions (F13)

**Files:**
- Modify: `backend/src/credit/routes/director.routes.ts:50-58`, `shareholder.routes.ts:54`, `ubo.routes.ts:54`, plus the borrower-contact reveal route from Task 5

- [ ] **Step 1:** Read the three reveal routes — docs say `credit:pii`/admin, code enforces `credit:read`. Current permission set (post-simplification) has 8 perms incl. `credit:compliance` (CREDIT_ADMIN only).
- [ ] **Step 2:** Decision (encode in code, note in commit): reveal requires `credit:write` minimum (analysts/RMs working the file) — NOT bare `credit:read`. Change all four routes to `requirePermission('credit:write')`. If the business later wants a dedicated `credit:pii`, that's a seed change away.
- [ ] **Step 3:** Manual check: log in as a hypothetical read-only user → reveal returns 403; as analyst → works and logs.
- [ ] **Step 4:** Commit: `git commit -m "fix(credit): PII reveal endpoints require credit:write, matching documented intent"`

---

### Task 13: Make the audit hash-chain consistent (F11)

**Files:**
- Modify: `backend/src/credit/services/auditChain.service.ts:16` (hash payload), `backend/src/credit/services/scoreOverride.service.ts:80,148`, `backend/src/credit/services/connectedParty.service.ts`, `backend/src/credit/controllers/creditApplication.controller.ts` (raw CreditAuditEvent creates), `backend/src/credit/jobs/auditRetention.job.ts:50-63` (verify formula), `backend/prisma/schema.prisma:3683` (cascade)
- Test: `backend/src/credit/services/__tests__/auditChain.test.ts` (create)

- [ ] **Step 1:** Read AuditChainService (payload = `id|applicationId|eventType|action|createdAt|previousHash`) and grep for every `creditAuditEvent.create(` outside the service: `grep -rn "creditAuditEvent.create" backend/src/credit --include="*.ts" | grep -v auditChain`.
- [ ] **Step 2:** Failing tests:

```ts
it('hash covers actorId, oldState, newState, metadata', () => {
  const h1 = computeHash({ ...base, actorId: 'a' });
  const h2 = computeHash({ ...base, actorId: 'b' });
  expect(h1).not.toBe(h2);
});
it('verifyChain detects a tampered actorId', async () => { ... expect(result.valid).toBe(false); });
```

- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement: (a) extend the hash payload to include `actorId|oldState|newState|JSON.stringify(metadata ?? null)`; (b) export a single `appendAuditEvent()` and `verifyApplicationChain()` from AuditChainService; (c) replace every raw `creditAuditEvent.create` found in Step 1 with `appendAuditEvent()`; (d) rewrite the retention job's verification to call `verifyApplicationChain()` per application (it currently uses a different formula on one global chain — meaningless); (e) schema: change `CreditAuditEvent` relation `onDelete: Cascade` → `Restrict`, run `npx prisma migrate dev --name audit_event_restrict_delete`.
- [ ] **Step 5:** **Compatibility:** old rows hashed under the old formula will fail verification. Verify with formula by row-vintage: add `hashVersion Int @default(1)` column (same migration), write new rows as version 2, verify each row with its own version's formula.
- [ ] **Step 6:** Run tests → PASS; run retention job manually once → chain report valid on seed data.
- [ ] **Step 7:** Commit: `git commit -m "fix(credit): audit hash covers actor/states/metadata, all writes via chain service, per-app verification, restrict delete"`

---

### Task 14: FX-aware exposure aggregation (F23)

**Files:**
- Create: `backend/src/credit/services/fxRate.service.ts`, migration for `CreditFxRate` model
- Modify: `backend/prisma/schema.prisma`, `backend/src/credit/services/policyLimit.service.ts:125-127,186+`, `backend/src/credit/services/exposureCompute.service.ts` (from Task 4), `backend/src/credit/services/loo.service.ts:47-48`
- Test: `backend/src/credit/services/__tests__/fxRate.test.ts` (create)

- [ ] **Step 1:** Add model + migrate:

```prisma
model CreditFxRate {
  id         String   @id @default(uuid())
  currency   String   // ISO 4217, quote vs MYR base
  rateToBase Decimal  @db.Decimal(18, 8)
  effectiveDate DateTime
  createdById String?
  createdAt  DateTime @default(now())
  @@unique([currency, effectiveDate])
  @@index([currency, effectiveDate(sort: Desc)])
}
```

`npx prisma migrate dev --name credit_fx_rates`. Seed MYR=1 plus a couple of sample rates in `prisma/seed.ts`.

- [ ] **Step 2:** Failing tests:

```ts
it('converts to base using latest effective rate ≤ asOf', async () => {
  expect(await toBase(1_000_000, 'USD')).toBe(4_700_000); // seeded 4.7
});
it('MYR passes through at 1', async () => { expect(await toBase(500, 'MYR')).toBe(500); });
it('throws on missing rate (fail-closed, no silent 1:1)', async () => {
  await expect(toBase(100, 'JPY')).rejects.toThrow(/no FX rate/i);
});
```

- [ ] **Step 3:** Run → FAIL; implement `fxRate.service.ts`:

```ts
export async function toBase(amount: number, currency: string, asOf = new Date()): Promise<number> {
  if (!currency || currency === 'MYR') return amount;
  const rate = await prisma.creditFxRate.findFirst({
    where: { currency, effectiveDate: { lte: asOf } },
    orderBy: { effectiveDate: 'desc' },
  });
  if (!rate) throw new BadRequestError(`No FX rate for ${currency}`);
  return amount * Number(rate.rateToBase);
}
```

Add admin CRUD route for rates (`POST/GET /credit/fx-rates`, `credit:admin`), following any existing simple admin route as a template.

- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Apply at aggregation points: `policyLimit.service.ts` exposure sums and `exposureCompute.service.ts` (Task 4) convert each facility via `toBase(amount, facility.currency)`. LOO: replace hardcoded "MYR" prefix (loo.service.ts:47-48) with the facility's actual currency code.
- [ ] **Step 6:** Run full backend suite → PASS (Task 4 tests updated for currency field in mocks).
- [ ] **Step 7:** Commit: `git commit -m "feat(credit): FX rate table; exposure/limit aggregation converts to base currency; LOO uses facility currency"`

---

### Task 15: Race-safe state transitions + mandatory OCC (F25)

**Files:**
- Modify: `backend/src/credit/services/creditApplication.service.ts:962` (transition update), `:622-626` (OCC opt-in)
- Test: `backend/src/credit/services/__tests__/creditApplication.transition.test.ts` (create)

- [ ] **Step 1:** Read `transition()` (findFirst → update without state guard) and the OCC block in `update()`.
- [ ] **Step 2:** Failing tests:

```ts
it('transition fails if state changed since read (guard in where clause)', async () => {
  prismaMock.creditApplication.updateMany.mockResolvedValue({ count: 0 });
  await expect(transition(id, 'approve', user)).rejects.toThrow(/state changed/i);
});
it('update without version is rejected with 428-style error', async () => {
  await expect(updateApplication(id, { amount: 5 }, /* version */ undefined, user))
    .rejects.toThrow(/version required/i);
});
```

- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement: (a) in `transition()`, switch the write to `updateMany({ where: { id, state: existing.state }, data: {...} })` and throw a 409 `versionConflictError`-style error when `count === 0` (keep version increment); side-effects (notifications, audit) run only after a successful guarded write; (b) make `expectedVersion` mandatory in `update()` — if `undefined`, throw `BadRequestError('version required')`. 
- [ ] **Step 5:** Frontend sweep: `grep -rn "creditService.updateApplication\|api.patch(.*applications" frontend/ ` — confirm every caller already sends `version` (the field is returned on GET). Add it where missing (the application object is in scope in all tab components via props/context).
- [ ] **Step 6:** Backend tests PASS; `npx tsc --noEmit` clean; smoke: edit loan request tab → save works; simulate stale version (edit in two tabs) → second save surfaces conflict toast.
- [ ] **Step 7:** Commit: `git commit -m "fix(credit): state-guarded transitions, mandatory optimistic concurrency on application update"`

---

### Task 16: Wire monitoring + condition due-date notifications (F24)

**Files:**
- Modify: `backend/src/credit/jobs/monitor.job.ts`, `backend/src/credit/services/creditNotification.service.ts`
- Test: `backend/src/credit/jobs/__tests__/monitor.notify.test.ts` (create)

- [ ] **Step 1:** Read monitor.job.ts (creates EWS rows silently) and `creditNotification.service.ts` `notifyMultiple` + the RM-resolution pattern used by LOO expiry (`loo.service.ts:237-284`).
- [ ] **Step 2:** Failing tests:

```ts
it('notifies assigned RM when an EWS is created', async () => { ...expect(notifySpy).toHaveBeenCalled()... });
it('flags and notifies overdue unfulfilled conditions', async () => { ... });
it('does not re-notify the same signal twice', async () => { ... });
```

- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement: (a) in monitor.job.ts, after each EWS creation, call `creditNotificationService.notifyMultiple` to the application's assignedRm (and CREDIT_MANAGER role holders for covenant breaches) — through the full pipeline (DB+SSE+email), not raw `prisma.notification.create`; (b) add an overdue-conditions pass to the same job: unfulfilled/unwaived conditions with `dueDate < now` → EWS row + notification; (c) dedupe via a real FK: add `covenantId String?` / `conditionId String?` columns to EarlyWarningSignal (`npx prisma migrate dev --name ews_source_fk`) and check existence on those instead of the fragile `description contains` match (monitor.job.ts:52).
- [ ] **Step 5:** Run → PASS; run job manually against seed data with one overdue condition → notification row + email log appear, second run produces nothing new.
- [ ] **Step 6:** Commit: `git commit -m "fix(credit): monitoring EWS and overdue conditions now notify RM/managers; FK-based dedupe"`

---

### Task 17: Assessment-screen completeness fixes (F14, F15)

**Files:**
- Modify: `frontend/pages/CreditApplicationDetail.tsx:402 (isSecured), :515-519 (wizard props)`, `frontend/pages/credit/CreditApplicationWizard.tsx:43-47 (default section), :61-64`
- Modify: `frontend/pages/credit/creditUtils.ts:433` (FAB/readiness tab mismatch)

- [ ] **Step 1:** Read the three sites. Determine "secured" from data already on the page: the application's facilities/product or existing collateral links (check what the page already fetches — collateral count is available to the S6 tab; if not at page level, derive `isSecured = collateralItems.length > 0 || SECURED_PRODUCTS.includes(productType)` using whichever of the two is fetched at page level).
- [ ] **Step 2:** Replace hardcoded `isSecured: false` at :402 with the derived value, so S6 flips from 'optional' to required-incomplete on secured deals (logic already exists in `creditUtils.ts:410-412`).
- [ ] **Step 3:** Wizard: pass `getCompletionStatus` and `dirty` into `CreditApplicationWizard` (:515-519) — same props the classic sidebar uses; in the wizard, change the no-`?section` default (:43-47) from `'header'` to the first section of the first visible group for the user's flag state.
- [ ] **Step 4:** Add the dirty guard to wizard navigation: reuse `useDirtyFormGuard` exactly as classic mode does (CreditApplicationDetail.tsx:105,152-155).
- [ ] **Step 5:** Fix `getNextIncompleteTab` for S7 (`creditUtils.ts:433`) to return `PHASE_TO_TAB_MAP.s7` (= 'approvals') so the FAB and the readiness modal agree.
- [ ] **Step 6:** `npx tsc --noEmit`; smoke: secured app shows S6 incomplete; wizard shows real completion icons, warns on unsaved nav, lands on Loan Request by default.
- [ ] **Step 7:** Commit: `git commit -m "fix(credit): secured-deal collateral completeness, wizard completion/dirty wiring, consistent next-incomplete target"`

---

### Task 18: Reports data-integrity fixes (F17)

**Files:**
- Modify: `backend/src/credit/routes/reports.routes.ts:71-72, 92-96`, `backend/src/credit/services/dashboard.service.ts:813, 871-874, 933, 664`
- Test: extend `backend/src/credit/services/__tests__/dashboard.turnaround.test.ts` (create)

- [ ] **Step 1:** Read the export row-builders and the turnaround computation.
- [ ] **Step 2:** Failing test:

```ts
it('turnaround includes rejected applications with decision type', async () => {
  const r = await getApprovalTurnaround({});
  expect(r.detail.some(d => d.decision === 'REJECT')).toBe(true);
});
```

- [ ] **Step 3:** Run → FAIL; implement: turnaround uses first *final* decision (APPROVE or REJECT) per app (service:871-874), adds a `decision` column to the detail rows, and renames the summary metric to "Decisions" honestly. Sort month groups chronologically; for productType/RM groupings drop the trend arrow (frontend `CreditReports.tsx:231-238`: render arrow only when `groupBy === 'month'`).
- [ ] **Step 4:** Fix exports: exposure export gets separate sections (or two sheets for XLSX) for borrowers vs sectors with correct headers (`['Name','Sector','Rating','Exposure']` / `['Sector','Borrowers','Exposure']`) — kills the count-under-Rating corruption (routes:92-96); pipeline export adds SLA breach count + breach line items to match the screen (routes:71-72).
- [ ] **Step 5:** Sort rating distribution by `RATING_ORDER` server-side (service:664) — import/replicate the order list the dashboard frontend uses so both screens agree.
- [ ] **Step 6:** Tests PASS; download both exports and eyeball columns.
- [ ] **Step 7:** Commit: `git commit -m "fix(credit): rejection-aware turnaround, correct export columns, rating-order sorting"`

---

### Task 19: Borrower profile dead controls (F19, part)

**Files:**
- Modify: `frontend/pages/BorrowerProfileDetail.tsx:441-445, 497-502, 551-556` (dead Add buttons), `frontend/pages/credit/GroupExposurePage.tsx:144-223` (AddMemberModal)
- Possibly create: `frontend/src/components/credit/PartyFormModal.tsx`

- [ ] **Step 1:** Read the existing backend CRUD (`director.routes.ts:65` PATCH/DELETE exist; POST create routes — confirm paths) and any existing director/party form (PartiesTab in the application may already have one — `frontend/pages/credit/tabs/PartiesTab.tsx`; reuse it if it has an add-director form).
- [ ] **Step 2:** Implement one shared `PartyFormModal` (name, NRIC, nationality, DOB, role-specific fields per type director/shareholder/UBO) posting to the respective endpoints; wire the three dead buttons to open it; refresh the tab list on success. If PartiesTab already has equivalent forms, extract and reuse rather than writing new ones.
- [ ] **Step 3:** Replace AddMemberModal's raw-UUID input with a borrower search: debounced query against the existing borrower list endpoint (same one BorrowerProfileList uses), select from results.
- [ ] **Step 4:** `npx tsc --noEmit`; smoke: add a director from the profile; add a group member by searching a name.
- [ ] **Step 5:** Commit: `git commit -m "fix(credit): working add director/shareholder/UBO from profile; searchable group member picker"`

---

### Task 20: IA + access-control alignment (F9-adjacent, Phase 2 items)

**Files:**
- Modify: `frontend/src/components/CreditNav.tsx:14-24`, `frontend/App.tsx:89, 300, 304`

- [ ] **Step 1:** Add nav items: `{ to: '/credit/financials', label: 'Spreading', perm: 'credit:read' }` and `{ to: '/credit/collateral', label: 'Collateral', perm: 'credit:read' }` to ALL_ITEMS (overflow "More" handles the width).
- [ ] **Step 2:** Align Committee: change CreditNav gate from `credit:approve` → `credit:read` (route already allows read; viewing meetings read-only is the intent — voting/finalize stay gated server-side).
- [ ] **Step 3:** Add `credit:read` permission guard to `/credit/m/applications/:id` (App.tsx:304), matching the desktop detail route.
- [ ] **Step 4:** Remove the dead `CreditApplicationWizard` import (App.tsx:89).
- [ ] **Step 5:** `npx tsc --noEmit`; smoke nav as analyst (sees Spreading/Collateral/Committee) and the mobile summary route still loads for credit users.
- [ ] **Step 6:** Commit: `git commit -m "fix(credit): nav entries for spreading/collateral, committee gating aligned, mobile route guarded"`

---

### Task 21: Zod validation rollout on credit mutation routes (F-forms)

**Files:**
- Create: `backend/src/credit/middleware/validate.middleware.ts` (if no shared validator exists — check `backend/src/middleware` first)
- Modify: top-10 highest-risk mutation routes (in this order): approval submit, committee finalize/vote, disbursement create/approve/execute, borrower create/update, application create/update, condition create/fulfil/waive, facility upsert, document verify/reject, exposureSummary upsert, scorecard run/override

- [ ] **Step 1:** Check for an existing validation idiom: the 3 route files that already use Zod (`grep -rl "zod" backend/src/credit/routes`) — reuse their pattern exactly.
- [ ] **Step 2:** If none is middleware-shaped, add:

```ts
// validate.middleware.ts
import { AnyZodObject } from 'zod';
export const validate = (schema: AnyZodObject) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) return res.status(400).json({ error: 'VALIDATION', details: result.error.flatten() });
    Object.assign(req, result.data);
    next();
  };
```

- [ ] **Step 3:** Work through the 10 route groups one commit each (schema per route co-located in the route file, mirroring the existing Zod-using files). Keep controller-level checks (e.g., the 10-char comment rule) — Zod duplicates them declaratively (`comment: z.string().min(10)` conditional on decision via `.superRefine`).
- [ ] **Step 4:** Per route group: one test hitting the route with invalid payload → 400 with details; valid payload → passes through. Use supertest if present in devDeps; otherwise unit-test the schema objects directly.
- [ ] **Step 5:** Commits: `git commit -m "feat(credit): zod validation on <group> routes"` × 10.

---

### Task 22: SOD hardening — admin bypass + committee finalize (F12)

**Files:**
- Modify: `backend/src/credit/middleware/sod.middleware.ts:29, 54-57`, `backend/src/credit/routes/committee.routes.ts:213-216`
- Test: `backend/src/credit/middleware/__tests__/sod.test.ts` (create)

- [ ] **Step 1:** Read the bypass (`ADMIN`/`CREDIT_ADMIN` skip all SOD) and committee finalize gating (`credit:admin` + SOD).
- [ ] **Step 2:** Failing tests:

```ts
it('CREDIT_ADMIN cannot approve an application they submitted (maker-checker holds)', ...);
it('CREDIT_ADMIN cannot approve where they are assigned RM', ...);
```

- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement: narrow the bypass — admins skip only the *authority-level* short-circuit, never Rule 1 (RM-self) or Rule 2 (maker-checker). Keep `ADMIN` (platform superuser) bypass only if the existing platform convention requires it — if kept, log an explicit `SOD_BYPASSED` audit event via AuditChainService so it's visible.
- [ ] **Step 5:** Committee finalize: change route permission from `credit:admin` → `credit:approve`, keep `enforceCommitteeSOD`, and add a server-side check that the finalizer is the meeting's chair or secretary (the client already assumes this — CommitteeMobileVote gates it client-side only). Also enforce the 10-char REJECT comment server-side in the finalize controller (same rule as approval.controller.ts:116-118).
- [ ] **Step 6:** Tests PASS; smoke committee finalize as chair.
- [ ] **Step 7:** Commit: `git commit -m "fix(credit): maker-checker applies to admins, committee finalize by chair/secretary with server-side comment rule"`

---

### Task 23: Exposure tab branch consistency + SLA single-source (F-dashboard High #3/#4)

**Files:**
- Modify: `backend/src/credit/services/dashboard.service.ts:679-683 (branch param), :239-249 (heuristic count)`, `frontend/pages/credit/CreditDashboard.tsx:168-184`, `frontend/src/components/credit/SlaBreachWidget.tsx`

- [ ] **Step 1:** Add `branchId` support to `getExposureSummary` (same where-clause threading as `getExposureDashboard`); frontend passes the active branch to both calls (:171).
- [ ] **Step 2:** SLA single-source: replace the heuristic `slaBreachCount` (:239-249) with `prisma.creditSlaBreach.count({ where: { resolvedAt: null, application: { ...branch/date filters } } })` and apply the same filters to the itemized list (:263-285). Badge and rows now come from one source. (The table is now reliably populated because Task 1 registered the checker.)
- [ ] **Step 3:** Delete the now-unused `SLA_DAYS_BY_STATE` map (service:150-167) if nothing else references it; also delete the hardcoded SLA map in `frontend/pages/MyApprovals.tsx:17-21` and surface the breach flag from the API instead.
- [ ] **Step 4:** Smoke: branch filter changes ALL exposure numbers coherently; SLA badge count equals row count.
- [ ] **Step 5:** Commit: `git commit -m "fix(credit): branch-consistent exposure summary; SLA breach counts single-sourced from breach table"`

---

## Self-check ordering note
Task 1 (jobs) before Task 23 (SLA single-source) — the breach table must be populated. Task 4 (exposureCompute) before Task 14 (FX) — FX converts inside the compute service. Task 13 (chain service) before Task 11's audit call — Task 11 uses `appendAuditEvent`. If executing out of order, Task 11 may temporarily use the existing AuditChainService append.

---

## BACKLOG — separate plans (do NOT start under this plan)

**Plan B (workflow & lifecycle mediums):** delegation wired into decision path with `onBehalfOf` on CreditDecision + time-boxed delegation; LOO expiry state transition + regenerate invalidation; OFFER-state edit → LOO invalidation trigger; disbursement tranches; pricing gate in submission readiness; quorum-at-vote + recusal register; ESCALATE routing or removal; approval-pack snapshots; closure checklist.
**Plan E (integrations — F7 and adapters):** CCRIS/CTOS bureau API integration replacing `bureau.noop.ts` (largest item — its own spec/brainstorm first; interim manual-upload flow is acceptably hard-gated today); AML screening, CBS core-banking feed (payment events), e-sign, OCR adapters; computed ECL/staging engine (F20).
**Plan C (reporting & analytics):** limit-utilization / rejection-analysis / SLA-register / portfolio-risk (ECL/stage) reports; time-series trends; report scheduling + PDF; dashboard NPL/watchlist widget, aging buckets, workload distribution; inline approve/reject from inbox.
**Plan D (platform/UX polish):** SLA time-in-state engine (state-entry timestamps); single STATE_LABELS source; design-token cleanup (GroupExposurePage, FinancialsTab inline styles); emoji→icon; toast-not-alert; borrower list pagination; FinancialAnalysis typeahead + links; document expiry/retention/watermarking; auto-AV-scan on upload; PDF watermarks + Chrome path config (CHROME_PATH env); timezone-safe date math; merged classic/wizard taxonomy; borrower-profile bureau/documents/FATCA sections; structured-data form load-before-save fix (CreditChecksTab:113); lineKey schema unification; test-coverage expansion beyond the suites created here.

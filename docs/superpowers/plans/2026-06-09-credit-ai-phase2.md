# Credit AI — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add governed, auditable AI advisory features (A4 Risk Narrative, A5 Red-Flag Detector, A6 Duplicate Borrower Detection, A13 Soft Compliance Check, A15 Auto-Exception Detection) to the credit assessment module.

**Architecture:** A shared `credit-ai.service.ts` wraps every OpenAI call and auto-logs to three new governance tables (`AiPromptVersion`, `AiInteraction`, `AiOverride`). Each AI feature lives in its own service + controller + route file, following the existing `retailIncome` pattern. Frontend panels are additive — they sit inside existing tabs and are never blocking.

**Tech Stack:** OpenAI Node SDK (already installed), Prisma (PostgreSQL), Express, React 19 + TypeScript, existing `crm-ai.service.ts` pattern as reference.

---

## 🔴 PAID API NOTICE

**All AI features in this plan require the OpenAI API (`OPENAI_API_KEY` in `.env`).** The key is already wired into `backend/src/config/index.ts` and used by CRM features. No new vendor signup is needed, but costs will increase.

**Estimated cost per use:**
| Feature | Model | Estimated cost per call |
|---|---|---|
| A5 Red-Flag Detector | GPT-4o-mini | ~$0.001 |
| A6 Duplicate Detection | Deterministic only (no LLM) | **$0** |
| A4 Risk Narrative | GPT-4o | ~$0.01–0.03 |
| A13 Soft Compliance Check | GPT-4o-mini | ~$0.001 |
| A15 Auto-Exception | GPT-4o-mini | ~$0.001 |

**These are advisory/on-demand calls** (triggered by analyst action, not automated). At 50 applications/month, total AI cost is under ~$5/month. If you add A12 (Copilot Chat) later, expect $50–200/month depending on usage.

---

## ⚠️ EFFORT WARNINGS

| Section | Warning |
|---|---|
| Phase 0 (Governance) | **Prerequisite — nothing else ships without this.** ~1 day. |
| A6 (Duplicate Detection) | Plan uses **deterministic matching only** (name/SSM/NRIC hash). Adding embedding-based fuzzy matching would double the effort and add `text-embedding-3-small` API cost. Flag if fuzzy matching is required before starting. |
| A4 (Risk Narrative) | GPT-4o prompt quality depends heavily on how much financial data exists at call time. Applications with incomplete spreads will produce weak narratives. |
| A12 (Copilot Chat) | **NOT in this plan.** That feature (RAG over policy docs + application facts) is a full separate sprint (~3–5 days). `policyExplainer.service.ts` is the starting point. |
| A9/A16 (Predictive/Portfolio) | **Not feasible yet.** Needs 12+ months of portfolio history. Do not attempt. |

---

## File Map

### New files (create)
```
backend/prisma/schema.prisma                         ← add 3 new models
backend/src/credit/services/credit-ai.service.ts    ← shared callAi() wrapper + cost logging
backend/src/credit/services/creditDuplicate.service.ts
backend/src/credit/services/creditRedFlag.service.ts
backend/src/credit/services/creditNarrative.service.ts
backend/src/credit/services/creditAiCompliance.service.ts
backend/src/credit/controllers/creditAi.controller.ts  ← single controller for all 4 AI features
backend/src/credit/routes/creditAi.routes.ts
backend/src/credit/__tests__/credit-ai.test.ts
frontend/pages/credit/components/AiRedFlagPanel.tsx
frontend/pages/credit/components/AiNarrativePanel.tsx
frontend/pages/credit/components/AiDuplicateAlert.tsx
frontend/pages/credit/components/AiCompliancePanel.tsx
frontend/src/services/creditAi.service.ts           ← frontend API client
```

### Modified files
```
backend/prisma/schema.prisma                  ← +3 AI governance models
backend/src/credit/routes/credit.routes.ts    ← mount creditAi.routes.ts
frontend/pages/credit/CreditApplicationDetail.tsx  ← add panels into existing tabs
frontend/pages/credit/BorrowerProfileDetail.tsx    ← add duplicate alert
```

---

## Phase 0: Governance Scaffold

> **This is the prerequisite for all subsequent phases.** No AI feature may ship without the audit log.

---

### Task 0.1: Add AI governance models to Prisma schema

**Files:**
- Modify: `backend/prisma/schema.prisma` (append at end, after `CrmDuplicateMatch`)

- [ ] **Step 1: Append the three governance models**

Open `backend/prisma/schema.prisma`. After the closing `}` of `CrmDuplicateMatch` (currently last model), append:

```prisma
// === AI Governance ===

model AiPromptVersion {
  id          String   @id @default(cuid())
  feature     String   @db.VarChar(50)
  version     Int
  promptHash  String   @map("prompt_hash") @db.VarChar(64)
  template    String   @db.Text
  model       String   @db.VarChar(50)
  params      Json     @default("{}")
  active      Boolean  @default(true)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  interactions AiInteraction[]

  @@unique([feature, version])
  @@index([feature, active])
  @@map("ai_prompt_versions")
}

model AiInteraction {
  id              String   @id @default(cuid())
  promptVersionId String   @map("prompt_version_id")
  entityType      String   @map("entity_type") @db.VarChar(50)
  entityId        String   @map("entity_id") @db.VarChar(100)
  userId          String   @map("user_id") @db.Uuid
  inputHash       String   @map("input_hash") @db.VarChar(64)
  inputTokens     Int      @map("input_tokens")
  outputTokens    Int      @map("output_tokens")
  latencyMs       Int      @map("latency_ms")
  costUsd         Float    @map("cost_usd")
  output          Json
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  promptVersion AiPromptVersion @relation(fields: [promptVersionId], references: [id])
  user          User            @relation("AiInteractionUser", fields: [userId], references: [id])
  overrides     AiOverride[]

  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt])
  @@map("ai_interactions")
}

model AiOverride {
  id             String   @id @default(cuid())
  interactionId  String   @map("interaction_id")
  userId         String   @map("user_id") @db.Uuid
  overrideReason String   @map("override_reason") @db.Text
  originalOutput Json     @map("original_output")
  overrideValue  Json     @map("override_value")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamp(6)

  interaction AiInteraction @relation(fields: [interactionId], references: [id])
  user        User          @relation("AiOverrideUser", fields: [userId], references: [id])

  @@index([interactionId])
  @@map("ai_overrides")
}
```

- [ ] **Step 2: Add User relations for the new models**

In `backend/prisma/schema.prisma`, find the `model User {` block. Inside its relations section (after all other relation lines, before the closing `@@map`), add:

```prisma
  aiInteractions   AiInteraction[]  @relation("AiInteractionUser")
  aiOverrides      AiOverride[]     @relation("AiOverrideUser")
```

- [ ] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_ai_governance_tables
```
Expected: Migration created and applied. Three new tables visible in studio.

- [ ] **Step 4: Verify in Prisma Studio**

```bash
cd backend && npm run prisma:studio
```
Expected: `ai_prompt_versions`, `ai_interactions`, `ai_overrides` tables exist with correct columns.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(credit-ai): add AiPromptVersion, AiInteraction, AiOverride governance tables"
```

---

### Task 0.2: Seed prompt version records

**Files:**
- Modify: `backend/prisma/seed.ts` (or `backend/prisma/seeds/credit-ai.seed.ts` if seeds are split)

- [ ] **Step 1: Check where seeds live**

```bash
ls backend/prisma/
```
If there's a `seeds/` directory, create `backend/prisma/seeds/creditAiPrompts.seed.ts`. Otherwise edit `backend/prisma/seed.ts`.

- [ ] **Step 2: Add prompt version seed data**

Add the following upsert block in the seed file:

```typescript
// AI Prompt Versions — one record per feature, version 1
const AI_PROMPT_VERSIONS = [
  {
    feature: 'A4_RISK_NARRATIVE',
    version: 1,
    promptHash: 'v1',
    template: 'You are a senior credit analyst. Draft a concise risk narrative for the credit memo based on the provided application data. Return JSON: { "narrative": "string", "keyRisks": ["string"], "keyStrengths": ["string"], "citedFields": ["string"] }',
    model: 'gpt-4o',
    params: { max_tokens: 1200, temperature: 0.3 },
  },
  {
    feature: 'A5_RED_FLAG',
    version: 1,
    promptHash: 'v1',
    template: 'You are a credit risk specialist. Analyse the financial ratios and flag anomalies. Return JSON: { "flags": [{ "severity": "HIGH|MEDIUM|LOW", "title": "string", "evidence": "string", "rationale": "string" }], "overallRisk": "HIGH|MEDIUM|LOW" }',
    model: 'gpt-4o-mini',
    params: { max_tokens: 800, temperature: 0.1 },
  },
  {
    feature: 'A13_COMPLIANCE',
    version: 1,
    promptHash: 'v1',
    template: 'You are a credit compliance officer. Review the application checklist data and identify soft compliance concerns not caught by deterministic rules. Return JSON: { "concerns": [{ "severity": "HIGH|MEDIUM|LOW", "field": "string", "issue": "string", "recommendation": "string" }] }',
    model: 'gpt-4o-mini',
    params: { max_tokens: 600, temperature: 0.1 },
  },
  {
    feature: 'A15_EXCEPTION',
    version: 1,
    promptHash: 'v1',
    template: 'You are a credit policy officer. Identify policy exceptions in this application and explain each in plain language. Return JSON: { "exceptions": [{ "policyRef": "string", "description": "string", "severity": "HIGH|MEDIUM|LOW", "recommendation": "string" }] }',
    model: 'gpt-4o-mini',
    params: { max_tokens: 600, temperature: 0.1 },
  },
] as const;

for (const pv of AI_PROMPT_VERSIONS) {
  await prisma.aiPromptVersion.upsert({
    where: { feature_version: { feature: pv.feature, version: pv.version } },
    update: {},
    create: {
      feature: pv.feature,
      version: pv.version,
      promptHash: pv.promptHash,
      template: pv.template,
      model: pv.model,
      params: pv.params,
      active: true,
    },
  });
}
console.log('✓ AI prompt versions seeded');
```

- [ ] **Step 3: Run seed**

```bash
cd backend && npm run prisma:seed
```
Expected: `✓ AI prompt versions seeded` in output. 4 rows in `ai_prompt_versions`.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/
git commit -m "feat(credit-ai): seed AI prompt version registry"
```

---

### Task 0.3: Create the shared credit-ai.service.ts wrapper

**Files:**
- Create: `backend/src/credit/services/credit-ai.service.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/credit/__tests__/credit-ai.test.ts`:

```typescript
import { callAi, getActivePromptVersion } from '../services/credit-ai.service';

jest.mock('openai');
jest.mock('../../utils/prisma', () => ({
  default: {
    aiPromptVersion: { findFirst: jest.fn() },
    aiInteraction: { create: jest.fn().mockResolvedValue({ id: 'interaction-1' }) },
  },
}));

import prisma from '../../utils/prisma';

describe('credit-ai.service', () => {
  describe('getActivePromptVersion', () => {
    it('throws if no active version found', async () => {
      (prisma.aiPromptVersion.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(getActivePromptVersion('A5_RED_FLAG')).rejects.toThrow('No active prompt version');
    });

    it('returns the active version', async () => {
      const pv = { id: 'pv-1', feature: 'A5_RED_FLAG', version: 1, model: 'gpt-4o-mini', template: 'test', params: {} };
      (prisma.aiPromptVersion.findFirst as jest.Mock).mockResolvedValue(pv);
      const result = await getActivePromptVersion('A5_RED_FLAG');
      expect(result.id).toBe('pv-1');
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && npx jest credit-ai.test --no-coverage
```
Expected: FAIL — `credit-ai.service` module not found.

- [ ] **Step 3: Create the service**

Create `backend/src/credit/services/credit-ai.service.ts`:

```typescript
import OpenAI from 'openai';
import crypto from 'crypto';
import { config } from '../../config';
import prisma from '../../utils/prisma';
import { AppError } from '../../middleware/error.middleware';

const COST_PER_TOKEN: Record<string, { input: number; output: number }> = {
  'gpt-4o':      { input: 2.5 / 1_000_000,  output: 10   / 1_000_000 },
  'gpt-4o-mini': { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
};

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!config.openai.apiKey) throw new AppError('AI service unavailable', 503);
    _openai = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return _openai;
}

export interface AiPromptVersionRecord {
  id: string;
  feature: string;
  version: number;
  model: string;
  template: string;
  params: Record<string, unknown>;
}

export async function getActivePromptVersion(feature: string): Promise<AiPromptVersionRecord> {
  const pv = await prisma.aiPromptVersion.findFirst({
    where: { feature, active: true },
    orderBy: { version: 'desc' },
  });
  if (!pv) throw new AppError(`No active prompt version for feature: ${feature}`, 500);
  return pv as AiPromptVersionRecord;
}

export interface CallAiOptions<T> {
  feature: string;
  entityType: string;
  entityId: string;
  userId: string;
  buildMessages: (template: string) => OpenAI.Chat.ChatCompletionMessageParam[];
  maxTokens?: number;
}

export interface AiResult<T> {
  output: T;
  interactionId: string;
  model: string;
  version: number;
  costUsd: number;
}

export async function callAi<T>(opts: CallAiOptions<T>): Promise<AiResult<T>> {
  const pv = await getActivePromptVersion(opts.feature);
  const messages = opts.buildMessages(pv.template);
  const inputHash = crypto.createHash('sha256').update(JSON.stringify(messages)).digest('hex');
  const start = Date.now();

  const completion = await getOpenAI().chat.completions.create({
    model: pv.model,
    max_tokens: opts.maxTokens ?? ((pv.params as Record<string, number>).max_tokens ?? 1024),
    temperature: (pv.params as Record<string, number>).temperature ?? 0.2,
    response_format: { type: 'json_object' },
    messages,
  });

  const latencyMs = Date.now() - start;
  const raw = completion.choices[0].message.content ?? '{}';
  const output = parseJson<T>(raw);

  const inputTokens = completion.usage?.prompt_tokens ?? 0;
  const outputTokens = completion.usage?.completion_tokens ?? 0;
  const rates = COST_PER_TOKEN[pv.model] ?? COST_PER_TOKEN['gpt-4o-mini'];
  const costUsd = inputTokens * rates.input + outputTokens * rates.output;

  const interaction = await prisma.aiInteraction.create({
    data: {
      promptVersionId: pv.id,
      entityType: opts.entityType,
      entityId: opts.entityId,
      userId: opts.userId,
      inputHash,
      inputTokens,
      outputTokens,
      latencyMs,
      costUsd,
      output: output as object,
    },
  });

  return { output, interactionId: interaction.id, model: pv.model, version: pv.version, costUsd };
}

export async function recordOverride(opts: {
  interactionId: string;
  userId: string;
  overrideReason: string;
  originalOutput: object;
  overrideValue: object;
}): Promise<void> {
  await prisma.aiOverride.create({
    data: {
      interactionId: opts.interactionId,
      userId: opts.userId,
      overrideReason: opts.overrideReason,
      originalOutput: opts.originalOutput,
      overrideValue: opts.overrideValue,
    },
  });
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd backend && npx jest credit-ai.test --no-coverage
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/services/credit-ai.service.ts backend/src/credit/__tests__/credit-ai.test.ts
git commit -m "feat(credit-ai): add callAi() wrapper with AiInteraction audit logging"
```

---

## Phase 1: A6 — Duplicate Borrower Detection

> **No LLM calls. Zero API cost.** Deterministic matching on name/SSM/NRIC HMAC. The advisory UI still follows the same override-capture pattern.

---

### Task 1.1: creditDuplicate.service.ts

**Files:**
- Create: `backend/src/credit/services/creditDuplicate.service.ts`
- Test: `backend/src/credit/__tests__/creditDuplicate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/credit/__tests__/creditDuplicate.test.ts
jest.mock('../../utils/prisma', () => ({
  default: {
    borrowerProfile: { findMany: jest.fn() },
    crmDuplicateMatch: { upsert: jest.fn().mockResolvedValue({}) },
  },
}));

import prisma from '../../utils/prisma';
import { findDuplicateBorrowers } from '../services/creditDuplicate.service';

describe('findDuplicateBorrowers', () => {
  it('returns empty array when no other profiles exist', async () => {
    (prisma.borrowerProfile.findMany as jest.Mock).mockResolvedValue([]);
    const result = await findDuplicateBorrowers('borrower-1');
    expect(result.matches).toHaveLength(0);
  });

  it('detects exact name match', async () => {
    (prisma.borrowerProfile.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'b-1', name: 'Citadel Sdn Bhd', account: null, directors: [] }])  // target
      .mockResolvedValueOnce([{ id: 'b-2', name: 'Citadel Sdn Bhd', account: null, directors: [] }]); // others
    const result = await findDuplicateBorrowers('b-1');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].matchFields).toContain('name');
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd backend && npx jest creditDuplicate.test --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create the service**

```typescript
// backend/src/credit/services/creditDuplicate.service.ts
import prisma from '../../utils/prisma';

export interface DuplicateMatch {
  borrowerProfileId: string;
  borrowerName: string;
  matchFields: string[];
  confidence: number;
  existingApplicationCount: number;
}

export interface DuplicateCheckResult {
  checkedProfileId: string;
  matches: DuplicateMatch[];
  checkedAt: Date;
}

export async function findDuplicateBorrowers(borrowerProfileId: string): Promise<DuplicateCheckResult> {
  const target = await prisma.borrowerProfile.findUniqueOrThrow({
    where: { id: borrowerProfileId },
    include: {
      account: { select: { name: true, registrationNumber: true } },
      directors: { select: { nricPassportHmac: true } },
    },
  });

  const others = await prisma.borrowerProfile.findMany({
    where: { id: { not: borrowerProfileId }, isActive: true, deletedAt: null },
    include: {
      account: { select: { id: true, name: true, registrationNumber: true } },
      directors: { select: { nricPassportHmac: true } },
      applications: { select: { id: true } },
    },
  });

  const targetName = (target.name ?? target.account?.name ?? '').toLowerCase().trim();
  const targetRegNo = target.account?.registrationNumber?.replace(/\W/g, '').toUpperCase() ?? null;
  const targetDirectorHmacs = new Set(target.directors.map((d) => d.nricPassportHmac).filter(Boolean));

  const matches: DuplicateMatch[] = [];

  for (const other of others) {
    const matchFields: string[] = [];
    let confidence = 0;

    const otherName = (other.name ?? other.account?.name ?? '').toLowerCase().trim();
    if (targetName && otherName && targetName === otherName) {
      matchFields.push('name');
      confidence += 0.6;
    }

    const otherRegNo = other.account?.registrationNumber?.replace(/\W/g, '').toUpperCase() ?? null;
    if (targetRegNo && otherRegNo && targetRegNo === otherRegNo) {
      matchFields.push('registrationNumber');
      confidence += 0.9;
    }

    const otherDirectorHmacs = other.directors.map((d) => d.nricPassportHmac).filter(Boolean);
    const sharedDirectors = otherDirectorHmacs.filter((h) => h && targetDirectorHmacs.has(h));
    if (sharedDirectors.length > 0) {
      matchFields.push(`sharedDirectors(${sharedDirectors.length})`);
      confidence += 0.5 * sharedDirectors.length;
    }

    if (matchFields.length === 0) continue;

    confidence = Math.min(confidence, 1.0);

    // Persist match record (mirrors CrmDuplicateMatch pattern)
    await prisma.crmDuplicateMatch.upsert({
      where: { entityAId_entityBId: { entityAId: borrowerProfileId, entityBId: other.id } },
      update: { matchFields, confidence, status: 'OPEN' },
      create: {
        entityType: 'BORROWER',
        entityAId: borrowerProfileId,
        entityBId: other.id,
        matchFields,
        confidence,
        status: 'OPEN',
      },
    });

    matches.push({
      borrowerProfileId: other.id,
      borrowerName: other.name ?? other.account?.name ?? 'Unknown',
      matchFields,
      confidence,
      existingApplicationCount: other.applications.length,
    });
  }

  return { checkedProfileId: borrowerProfileId, matches, checkedAt: new Date() };
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npx jest creditDuplicate.test --no-coverage
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/services/creditDuplicate.service.ts backend/src/credit/__tests__/creditDuplicate.test.ts
git commit -m "feat(credit-ai): A6 duplicate borrower detection service"
```

---

### Task 1.2: A6 route + controller endpoint

**Files:**
- Create: `backend/src/credit/controllers/creditAi.controller.ts`
- Create: `backend/src/credit/routes/creditAi.routes.ts`
- Modify: `backend/src/credit/routes/credit.routes.ts`

- [ ] **Step 1: Create the controller**

```typescript
// backend/src/credit/controllers/creditAi.controller.ts
import { Request, Response, NextFunction } from 'express';
import { findDuplicateBorrowers } from '../services/creditDuplicate.service';
import { generateRedFlags } from '../services/creditRedFlag.service';
import { generateRiskNarrative } from '../services/creditNarrative.service';
import { runAiComplianceCheck } from '../services/creditAiCompliance.service';
import { recordOverride } from '../services/credit-ai.service';

export const creditAiController = {
  async checkDuplicates(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await findDuplicateBorrowers(req.params.borrowerProfileId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getRedFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await generateRedFlags(req.params.appId, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getRiskNarrative(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await generateRiskNarrative(req.params.appId, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getComplianceCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await runAiComplianceCheck(req.params.appId, userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async submitOverride(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { interactionId, overrideReason, originalOutput, overrideValue } = req.body;
      await recordOverride({ interactionId, userId, overrideReason, originalOutput, overrideValue });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
```

- [ ] **Step 2: Create the routes file**

```typescript
// backend/src/credit/routes/creditAi.routes.ts
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { creditAiController } from '../controllers/creditAi.controller';

const router = Router();

// A6 — Duplicate Borrower Detection
router.post(
  '/borrower-profiles/:borrowerProfileId/duplicate-check',
  authenticate,
  requirePermission('credit:read'),
  creditAiController.checkDuplicates,
);

// A5 — Red-Flag Detector
router.post(
  '/:appId/red-flags',
  authenticate,
  requirePermission('credit:read'),
  creditAiController.getRedFlags,
);

// A4 — Risk Narrative
router.post(
  '/:appId/risk-narrative',
  authenticate,
  requirePermission('credit:write'),
  creditAiController.getRiskNarrative,
);

// A13 — AI Compliance Check
router.post(
  '/:appId/ai-compliance',
  authenticate,
  requirePermission('credit:read'),
  creditAiController.getComplianceCheck,
);

// Override capture (all features)
router.post(
  '/ai/override',
  authenticate,
  requirePermission('credit:write'),
  creditAiController.submitOverride,
);

export default router;
```

- [ ] **Step 3: Mount in credit.routes.ts**

Open `backend/src/credit/routes/credit.routes.ts`. Find where other sub-routers are mounted (e.g. where `retailIncome.routes.ts` is imported). Add:

```typescript
import creditAiRouter from './creditAi.routes';
// ...
router.use('/ai', creditAiRouter);
```

This exposes endpoints at `/api/v1/credit/ai/borrower-profiles/:id/duplicate-check` etc.

- [ ] **Step 4: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep "creditAi\|credit-ai" | head -20
```
Expected: No errors for the new files.

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/controllers/creditAi.controller.ts backend/src/credit/routes/creditAi.routes.ts backend/src/credit/routes/credit.routes.ts
git commit -m "feat(credit-ai): A6 duplicate check route + unified AI controller scaffold"
```

---

### Task 1.3: A6 Frontend — AiDuplicateAlert component

**Files:**
- Create: `frontend/pages/credit/components/AiDuplicateAlert.tsx`
- Modify: `frontend/src/services/creditAi.service.ts` (create if doesn't exist)
- Modify: `frontend/pages/credit/BorrowerProfileDetail.tsx` (or wherever BorrowerProfile is displayed)

- [ ] **Step 1: Create the frontend API service**

Create `frontend/src/services/creditAi.service.ts`:

```typescript
import axios from 'axios';

const BASE = '/api/v1/credit/ai';

export interface DuplicateMatch {
  borrowerProfileId: string;
  borrowerName: string;
  matchFields: string[];
  confidence: number;
  existingApplicationCount: number;
}

export interface DuplicateCheckResult {
  checkedProfileId: string;
  matches: DuplicateMatch[];
  checkedAt: string;
}

export interface RedFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  evidence: string;
  rationale: string;
}

export interface RedFlagResult {
  flags: RedFlag[];
  overallRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  interactionId: string;
  model: string;
}

export interface RiskNarrativeResult {
  narrative: string;
  keyRisks: string[];
  keyStrengths: string[];
  citedFields: string[];
  interactionId: string;
  model: string;
}

export interface ComplianceConcern {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  field: string;
  issue: string;
  recommendation: string;
}

export interface ComplianceCheckResult {
  concerns: ComplianceConcern[];
  interactionId: string;
}

export const creditAiService = {
  checkDuplicates: (borrowerProfileId: string) =>
    axios.post<DuplicateCheckResult>(`${BASE}/borrower-profiles/${borrowerProfileId}/duplicate-check`).then(r => r.data),

  getRedFlags: (appId: string) =>
    axios.post<RedFlagResult>(`${BASE}/${appId}/red-flags`).then(r => r.data),

  getRiskNarrative: (appId: string) =>
    axios.post<RiskNarrativeResult>(`${BASE}/${appId}/risk-narrative`).then(r => r.data),

  getComplianceCheck: (appId: string) =>
    axios.post<ComplianceCheckResult>(`${BASE}/${appId}/ai-compliance`).then(r => r.data),

  submitOverride: (data: { interactionId: string; overrideReason: string; originalOutput: object; overrideValue: object }) =>
    axios.post(`${BASE}/ai/override`, data),
};
```

- [ ] **Step 2: Create the AiDuplicateAlert component**

```tsx
// frontend/pages/credit/components/AiDuplicateAlert.tsx
import React, { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { creditAiService, DuplicateCheckResult } from '../../../src/services/creditAi.service';

interface Props {
  borrowerProfileId: string;
}

export function AiDuplicateAlert({ borrowerProfileId }: Props) {
  const [result, setResult] = useState<DuplicateCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await creditAiService.checkDuplicates(borrowerProfileId);
      setResult(data);
    } catch {
      setError('Duplicate check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
          <AlertTriangle className="h-4 w-4" />
          Duplicate Borrower Check
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking…' : result ? 'Re-check' : 'Run Check'}
        </button>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {result && result.matches.length === 0 && (
        <p className="text-green-700 text-sm">No duplicate borrowers detected.</p>
      )}

      {result && result.matches.length > 0 && (
        <div className="space-y-2">
          <p className="text-amber-800 text-xs font-medium">{result.matches.length} potential duplicate(s) found:</p>
          {result.matches.map((m) => (
            <div key={m.borrowerProfileId} className="rounded bg-white border border-amber-200 p-3 text-xs space-y-1">
              <div className="font-medium text-gray-800">{m.borrowerName}</div>
              <div className="text-gray-500">
                Match basis: <span className="text-amber-700">{m.matchFields.join(', ')}</span>
              </div>
              <div className="text-gray-500">
                Confidence: <span className="font-medium">{Math.round(m.confidence * 100)}%</span>
                {' · '}
                {m.existingApplicationCount} existing application(s)
              </div>
              <a
                href={`/credit/borrower-profiles/${m.borrowerProfileId}`}
                className="text-blue-600 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                View profile →
              </a>
            </div>
          ))}
          <p className="text-amber-700 text-xs italic mt-1">
            Advisory only. Credit officer must review before proceeding.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Mount in BorrowerProfile tab**

Find the file rendering borrower profile details (likely `frontend/pages/credit/CreditApplicationDetail.tsx` borrower tab section, or a dedicated `BorrowerProfileDetail.tsx`). Look for the section where borrower info is displayed and add:

```tsx
import { AiDuplicateAlert } from './components/AiDuplicateAlert';

// Inside the borrower profile section JSX:
<AiDuplicateAlert borrowerProfileId={borrowerProfile.id} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/creditAi.service.ts frontend/pages/credit/components/AiDuplicateAlert.tsx frontend/pages/credit/
git commit -m "feat(credit-ai): A6 duplicate borrower alert panel"
```

---

## Phase 2: A5 — Red-Flag Detector

> **Requires OpenAI API.** Uses GPT-4o-mini (~$0.001/call). Reads computed financial ratios from the database — no manual data entry.

---

### Task 2.1: creditRedFlag.service.ts

**Files:**
- Create: `backend/src/credit/services/creditRedFlag.service.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to backend/src/credit/__tests__/credit-ai.test.ts
jest.mock('../services/creditRedFlag.service');
import { generateRedFlags } from '../services/creditRedFlag.service';

describe('generateRedFlags', () => {
  it('exists and is callable', () => {
    expect(typeof generateRedFlags).toBe('function');
  });
});
```

- [ ] **Step 2: Run to confirm fail**

```bash
cd backend && npx jest credit-ai.test --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create the service**

```typescript
// backend/src/credit/services/creditRedFlag.service.ts
import prisma from '../../utils/prisma';
import { callAi, AiResult } from './credit-ai.service';
import { RATIO_THRESHOLDS, evaluateRatioThreshold } from './financial.service';

export interface RedFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  evidence: string;
  rationale: string;
}

export interface RedFlagResult {
  flags: RedFlag[];
  overallRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  interactionId: string;
  model: string;
  costUsd: number;
}

export async function generateRedFlags(applicationId: string, userId: string): Promise<RedFlagResult> {
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: { select: { name: true, creditRiskRating: true } },
      facilities: { select: { facilityType: true, requestedAmount: true } },
      financialStatements: {
        orderBy: { periodEnd: 'desc' },
        take: 3,
        include: { ratios: true },
      },
    },
  });

  // Build ratio summary for the prompt (no raw financials — just ratios)
  const ratioSummary = application.financialStatements.map((stmt) => {
    const ratioMap: Record<string, { value: number; status: string }> = {};
    for (const ratio of stmt.ratios) {
      ratioMap[ratio.ratioKey] = {
        value: Number(ratio.value),
        status: evaluateRatioThreshold(ratio.ratioKey, Number(ratio.value)),
      };
    }
    return { period: stmt.periodEnd?.toISOString().slice(0, 7), ratios: ratioMap };
  });

  const deterministicWarnings = application.financialStatements
    .flatMap((stmt) =>
      stmt.ratios
        .filter((r) => evaluateRatioThreshold(r.ratioKey, Number(r.value)) === 'fail')
        .map((r) => `${r.ratioKey}: ${Number(r.value).toFixed(2)} (FAIL threshold)`)
    );

  const result = await callAi<{ flags: RedFlag[]; overallRisk: 'HIGH' | 'MEDIUM' | 'LOW' }>({
    feature: 'A5_RED_FLAG',
    entityType: 'CREDIT_APPLICATION',
    entityId: applicationId,
    userId,
    buildMessages: (template) => [
      { role: 'system', content: template },
      {
        role: 'user',
        content: JSON.stringify({
          applicationId,
          borrower: application.borrowerProfile?.name,
          riskRating: application.borrowerProfile?.creditRiskRating,
          facilities: application.facilities,
          ratioHistory: ratioSummary,
          deterministicFailFlags: deterministicWarnings,
          instruction: 'Identify red flags beyond the deterministic failures already listed. Focus on trends, inconsistencies, and contextual anomalies.',
        }),
      },
    ],
  });

  return {
    flags: result.output.flags,
    overallRisk: result.output.overallRisk,
    interactionId: result.interactionId,
    model: result.model,
    costUsd: result.costUsd,
  };
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npx jest credit-ai.test --no-coverage
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/credit/services/creditRedFlag.service.ts
git commit -m "feat(credit-ai): A5 red-flag detector service"
```

---

### Task 2.2: A5 Frontend — AiRedFlagPanel

**Files:**
- Create: `frontend/pages/credit/components/AiRedFlagPanel.tsx`
- Modify: `frontend/pages/credit/CreditApplicationDetail.tsx` — add to Scorecard or Risk Assessment tab

- [ ] **Step 1: Create the panel component**

```tsx
// frontend/pages/credit/components/AiRedFlagPanel.tsx
import React, { useState } from 'react';
import { AlertOctagon, CheckCircle, RefreshCw, Flag } from 'lucide-react';
import { creditAiService, RedFlagResult, RedFlag } from '../../../src/services/creditAi.service';

const SEVERITY_STYLES = {
  HIGH:   'bg-red-50 border-red-200 text-red-800',
  MEDIUM: 'bg-amber-50 border-amber-200 text-amber-800',
  LOW:    'bg-yellow-50 border-yellow-100 text-yellow-800',
};

interface Props {
  applicationId: string;
}

export function AiRedFlagPanel({ applicationId }: Props) {
  const [result, setResult] = useState<RedFlagResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await creditAiService.getRedFlags(applicationId);
      setResult(data);
      setDismissed(new Set());
    } catch {
      setError('Red flag analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  const visibleFlags = result?.flags.filter((_, i) => !dismissed.has(i)) ?? [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-gray-800 text-sm">
          <Flag className="h-4 w-4 text-red-500" />
          AI Red-Flag Analysis
          {result && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              result.overallRisk === 'HIGH' ? 'bg-red-100 text-red-700' :
              result.overallRisk === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'
            }`}>
              {result.overallRisk} RISK
            </span>
          )}
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analysing…' : result ? 'Refresh' : 'Run Analysis'}
        </button>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {result && visibleFlags.length === 0 && (
        <div className="flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle className="h-4 w-4" />
          No significant red flags detected.
        </div>
      )}

      {visibleFlags.map((flag, i) => (
        <div key={i} className={`rounded border p-3 text-xs space-y-1 ${SEVERITY_STYLES[flag.severity]}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium">{flag.severity}: {flag.title}</div>
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(i))}
              className="shrink-0 text-gray-400 hover:text-gray-600 text-xs underline"
            >
              Dismiss
            </button>
          </div>
          <div className="text-gray-600">{flag.evidence}</div>
          <div className="italic text-gray-500">{flag.rationale}</div>
        </div>
      ))}

      {result && (
        <p className="text-gray-400 text-xs">
          Advisory only · Model: {result.model} · Cost: ${result.costUsd.toFixed(5)}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add to Scorecard/Risk tab in CreditApplicationDetail.tsx**

Search `CreditApplicationDetail.tsx` for the tab that renders scorecard or risk assessment content. Add:

```tsx
import { AiRedFlagPanel } from './components/AiRedFlagPanel';

// Inside the scorecard/risk tab JSX, after existing scorecard content:
<AiRedFlagPanel applicationId={application.id} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/credit/components/AiRedFlagPanel.tsx frontend/pages/credit/CreditApplicationDetail.tsx
git commit -m "feat(credit-ai): A5 red-flag detector panel in scorecard tab"
```

---

## Phase 3: A4 — Risk Narrative Summary

> **Requires OpenAI API.** Uses GPT-4o (~$0.01–0.03/call). Highest value for analysts — generates the credit memo risk narrative draft.

---

### Task 3.1: creditNarrative.service.ts

**Files:**
- Create: `backend/src/credit/services/creditNarrative.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// backend/src/credit/services/creditNarrative.service.ts
import prisma from '../../utils/prisma';
import { callAi } from './credit-ai.service';

export interface RiskNarrativeResult {
  narrative: string;
  keyRisks: string[];
  keyStrengths: string[];
  citedFields: string[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export async function generateRiskNarrative(applicationId: string, userId: string): Promise<RiskNarrativeResult> {
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          name: true,
          creditRiskRating: true,
          borrowerType: true,
          totalExposure: true,
        },
      },
      facilities: {
        select: {
          facilityType: true,
          requestedAmount: true,
          tenor: true,
          purpose: true,
          currency: true,
        },
      },
      financialStatements: {
        orderBy: { periodEnd: 'desc' },
        take: 3,
        include: { ratios: { select: { ratioKey: true, value: true } } },
      },
      qualitativeAssessment: {
        select: {
          managementQuality: true,
          industryOutlook: true,
          businessRisk: true,
          financialRisk: true,
        },
      },
      scoreRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { totalScore: true, riskRating: true },
      },
      collateralApplicationLinks: {
        include: { collateral: { select: { collateralType: true, estimatedValue: true, currency: true } } },
        take: 5,
      },
    },
  });

  const latestRatios = application.financialStatements[0]?.ratios ?? [];
  const ratioSummary: Record<string, number> = {};
  for (const r of latestRatios) {
    ratioSummary[r.ratioKey] = Number(r.value);
  }

  const result = await callAi<{
    narrative: string;
    keyRisks: string[];
    keyStrengths: string[];
    citedFields: string[];
  }>({
    feature: 'A4_RISK_NARRATIVE',
    entityType: 'CREDIT_APPLICATION',
    entityId: applicationId,
    userId,
    buildMessages: (template) => [
      { role: 'system', content: template },
      {
        role: 'user',
        content: JSON.stringify({
          borrower: application.borrowerProfile?.name,
          borrowerType: application.borrowerProfile?.borrowerType,
          riskRating: application.borrowerProfile?.creditRiskRating,
          totalExposure: application.borrowerProfile?.totalExposure,
          facilities: application.facilities,
          latestRatios: ratioSummary,
          qualitativeAssessment: application.qualitativeAssessment,
          scorecard: application.scoreRuns[0] ?? null,
          collaterals: application.collateralApplicationLinks.map((l) => l.collateral),
          instruction: 'Write 2–4 paragraphs suitable for the Risk section of a credit approval memorandum. Be factual, cite specific ratios or amounts where relevant, and maintain formal credit officer tone.',
        }),
      },
    ],
    maxTokens: 1200,
  });

  return {
    narrative: result.output.narrative,
    keyRisks: result.output.keyRisks,
    keyStrengths: result.output.keyStrengths,
    citedFields: result.output.citedFields,
    interactionId: result.interactionId,
    model: result.model,
    costUsd: result.costUsd,
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep creditNarrative | head -10
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/credit/services/creditNarrative.service.ts
git commit -m "feat(credit-ai): A4 risk narrative generation service"
```

---

### Task 3.2: A4 Frontend — AiNarrativePanel

**Files:**
- Create: `frontend/pages/credit/components/AiNarrativePanel.tsx`
- Modify: `frontend/pages/credit/CreditApplicationDetail.tsx` — add to Credit Memo or Approval tab

- [ ] **Step 1: Create the panel**

```tsx
// frontend/pages/credit/components/AiNarrativePanel.tsx
import React, { useState } from 'react';
import { FileText, Copy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { creditAiService, RiskNarrativeResult } from '../../../src/services/creditAi.service';

interface Props {
  applicationId: string;
  onCopyToMemo?: (narrative: string) => void;
}

export function AiNarrativePanel({ applicationId, onCopyToMemo }: Props) {
  const [result, setResult] = useState<RiskNarrativeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await creditAiService.getRiskNarrative(applicationId);
      setResult(data);
      setExpanded(true);
    } catch {
      setError('Narrative generation failed. Ensure financial spreads are complete.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.narrative);
    onCopyToMemo?.(result.narrative);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-800 font-medium text-sm">
          <FileText className="h-4 w-4" />
          AI Risk Narrative Draft
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-blue-600 hover:text-blue-800"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating…' : result ? 'Regenerate' : 'Generate Draft'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {result && expanded && (
        <div className="space-y-3">
          <div className="bg-white rounded border border-blue-100 p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {result.narrative}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {result.keyRisks.length > 0 && (
              <div>
                <div className="font-medium text-red-700 mb-1">Key Risks</div>
                <ul className="space-y-0.5 text-gray-600">
                  {result.keyRisks.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            )}
            {result.keyStrengths.length > 0 && (
              <div>
                <div className="font-medium text-green-700 mb-1">Key Strengths</div>
                <ul className="space-y-0.5 text-gray-600">
                  {result.keyStrengths.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-blue-500 text-xs">
              Draft only — analyst must review and edit before submission · {result.model} · ${result.costUsd.toFixed(4)}
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add to CA Memo or Approvals tab**

In `CreditApplicationDetail.tsx`, find the CA Memo tab section (look for `mattersToHighlight` or `firstWayOut` fields). Add the panel above the memo form:

```tsx
import { AiNarrativePanel } from './components/AiNarrativePanel';

// Inside the CA Memo tab:
<AiNarrativePanel applicationId={application.id} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/credit/components/AiNarrativePanel.tsx frontend/pages/credit/CreditApplicationDetail.tsx
git commit -m "feat(credit-ai): A4 risk narrative draft panel in CA Memo tab"
```

---

## Phase 4: A13 — AI Soft Compliance Check

> Augments the existing deterministic `submissionReadiness` gate. Never blocks submission — advisory only.

---

### Task 4.1: creditAiCompliance.service.ts

**Files:**
- Create: `backend/src/credit/services/creditAiCompliance.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// backend/src/credit/services/creditAiCompliance.service.ts
import prisma from '../../utils/prisma';
import { callAi } from './credit-ai.service';

export interface ComplianceConcern {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  field: string;
  issue: string;
  recommendation: string;
}

export interface ComplianceCheckResult {
  concerns: ComplianceConcern[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export async function runAiComplianceCheck(applicationId: string, userId: string): Promise<ComplianceCheckResult> {
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          borrowerType: true,
          amlRiskTier: true,
          isSanctionedEntity: true,
        },
      },
      documents: {
        select: { documentType: true, status: true, expiryDate: true },
        where: { deletedAt: null },
      },
      bureauChecks: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { status: true, result: true, checkedAt: true },
      },
      conditions: {
        select: { conditionType: true, status: true, description: true },
        where: { deletedAt: null },
      },
    },
  });

  const docSummary = application.documents.map((d) => ({
    type: d.documentType,
    status: d.status,
    expired: d.expiryDate ? d.expiryDate < new Date() : false,
  }));

  const result = await callAi<{ concerns: ComplianceConcern[] }>({
    feature: 'A13_COMPLIANCE',
    entityType: 'CREDIT_APPLICATION',
    entityId: applicationId,
    userId,
    buildMessages: (template) => [
      { role: 'system', content: template },
      {
        role: 'user',
        content: JSON.stringify({
          borrowerType: application.borrowerProfile?.borrowerType,
          amlRiskTier: application.borrowerProfile?.amlRiskTier,
          isSanctioned: application.borrowerProfile?.isSanctionedEntity,
          documents: docSummary,
          bureauStatus: application.bureauChecks[0]?.status ?? 'NOT_DONE',
          openConditions: application.conditions.filter((c) => c.status === 'PENDING').length,
          instruction: 'Do NOT repeat deterministic failures (expired docs are handled separately). Focus on soft compliance concerns: logical inconsistencies, missing supporting narratives, incomplete risk declarations, or fields that seem implausible given context.',
        }),
      },
    ],
  });

  return {
    concerns: result.output.concerns,
    interactionId: result.interactionId,
    model: result.model,
    costUsd: result.costUsd,
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep creditAiCompliance | head -10
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/credit/services/creditAiCompliance.service.ts
git commit -m "feat(credit-ai): A13 AI soft compliance check service"
```

---

### Task 4.2: A13 Frontend — AiCompliancePanel

**Files:**
- Create: `frontend/pages/credit/components/AiCompliancePanel.tsx`
- Modify: `frontend/pages/credit/CreditApplicationDetail.tsx` — add to Documents or Submission Readiness tab

- [ ] **Step 1: Create the panel**

```tsx
// frontend/pages/credit/components/AiCompliancePanel.tsx
import React, { useState } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import { creditAiService, ComplianceCheckResult } from '../../../src/services/creditAi.service';

const SEV_COLOR = {
  HIGH: 'border-red-200 bg-red-50 text-red-800',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-800',
  LOW: 'border-gray-200 bg-gray-50 text-gray-700',
};

interface Props {
  applicationId: string;
}

export function AiCompliancePanel({ applicationId }: Props) {
  const [result, setResult] = useState<ComplianceCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      setResult(await creditAiService.getComplianceCheck(applicationId));
    } catch {
      setError('Compliance check failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-800 font-medium text-sm">
          <ShieldCheck className="h-4 w-4 text-blue-500" />
          AI Soft Compliance Check
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking…' : result ? 'Re-check' : 'Run Check'}
        </button>
      </div>

      {error && <p className="text-red-600 text-xs">{error}</p>}

      {result && result.concerns.length === 0 && (
        <p className="text-green-700 text-sm">No soft compliance concerns detected.</p>
      )}

      {result?.concerns.map((c, i) => (
        <div key={i} className={`rounded border p-3 text-xs space-y-1 ${SEV_COLOR[c.severity]}`}>
          <div className="font-medium">{c.severity}: {c.field}</div>
          <div>{c.issue}</div>
          <div className="italic text-gray-500">Recommendation: {c.recommendation}</div>
        </div>
      ))}

      {result && (
        <p className="text-gray-400 text-xs">
          Advisory only — does not block submission · {result.model}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add to submission readiness section**

In `CreditApplicationDetail.tsx`, find the submission readiness / documents tab. Add:

```tsx
import { AiCompliancePanel } from './components/AiCompliancePanel';

// After the deterministic SubmissionReadinessPanel:
<AiCompliancePanel applicationId={application.id} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/credit/components/AiCompliancePanel.tsx frontend/pages/credit/CreditApplicationDetail.tsx
git commit -m "feat(credit-ai): A13 AI soft compliance panel in submission readiness tab"
```

---

## Phase 5: A15 — Auto-Exception Detection

> **Low complexity.** Rules already exist in `policyLimit.service.ts`. AI layer adds plain-language explanation of each exception — no new data needed.

---

### Task 5.1: A15 backend — add exception explanation to existing policy limit check

**Files:**
- Modify: `backend/src/credit/services/policyLimit.service.ts` — add `explainExceptions()` export
- (Or create a thin wrapper — check file size first)

- [ ] **Step 1: Check policyLimit.service.ts size**

```bash
wc -l backend/src/credit/services/policyLimit.service.ts
```

If under 300 lines, add directly. If larger, create a thin `creditAutoException.service.ts` wrapper.

- [ ] **Step 2: Add the explainExceptions function**

In whichever file is appropriate, add:

```typescript
// backend/src/credit/services/creditAutoException.service.ts
import prisma from '../../utils/prisma';
import { callAi } from './credit-ai.service';

export interface PolicyException {
  policyRef: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

export interface AutoExceptionResult {
  exceptions: PolicyException[];
  interactionId: string;
  model: string;
  costUsd: number;
}

export async function detectPolicyExceptions(applicationId: string, userId: string): Promise<AutoExceptionResult> {
  const application = await prisma.creditApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      borrowerProfile: {
        select: {
          creditRiskRating: true,
          totalExposure: true,
          exposureLimit: true,
          borrowerType: true,
        },
      },
      facilities: {
        select: {
          facilityType: true,
          requestedAmount: true,
          tenor: true,
          currency: true,
          purpose: true,
        },
      },
      scoreRuns: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { totalScore: true, riskRating: true },
      },
    },
  });

  const bp = application.borrowerProfile;
  const totalRequested = application.facilities.reduce(
    (sum, f) => sum + Number(f.requestedAmount ?? 0), 0
  );
  const projectedExposure = Number(bp?.totalExposure ?? 0) + totalRequested;

  const detectedRuleBreaches: string[] = [];
  if (bp?.exposureLimit && projectedExposure > Number(bp.exposureLimit)) {
    detectedRuleBreaches.push(`Projected exposure ${projectedExposure.toLocaleString()} exceeds borrower limit ${Number(bp.exposureLimit).toLocaleString()}`);
  }
  if (bp?.creditRiskRating === 'WATCH' || bp?.creditRiskRating === 'SUBSTANDARD') {
    detectedRuleBreaches.push(`New facility proposed for borrower with risk rating: ${bp.creditRiskRating}`);
  }

  const result = await callAi<{ exceptions: PolicyException[] }>({
    feature: 'A15_EXCEPTION',
    entityType: 'CREDIT_APPLICATION',
    entityId: applicationId,
    userId,
    buildMessages: (template) => [
      { role: 'system', content: template },
      {
        role: 'user',
        content: JSON.stringify({
          borrowerType: bp?.borrowerType,
          riskRating: bp?.creditRiskRating,
          totalExposure: bp?.totalExposure,
          exposureLimit: bp?.exposureLimit,
          projectedExposure,
          facilities: application.facilities,
          scorecard: application.scoreRuns[0] ?? null,
          deterministicBreaches: detectedRuleBreaches,
          instruction: 'Explain each policy exception in plain language for the credit officer. Include the relevant policy reference (e.g. "Credit Policy §4.2"), what the exception is, and what approvals or mitigants would typically be required.',
        }),
      },
    ],
  });

  return {
    exceptions: result.output.exceptions,
    interactionId: result.interactionId,
    model: result.model,
    costUsd: result.costUsd,
  };
}
```

- [ ] **Step 3: Add route to creditAi.routes.ts**

In `backend/src/credit/routes/creditAi.routes.ts`, add:

```typescript
import { detectPolicyExceptions } from '../services/creditAutoException.service';

// After existing routes:
router.post(
  '/:appId/exceptions',
  authenticate,
  requirePermission('credit:read'),
  async (req, res, next) => {
    try {
      const result = await detectPolicyExceptions(req.params.appId, req.user!.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
```

- [ ] **Step 4: Add to creditAi.service.ts (frontend)**

In `frontend/src/services/creditAi.service.ts`, add:

```typescript
export interface PolicyException {
  policyRef: string;
  description: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendation: string;
}

export interface AutoExceptionResult {
  exceptions: PolicyException[];
  interactionId: string;
  model: string;
}

// In the creditAiService object:
detectExceptions: (appId: string) =>
  axios.post<AutoExceptionResult>(`${BASE}/${appId}/exceptions`).then(r => r.data),
```

- [ ] **Step 5: Wire into existing exceptions/conditions UI**

A15 results should appear in the Conditions tab or wherever policy exceptions are currently displayed. A small inline banner using the same severity color pattern from `AiCompliancePanel` is sufficient — no new full component needed. Add a "Detect Policy Exceptions" button in that tab.

- [ ] **Step 6: TypeScript check**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -E "autoException|creditAi" | head -10
```
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/credit/services/creditAutoException.service.ts backend/src/credit/routes/creditAi.routes.ts frontend/src/services/creditAi.service.ts
git commit -m "feat(credit-ai): A15 auto-exception detection with AI explanation"
```

---

## Phase 6: End-to-End Verification

### Task 6.1: Integration smoke test

- [ ] **Step 1: Start dev servers**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Seed and verify governance tables**

```bash
cd backend && npm run prisma:seed
```
Check `ai_prompt_versions` has 4 rows.

- [ ] **Step 3: Test each feature**

Log in as `admin@test.local / abc@123`. Open any credit application with financial spreads.

| Feature | Where to find | Expected result |
|---|---|---|
| A6 Duplicate | Borrower Profile section | "Run Check" button appears; clicking it returns result in < 2s (no API call) |
| A5 Red Flags | Scorecard/Risk tab | "Run Analysis" calls GPT-4o-mini; flags display with severity |
| A4 Narrative | CA Memo tab | "Generate Draft" calls GPT-4o; 2–4 paragraph narrative appears |
| A13 Compliance | Submission Readiness tab | "Run Check" returns soft concerns or clean result |
| A15 Exceptions | Conditions tab | "Detect Exceptions" returns policy exceptions with refs |

- [ ] **Step 4: Verify audit log**

```bash
cd backend && npm run prisma:studio
```
Open `ai_interactions` table. Confirm one row per AI call with `input_tokens`, `output_tokens`, `cost_usd`, and `output` populated.

- [ ] **Step 5: Final TypeScript + lint**

```bash
cd backend && npx tsc --noEmit && npm run lint
cd frontend && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(credit-ai): Phase 2 AI features — A4 A5 A6 A13 A15 with governance audit log"
```

---

## Summary

| Phase | Feature | API Cost | Effort | Notes |
|---|---|---|---|---|
| 0 | Governance scaffold | None | 0.5 day | **Prerequisite — must go first** |
| 1 | A6 Duplicate detection | **$0** | 0.5 day | Deterministic only |
| 2 | A5 Red-flag detector | ~$0.001/call | 1 day | GPT-4o-mini |
| 3 | A4 Risk narrative | ~$0.01–0.03/call | 1 day | GPT-4o — highest value |
| 4 | A13 Soft compliance | ~$0.001/call | 0.5 day | Advisory only |
| 5 | A15 Auto-exception | ~$0.001/call | 0.5 day | Rules-first |
| 6 | Verification | — | 0.5 day | |
| **Total** | | **< $5/month at 50 apps** | **~4–5 days** | |

**Not in this plan (separate sprint):**
- A12 Credit Officer Copilot Chat (~3–5 days, RAG over policy docs)
- A2/A3 OCR / Bank Statement Analyser (requires Azure Document Intelligence or AWS Textract — new paid vendor)
- A1 Document Classifier (requires vision-capable endpoint + document pipeline)

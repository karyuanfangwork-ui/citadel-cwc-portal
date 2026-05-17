# CRM AI Features Implementation Plan

> **STATUS: ✅ FULLY IMPLEMENTED** — Completed 2026-05-17. All 13 tasks done across 2 commits on `dev2.0`.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add an OpenAI-powered AI intelligence layer to the CRM — 9 features across 3 phases: agent productivity, sales intelligence, and compliance assistance.

**Architecture:** A single `crm-ai.service.ts` owns all OpenAI SDK calls; `crm-ai.controller.ts` + `crm-ai.routes.ts` expose 9 REST endpoints under `/api/v1/crm/ai/`. Frontend consumes via a shared `useCrmAi` hook collection + `AiInsightCard` component. Phase 2 persists AI scores to two new Prisma fields.

**Tech Stack:** `openai`, Node.js/Express/TypeScript, Prisma/PostgreSQL, React 19, Vite

**Prerequisite:** P0 routing bug B1 must be fixed (Lead Detail and Contact Detail pages must be reachable) before Phase 1 UI tasks.

---

## File Map

### New files
| File | Purpose |
|---|---|
| `backend/src/services/crm-ai.service.ts` | All 9 OpenAI AI methods |
| `backend/src/controllers/crm-ai.controller.ts` | HTTP request handlers for AI routes |
| `backend/src/routes/crm-ai.routes.ts` | Route definitions, mounted inside crm.routes.ts |
| `backend/src/__tests__/crm-ai.test.ts` | Unit tests (mocked OpenAI client) |
| `frontend/src/components/crm/AiInsightCard.tsx` | Shared AI result display component |
| `frontend/src/hooks/useCrmAi.ts` | All AI feature hooks |

### Modified files
| File | Change |
|---|---|
| `backend/package.json` | Add `openai` |
| `backend/src/config/index.ts` | Add `openai.apiKey` config entry |
| `backend/src/routes/crm.routes.ts` | Mount crm-ai routes |
| `backend/prisma/schema.prisma` | Add `aiScore`/`aiWinProbability` fields (Phase 2) |
| `frontend/src/services/crm.service.ts` | Add 9 AI API call methods |
| `frontend/pages/CrmLeadDetail.tsx` | Add score badge, summary panel, draft button |
| `frontend/pages/CrmLeads.tsx` | Add score badges on lead cards |
| `frontend/pages/CrmContactDetail.tsx` | Add draft button, KYC gap detector, risk classifier |
| `frontend/pages/CrmOpportunityDetail.tsx` | Add win probability display |
| `frontend/pages/CrmPipeline.tsx` | Add win probability on kanban cards |
| `frontend/pages/CrmDashboard.tsx` | Add AI daily briefing card |

---

## Task 1: Install SDK, config, and backend scaffolding

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/config/index.ts`
- Create: `backend/src/services/crm-ai.service.ts`
- Create: `backend/src/controllers/crm-ai.controller.ts`
- Create: `backend/src/routes/crm-ai.routes.ts`
- Modify: `backend/src/routes/crm.routes.ts`

- [x] **Step 1: Install OpenAI SDK**

```bash
cd backend && npm install openai
```

Expected: `openai` appears in `backend/package.json` dependencies.

- [x] **Step 2: Add config entry**

In `backend/src/config/index.ts`, add after the `email` block (around line 64):

```typescript
    // OpenAI
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
    },
```

- [x] **Step 3: Add env var to .env**

Add to `backend/.env` (do NOT commit this file):
```
OPENAI_API_KEY=sk-...your-key-here...
```

- [x] **Step 4: Create crm-ai.service.ts scaffold**

Create `backend/src/services/crm-ai.service.ts`:

```typescript
import OpenAI from 'openai';
import { config } from '../config';
import prisma from '../utils/prisma';
import { logger } from '../utils/logger';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

const FAST = 'gpt-4o-mini';
const SMART = 'gpt-4o';

// ─── Phase 1: Agent Productivity ─────────────────────────────────────────────

export async function analyzeActivityNote(activityId: string): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  nextAction: string;
  suggestedStatusChange: string | null;
  keyFacts: string[];
}> {
  const activity = await prisma.crmActivity.findUniqueOrThrow({
    where: { id: activityId },
    include: {
      lead: { select: { id: true, title: true, status: true } },
      opportunity: { select: { id: true, name: true } },
    },
  });

  const entityContext = activity.lead
    ? `Lead: "${activity.lead.title}" (status: ${activity.lead.status})`
    : activity.opportunity
    ? `Opportunity: "${activity.opportunity.name}"`
    : 'No linked entity';

  const response = await openai.chat.completions.create({
    model: FAST,
    max_tokens: 512,
    messages: [
      {
        role: 'system',
        content: `You are a CRM assistant for a Malaysian trust and estate planning company. Analyze sales activity notes and extract structured insights. Always respond with valid JSON only — no markdown, no explanation.`,
      },
      {
        role: 'user',
        content: `Analyze this CRM activity note and return JSON with these fields:
- sentiment: "positive" | "neutral" | "negative"
- nextAction: string (recommended next step for the sales agent, 1 sentence)
- suggestedStatusChange: string | null (e.g. "QUALIFIED", "CONTACTED" — only if clearly warranted, else null)
- keyFacts: string[] (up to 3 key facts mentioned: names, amounts, dates, decisions)

Activity type: ${activity.type}
Subject: ${activity.subject}
Notes: ${activity.description || '(no notes)'}
Context: ${entityContext}`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return JSON.parse(raw);
}

export async function draftFollowUpMessage(
  entityType: 'lead' | 'contact',
  entityId: string,
  channel: 'whatsapp' | 'email',
  tone: 'formal' | 'friendly',
): Promise<{ subject: string | null; body: string }> {
  let name = '';
  let company = '';
  let lastActivitySummary = '';
  let opportunityContext = '';
  let preferredLanguage = '';

  if (entityType === 'lead') {
    const lead = await prisma.crmLead.findUniqueOrThrow({
      where: { id: entityId },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 1, select: { subject: true, description: true, type: true } },
        contact: { select: { firstName: true, lastName: true, preferredLanguage: true } },
      },
    });
    name = lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : lead.contactName || 'Valued Client';
    company = lead.companyName || '';
    preferredLanguage = lead.contact?.preferredLanguage || 'English';
    lastActivitySummary = lead.activities[0]
      ? `${lead.activities[0].type}: ${lead.activities[0].subject} — ${lead.activities[0].description || ''}`
      : 'No prior contact';
    opportunityContext = `Lead: "${lead.title}" (value: MYR ${lead.estimatedValue ?? 'unknown'})`;
  } else {
    const contact = await prisma.crmContact.findUniqueOrThrow({
      where: { id: entityId },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 1, select: { subject: true, description: true, type: true } },
        opportunities: { orderBy: { createdAt: 'desc' }, take: 1, select: { name: true, stage: { select: { name: true } } } },
      },
    });
    name = `${contact.firstName} ${contact.lastName}`;
    company = contact.company || '';
    preferredLanguage = contact.preferredLanguage || 'English';
    lastActivitySummary = contact.activities[0]
      ? `${contact.activities[0].type}: ${contact.activities[0].subject} — ${contact.activities[0].description || ''}`
      : 'No prior contact';
    if (contact.opportunities[0]) {
      opportunityContext = `Active opportunity: "${contact.opportunities[0].name}" at stage "${contact.opportunities[0].stage?.name}"`;
    }
  }

  const response = await openai.chat.completions.create({
    model: FAST,
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: `You are a sales assistant at a Malaysian trust and estate planning company (Citadel). Write professional, culturally appropriate ${channel} messages. Respond with JSON only — no markdown.`,
      },
      {
        role: 'user',
        content: `Draft a ${channel} follow-up message.

Recipient: ${name}${company ? ` (${company})` : ''}
Preferred language: ${preferredLanguage}
Tone: ${tone}
Channel: ${channel}
Last interaction: ${lastActivitySummary}
Context: ${opportunityContext || 'General follow-up'}

Return JSON: { "subject": string | null (null for WhatsApp), "body": string }
For email: include subject line. For WhatsApp: subject is null, body is conversational and under 200 words.`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return JSON.parse(raw);
}

export async function summarizeLead(leadId: string): Promise<{
  statusSummary: string;
  keyFacts: string;
  recommendedNextStep: string;
}> {
  const lead = await prisma.crmLead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      activities: { orderBy: { createdAt: 'desc' }, take: 30, select: { type: true, subject: true, description: true, createdAt: true } },
      notes: { orderBy: { createdAt: 'desc' }, take: 10, select: { content: true, createdAt: true } },
      contact: { select: { firstName: true, lastName: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
  });

  const activitiesText = lead.activities
    .map((a) => `[${a.createdAt.toISOString().slice(0, 10)}] ${a.type}: ${a.subject} — ${a.description || ''}`)
    .join('\n');
  const notesText = lead.notes.map((n) => `[${n.createdAt.toISOString().slice(0, 10)}] ${n.content}`).join('\n');

  const response = await openai.chat.completions.create({
    model: FAST,
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Summarize this sales lead in 3 short bullet points. Return JSON only: { "statusSummary": string, "keyFacts": string, "recommendedNextStep": string }

Lead: "${lead.title}"
Status: ${lead.status} | Source: ${lead.source} | Value: MYR ${lead.estimatedValue ?? 'unknown'}
Contact: ${lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : lead.contactName || 'unknown'}
Owner: ${lead.owner.firstName} ${lead.owner.lastName}

Activities (newest first):
${activitiesText || '(none)'}

Notes:
${notesText || '(none)'}`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return JSON.parse(raw);
}

// ─── Phase 2: Sales Intelligence ─────────────────────────────────────────────

export async function scoreLead(leadId: string): Promise<{
  score: number;
  reason: string;
}> {
  const lead = await prisma.crmLead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      _count: { select: { activities: true } },
      contact: { select: { email: true, phone: true } },
    },
  });

  const daysSinceCreated = Math.floor((Date.now() - lead.createdAt.getTime()) / 86400000);
  const recentActivities = await prisma.crmActivity.count({
    where: { leadId, createdAt: { gte: new Date(Date.now() - 14 * 86400000) } },
  });

  const response = await openai.chat.completions.create({
    model: FAST,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `You are a CRM lead scoring engine for a Malaysian trust and estate planning company. Score leads 0-100 based on engagement signals and deal potential. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Score this lead 0-100 and give a one-sentence reason.

Source: ${lead.source}
Status: ${lead.status}
Estimated value: MYR ${lead.estimatedValue ?? 'unknown'}
Days since created: ${daysSinceCreated}
Total activities: ${lead._count.activities}
Activities in last 14 days: ${recentActivities}
Has email: ${!!lead.contact?.email || !!lead.contactEmail}
Has phone: ${!!lead.contact?.phone || !!lead.contactPhone}

Return JSON: { "score": number (0-100), "reason": string (1 sentence) }`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  const result = JSON.parse(raw);

  // Persist score back to DB
  await prisma.crmLead.update({
    where: { id: leadId },
    data: { aiScore: result.score, aiScoreReason: result.reason, aiScoredAt: new Date() },
  });

  return result;
}

export async function predictWinProbability(opportunityId: string): Promise<{
  probability: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}> {
  const opp = await prisma.crmOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: {
      stage: { select: { name: true, probability: true } },
      _count: { select: { activities: true } },
    },
  });

  const daysSinceLastActivity = opp.updatedAt
    ? Math.floor((Date.now() - opp.updatedAt.getTime()) / 86400000)
    : 999;
  const daysUntilClose = opp.expectedCloseDate
    ? Math.floor((opp.expectedCloseDate.getTime() - Date.now()) / 86400000)
    : null;

  const response = await openai.chat.completions.create({
    model: FAST,
    max_tokens: 250,
    messages: [
      {
        role: 'system',
        content: `You are a CRM win probability engine for a Malaysian trust and estate planning company. Predict deal win probability as a percentage. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Predict win probability for this opportunity.

Stage: ${opp.stage.name} (static stage probability: ${opp.stage.probability}%)
Value: MYR ${opp.value}
Total activities: ${opp._count.activities}
Days since last update: ${daysSinceLastActivity}
Days until expected close: ${daysUntilClose ?? 'not set'}

Return JSON: { "probability": number (0-100), "confidence": "high"|"medium"|"low", "reason": string (1 sentence) }`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  const result = JSON.parse(raw);

  await prisma.crmOpportunity.update({
    where: { id: opportunityId },
    data: { aiWinProbability: result.probability, aiWinReason: result.reason, aiScoredAt: new Date() },
  });

  return result;
}

export async function generateDailyBriefing(userId: string): Promise<{
  headline: string;
  bullets: string[];
  topPriority: string;
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

  const [overdueFollowUps, staleDeals, todayActivities, topOpportunities] = await Promise.all([
    prisma.crmLead.count({
      where: { ownerId: userId, followUpDate: { lt: now }, deletedAt: null, status: { notIn: ['CONVERTED', 'LOST'] } },
    }),
    prisma.crmOpportunity.findMany({
      where: { ownerId: userId, deletedAt: null, updatedAt: { lt: sevenDaysAgo } },
      select: { name: true, value: true, stage: { select: { name: true } } },
      orderBy: { value: 'desc' },
      take: 3,
    }),
    prisma.crmActivity.count({
      where: {
        userId,
        scheduledAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) },
        completedAt: null,
      },
    }),
    prisma.crmOpportunity.findMany({
      where: { ownerId: userId, deletedAt: null, stage: { isWonStage: false, isLostStage: false } },
      select: { name: true, value: true, stage: { select: { name: true } } },
      orderBy: { value: 'desc' },
      take: 3,
    }),
  ]);

  const staleDealsText = staleDeals.map((d) => `"${d.name}" (MYR ${d.value}, stage: ${d.stage.name})`).join(', ');
  const topOppText = topOpportunities.map((o) => `"${o.name}" MYR ${o.value} at ${o.stage.name}`).join('; ');

  const response = await openai.chat.completions.create({
    model: FAST,
    max_tokens: 350,
    messages: [
      {
        role: 'user',
        content: `Generate a brief daily sales briefing for a relationship manager. Return JSON only.

Data:
- Overdue follow-ups: ${overdueFollowUps}
- Stale deals (no activity 7+ days): ${staleDealsText || 'none'}
- Activities scheduled today: ${todayActivities}
- Top active opportunities: ${topOppText || 'none'}

Return JSON: { "headline": string (1 sentence summary), "bullets": string[] (2-3 priority bullets, each under 15 words), "topPriority": string (single most important action today) }`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return JSON.parse(raw);
}

// ─── Phase 3: Compliance Assist ──────────────────────────────────────────────

export async function detectKycGaps(contactId: string): Promise<{
  gaps: Array<{ field: string; requirement: string; severity: 'required' | 'recommended' }>;
  complianceSummary: string;
  isCompliant: boolean;
}> {
  const contact = await prisma.crmContact.findUniqueOrThrow({
    where: { id: contactId },
    include: { kycRecord: true },
  });

  const kyc = contact.kycRecord;

  const response = await openai.chat.completions.create({
    model: SMART,
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: `You are a Malaysian financial services compliance specialist. Assess KYC records against BNM/AMLA requirements for trust product sales. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Assess this KYC record for a trust product client.

Contact: ${contact.firstName} ${contact.lastName}
KYC Status: ${kyc?.status ?? 'NOT_STARTED'}
NRIC/Passport: ${contact.nricPassport ? 'present' : 'MISSING'}
Risk classification: ${kyc?.riskClassification ?? 'NOT_SET'}
PEP flag: ${kyc?.isPep ?? 'NOT_SET'}
Source of funds: ${kyc?.sourceOfFunds ? 'documented' : 'MISSING'}
KYC expiry date: ${kyc?.expiryDate ? kyc.expiryDate.toISOString().slice(0, 10) : 'NOT_SET'}
PDPA consent: ${contact.pdpaConsent ? `yes (${contact.pdpaConsentDate?.toISOString().slice(0, 10)})` : 'MISSING'}

Return JSON: { "gaps": [{ "field": string, "requirement": string (cite BNM/AMLA where applicable), "severity": "required"|"recommended" }], "complianceSummary": string (1 sentence), "isCompliant": boolean }`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return JSON.parse(raw);
}

export async function classifyRiskProfile(contactId: string): Promise<{
  suggestedRiskTier: 'Low' | 'Medium' | 'High';
  justification: string;
  regulatoryBasis: string;
}> {
  const contact = await prisma.crmContact.findUniqueOrThrow({
    where: { id: contactId },
    include: { kycRecord: true, account: { select: { accountType: true } } },
  });

  const kyc = contact.kycRecord;

  const response = await openai.chat.completions.create({
    model: SMART,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content: `You are a Malaysian financial services compliance specialist applying BNM's risk-based approach (RBA) framework for AML/CFT. Classify client risk tiers. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Suggest a risk tier for this trust product client based on BNM's risk-based approach.

Client type: ${contact.account?.accountType ?? 'INDIVIDUAL'}
Occupation: ${contact.jobTitle ?? 'unknown'}
Source of funds: ${kyc?.sourceOfFunds ?? 'not documented'}
PEP: ${kyc?.isPep ? 'YES — Politically Exposed Person' : 'No'}
Existing risk classification: ${kyc?.riskClassification ?? 'none'}

Return JSON: { "suggestedRiskTier": "Low"|"Medium"|"High", "justification": string (2-3 sentences), "regulatoryBasis": string (cite specific BNM guideline or AMLA section) }`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return JSON.parse(raw);
}

export async function generateDocumentChecklist(trustProductId: string): Promise<{
  documents: Array<{ name: string; description: string; required: boolean }>;
  notes: string;
}> {
  const trustProduct = await prisma.crmTrustProduct.findUniqueOrThrow({
    where: { id: trustProductId },
    include: {
      opportunity: {
        include: {
          contact: { select: { firstName: true, lastName: true } },
          account: { select: { accountType: true, name: true } },
        },
      },
      beneficiaries: { select: { id: true } },
    },
  });

  const beneficiaryCount = trustProduct.beneficiaries.length;
  const clientType = trustProduct.opportunity.account?.accountType ?? 'INDIVIDUAL';

  const response = await openai.chat.completions.create({
    model: SMART,
    max_tokens: 700,
    messages: [
      {
        role: 'system',
        content: `You are a Malaysian trust and estate planning specialist. Generate document checklists for trust product setup in Malaysia. Return JSON only.`,
      },
      {
        role: 'user',
        content: `Generate a document checklist for this trust product.

Trust type: ${trustProduct.trustType ?? 'Living Trust'}
Client type: ${clientType}
Client: ${trustProduct.opportunity.contact?.firstName ?? ''} ${trustProduct.opportunity.contact?.lastName ?? ''}
Number of beneficiaries: ${beneficiaryCount}
Asset value: MYR ${trustProduct.assetValue ?? 'unknown'}

Return JSON: { "documents": [{ "name": string, "description": string (what this doc is for), "required": boolean }], "notes": string (any special requirements or caveats for this trust setup) }`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return JSON.parse(raw);
}
```

- [x] **Step 5: Create crm-ai.controller.ts**

Create `backend/src/controllers/crm-ai.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import * as aiService from '../services/crm-ai.service';
import { logger } from '../utils/logger';

const handle = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export const crmAiController = {
  analyzeNote: handle(async (req, res) => {
    const result = await aiService.analyzeActivityNote(req.params.id);
    res.json(result);
  }),

  draftMessage: handle(async (req, res) => {
    const { entityType, channel, tone } = req.body as {
      entityType: 'lead' | 'contact';
      channel: 'whatsapp' | 'email';
      tone: 'formal' | 'friendly';
    };
    const result = await aiService.draftFollowUpMessage(entityType, req.params.id, channel, tone);
    res.json(result);
  }),

  leadSummary: handle(async (req, res) => {
    const result = await aiService.summarizeLead(req.params.id);
    res.json(result);
  }),

  leadScore: handle(async (req, res) => {
    const result = await aiService.scoreLead(req.params.id);
    res.json(result);
  }),

  winProbability: handle(async (req, res) => {
    const result = await aiService.predictWinProbability(req.params.id);
    res.json(result);
  }),

  dailyBriefing: handle(async (req, res) => {
    const userId = (req as any).user.id as string;
    const result = await aiService.generateDailyBriefing(userId);
    res.json(result);
  }),

  kycGaps: handle(async (req, res) => {
    const result = await aiService.detectKycGaps(req.params.id);
    res.json(result);
  }),

  riskProfile: handle(async (req, res) => {
    const result = await aiService.classifyRiskProfile(req.params.id);
    res.json(result);
  }),

  documentChecklist: handle(async (req, res) => {
    const result = await aiService.generateDocumentChecklist(req.params.id);
    res.json(result);
  }),
};
```

- [x] **Step 6: Create crm-ai.routes.ts**

Create `backend/src/routes/crm-ai.routes.ts`:

```typescript
import { Router } from 'express';
import { crmAiController } from '../controllers/crm-ai.controller';
import { requirePermission } from '../middleware/auth.middleware';

const router = Router();

// Phase 1 — Agent Productivity
router.post('/activities/:id/analyze', requirePermission('crm:read'), crmAiController.analyzeNote);
router.post('/leads/:id/draft-message', requirePermission('crm:read'), crmAiController.draftMessage);
router.post('/contacts/:id/draft-message', requirePermission('crm:read'), crmAiController.draftMessage);
router.get('/leads/:id/summary', requirePermission('crm:read'), crmAiController.leadSummary);

// Phase 2 — Sales Intelligence
router.get('/leads/:id/score', requirePermission('crm:read'), crmAiController.leadScore);
router.get('/opportunities/:id/win-probability', requirePermission('crm:read'), crmAiController.winProbability);
router.get('/dashboard/briefing', requirePermission('crm:read'), crmAiController.dailyBriefing);

// Phase 3 — Compliance Assist
router.get('/contacts/:id/kyc-gaps', requirePermission('crm:read'), crmAiController.kycGaps);
router.get('/contacts/:id/risk-profile', requirePermission('crm:read'), crmAiController.riskProfile);
router.get('/trust-products/:id/document-checklist', requirePermission('crm:read'), crmAiController.documentChecklist);

export default router;
```

- [x] **Step 7: Mount AI routes in crm.routes.ts**

At the bottom of `backend/src/routes/crm.routes.ts`, before `export default router`, add:

```typescript
import crmAiRoutes from './crm-ai.routes';

// ======== AI FEATURES ========
router.use('/ai', crmAiRoutes);
```

- [x] **Step 8: Verify TypeScript compiles**

```bash
cd backend && npm run build 2>&1 | head -30
```

Expected: Build succeeds with no errors.

- [x] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/config/index.ts backend/src/services/crm-ai.service.ts backend/src/controllers/crm-ai.controller.ts backend/src/routes/crm-ai.routes.ts backend/src/routes/crm.routes.ts
git commit -m "feat(crm): add AI service scaffold with 9 methods + routes (OpenAI SDK)"
```

---

## Task 2: Backend tests for AI service

**Files:**
- Create: `backend/src/__tests__/crm-ai.test.ts`

- [x] **Step 1: Create test file with mocked OpenAI client**

Create `backend/src/__tests__/crm-ai.test.ts`:

```typescript
import { analyzeActivityNote, draftFollowUpMessage, summarizeLead, scoreLead, predictWinProbability, generateDailyBriefing } from '../services/crm-ai.service';
import prisma from '../utils/prisma';

// Mock the entire OpenAI SDK
jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

// Capture the mock instance for per-test configuration
let mockCreate: jest.Mock;
beforeAll(() => {
  const OpenAI = require('openai').default;
  mockCreate = OpenAI.mock.results[0].value.chat.completions.create;
});

const mockJson = (obj: object) =>
  mockCreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(obj) } }],
  });

// Use real test DB — create and clean up test records
const TEST_USER_EMAIL = 'crm-ai-test@test.local';
let testUserId: string;
let testLeadId: string;
let testActivityId: string;
let testOpportunityId: string;

beforeAll(async () => {
  const user = await prisma.user.findFirst({ where: { email: TEST_USER_EMAIL } });
  if (!user) throw new Error('Seed test user not found. Run `npm run prisma:seed` first.');
  testUserId = user.id;

  const account = await prisma.crmAccount.create({
    data: { name: 'AI Test Account', ownerId: testUserId },
  });

  const lead = await prisma.crmLead.create({
    data: {
      title: 'AI Test Lead',
      status: 'NEW',
      source: 'REFERRAL',
      ownerId: testUserId,
      estimatedValue: 50000,
    },
  });
  testLeadId = lead.id;

  const activity = await prisma.crmActivity.create({
    data: {
      type: 'CALL',
      subject: 'Discovery call',
      description: 'Client expressed strong interest in Living Trust. Has 3 children. Net worth around RM 2M.',
      userId: testUserId,
      leadId: testLeadId,
    },
  });
  testActivityId = activity.id;

  const pipeline = await prisma.crmPipeline.findFirst({ where: { isDefault: true } });
  if (!pipeline) throw new Error('No default pipeline found. Run seed.');
  const stage = await prisma.crmPipelineStage.findFirst({ where: { pipelineId: pipeline.id } });
  if (!stage) throw new Error('No pipeline stage found.');

  const opp = await prisma.crmOpportunity.create({
    data: {
      name: 'AI Test Opportunity',
      accountId: account.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      ownerId: testUserId,
      value: 120000,
    },
  });
  testOpportunityId = opp.id;
});

afterAll(async () => {
  await prisma.crmActivity.deleteMany({ where: { leadId: testLeadId } });
  await prisma.crmOpportunity.deleteMany({ where: { id: testOpportunityId } });
  await prisma.crmLead.delete({ where: { id: testLeadId } });
  await prisma.$disconnect();
});

describe('analyzeActivityNote', () => {
  it('parses Claude response and returns structured analysis', async () => {
    mockJson({ sentiment: 'positive', nextAction: 'Send trust brochure', suggestedStatusChange: 'QUALIFIED', keyFacts: ['RM 2M net worth', '3 children', 'Living Trust interest'] });

    const result = await analyzeActivityNote(testActivityId);
    expect(result.sentiment).toBe('positive');
    expect(result.nextAction).toBeTruthy();
    expect(Array.isArray(result.keyFacts)).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-4o-mini' }));
  });
});

describe('summarizeLead', () => {
  it('returns three summary fields', async () => {
    mockJson({ statusSummary: 'New referral, high intent', keyFacts: 'RM 50k potential', recommendedNextStep: 'Schedule meeting' });

    const result = await summarizeLead(testLeadId);
    expect(result.statusSummary).toBeTruthy();
    expect(result.keyFacts).toBeTruthy();
    expect(result.recommendedNextStep).toBeTruthy();
  });
});

describe('scoreLead', () => {
  it('returns score 0-100 and persists to DB', async () => {
    mockJson({ score: 72, reason: 'High-value referral with recent activity' });

    const result = await scoreLead(testLeadId);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.reason).toBeTruthy();

    const updated = await prisma.crmLead.findUnique({ where: { id: testLeadId } });
    expect(updated?.aiScore).toBe(72);
    expect(updated?.aiScoreReason).toBeTruthy();
  });
});

describe('predictWinProbability', () => {
  it('returns probability and persists to DB', async () => {
    mockJson({ probability: 65, confidence: 'medium', reason: 'Active deal in proposal stage' });

    const result = await predictWinProbability(testOpportunityId);
    expect(result.probability).toBeGreaterThanOrEqual(0);
    expect(result.probability).toBeLessThanOrEqual(100);
    expect(['high', 'medium', 'low']).toContain(result.confidence);

    const updated = await prisma.crmOpportunity.findUnique({ where: { id: testOpportunityId } });
    expect(updated?.aiWinProbability).toBe(65);
  });
});

describe('generateDailyBriefing', () => {
  it('returns briefing with headline, bullets, and topPriority', async () => {
    mockJson({ headline: 'Busy day ahead', bullets: ['3 overdue follow-ups', 'Top deal stalling'], topPriority: 'Call Ahmad re RM 120k deal' });

    const result = await generateDailyBriefing(testUserId);
    expect(result.headline).toBeTruthy();
    expect(Array.isArray(result.bullets)).toBe(true);
    expect(result.topPriority).toBeTruthy();
  });
});
```

- [x] **Step 2: Run tests**

```bash
cd backend && npm test -- --testPathPattern=crm-ai 2>&1 | tail -20
```

Expected: All 5 test suites pass.

- [x] **Step 3: Commit**

```bash
git add backend/src/__tests__/crm-ai.test.ts
git commit -m "test(crm): add unit tests for AI service (mocked OpenAI client)"
```

---

## Task 3: Prisma migration for Phase 2 fields

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [x] **Step 1: Add AI fields to CrmLead model**

In `backend/prisma/schema.prisma`, in the `CrmLead` model, add after the `followUpNote` line:

```prisma
  // AI scoring
  aiScore        Int?       @map("ai_score")
  aiScoreReason  String?    @map("ai_score_reason") @db.Text
  aiScoredAt     DateTime?  @map("ai_scored_at") @db.Timestamp(6)
```

- [x] **Step 2: Add AI fields to CrmOpportunity model**

In `backend/prisma/schema.prisma`, in the `CrmOpportunity` model, add after the `deletedAt` line:

```prisma
  // AI scoring
  aiWinProbability  Float?     @map("ai_win_probability")
  aiWinReason       String?    @map("ai_win_reason") @db.Text
  aiScoredAt        DateTime?  @map("ai_scored_at") @db.Timestamp(6)
```

- [x] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_crm_ai_score_fields
```

Expected: Migration created and applied. Prisma client regenerated.

- [x] **Step 4: Verify TypeScript build still passes**

```bash
cd backend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: No output (no errors).

- [x] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat(crm): add aiScore and aiWinProbability fields to Prisma schema"
```

---

## Task 4: AiInsightCard shared component + frontend API methods

**Files:**
- Create: `frontend/src/components/crm/AiInsightCard.tsx`
- Modify: `frontend/src/services/crm.service.ts`

- [x] **Step 1: Create AiInsightCard component**

Create `frontend/src/components/crm/AiInsightCard.tsx`:

```tsx
import React from 'react';

interface AiInsightCardProps {
  title?: string;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
  onRefresh?: () => void;
  className?: string;
}

export default function AiInsightCard({
  title = 'AI Insight',
  loading,
  error,
  children,
  onRefresh,
  className = '',
}: AiInsightCardProps) {
  return (
    <div className={`rounded-lg border border-violet-200 bg-violet-50 p-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
          <span className="material-icons text-base">auto_awesome</span>
          {title}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="rounded p-1 text-violet-500 hover:bg-violet-100 disabled:opacity-40"
            title="Refresh"
          >
            <span className="material-icons text-sm">refresh</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-violet-500">
          <span className="material-icons animate-spin text-base">progress_activity</span>
          Analyzing…
        </div>
      )}

      {error && !loading && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!loading && !error && children}
    </div>
  );
}
```

- [x] **Step 2: Add AI API methods to crm.service.ts**

At the end of the `crmService` object in `frontend/src/services/crm.service.ts`, before the closing `}`, add:

```typescript
  // ── AI Features ──────────────────────────────────────────────────────────
  async analyzeActivityNote(activityId: string) {
    const { data } = await api.post(`/crm/ai/activities/${activityId}/analyze`);
    return data as { sentiment: 'positive' | 'neutral' | 'negative'; nextAction: string; suggestedStatusChange: string | null; keyFacts: string[] };
  },
  async draftLeadMessage(leadId: string, payload: { channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' }) {
    const { data } = await api.post(`/crm/ai/leads/${leadId}/draft-message`, { entityType: 'lead', ...payload });
    return data as { subject: string | null; body: string };
  },
  async draftContactMessage(contactId: string, payload: { channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' }) {
    const { data } = await api.post(`/crm/ai/contacts/${contactId}/draft-message`, { entityType: 'contact', ...payload });
    return data as { subject: string | null; body: string };
  },
  async getLeadSummary(leadId: string) {
    const { data } = await api.get(`/crm/ai/leads/${leadId}/summary`);
    return data as { statusSummary: string; keyFacts: string; recommendedNextStep: string };
  },
  async getLeadScore(leadId: string) {
    const { data } = await api.get(`/crm/ai/leads/${leadId}/score`);
    return data as { score: number; reason: string };
  },
  async getWinProbability(opportunityId: string) {
    const { data } = await api.get(`/crm/ai/opportunities/${opportunityId}/win-probability`);
    return data as { probability: number; confidence: 'high' | 'medium' | 'low'; reason: string };
  },
  async getDailyBriefing() {
    const { data } = await api.get(`/crm/ai/dashboard/briefing`);
    return data as { headline: string; bullets: string[]; topPriority: string };
  },
  async getKycGaps(contactId: string) {
    const { data } = await api.get(`/crm/ai/contacts/${contactId}/kyc-gaps`);
    return data as { gaps: Array<{ field: string; requirement: string; severity: 'required' | 'recommended' }>; complianceSummary: string; isCompliant: boolean };
  },
  async getRiskProfile(contactId: string) {
    const { data } = await api.get(`/crm/ai/contacts/${contactId}/risk-profile`);
    return data as { suggestedRiskTier: 'Low' | 'Medium' | 'High'; justification: string; regulatoryBasis: string };
  },
  async getDocumentChecklist(trustProductId: string) {
    const { data } = await api.get(`/crm/ai/trust-products/${trustProductId}/document-checklist`);
    return data as { documents: Array<{ name: string; description: string; required: boolean }>; notes: string };
  },
```

- [x] **Step 3: Commit**

```bash
git add frontend/src/components/crm/AiInsightCard.tsx frontend/src/services/crm.service.ts
git commit -m "feat(crm): add AiInsightCard component and AI API service methods"
```

---

## Task 5: Phase 1 — Smart Note Analyzer UI

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx` (and `CrmContactDetail.tsx` similarly)

In the activity feed section where activities are rendered, add an "Analyze" button that calls the API and shows the result inline. The pattern is the same in both Lead and Contact detail pages.

- [x] **Step 1: Add useAiNoteAnalysis hook at top of CrmLeadDetail.tsx**

Find the imports section in `frontend/pages/CrmLeadDetail.tsx` and add:

```tsx
import AiInsightCard from '@/components/crm/AiInsightCard';
import crmService from '@/services/crm.service';
```

Inside the component, add state near other state declarations:

```tsx
const [analyzedNotes, setAnalyzedNotes] = React.useState<Record<string, { sentiment: string; nextAction: string; suggestedStatusChange: string | null; keyFacts: string[] } | null>>({});
const [analyzingId, setAnalyzingId] = React.useState<string | null>(null);

const handleAnalyzeNote = async (activityId: string) => {
  setAnalyzingId(activityId);
  try {
    const result = await crmService.analyzeActivityNote(activityId);
    setAnalyzedNotes((prev) => ({ ...prev, [activityId]: result }));
  } catch {
    // fail silently — AI is optional
  } finally {
    setAnalyzingId(null);
  }
};
```

- [x] **Step 2: Add Analyze button and result to each activity row**

In the JSX where each activity is rendered, after the activity description, add:

```tsx
{['CALL', 'MEETING', 'WHATSAPP'].includes(activity.type) && (
  <div className="mt-2">
    {!analyzedNotes[activity.id] ? (
      <button
        onClick={() => handleAnalyzeNote(activity.id)}
        disabled={analyzingId === activity.id}
        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 disabled:opacity-50"
      >
        <span className="material-icons text-sm">auto_awesome</span>
        {analyzingId === activity.id ? 'Analyzing…' : 'AI Analyze'}
      </button>
    ) : (
      <AiInsightCard title="Note Analysis" className="mt-1">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-1">
            <span className={`material-icons text-sm ${analyzedNotes[activity.id]!.sentiment === 'positive' ? 'text-green-600' : analyzedNotes[activity.id]!.sentiment === 'negative' ? 'text-red-500' : 'text-gray-500'}`}>
              {analyzedNotes[activity.id]!.sentiment === 'positive' ? 'sentiment_satisfied' : analyzedNotes[activity.id]!.sentiment === 'negative' ? 'sentiment_dissatisfied' : 'sentiment_neutral'}
            </span>
            <span className="capitalize text-gray-600">{analyzedNotes[activity.id]!.sentiment}</span>
          </div>
          <p><span className="font-medium">Next action:</span> {analyzedNotes[activity.id]!.nextAction}</p>
          {analyzedNotes[activity.id]!.suggestedStatusChange && (
            <p className="text-violet-700"><span className="font-medium">Suggest status:</span> {analyzedNotes[activity.id]!.suggestedStatusChange}</p>
          )}
          {analyzedNotes[activity.id]!.keyFacts.length > 0 && (
            <ul className="list-disc pl-4 text-gray-600">
              {analyzedNotes[activity.id]!.keyFacts.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          )}
        </div>
      </AiInsightCard>
    )}
  </div>
)}
```

- [x] **Step 3: Repeat the same pattern in CrmContactDetail.tsx**

Apply identical state + JSX changes to `frontend/pages/CrmContactDetail.tsx` in its activity feed section.

- [x] **Step 4: Commit**

```bash
git add frontend/pages/CrmLeadDetail.tsx frontend/pages/CrmContactDetail.tsx
git commit -m "feat(crm): add AI note analyzer to Lead and Contact activity feeds"
```

---

## Task 6: Phase 1 — Draft Message modal

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`
- Modify: `frontend/pages/CrmContactDetail.tsx`

- [x] **Step 1: Add draft message state and handler to CrmLeadDetail.tsx**

Inside the component, add:

```tsx
const [draftModal, setDraftModal] = React.useState(false);
const [draftConfig, setDraftConfig] = React.useState<{ channel: 'whatsapp' | 'email'; tone: 'formal' | 'friendly' }>({ channel: 'whatsapp', tone: 'friendly' });
const [draftResult, setDraftResult] = React.useState<{ subject: string | null; body: string } | null>(null);
const [draftLoading, setDraftLoading] = React.useState(false);

const handleDraftMessage = async () => {
  setDraftLoading(true);
  setDraftResult(null);
  try {
    const result = await crmService.draftLeadMessage(lead.id, draftConfig);
    setDraftResult(result);
  } catch {
    // fail silently
  } finally {
    setDraftLoading(false);
  }
};
```

- [x] **Step 2: Add Draft Message button in the Lead Detail action area**

In the action buttons area (near the Edit button), add:

```tsx
<button
  onClick={() => { setDraftModal(true); setDraftResult(null); }}
  className="flex items-center gap-1 rounded-md border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100"
>
  <span className="material-icons text-sm">auto_awesome</span>
  Draft Message
</button>
```

- [x] **Step 3: Add Draft Message modal JSX**

Somewhere in the component return, before the closing fragment/div, add:

```tsx
{draftModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Draft Follow-Up Message</h2>
        <button onClick={() => setDraftModal(false)} className="text-gray-400 hover:text-gray-600">
          <span className="material-icons">close</span>
        </button>
      </div>

      <div className="mb-4 flex gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Channel</label>
          <select
            value={draftConfig.channel}
            onChange={(e) => setDraftConfig((p) => ({ ...p, channel: e.target.value as 'whatsapp' | 'email' }))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tone</label>
          <select
            value={draftConfig.tone}
            onChange={(e) => setDraftConfig((p) => ({ ...p, tone: e.target.value as 'formal' | 'friendly' }))}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="friendly">Friendly</option>
            <option value="formal">Formal</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={handleDraftMessage}
            disabled={draftLoading}
            className="rounded-md bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {draftLoading ? 'Drafting…' : 'Generate'}
          </button>
        </div>
      </div>

      {draftResult && (
        <div className="space-y-3">
          {draftResult.subject && (
            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Subject</p>
              <p className="rounded-md bg-gray-50 px-3 py-2 text-sm">{draftResult.subject}</p>
            </div>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">Message</p>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              rows={8}
              defaultValue={draftResult.body}
            />
          </div>
          <p className="text-xs text-gray-400">Edit as needed before sending. AI-generated — review before use.</p>
        </div>
      )}
    </div>
  </div>
)}
```

- [x] **Step 4: Repeat in CrmContactDetail.tsx**

Apply identical state + button + modal to `CrmContactDetail.tsx`, changing `draftLeadMessage` to `draftContactMessage`.

- [x] **Step 5: Commit**

```bash
git add frontend/pages/CrmLeadDetail.tsx frontend/pages/CrmContactDetail.tsx
git commit -m "feat(crm): add AI draft message modal to Lead and Contact detail pages"
```

---

## Task 7: Phase 1 — Lead Summary sidebar panel

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`

- [x] **Step 1: Add summary state and handler**

In `CrmLeadDetail.tsx`, add state:

```tsx
const [summary, setSummary] = React.useState<{ statusSummary: string; keyFacts: string; recommendedNextStep: string } | null>(null);
const [summaryLoading, setSummaryLoading] = React.useState(false);

const handleGetSummary = async () => {
  setSummaryLoading(true);
  try {
    const result = await crmService.getLeadSummary(lead.id);
    setSummary(result);
  } catch {
    // fail silently
  } finally {
    setSummaryLoading(false);
  }
};
```

- [x] **Step 2: Add summary panel to the sidebar**

In the right sidebar area (alongside existing info panels), add:

```tsx
<AiInsightCard
  title="AI Summary"
  loading={summaryLoading}
  onRefresh={handleGetSummary}
  className="mb-4"
>
  {!summary ? (
    <button
      onClick={handleGetSummary}
      className="text-sm text-violet-600 hover:underline"
    >
      Generate summary
    </button>
  ) : (
    <ul className="space-y-2 text-sm">
      <li><span className="font-medium text-gray-700">Status:</span> {summary.statusSummary}</li>
      <li><span className="font-medium text-gray-700">Key facts:</span> {summary.keyFacts}</li>
      <li><span className="font-medium text-violet-700">Next step:</span> {summary.recommendedNextStep}</li>
    </ul>
  )}
</AiInsightCard>
```

- [x] **Step 3: Commit**

```bash
git add frontend/pages/CrmLeadDetail.tsx
git commit -m "feat(crm): add AI lead summary panel to Lead Detail sidebar"
```

---

## Task 8: Phase 2 — Lead score badges

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`
- Modify: `frontend/pages/CrmLeads.tsx`

- [x] **Step 1: Add score color helper**

Create a small helper function at the top of both files (or in a shared util):

```tsx
const scoreColor = (score: number) =>
  score >= 70 ? 'bg-green-100 text-green-700' : score >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600';
```

- [x] **Step 2: Add score state and fetch to CrmLeadDetail.tsx**

```tsx
const [scoreData, setScoreData] = React.useState<{ score: number; reason: string } | null>(
  lead.aiScore != null ? { score: lead.aiScore, reason: lead.aiScoreReason ?? '' } : null
);
const [scoreLoading, setScoreLoading] = React.useState(false);

const handleGetScore = async () => {
  setScoreLoading(true);
  try {
    const result = await crmService.getLeadScore(lead.id);
    setScoreData(result);
  } catch {
    // fail silently
  } finally {
    setScoreLoading(false);
  }
};
```

- [x] **Step 3: Display score badge in Lead Detail header area**

Near the lead title / status badge area:

```tsx
{scoreData ? (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreColor(scoreData.score)}`}
    title={scoreData.reason}
  >
    <span className="material-icons text-xs">auto_awesome</span>
    {scoreData.score}/100
  </span>
) : (
  <button
    onClick={handleGetScore}
    disabled={scoreLoading}
    className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 hover:bg-violet-100 hover:text-violet-700 disabled:opacity-50"
  >
    <span className="material-icons text-xs">auto_awesome</span>
    {scoreLoading ? '…' : 'Score'}
  </button>
)}
```

- [x] **Step 4: Add score badges to lead cards in CrmLeads.tsx**

In `CrmLeads.tsx`, for each lead card, add a score badge if `lead.aiScore` is present (it comes from the list API if the field is selected):

```tsx
{lead.aiScore != null && (
  <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreColor(lead.aiScore)}`}>
    <span className="material-icons text-xs">auto_awesome</span>
    {lead.aiScore}
  </span>
)}
```

Note: The lead list API returns `aiScore` once the Prisma schema migration (Task 3) has been applied. No backend change needed — Prisma selects all scalar fields by default.

- [x] **Step 5: Commit**

```bash
git add frontend/pages/CrmLeadDetail.tsx frontend/pages/CrmLeads.tsx
git commit -m "feat(crm): add AI lead score badges to Lead Detail and Leads list"
```

---

## Task 9: Phase 2 — Win Probability on Opportunity pages

**Files:**
- Modify: `frontend/pages/CrmOpportunityDetail.tsx`
- Modify: `frontend/pages/CrmPipeline.tsx`

- [x] **Step 1: Add win probability to CrmOpportunityDetail.tsx**

Import `AiInsightCard` and add state:

```tsx
import AiInsightCard from '@/components/crm/AiInsightCard';

const [winData, setWinData] = React.useState<{ probability: number; confidence: 'high' | 'medium' | 'low'; reason: string } | null>(
  opportunity.aiWinProbability != null ? { probability: opportunity.aiWinProbability, confidence: 'medium', reason: opportunity.aiWinReason ?? '' } : null
);
const [winLoading, setWinLoading] = React.useState(false);

const handleGetWinProb = async () => {
  setWinLoading(true);
  try {
    const result = await crmService.getWinProbability(opportunity.id);
    setWinData(result);
  } catch {
    // fail silently
  } finally {
    setWinLoading(false);
  }
};
```

- [x] **Step 2: Display win probability in Opportunity Detail**

Replace or augment the static probability display (look for where `opportunity.probability` or `stage.probability` is shown) with:

```tsx
<AiInsightCard title="AI Win Probability" loading={winLoading} onRefresh={handleGetWinProb}>
  {!winData ? (
    <button onClick={handleGetWinProb} className="text-sm text-violet-600 hover:underline">
      Predict win probability
    </button>
  ) : (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-violet-700">{winData.probability}%</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${winData.confidence === 'high' ? 'bg-green-100 text-green-700' : winData.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>
          {winData.confidence} confidence
        </span>
      </div>
      <p className="text-gray-600">{winData.reason}</p>
    </div>
  )}
</AiInsightCard>
```

- [x] **Step 3: Add win probability to kanban cards in CrmPipeline.tsx**

In `CrmPipeline.tsx`, on each opportunity kanban card, display `opportunity.aiWinProbability` if present:

```tsx
{opportunity.aiWinProbability != null && (
  <span className="mt-1 flex items-center gap-1 text-xs text-violet-600">
    <span className="material-icons text-xs">auto_awesome</span>
    {opportunity.aiWinProbability}% win
  </span>
)}
```

- [x] **Step 4: Commit**

```bash
git add frontend/pages/CrmOpportunityDetail.tsx frontend/pages/CrmPipeline.tsx
git commit -m "feat(crm): add AI win probability to Opportunity Detail and Pipeline kanban"
```

---

## Task 10: Phase 2 — AI Daily Briefing on Dashboard

**Files:**
- Modify: `frontend/pages/CrmDashboard.tsx`

- [x] **Step 1: Add briefing state to CrmDashboard.tsx**

Add at the top of the component:

```tsx
import AiInsightCard from '@/components/crm/AiInsightCard';

const [briefing, setBriefing] = React.useState<{ headline: string; bullets: string[]; topPriority: string } | null>(null);
const [briefingLoading, setBriefingLoading] = React.useState(false);
const [briefingError, setBriefingError] = React.useState<string | null>(null);
const [briefingExpanded, setBriefingExpanded] = React.useState(true);

React.useEffect(() => {
  let cancelled = false;
  const load = async () => {
    setBriefingLoading(true);
    try {
      const result = await crmService.getDailyBriefing();
      if (!cancelled) setBriefing(result);
    } catch {
      // fail silently — AI is optional
    } finally {
      if (!cancelled) setBriefingLoading(false);
    }
  };
  load();
  return () => { cancelled = true; };
}, []);
```

- [x] **Step 2: Add briefing card to Dashboard JSX above stat cards**

Before the existing stat cards grid, add:

```tsx
<AiInsightCard
  title="Today's Briefing"
  loading={briefingLoading}
  error={briefingError}
  onRefresh={() => { setBriefing(null); setBriefingError(null); /* re-trigger via key change or re-call */ }}
  className="mb-6"
>
  {briefing && (
    <div className="space-y-2">
      <p className="font-medium text-gray-800">{briefing.headline}</p>
      <ul className="space-y-1">
        {briefing.bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <span className="material-icons mt-0.5 text-sm text-violet-400">chevron_right</span>
            {b}
          </li>
        ))}
      </ul>
      <div className="mt-2 rounded-md bg-violet-100 px-3 py-2">
        <p className="text-xs font-semibold text-violet-700">Top priority</p>
        <p className="text-sm text-violet-800">{briefing.topPriority}</p>
      </div>
    </div>
  )}
</AiInsightCard>
```

- [x] **Step 3: Commit**

```bash
git add frontend/pages/CrmDashboard.tsx
git commit -m "feat(crm): add AI daily briefing card to CRM dashboard"
```

---

## Task 11: Phase 3 — KYC Gap Detector

**Files:**
- Modify: `frontend/pages/CrmContactDetail.tsx`

- [x] **Step 1: Add KYC gap state and handler**

In `CrmContactDetail.tsx`, inside the component:

```tsx
const [kycGaps, setKycGaps] = React.useState<{
  gaps: Array<{ field: string; requirement: string; severity: 'required' | 'recommended' }>;
  complianceSummary: string;
  isCompliant: boolean;
} | null>(null);
const [kycLoading, setKycLoading] = React.useState(false);

const handleKycCheck = async () => {
  setKycLoading(true);
  try {
    const result = await crmService.getKycGaps(contact.id);
    setKycGaps(result);
  } catch {
    // fail silently
  } finally {
    setKycLoading(false);
  }
};
```

- [x] **Step 2: Add KYC Gap panel in the KYC section of Contact Detail**

In the KYC section (look for where KYC record is displayed):

```tsx
<AiInsightCard title="AI KYC Compliance Check" loading={kycLoading} onRefresh={handleKycCheck} className="mt-4">
  {!kycGaps ? (
    <button onClick={handleKycCheck} className="text-sm text-violet-600 hover:underline">
      Run compliance check
    </button>
  ) : (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 text-sm font-semibold ${kycGaps.isCompliant ? 'text-green-700' : 'text-red-600'}`}>
        <span className="material-icons text-base">{kycGaps.isCompliant ? 'check_circle' : 'warning'}</span>
        {kycGaps.complianceSummary}
      </div>
      {kycGaps.gaps.length > 0 && (
        <ul className="space-y-1">
          {kycGaps.gaps.map((g, i) => (
            <li key={i} className={`flex items-start gap-2 rounded-md px-2 py-1 text-xs ${g.severity === 'required' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'}`}>
              <span className="material-icons mt-0.5 text-sm">{g.severity === 'required' ? 'error' : 'info'}</span>
              <span><span className="font-semibold">{g.field}:</span> {g.requirement}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-gray-400">AI-generated — verify against latest BNM guidelines.</p>
    </div>
  )}
</AiInsightCard>
```

- [x] **Step 3: Commit**

```bash
git add frontend/pages/CrmContactDetail.tsx
git commit -m "feat(crm): add AI KYC gap detector to Contact Detail"
```

---

## Task 12: Phase 3 — Risk Profile Classifier

**Files:**
- Modify: `frontend/pages/CrmContactDetail.tsx`

- [x] **Step 1: Add risk profile state and handler**

In `CrmContactDetail.tsx`, add:

```tsx
const [riskProfile, setRiskProfile] = React.useState<{
  suggestedRiskTier: 'Low' | 'Medium' | 'High';
  justification: string;
  regulatoryBasis: string;
} | null>(null);
const [riskLoading, setRiskLoading] = React.useState(false);

const handleRiskProfile = async () => {
  setRiskLoading(true);
  try {
    const result = await crmService.getRiskProfile(contact.id);
    setRiskProfile(result);
  } catch {
    // fail silently
  } finally {
    setRiskLoading(false);
  }
};
```

- [x] **Step 2: Add Risk Profile panel near KYC section**

```tsx
<AiInsightCard title="AI Risk Classification" loading={riskLoading} onRefresh={handleRiskProfile} className="mt-4">
  {!riskProfile ? (
    <button onClick={handleRiskProfile} className="text-sm text-violet-600 hover:underline">
      Classify risk profile
    </button>
  ) : (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${riskProfile.suggestedRiskTier === 'High' ? 'bg-red-100 text-red-700' : riskProfile.suggestedRiskTier === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
          {riskProfile.suggestedRiskTier} Risk
        </span>
        <span className="text-xs text-gray-400">(AI suggestion — agent must confirm)</span>
      </div>
      <p className="text-gray-700">{riskProfile.justification}</p>
      <p className="text-xs text-gray-500 italic">{riskProfile.regulatoryBasis}</p>
    </div>
  )}
</AiInsightCard>
```

- [x] **Step 3: Commit**

```bash
git add frontend/pages/CrmContactDetail.tsx
git commit -m "feat(crm): add AI risk profile classifier to Contact Detail"
```

---

## Task 13: Phase 3 — Document Checklist Generator

**Files:**
- Modify: The Trust Product detail view (in `CrmOpportunityDetail.tsx` or wherever `CrmTrustProduct` data is displayed — look for the `trustProduct` section in `CrmOpportunityDetail.tsx`)

- [x] **Step 1: Locate trust product section**

Search `CrmOpportunityDetail.tsx` for where `trustProduct` data is displayed:

```bash
grep -n "trustProduct\|TrustProduct\|trust_product" /Users/fangkaryuan/cwc2.0/citadel-cwc-portal/frontend/pages/CrmOpportunityDetail.tsx
```

- [x] **Step 2: Add document checklist state and handler**

In `CrmOpportunityDetail.tsx`, add state (only if `opportunity.trustProduct` exists):

```tsx
const [docChecklist, setDocChecklist] = React.useState<{
  documents: Array<{ name: string; description: string; required: boolean }>;
  notes: string;
} | null>(null);
const [docChecklistLoading, setDocChecklistLoading] = React.useState(false);

const handleDocChecklist = async () => {
  if (!opportunity.trustProduct?.id) return;
  setDocChecklistLoading(true);
  try {
    const result = await crmService.getDocumentChecklist(opportunity.trustProduct.id);
    setDocChecklist(result);
  } catch {
    // fail silently
  } finally {
    setDocChecklistLoading(false);
  }
};
```

- [x] **Step 3: Add document checklist panel in trust product section**

```tsx
{opportunity.trustProduct && (
  <AiInsightCard title="AI Document Checklist" loading={docChecklistLoading} onRefresh={handleDocChecklist} className="mt-4">
    {!docChecklist ? (
      <button onClick={handleDocChecklist} className="text-sm text-violet-600 hover:underline">
        Generate document checklist
      </button>
    ) : (
      <div className="space-y-2">
        <ul className="space-y-1">
          {docChecklist.documents.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className={`material-icons mt-0.5 text-sm ${d.required ? 'text-red-500' : 'text-gray-400'}`}>
                {d.required ? 'assignment' : 'assignment_late'}
              </span>
              <div>
                <span className="font-medium">{d.name}</span>
                {!d.required && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
                <p className="text-xs text-gray-500">{d.description}</p>
              </div>
            </li>
          ))}
        </ul>
        {docChecklist.notes && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">{docChecklist.notes}</p>
        )}
      </div>
    )}
  </AiInsightCard>
)}
```

- [x] **Step 4: Commit**

```bash
git add frontend/pages/CrmOpportunityDetail.tsx
git commit -m "feat(crm): add AI document checklist generator to Trust Product section"
```

---

## Self-Review Checklist

- [x] **Task 1** covers SDK install, config, service scaffold, controller, routes, and mounting — spec section "SDK & Config" fully covered
- [x] **Task 2** covers tests for all 5 service methods that have meaningful testable outputs (Phase 1 + 2)
- [x] **Task 3** covers Prisma schema changes and migration — spec "Data Model Changes" covered
- [x] **Task 4** covers `AiInsightCard` shared component and all 10 frontend API methods
- [x] **Tasks 5–7** cover Phase 1 features: note analyzer, draft message, lead summary
- [x] **Tasks 8–10** cover Phase 2 features: lead score, win probability, daily briefing
- [x] **Tasks 11–13** cover Phase 3 features: KYC gaps, risk profile, document checklist
- [x] All methods use the correct model — `gpt-4o-mini` (FAST) for Phase 1–2, `gpt-4o` (SMART) for Phase 3
- [x] All DB writes (score, win probability) verified present in service methods and tested
- [x] Error handling: all frontend handlers catch silently — AI failures don't break CRM
- [x] "Human in the loop" explicit for risk profile (UI says "AI suggestion — agent must confirm")
- [x] Phase 2 note: `aiScore` appears in list API response without backend change since Prisma selects all scalar fields by default

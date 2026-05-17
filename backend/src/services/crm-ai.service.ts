import OpenAI from 'openai';
import { config } from '../config';
import prisma from '../utils/prisma';

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

Activity type: ${activity.activityType}
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
        activities: { orderBy: { createdAt: 'desc' }, take: 1, select: { subject: true, description: true, activityType: true } },
        contact: { select: { firstName: true, lastName: true, preferredLanguage: true } },
      },
    });
    name = lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName}` : lead.contactName || 'Valued Client';
    company = lead.companyName || '';
    preferredLanguage = lead.contact?.preferredLanguage || 'English';
    lastActivitySummary = lead.activities[0]
      ? `${lead.activities[0].activityType}: ${lead.activities[0].subject} — ${lead.activities[0].description || ''}`
      : 'No prior contact';
    opportunityContext = `Lead: "${lead.title}" (value: MYR ${lead.estimatedValue ?? 'unknown'})`;
  } else {
    const contact = await prisma.crmContact.findUniqueOrThrow({
      where: { id: entityId },
      include: {
        activities: { orderBy: { createdAt: 'desc' }, take: 1, select: { subject: true, description: true, activityType: true } },
        opportunities: { orderBy: { createdAt: 'desc' }, take: 1, select: { name: true, stage: { select: { name: true } } } },
      },
    });
    name = `${contact.firstName} ${contact.lastName}`;
    company = '';
    preferredLanguage = contact.preferredLanguage || 'English';
    lastActivitySummary = contact.activities[0]
      ? `${contact.activities[0].activityType}: ${contact.activities[0].subject} — ${contact.activities[0].description || ''}`
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
      activities: { orderBy: { createdAt: 'desc' }, take: 30, select: { activityType: true, subject: true, description: true, createdAt: true } },
      notes: { orderBy: { createdAt: 'desc' }, take: 10, select: { content: true, createdAt: true } },
      contact: { select: { firstName: true, lastName: true } },
      owner: { select: { firstName: true, lastName: true } },
    },
  });

  const activitiesText = lead.activities
    .map((a) => `[${a.createdAt.toISOString().slice(0, 10)}] ${a.activityType}: ${a.subject} — ${a.description || ''}`)
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
Risk classification: ${kyc?.riskLevel ?? 'NOT_SET'}
PEP flag: ${kyc?.isPep ?? 'NOT_SET'}
Source of funds: ${kyc?.sourceOfFundsVerified ? 'documented' : 'MISSING'}
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
Source of funds: ${kyc?.sourceOfFundsVerified ? 'documented' : 'not documented'}
PEP: ${kyc?.isPep ? 'YES — Politically Exposed Person' : 'No'}
Existing risk classification: ${kyc?.riskLevel ?? 'none'}

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
      contact: { select: { id: true } },
    },
  });

  // Count beneficiaries via the contact relation (beneficiaries belong to contacts)
  const beneficiaryCount = trustProduct.contact
    ? await prisma.crmBeneficiary.count({ where: { contactId: trustProduct.contact.id } })
    : 0;

  const clientType = trustProduct.opportunity?.account?.accountType ?? 'INDIVIDUAL';
  const contactName = trustProduct.opportunity?.contact
    ? `${trustProduct.opportunity.contact.firstName} ${trustProduct.opportunity.contact.lastName}`
    : trustProduct.contact?.id ?? 'Unknown';

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
Client: ${contactName}
Number of beneficiaries: ${beneficiaryCount}
Asset value: MYR ${trustProduct.assetValue ?? 'unknown'}

Return JSON: { "documents": [{ "name": string, "description": string (what this doc is for), "required": boolean }], "notes": string (any special requirements or caveats for this trust setup) }`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return JSON.parse(raw);
}

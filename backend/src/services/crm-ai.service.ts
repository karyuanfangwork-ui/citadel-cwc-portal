import OpenAI from 'openai';
import { config } from '../config';
import prisma from '../utils/prisma';
import { AppError } from '../middleware/error.middleware';

// Lazy-initialize the OpenAI client so the server starts even without
// OPENAI_API_KEY set. The error surfaces only when an AI endpoint is called.
let _openai: OpenAI | null = null;
const getOpenAI = (): OpenAI => {
  if (!_openai) {
    if (!config.openai.apiKey) {
      throw new AppError('AI service is temporarily unavailable. Please try again later.', 503);
    }
    _openai = new OpenAI({ apiKey: config.openai.apiKey });
  }
  return _openai;
};

const FAST = 'gpt-4o-mini';
const SMART = 'gpt-4o';

// GPT sometimes wraps JSON in markdown fences despite instructions — strip them.
const parseJson = <T>(raw: string): T => {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
};

// ─── Phase 1: Agent Productivity ─────────────────────────────────────────────

export async function analyzeActivityNote(activityId: string): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  nextAction: string;
  suggestedStatusChange: string | null;
  keyFacts: string[];
  suggestedFollowUpDays: number | null;
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

  const response = await getOpenAI().chat.completions.create({
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
- suggestedFollowUpDays: number | null (days from today to schedule a follow-up — e.g. 3, 5, 7 — only if a concrete follow-up is warranted based on the note content, else null)

Activity type: ${activity.activityType}
Subject: ${activity.subject}
Notes: ${activity.description || '(no notes)'}
Context: ${entityContext}`,
      },
    ],
  });

  const raw = response.choices[0].message.content!;
  return parseJson(raw);
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

  const response = await getOpenAI().chat.completions.create({
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
  return parseJson(raw);
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

  const response = await getOpenAI().chat.completions.create({
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
  return parseJson(raw);
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

  const response = await getOpenAI().chat.completions.create({
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
  const result = parseJson<any>(raw);

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

  const response = await getOpenAI().chat.completions.create({
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
  const result = parseJson<any>(raw);

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

  const response = await getOpenAI().chat.completions.create({
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
  return parseJson(raw);
}

// ─── Phase 3: Win/Loss Debrief ────────────────────────────────────────────────

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

  const wlResponse = await getOpenAI().chat.completions.create({
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

  return parseJson(wlResponse.choices[0].message.content!);
}

export async function getNextBestAction(entityType: string, entityId: string): Promise<{
  actions: Array<{ action: string; priority: 'high' | 'medium' | 'low'; reason: string }>;
}> {
  const VALID_TYPES = ['lead', 'contact', 'account', 'opportunity'];
  if (!VALID_TYPES.includes(entityType)) {
    throw new AppError(`Invalid entityType "${entityType}". Must be one of: ${VALID_TYPES.join(', ')}`, 400);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  // Fetch entity details
  let statusField = '';
  let entityName = '';

  if (entityType === 'lead') {
    const lead = await prisma.crmLead.findUniqueOrThrow({ where: { id: entityId } });
    statusField = lead.status;
    entityName = lead.title;
  } else if (entityType === 'contact') {
    const contact = await prisma.crmContact.findUniqueOrThrow({ where: { id: entityId } });
    statusField = contact.isActive ? 'Active' : 'Inactive';
    entityName = `${contact.firstName} ${contact.lastName}`;
  } else if (entityType === 'account') {
    const account = await prisma.crmAccount.findUniqueOrThrow({ where: { id: entityId } });
    statusField = account.isActive ? 'Active' : 'Inactive';
    entityName = account.name;
  } else {
    const opp = await prisma.crmOpportunity.findUniqueOrThrow({
      where: { id: entityId },
      include: { stage: { select: { name: true } } },
    });
    statusField = opp.stage.name;
    entityName = opp.name;
  }

  // Fetch recent activities for the entity (last 7 days)
  const activityWhere: any = {
    createdAt: { gte: sevenDaysAgo },
  };
  if (entityType === 'lead') activityWhere.leadId = entityId;
  else if (entityType === 'contact') activityWhere.contactId = entityId;
  else if (entityType === 'account') activityWhere.accountId = entityId;
  else activityWhere.opportunityId = entityId;

  const recentActivities = await prisma.crmActivity.findMany({
    where: activityWhere,
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { activityType: true, subject: true, createdAt: true },
  });

  // Calculate days since last contact
  const lastActivity = await prisma.crmActivity.findFirst({
    where: { ...activityWhere, createdAt: undefined },  // remove date filter for "last ever"
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  const daysSinceLastContact = lastActivity
    ? Math.floor((Date.now() - lastActivity.createdAt.getTime()) / 86400000)
    : 999;

  const activitySummary = recentActivities.length > 0
    ? recentActivities.map(a => `${a.activityType}: ${a.subject}`).join('; ')
    : 'No activities in last 7 days';

  const ALLOWED_ACTIONS = [
    'Call within 24h',
    'Send follow-up email',
    'Schedule meeting',
    'Update value estimate',
    'Review risk profile',
    'Send proposal',
    'Request documents',
  ];

  try {
    const response = await getOpenAI().chat.completions.create({
      model: FAST,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content: `You are a CRM sales assistant for a Malaysian trust and estate planning company. Suggest the next best actions for a sales rep. Return JSON only — no markdown.`,
        },
        {
          role: 'user',
          content: `Suggest 1-3 next best actions for this CRM entity.

Entity type: ${entityType}
Name: ${entityName}
Status/Phase: ${statusField}
Days since last contact: ${daysSinceLastContact}
Recent activity (last 7 days): ${activitySummary}

Choose 1-3 actions ONLY from this list: ${ALLOWED_ACTIONS.join(', ')}

Return JSON: { "actions": [{ "action": string (must be from the allowed list), "priority": "high"|"medium"|"low", "reason": string (1 sentence) }] }`,
        },
      ],
    });

    const raw = response.choices[0].message.content!;
    return parseJson(raw);
  } catch (err) {
    // Fallback: return sensible defaults based on rules
    const actions: Array<{ action: string; priority: 'high' | 'medium' | 'low'; reason: string }> = [];

    if (daysSinceLastContact > 7) {
      actions.push({ action: 'Call within 24h', priority: 'high', reason: `No contact in ${daysSinceLastContact} days — immediate follow-up required` });
    }
    if (daysSinceLastContact > 3) {
      actions.push({ action: 'Send follow-up email', priority: 'medium', reason: 'Follow-up email to re-engage since no recent contact' });
    }
    if (entityType === 'opportunity' && (statusField === 'Proposal' || statusField === 'Negotiation')) {
      actions.push({ action: 'Send proposal', priority: 'high', reason: `Opportunity is in ${statusField} stage` });
    }
    if (entityType === 'lead' && statusField === 'QUALIFIED') {
      actions.push({ action: 'Schedule meeting', priority: 'high', reason: 'Lead is qualified — schedule a discovery meeting' });
    }
    if (actions.length === 0) {
      actions.push({ action: 'Schedule meeting', priority: 'medium', reason: 'Regular check-in to maintain relationship' });
    }

    return { actions };
  }
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

  const response = await getOpenAI().chat.completions.create({
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
  return parseJson(raw);
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

  const response = await getOpenAI().chat.completions.create({
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
  return parseJson(raw);
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

  const response = await getOpenAI().chat.completions.create({
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
  return parseJson(raw);
}

// ─── Phase 3: Manager Intelligence ───────────────────────────────────────────

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

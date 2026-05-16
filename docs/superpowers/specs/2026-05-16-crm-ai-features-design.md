# CRM AI Features — Design Spec
**Date:** 2026-05-16
**Author:** KY + Claude Code
**Status:** Approved

---

## Overview

Add an AI intelligence layer to the CWC CRM module using the Anthropic Claude API (`@anthropic-ai/sdk`). Nine features delivered across three phases: agent productivity, sales intelligence, and compliance assistance.

**Prerequisite:** P0 routing bug (B1 in `CRM_AUDIT_FINDINGS.md`) must be fixed before Phase 1 — Lead Detail and Contact Detail pages must be reachable.

---

## Architecture

### Backend

A single `backend/src/services/crm-ai.service.ts` owns all Claude interactions.

```
crm-ai.service.ts
  ├── analyzeActivityNote(activityId)      → Phase 1
  ├── draftFollowUpMessage(entityId, type) → Phase 1
  ├── summarizeLead(leadId)               → Phase 1
  ├── scoreLead(leadId)                   → Phase 2
  ├── predictWinProbability(opportunityId)→ Phase 2
  ├── generateDailyBriefing(userId)       → Phase 2
  ├── detectKycGaps(contactId)            → Phase 3
  ├── classifyRiskProfile(contactId)      → Phase 3
  └── generateDocumentChecklist(trustId)  → Phase 3
```

Each method:
1. Fetches relevant CRM data from Prisma
2. Assembles a structured prompt with context
3. Calls `claude-haiku-4-5-20251001` (fast, low-cost) for structured outputs; `claude-sonnet-4-6` for complex reasoning (compliance phase)
4. Returns a typed response object

All AI calls are **on-demand** (triggered by user action or dashboard load) — not background jobs. Results are **not persisted** in Phase 1–2 except lead scores and win probability (written back as fields or a `CrmAiScore` table).

### New Routes

All under `/api/v1/crm/ai/`:

| Method | Path | Controller |
|---|---|---|
| POST | `/ai/activities/:id/analyze` | analyzeNote |
| POST | `/ai/leads/:id/draft-message` | draftMessage |
| GET | `/ai/leads/:id/summary` | leadSummary |
| GET | `/ai/leads/:id/score` | leadScore |
| GET | `/ai/opportunities/:id/win-probability` | winProbability |
| GET | `/ai/dashboard/briefing` | dailyBriefing |
| GET | `/ai/contacts/:id/kyc-gaps` | kycGaps |
| GET | `/ai/contacts/:id/risk-profile` | riskProfile |
| GET | `/ai/trust-products/:id/document-checklist` | docChecklist |

### Frontend

Each AI feature is a self-contained hook + UI component:

- `useAiLeadScore(leadId)` — fetches score, caches in component state
- `useAiWinProbability(opportunityId)`
- `useDailyBriefing()`
- AI result panels use a consistent `<AiInsightCard>` component (icon, confidence indicator, explanation text)
- "Draft Message" and "Summarize" are button-triggered modals

### Error Handling

All AI endpoints return gracefully if Claude is unavailable — features degrade silently (hide the AI component, log the error). AI failures never block core CRM functionality.

---

## Phase 1 — Agent Productivity

### Feature 1: Smart Note Analyzer

**Trigger:** After an agent saves a `CrmActivity` of type CALL, MEETING, or WHATSAPP.
**What Claude does:** Reads the activity note/description, extracts:
- Sentiment (positive / neutral / negative)
- Suggested next action (free text)
- Recommended lead/opportunity status change (optional)
- Key facts (names, amounts, dates mentioned)

**Output displayed:** Inline card below the saved activity in the Activity feed. Agent can accept the suggested status change with one click.

**Prompt context:** Activity subject, description, entity type (lead/opportunity), current status, contact name.

### Feature 2: Follow-up Draft Generator

**Trigger:** "Draft Message" button on Lead Detail and Contact Detail pages.
**Agent selects:** Channel (WhatsApp / Email) and tone (formal / friendly).
**What Claude does:** Writes a contextual outreach message using: contact name, last interaction summary, opportunity stage (if any), product interest (from lead/opportunity title).

**Output:** Modal with editable draft. Agent copies or edits before sending (no direct send integration in this phase).

**Prompt context:** Contact name, company, last activity date + summary, opportunity title + stage, preferred language (if set).

### Feature 3: Lead Activity Summary

**Trigger:** "Summarize" button on Lead Detail sidebar.
**What Claude does:** Reads all activities and notes for the lead (last 30, max), produces a 3-bullet executive brief:
- Current status and engagement level
- Key facts discussed
- Recommended next step

**Output:** Collapsible panel in Lead Detail sidebar. Cached for the session (re-fetch on demand).

**Prompt context:** Lead title, status, source, estimated value, all activities sorted by date, all notes.

---

## Phase 2 — Sales Intelligence

### Feature 4: Lead Scoring

**Trigger:** On-demand (GET button on Lead Detail) + batch on Leads list page load (scores fetched for visible leads).
**Score inputs:** Lead source, estimated value, days since created, activity count in last 14 days, lead status, contact completeness (has phone/email).
**Output:** Score 0–100 + one-sentence rationale. Displayed as a colored badge (🔴 <40, 🟡 40–70, 🟢 >70) on lead cards and Lead Detail.

**Storage:** Written to `CrmLead.aiScore` (Int?) and `CrmLead.aiScoreReason` (String?) — new Prisma fields, migration required.

### Feature 5: Win Probability

**Trigger:** On-demand on Opportunity Detail + displayed on kanban cards.
**Inputs:** Stage, days in current stage, days since last activity, activity count, deal value vs pipeline average, contact completeness, close date proximity.
**Output:** Probability % + "High/Medium/Low confidence" + 1-sentence reason. Replaces the static stage probability on the opportunity detail page.

**Storage:** Written to `CrmOpportunity.aiWinProbability` (Float?) + `CrmOpportunity.aiWinReason` (String?) — migration required.

### Feature 6: Actionable Daily Briefing

**Trigger:** `CrmDashboard` load (for the authenticated user).
**What Claude does:** Receives: user's open leads (count + overdue follow-ups), stale deals (no activity 7+ days), today's scheduled activities, top 3 opportunities by value. Generates a short prioritized briefing:
- "You have X follow-ups overdue"
- "Deal [Y] has been stalled for Z days — consider re-engaging"
- "Top priority today: [name] — [reason]"

**Output:** Collapsible "AI Briefing" card at the top of CrmDashboard, above the stat cards. Refreshes on page load, cached 15 min.

**Model:** `claude-haiku-4-5-20251001` (fast, low cost — this fires on every dashboard load).

---

## Phase 3 — Compliance Assist

**Model:** `claude-sonnet-4-6` for all compliance features — regulatory accuracy requires stronger reasoning.

### Feature 7: KYC Gap Detector

**Trigger:** Button on Contact Detail KYC section.
**What Claude does:** Reviews the contact's KYC record against a hardcoded BNM/AMLA checklist (NRIC, source of funds, risk tier, PEP flag, KYC expiry). Lists missing or expired fields with their regulatory basis.

**Output:** Checklist panel with ✅/❌ per item + a compliance summary sentence.

### Feature 8: Risk Profile Classifier

**Trigger:** Button on Contact Detail.
**What Claude does:** Given the contact's occupation, source of funds (from KYC), account type (individual/corporate), and any PEP flag — suggests risk tier (Low / Medium / High) with a written justification referencing BNM risk-based approach guidelines.

**Output:** Suggested tier badge + justification text. Agent must manually confirm and save (not auto-saved — human in the loop for compliance decisions).

### Feature 9: Document Checklist Generator

**Trigger:** Button on Trust Product Detail page.
**What Claude does:** Given trust type (Living Trust, Testamentary, Charitable), client type (individual/corporate), and beneficiary count — generates a tailored document checklist (e.g., trust deed, NRIC copies, beneficiary consent forms, asset schedule, witness requirements).

**Output:** Printable/copyable checklist modal. Not persisted — generated fresh each time.

---

## Data Model Changes (Prisma)

```prisma
model CrmLead {
  // new fields
  aiScore        Int?
  aiScoreReason  String?
  aiScoredAt     DateTime?
}

model CrmOpportunity {
  // new fields
  aiWinProbability  Float?
  aiWinReason       String?
  aiScoredAt        DateTime?
}
```

One migration required. No schema changes for Phase 1 or Phase 3 (results displayed inline, not stored).

---

## SDK & Config

- **Package:** `@anthropic-ai/sdk` added to `backend/package.json`
- **Env var:** `ANTHROPIC_API_KEY` added to `.env` and `backend/src/config/index.ts`
- **Models used:**
  - `claude-haiku-4-5-20251001` — Phase 1 + Phase 2 (fast, cheap, structured outputs)
  - `claude-sonnet-4-6` — Phase 3 compliance features (stronger reasoning)
- **Prompt caching:** Enable on system prompts that repeat across calls (lead scoring, KYC gap detection) using `cache_control: { type: "ephemeral" }`

---

## Effort Estimate

| Phase | Features | Dev Days |
|---|---|---|
| Setup (SDK, service scaffold, env config) | — | 0.5 |
| Phase 1 — Agent Productivity | 3 | 5–6 |
| Phase 2 — Sales Intelligence | 3 | 4–5 |
| Phase 3 — Compliance Assist | 3 | 4–5 |
| **Total** | **9 features** | **~14–16 days** |

**Prerequisite (not included above):** Fix P0 routing bug B1 (~1 day).

---

## Out of Scope

- Streaming chat assistant (can be Phase 4)
- Auto-sending drafted messages (requires WhatsApp/email API integration)
- AI training on company-specific data (uses general Claude knowledge)
- Batch nightly scoring jobs (on-demand only in this plan)

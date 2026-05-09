# CRM Guide Page — Design Spec
Date: 2026-05-09

## Overview

A dedicated in-app guide page (`/crm/guide`) that walks sales staff through the full CRM lead lifecycle — from creating a lead through to closing a deal. Audience is mixed: some staff are CRM-naive, others know CRM concepts but are new to this system. The page covers both conceptual orientation and system-specific steps.

## Goals

- Sales staff can self-onboard onto the CRM module without external documentation
- Staff understand every status, activity type, and action available to them
- Staff can follow the lead lifecycle end-to-end: create → contact → qualify → convert → close

## Non-Goals

- No interactive tour or tooltips on other pages
- No backend API calls — purely static content
- No printable PDF export (out of scope)

## Route & Navigation

- **Route:** `/crm/guide`
- **Permission:** `crm:read` (same as all other CRM pages)
- **Entry point:** A "How to Use the CRM" card/banner added to `CrmDashboard.tsx`, linking to `/crm/guide`
- **Route added to:** `frontend/App.tsx` alongside existing CRM routes

## Page Structure

Long scrollable page, no tabs or accordions. All content visible at once. Styled with existing brand tokens (Tailwind classes, `brand-700`, `text-text-primary`, `text-text-secondary`, Material Symbols icons) consistent with other CRM pages.

A sticky top navigation bar (anchor links) lets users jump to any section without losing their place.

---

### Section 1 — What Is the CRM?

Short intro (3–4 sentences): the CRM tracks potential clients from first contact to a closed deal. Two roles: sales reps manage their own leads and deals; managers see the team dashboard and reports. Everything is logged here so nothing falls through the cracks.

---

### Section 2 — Navigation Overview

A table listing each CRM section, its path, and its purpose:

| Section | Path | Purpose |
|---|---|---|
| Dashboard | `/crm` | Daily snapshot — active leads, overdue follow-ups, pipeline summary |
| Leads | `/crm/leads` | All prospects before they become deals |
| Pipeline | `/crm/pipeline` | Kanban board of active deals by stage |
| Opportunities | `/crm/opportunities` | List view of all deals |
| Contacts | `/crm/contacts` | Individual people you are in contact with |
| Accounts | `/crm/accounts` | Companies and organisations |
| Reports | `/crm/reports` | Performance analytics and team metrics |

---

### Section 3 — Step 1: Create a Lead

Where to go: `/crm/leads` → click "New Lead" button (top right).

Fields explained:
- **Title** *(required)* — prospect's name or a short description
- **Source** — how you found them (Website, Referral, Cold Call, Trade Show, LinkedIn, Advertisement, Partner, Other)
- **Company Name** — their organisation
- **Contact** — link to an existing Contact record if available
- **Estimated Value (MYR)** — your best guess at deal size
- **Follow-Up Date** — when you plan to next contact them
- **Notes** — anything else relevant at creation time

Click Save. The lead starts at status **NEW**.

---

### Section 4 — Step 2: The Lead Status Flow

Leads move through statuses as you work them. Update the status on the Lead Detail page.

```
NEW → CONTACTED → QUALIFIED → CONVERTED (to Deal)
                ↘ UNQUALIFIED
                            ↘ LOST (at any stage)
```

| Status | Meaning |
|---|---|
| NEW | Just created, not yet contacted |
| CONTACTED | You have reached out at least once |
| QUALIFIED | Budget confirmed, genuine interest, ready to pitch |
| UNQUALIFIED | Not a fit — wrong profile, no budget, no interest |
| CONVERTED | Lead has been converted to a Deal (locked) |
| LOST | Was qualified/contacted but deal fell through |

**Rule of thumb:** Move the status the same day something changes.

---

### Section 5 — Step 3: Log Every Touchpoint (Activities)

On the Lead Detail page, click **"Log Activity"** after every interaction. Choose the activity type:

| Type | When to use |
|---|---|
| CALL | Phone call made or received |
| EMAIL | Email sent or received |
| MEETING | In-person or video meeting |
| WHATSAPP | WhatsApp message or conversation |
| SITE_VISIT | You visited or they visited a site |
| FOLLOW_UP | Scheduled follow-up action |
| TASK | Any to-do item related to this lead |
| NOTE | General observation (no specific action) |

Fill in a description and an optional date. Activities appear in the **Activities** tab on the Lead Detail page in chronological order.

**Why log activities?** The activity log is your evidence trail. Managers can see it. If you hand a lead to a colleague, they see exactly what happened.

---

### Section 6 — Step 4: Add Notes

Notes are for context that doesn't fit an activity — e.g. "Client mentioned they are currently using a competitor" or "Decision maker is the CFO, not the person I spoke to."

Notes live in the **Notes** tab on the Lead Detail page. Add them any time.

**Activities vs Notes:** Log an activity when you *did* something. Write a note when you learned something.

---

### Section 7 — Step 5: Set Follow-Up Dates

Every open lead should have a follow-up date. Set it on the Lead Detail page (Overview tab → Follow-Up Date field).

The Leads list shows urgency badges:

| Badge | Meaning | Action |
|---|---|---|
| 🔴 Overdue | Follow-up date passed | Contact them today or reschedule |
| 🟡 Due Today | Follow-up is today | Reach out today |
| ⬜ Stale | No activity for 7+ days | Log an activity or close the lead |

Keeping these badges clear is the single most important daily habit in the CRM.

---

### Section 8 — Step 6: Qualify or Disqualify

When you have enough information to judge whether this lead is worth pursuing:

- **Mark QUALIFIED** if: you have spoken to the decision maker, they have confirmed interest and budget.
- **Mark UNQUALIFIED** if: they are not the right profile, have no budget, or are not interested.
- **Mark LOST** if: the lead was progressing but the deal has now fallen through. Add a lost reason in the notes.

Only QUALIFIED leads can be converted to a Deal.

---

### Section 9 — Step 7: Convert a Lead to a Deal

When a lead is QUALIFIED, the **"Convert to Deal"** button appears on the Lead Detail page.

Click it and fill in:
- **Pipeline** — which sales pipeline this deal belongs to (e.g. Cash Trust Pipeline)
- **Stage** — which stage the deal starts at
- **Deal Name** — auto-filled from the lead title, editable
- **Deal Value (MYR)** — the confirmed or estimated deal value

Click Convert. The lead is locked (status becomes CONVERTED) and a new **Opportunity** is created. A link to the Opportunity appears on the Lead Detail page.

---

### Section 10 — Step 8: Manage the Pipeline

Go to `/crm/pipeline` to see all active deals on a Kanban board, grouped by stage.

Each card shows: deal name, value, account, and days in current stage. Open a deal card to:
- Change its stage (move it forward or backward)
- Log activities and notes
- Update the deal value
- Link contacts

Move a deal to the next stage as soon as that milestone is reached. Do not leave deals sitting in a stage when they have progressed.

---

### Section 11 — Step 9: Close a Deal

On the Opportunity Detail page, when the deal reaches its final stage:

- **Won** — mark as Won and record the final value. The deal is archived as successful.
- **Lost** — mark as Lost and record a reason. This feeds the Reports page so the team can learn from losses.

Closed deals leave the active Pipeline view but remain searchable in Opportunities.

---

### Section 12 — Tips & Best Practices

- **Same-day rule:** Update the lead status and log an activity on the same day you make contact.
- **No stale leads:** Check the Leads list daily. Clear all Overdue and Due Today badges before lunch.
- **Every lead needs a follow-up date** unless it is Converted, Lost, or Unqualified.
- **Notes are not a substitute for activities:** Notes are invisible to automated reports. Activities are tracked.
- **Use Accounts and Contacts:** Link leads and opportunities to Contact and Account records. This gives a full history of your relationship with a company across multiple deals.
- **Check the Dashboard first:** Start every workday at `/crm`. The dashboard surfaces what needs your attention today.

---

## Implementation Notes

- New file: `frontend/pages/CrmGuide.tsx` — pure presentational component, no API calls
- Styled with Tailwind brand tokens consistent with `CrmDashboard.tsx`
- Uses Material Symbols icons (already loaded globally)
- Sticky anchor nav at top of page for quick section jumping
- Route: add `<Route path="/crm/guide" ... />` in `App.tsx`
- Entry point: add a "How to Use the CRM" card to `CrmDashboard.tsx`

## Effort Estimate

**Total: ~3–4 hours**
- `CrmGuide.tsx` page component: ~2.5 hours
- Route registration + dashboard entry card: ~30 minutes
- Review and polish: ~30 minutes

No backend work required. No migration. No new dependencies.

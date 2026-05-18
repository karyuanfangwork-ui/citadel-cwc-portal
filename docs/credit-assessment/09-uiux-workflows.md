# 09 — UI/UX & Workflow Recommendations

## 1. Persona journeys

### Relationship Manager (RM)
1. Open prospect from CRM → "Initiate Credit Application".
2. Wizard auto-fills borrower data from CRM Account/Contact.
3. Upload documents (drag/drop, multi-file; AV inline progress).
4. Track checklist progress live; submit when 100%.
5. Receive status notifications via SSE + email.

**Reduce clicks**: deep-link from CRM Opportunity; one-click "request missing docs" sends pre-templated email.

### Credit Analyst (CA)
1. Inbox of "ready for analysis" applications with SLA timer.
2. Open application → spreading workspace (OCR draft → editable grid).
3. Ratios panel updates live; AI red-flag chips surface inline.
4. Run scorecard → review breakdown → write narrative (AI draft optional).
5. Recommend, submit to checker.

**Smart autofill**: prior period auto-populated from last review; map memory remembers chart-of-accounts mapping per customer.

### Credit Manager / Senior / Committee
- **Inbox** with filters: rating, amount, age, risk.
- **One-page credit memo** view with collapsible sections: borrower, financials, ratios, scorecard, collateral, exposure, recommendation, conditions, AI summary (clearly labelled "advisory").
- Decision panel: Approve / Approve with conditions / Decline / Refer. Mandatory comments. Recusal banner if conflict detected.
- **Committee mode**: paper pack PDF, agenda, live voting screen, minutes drafted post-meeting.

### Risk / Portfolio Officer
- Portfolio dashboard (see §10).
- Watchlist board (Kanban: New → Reviewing → Action → Cleared).
- EWS alert centre with severity and source.

### Compliance Officer
- KYC clearance queue.
- Screening hit adjudication UI (side-by-side fields, evidence, decision capture).
- STR drafting workspace (controlled fields, immutable once filed).

### Executive
- KPI dashboard: pipeline value, decision turnaround, default rate, exception count, portfolio quality.

## 2. UX principles

- **Progressive disclosure** — show essentials, expand for detail.
- **Status before action** — every screen shows lifecycle state and next action.
- **Inline validation** — fail fast, explain why.
- **AI labelled** — every AI-derived UI element has an "AI suggestion" badge with tooltip naming model + version + last refresh.
- **No silent transitions** — every action gives an immediate confirmation toast and audit-trail timestamp.
- **Accessibility** — WCAG 2.2 AA target. Keyboard-complete flows.
- **Mobile-friendly read** — read-only views (committee paper, dashboard) responsive; data entry is desktop-first.
- **Dark mode** — optional.
- **Time-aware UI** — SLAs displayed as countdown chips; aged items highlighted.

## 3. Workflow efficiency recommendations

| Pain pattern | Recommendation |
|---|---|
| Re-keying CRM data | Deep-link + auto-import; "imported, edit if changed" banner |
| Manual document collection | System-driven checklist; templated request emails; client portal (later phase) |
| Slow back-and-forth | Inline comments at field level (resolvable threads) |
| Lost context across handoffs | Activity timeline pinned on every credit screen |
| Approval ping-pong | Maker-checker UI shows what changed since last submission |
| Committee paper packs | Auto-generated PDF; watermark; access log |

## 4. Form & validation patterns

- **Save draft** every 30s + on blur.
- **Required-by-stage** validation — only enforce at stage transition, not on save.
- **Smart defaults** from policy and prior cycles.
- **Numeric formatting** locale-aware (MYR, thousands separator).
- **File uploader**: shows AV status, MIME warning, version controls.

## 5. Notifications

- **SSE** for in-app real-time (existing infrastructure).
- **Email** for cross-system handoffs.
- **Digest** option (daily / weekly) per user.
- **Escalation** rules: SLA-near, SLA-breach.
- **Quiet hours** respect.

## 6. Information architecture (top-level nav additions)

```
CWC Portal
├─ Service Desk (existing)
├─ CRM (existing)
├─ Credit ▼  (NEW)
│   ├─ Pipeline
│   ├─ Applications
│   ├─ Borrowers
│   ├─ Decisions
│   ├─ Committee
│   ├─ Conditions Tracker
│   ├─ Portfolio
│   ├─ Watchlist
│   └─ Reports
├─ Compliance ▼
│   ├─ KYC Queue
│   ├─ Screening Hits
│   └─ Filings
├─ Admin (existing + Credit Policy, Approval Matrix)
```

## 7. Quick wireframe — Credit Memo (committee view)

```
┌───────────────────────────────────────────────────────────────────┐
│  ACME Sdn Bhd · App #CR-2026-00128   [ANALYSING]  SLA: 2d 04h    │
│  RM: Sara · Analyst: Jay · Checker: Lee · Committee: Tier 2       │
├───────────────────────────────────────────────────────────────────┤
│  Borrower    Facilities    Financials    Scorecard    Collateral │
│  Exposure    Conditions    Memo          Decisions    History    │
├───────────────────────────────────────────────────────────────────┤
│  Recommendation: APPROVE RM 3.5M term loan, 36m, 6.5% spread     │
│  Rating: BBB (scorecard) · Analyst overlay: BBB                  │
│  Group exposure: RM 8.2M → RM 11.7M (post)   Limit: RM 25M       │
│  Collateral: Property (Klang) · MV 5.0M · LTV 70%                │
│  AI summary (advisory) ▸                                          │
│  Red flags ▸ 2  ·  Open conditions ▸ 4                            │
├───────────────────────────────────────────────────────────────────┤
│  [Approve] [Approve with conditions] [Decline] [Refer] [Recuse]  │
└───────────────────────────────────────────────────────────────────┘
```

## 8. Anti-patterns to avoid

- Decisions buried behind multiple modals.
- AI outputs presented without provenance.
- Single "submit" button that silently passes validations.
- Mass-export buttons without DLP.
- Hidden permissions (silently disable; show "you don't have access — request" instead).

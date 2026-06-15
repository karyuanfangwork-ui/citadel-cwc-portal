# CRM Lead Detail UI/UX Audit Remediation Plan

**Goal:** Improve the CRM Lead Detail screen so converted leads behave like converted records, destructive actions are safer, information hierarchy is clearer, and AI/financial indicators are explainable.

**Primary screen:** `frontend/pages/CrmLeadDetail.tsx`

**Primary tests:** `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Design source:** Screenshot audit on 2026-06-15 for CRM Lead Detail page.

---

## Current Code Context

Observed implementation points:

- `frontend/pages/CrmLeadDetail.tsx:348-349` already derives `isConverted` and `isLost` from lead status.
- `frontend/pages/CrmLeadDetail.tsx:584-600` already switches `Convert to Opportunity` to `View Opportunity` when `isConverted && lead.convertedToOppId`.
- `frontend/pages/CrmLeadDetail.tsx:615-632` already hides `Draft Message` and `Mark as Lost` for converted/lost leads.
- `frontend/pages/CrmLeadDetail.tsx:633-641` still shows top-level `Delete Lead` beside common actions.
- `frontend/pages/CrmLeadDetail.tsx:671-680` renders AI suggested actions directly from next-best-action data, regardless of converted state.
- `frontend/pages/CrmLeadDetail.tsx:712-713` shows missing Industry as `—`.
- `frontend/pages/CrmLeadDetail.tsx:756-785` renders Financial Health with hardcoded CTOS/Cash Flow bars and repeats AI Score.
- `frontend/pages/CrmLeadDetail.tsx:415-454` renders Lead Owner only in the left rail, with truncation on name/job/email.
- `frontend/src/__tests__/CrmLeadDetail.test.tsx:98-113` currently expects `Delete Lead` as a visible header action, so tests must be updated when moving Delete into secondary menu.

---

## Implementation Strategy

Split into 5 small phases so each can be shipped independently.

Recommended order:

1. Workflow/state correctness for converted leads.
2. Action safety and header cleanup.
3. Information hierarchy and empty states.
4. AI/financial explainability.
5. Accessibility and responsive polish.

No backend schema migration is recommended for the first pass. Prefer frontend-only improvements using fields already present on `CrmLead`: `status`, `convertedToOppId`, `opportunities`, `owner`, `aiScore`, `aiScoreReason`, `account.industry`, `followUpDate`, `description`, `followUpNote`.

---

# Phase 1 — Converted Lead Workflow Correctness

## Objective
Make the page clearly communicate that a CONVERTED lead is no longer an active lead-nurturing object.

## Task 1.1 — Add a converted-state summary banner

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`
- Test: `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Implementation:**
Add a banner near the top of the Overview tab or below the record header when `isConverted` is true.

Suggested content:

- Title: `Lead converted`
- Body: `This lead has been converted. Continue work from the related opportunity/account.`
- CTA if `lead.convertedToOppId`: `View Opportunity`
- Secondary text if opportunities exist: show first related opportunity name/stage/value.

**Acceptance criteria:**
- Converted leads show a clear converted-state banner.
- Qualified/open leads do not show the banner.
- If `convertedToOppId` exists, CTA links to `/crm/opportunities/:id`.
- If only `lead.opportunities[0]` exists, use that as fallback link.

**Test cases:**
- Render lead with `status: 'CONVERTED'` and `convertedToOppId: 'opp-1'`; assert `Lead converted` and `View Opportunity` are visible.
- Render lead with `status: 'QUALIFIED'`; assert `Lead converted` is not visible.

---

## Task 1.2 — Replace lead-nurturing AI suggestions for converted leads

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:671-680`
- Test: `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Implementation:**
Introduce a small helper inside or above the component:

- For non-converted leads: continue using `nba.data.actions`.
- For converted leads: override with post-conversion actions:
  - `View converted opportunity`
  - `Log relationship activity`
  - `Review onboarding documents` or `Review related opportunity`

If `lead.convertedToOppId` exists, `View converted opportunity` should be a link/button.

**Acceptance criteria:**
- Converted leads do not show `Schedule meeting`, `Send follow-up email`, or other raw lead-nurturing suggestions from NBA if those are not post-conversion relevant.
- Converted leads show post-conversion actions instead.
- Non-converted leads preserve current NBA behavior.
- Suggestion dots/tooltips still show reason/priority.

**Test cases:**
- Mock NBA with `Send follow-up email` on a converted lead; assert it is not shown.
- Assert converted replacement action is shown.
- Assert non-converted lead still shows mocked NBA action.

---

## Task 1.3 — Clarify editability for converted leads

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`
- Test: `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Implementation options:**

Option A, minimal:
- Keep `Edit Lead` enabled.
- Add helper text in converted banner: `Some fields may be historical. Update the Opportunity for active deal information.`

Option B, stricter:
- Keep `Log Activity` and `Add Note` enabled.
- Replace `Edit Lead` with `Edit Historical Lead` or move it to secondary menu for converted leads.

Recommended first pass: Option A to avoid blocking legitimate data cleanup.

**Acceptance criteria:**
- User can understand whether they should update the lead or the opportunity.
- No backend changes required.

---

# Phase 2 — Safer Action Hierarchy

## Objective
Reduce accidental destructive actions and make frequent actions easier to scan.

## Task 2.1 — Move Delete Lead into a secondary More menu

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:576-641`
- Test: `frontend/src/__tests__/CrmLeadDetail.test.tsx:98-113`

**Implementation:**
Add local state:

- `const [showMoreActions, setShowMoreActions] = useState(false);`

Replace top-level `Delete Lead` with a `More` or `...` button.

Menu items:
- `Delete Lead` only if `hasPermission(user, 'crm:delete')`
- Optional: `Mark as Lost` can also live here on small screens, but keep current top-level placement for now if active lead.

For converted leads, either:
- Hide Delete by default and show only under More with danger styling, or
- Show `Archive Lead` if archive exists; otherwise keep Delete in More.

Recommended first pass:
- Keep delete available for permitted users, but only inside More.

**Acceptance criteria:**
- `Delete Lead` is not visible as a top-level header button.
- User must open More menu to see `Delete Lead`.
- Existing delete confirmation dialog still appears after clicking Delete Lead.
- Keyboard users can open menu and activate delete.

**Test changes:**
- Update test currently expecting `Delete Lead` in header.
- Assert top-level `Delete Lead` is not visible initially.
- Click `More actions`; assert `Delete Lead` appears.

---

## Task 2.2 — Reorder common actions by workflow frequency

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:576-641`

**Recommended order for active leads:**
1. Convert to Opportunity — primary teal
2. Log Activity
3. Add Note
4. Draft Message
5. Edit Lead
6. Mark as Lost
7. More

**Recommended order for converted leads:**
1. View Opportunity — primary/secondary prominent
2. Log Activity
3. Add Note
4. Edit Lead or More
5. More

**Acceptance criteria:**
- Converted page emphasizes `View Opportunity`, not lead conversion/nurturing.
- Common actions are before low-frequency admin actions.

---

# Phase 3 — Information Hierarchy and Empty States

## Objective
Make important context easier to see and reduce “broken field” perception.

## Task 3.1 — Add owner metadata to the main header

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:559-572`
- Test: `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Implementation:**
Extend the header subtitle metadata to include owner:

`Owner: Emily Chow · Datin Seri Rosnah · Updated 15 Jun`

Avoid overloading if the subtitle becomes too long. Use a compact line or separate small metadata row.

**Acceptance criteria:**
- Owner is visible in the main header area.
- Left rail owner card remains as the detailed owner block with reassignment action.
- Long owner names do not break layout.

**Test cases:**
- Assert owner name appears in header metadata or a labelled `Owner` area.

---

## Task 3.2 — Improve owner/contact truncation behavior

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:427-433` and `frontend/pages/CrmLeadDetail.tsx:379`
- Test: `frontend/src/__tests__/CrmLeadDetail.test.tsx:130-144`

**Implementation:**
The test already expects owner name/email not to contain `truncate`, but current code still uses `truncate` on owner name/email. Align implementation with the test intent:

- Remove `truncate` from owner name and email.
- Use `break-words` or `break-all` for long email.
- Add `title={lead.owner.email}` and `title={lead.contactEmail}` for emails.
- Consider `aria-label="Email Datin Seri Rosnah at ..."` for mail links.

**Acceptance criteria:**
- Full owner name and email are readable or accessible via tooltip.
- Long emails wrap without breaking the sidebar.

---

## Task 3.3 — Replace dash-only empty fields with meaningful placeholders

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:712-733`
- Test: `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Implementation:**
For missing values use human-readable text:

- Industry: `Not specified`
- Company: `Not specified`
- Follow-up Date: `No follow-up scheduled`
- Lead Source: `Not specified`

For fields that the user can fix, optionally add subtle helper text or an `Edit Lead` link.

**Acceptance criteria:**
- Missing Industry no longer renders as `—`.
- Empty values are understandable to business users.
- Currency can still use `—` if the project convention requires it, but `Not specified` is better for CRM metadata.

---

## Task 3.4 — Move description context higher in Lead Information

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:704-747`

**Implementation:**
Move Description directly below the card header or after Lead Source, before lower-priority fields.

Recommended order:
1. Description / referral context
2. Company
3. Contact / owner summary if desired
4. Lead Source
5. Estimated Value
6. Industry
7. Follow-up Date
8. Status

**Acceptance criteria:**
- Referral/source story is visible without scanning to the bottom of the card.
- Layout remains balanced in the two-column grid.

---

# Phase 4 — AI and Financial Health Explainability

## Objective
Make AI/financial indicators decision-useful instead of decorative.

## Task 4.1 — Remove duplicate AI Score from Financial Health card

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:777-785`
- Test: `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Implementation:**
Remove or replace the `AI Score` row in the Financial Health card.

Replace with `Score Rationale` if available:

- If `lead.aiScoreReason`: show it as a short explanatory paragraph.
- Else show `Score rationale unavailable` or omit the row.

**Acceptance criteria:**
- Header retains AI score badge.
- Financial Health no longer repeats the same `95/100` without explanation.
- If reason exists, users can understand why score is high/low.

**Test cases:**
- Lead with `aiScore: 95` should show `95/100` once in the header.
- If `aiScoreReason` is present, assert reason text appears in the Financial Health card.

---

## Task 4.2 — Add explicit values and tooltips to Financial Health metrics

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:756-776`

**Implementation:**
Replace ambiguous hardcoded metric rows with a small reusable inline renderer.

First pass can stay frontend-only with static values, but label honestly:

- `CTOS Availability` → `Verified` + `84% confidence` if the 84% bar is retained.
- `Cash Flow Growth` → `Positive` + `70% confidence` if the 70% bar is retained.

Better if actual fields exist later:
- `lead.ctosStatus`
- `lead.cashFlowTrend`
- `lead.financialHealthScore`

Do not imply real backend data if values are only placeholder/demo.

**Acceptance criteria:**
- Each progress bar has a visible text value or confidence label.
- Tooltip explains what the metric means.
- Progress bars have accessible labels, e.g. `aria-label="CTOS Availability verified, 84 percent confidence"`.

---

## Task 4.3 — Explain AI suggestion priority colors

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx:671-680`

**Implementation:**
Add visible or tooltip-level meaning to priority dots:

- high → `High priority`
- medium → `Recommended`
- low → `Optional`

Use `title` or `aria-label` combining action, priority, and reason.

Example label:
`High priority: Call within 24h. Reason: Hot inbound lead.`

**Acceptance criteria:**
- Color is not the only way to understand suggestion priority.
- Existing tooltip reason remains available.

---

# Phase 5 — Accessibility, Responsive Polish, and Verification

## Objective
Ensure the improved UI is usable with keyboard, screen readers, long text, and smaller screens.

## Task 5.1 — Accessibility pass for interactive controls

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`

**Checklist:**
- More menu button has `aria-expanded`, `aria-haspopup="menu"`, and clear label.
- Delete menu item has danger styling and accessible text.
- Financial progress bars have `role="progressbar"` or accessible labels.
- Email links have full `title` and readable/wrapping text.
- AI suggestions have priority text beyond color dots.

**Acceptance criteria:**
- Keyboard can reach More menu and delete action.
- Screen reader users can understand metric values and AI priority.

---

## Task 5.2 — Responsive sanity check

**Files:**
- Modify only if issues are found: `frontend/pages/CrmLeadDetail.tsx`

**Manual checks:**
- Desktop width: 1440px
- Laptop width: 1280px
- Tablet-ish width: 768px
- Mobile-ish width: 390px

**Areas to inspect:**
- Header action wrapping
- Left rail stacking
- Owner email wrapping
- More menu position
- Financial Health card below Lead Information
- Footer/nav overlap, if present in app shell

---

## Task 5.3 — Update tests and run verification

**Files:**
- Modify: `frontend/src/__tests__/CrmLeadDetail.test.tsx`

**Recommended test command:**
Run from `frontend/`:

```bash
npm test -- CrmLeadDetail.test.tsx
```

If the project uses Vitest directly and the above does not target correctly, use:

```bash
npx vitest run src/__tests__/CrmLeadDetail.test.tsx
```

**Build verification:**
Run from `frontend/`:

```bash
npm run build
```

**Acceptance criteria:**
- Lead detail tests pass.
- Frontend build passes.
- No Vite/React console warnings introduced by duplicate keys, invalid DOM nesting, or missing keys.

---

# Suggested Sprint Breakdown

## Sprint 1 — State and Safety

Scope:
- Phase 1 Task 1.1 converted banner
- Phase 1 Task 1.2 converted AI suggestions
- Phase 2 Task 2.1 Delete in More menu

Why first:
These address the highest-risk UX/business issues: misleading converted workflow and accidental deletion.

Expected impact:
- Converted leads feel business-aware.
- Destructive action risk is reduced.

## Sprint 2 — Clarity and Hierarchy

Scope:
- Phase 3 Task 3.1 owner in header
- Phase 3 Task 3.2 full owner/contact visibility
- Phase 3 Task 3.3 empty placeholders
- Phase 3 Task 3.4 description priority

Why second:
These improve day-to-day usability without changing backend logic.

Expected impact:
- Users find owner/context faster.
- Missing data reads as intentional, not broken.

## Sprint 3 — Explainability

Scope:
- Phase 4 Task 4.1 remove duplicate AI score
- Phase 4 Task 4.2 financial metric values/tooltips
- Phase 4 Task 4.3 AI priority labels

Why third:
This turns polished widgets into decision-support tools.

Expected impact:
- Users understand why the score/metric matters.
- Less confusion around AI recommendations.

## Sprint 4 — Accessibility and Responsive QA

Scope:
- Phase 5 Task 5.1 accessibility pass
- Phase 5 Task 5.2 responsive sanity check
- Phase 5 Task 5.3 full verification

Why fourth:
Final polish after layout/content changes settle.

Expected impact:
- Better keyboard/screen-reader support.
- Lower regression risk across device sizes.

---

# Risk / Tradeoff Notes

1. Backend data limitation:
   Financial Health currently appears hardcoded in the UI. Do not overstate it as real CTOS/cash-flow data unless backend fields exist.

2. Converted record links:
   `convertedToOppId` is used in the UI. If some converted leads only have `opportunities[]`, implement a fallback link to the first related opportunity.

3. Delete vs Archive:
   If the business prefers never deleting converted records, a backend-supported archive flow would be better. For now, moving Delete to More is the safest frontend-only improvement.

4. AI suggestion source:
   If next-best-action API can be updated later, the better long-term fix is backend/context-aware recommendations by entity status. First pass can safely override converted lead display in frontend.

5. Tests currently conflict with intended UX:
   `CrmLeadDetail.test.tsx` currently expects top-level Delete Lead. Update this test as part of Phase 2.

---

# Definition of Done

- Converted leads show converted-state context and post-conversion actions.
- Delete Lead is no longer a top-level action.
- Owner is visible in the main header and detailed in the sidebar.
- Missing values use business-friendly placeholders.
- Financial Health metrics have values/explanations and no duplicate AI score.
- AI suggestion priority is understandable without relying only on color.
- `CrmLeadDetail.test.tsx` updated and passing.
- `npm run build` from `frontend/` passes.

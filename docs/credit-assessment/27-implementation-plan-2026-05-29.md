# Credit Assessment Module — Implementation Plan (Post-Audit)

**Derived from:** `26-comprehensive-audit-2026-05-29.md`
**Created:** 2026-05-29
**Revised:** 2026-05-29 — Wave 4 rewritten + 0.5 added to reflect operating reality: **Citadel CWC is a non-bank SME lender (retail + commercial borrowers), not BNM-licensed and not lending under a partner bank**. Direct CCRIS access is therefore not available; bureau strategy is borrower-uploaded eCCRIS + CTOS + SSM + commercial AML vendor.
**Format:** Sequenced, self-contained work packets. Tackle one at a time, top to bottom. Each packet has: goal, files, acceptance criteria, effort, dependencies.

**Convention**
- **Effort:** XS ≤ 0.5d · S ≤ 1.5d · M ≤ 4d · L ≤ 10d · XL > 10d
- **Track:** SEC (security) · CTRL (controls) · UX · DATA · OPS · INT (integration) · AI
- Numbering is the execution order. Items inside the same wave can be parallelised if resourced.

---

## WAVE 0 — HOUSEKEEPING (Day 0–2, all XS / S)

Cheap, no-risk cleanup that clears the deck before real work.

### 0.1 — Delete stale seed backup
**Track:** OPS · **Effort:** XS · **Deps:** none
- Delete `backend/prisma/creditDemoSeed.ts.bak`.
- AC: file gone, `npm run build` still green.

### 0.2 — Consolidate credit seed scripts
**Track:** OPS · **Effort:** S · **Deps:** 0.1
- Merge `seed-credit-clear`, `seed-credit-notifications`, `seed-credit-flags`, `seed-credit-workflow`, `seed-credit-approvals`, `creditDemoSeed.ts` into a single orchestrator `seed-credit.ts` with CLI flags (`--clear`, `--demo`, `--workflow`, etc.).
- AC: one entry point, README updated, old scripts removed.

### 0.3 — Confirm 7-year audit retention job exists & runs
**Track:** SEC · **Effort:** S · **Deps:** none
- Grep for a retention cron on `CreditAuditEvent`. If absent, create one (no-op for now if retention < 7y of data, but wire the schedule).
- AC: scheduled job present, last-run timestamp visible in admin.

### 0.4 — Confirm `credit:bureau_checks` flag is OFF in production
**Track:** SEC · **Effort:** XS · **Deps:** none
- Verify production feature-flag value; document in `18-feature-flags.md` that "OFF until adapter live" is a compliance constraint.
- AC: written compliance sign-off attached to the doc.

### 0.5 — Confirm operating-entity regulatory status + bureau procurement budget *(blocking Wave 4)*
**Track:** OPS / Legal / Compliance · **Effort:** S (research) + L (vendor RFP & contracting in parallel) · **Deps:** none · **Owner:** CEO + Legal + Compliance
- Document:
  - License type held (Moneylenders Act / KPKT, SC P2P, SC ECF, other) and its operational constraints.
  - **AMLA Reporting Institution** status under BNM AML/CFT regime — yes / no / threshold-pending.
  - **CRAA 2010** compliance posture for bureau pulls (consent capture, retention, dispute handling).
  - **PDPA 2010** registration + data-protection policy reference.
- Decide bureau vendor mix from the shortlist (CTOS primary; Experian RAMCI as supplement; CBM optional; MemberCheck or ComplyAdvantage for AML; SSM e-Info for company data; an e-KYC vendor for retail borrowers).
- Approve monthly OpEx envelope for bureau + AML + e-KYC + SSM combined (realistic range RM15–40K/month for a production SME-lending operation at 100–500 deals/month).
- Kick off RFP / contracting in parallel with engineering (4–8 week lead time on KYB + DPA + permissible-purpose declaration for each vendor).
- AC: written decision memo committed to repo at `docs/credit-assessment/28-bureau-procurement-decision.md`; Wave 4 items are unblocked only once this exists.
- **Note:** Direct CCRIS adapter wiring is **explicitly out of scope** — that data path is reserved for BNM-licensed entities. Substitution via borrower-uploaded eCCRIS (Wave 4.1) is the legitimate workaround used by non-bank SME lenders in Malaysia.

---

## WAVE 1 — QUICK-WIN CONTROLS (Week 1–2)

These are pure-backend or lightly-frontend additions that close audit findings with high control value.

### 1.1 — Split `credit:disburse` out of `credit:admin`
**Track:** SEC · **Effort:** S · **Deps:** none
- New permission `credit:disburse`. Migrate disbursement endpoints to require it. Seed: grant to ops users only, not to risk admins.
- AC: `credit:admin` alone can no longer call disbursement endpoints; SOD test added.

### 1.2 — Connected-party auto-flag
**Track:** CTRL · **Effort:** M · **Deps:** none
- Derive `connectedPartyFlag` on `CreditApplication` from `RelatedPartyGroup` membership at submit + on every facility / party change. Keep free-form flag as override (audited).
- AC: a borrower in a related-party group automatically flips the flag on its application; matrix authority lookup uses derived value.

### 1.3 — Collateral valuation freshness alert + hard-block
**Track:** CTRL · **Effort:** S · **Deps:** none
- Cron: scan `CollateralValuation.valuationDate`; raise `EarlyWarningSignal(severity=MEDIUM)` at 9 months, `HIGH` at 12.
- Hard-block: state transition into `ACTIVE` / `DISBURSED` if any tangible collateral valuation > 12 months.
- AC: test passes; signal visible in dashboard.

### 1.4 — Insurance expiry alert
**Track:** CTRL · **Effort:** S · **Deps:** none
- Cron: scan `InsuranceCover.expiryDate`; signal at T-30 / T-7 / expired.
- AC: signal raised; email sent to RM + Compliance.

### 1.5 — Export audit log
**Track:** SEC · **Effort:** M · **Deps:** none
- New model `CreditExportEvent (userId, reportType, filters, rowCount, format, ip, ua, at)`.
- Wrap every CSV / PDF export endpoint to log before streaming.
- Admin view: list + filter exports.
- AC: every export creates a row; admin can query "who exported borrower list in last 30 days".

### 1.6 — Dual approval on score override Δ ≥ 2 notches
**Track:** CTRL · **Effort:** M · **Deps:** none
- Backend: if `|originalRatingNotch − overrideRatingNotch| ≥ 2`, require a second `credit:admin` approver; status `PENDING_SECOND_APPROVAL`.
- UI: show pending state in Scoring tab; second approver receives notification.
- AC: large-delta override cannot complete with one approver; audit trail records both.

### 1.7 — Submission-readiness hard gate
**Track:** UX · **Effort:** M · **Deps:** none
- Backend: validator returning per-section completeness for an application.
- Frontend: Summary tab gauge "12 / 14 sections complete"; submit button disabled until critical sections complete; rules per `ApplicationType` (NEW vs RENEWAL).
- AC: empty narratives / missing facilities / unverified docs block submit; clear error list shown.

### 1.8 — Confirmation modal consistency
**Track:** UX · **Effort:** S · **Deps:** none
- Pick one shared `<ConfirmModal>` component; replace ad-hoc toasts / inline confirms across destructive credit actions (delete document, withdraw app, finalise vote).
- AC: grep finds one component; UX QA pass.

### 1.9 — Sticky table headers + zebra striping
**Track:** UX · **Effort:** S · **Deps:** none
- Apply to score-factor, monitoring, exposure, facility tables.
- AC: visual QA pass at 1280 px and 1024 px.

### 1.10 — CA Memo preview button in Approvals + Signoff
**Track:** UX · **Effort:** M · **Deps:** memo-generation endpoint (exists)
- Button → opens PDF viewer modal with current memo state.
- AC: approver can review memo in one click; no separate page nav.

---

## WAVE 2 — SECURITY HARDENING (Week 3–6)

### 2.1 — MFA / WebAuthn for `credit:approve` and `credit:admin`
**Track:** SEC · **Effort:** L · **Deps:** none
- TOTP first (simpler); WebAuthn second.
- Enforce step-up on first login of session for any user holding a credit privileged role.
- AC: privileged user without MFA enrolled is blocked at login with enrolment flow.

### 2.2 — Time-based SLA escalation
**Track:** OPS · **Effort:** L · **Deps:** none
- Config table `CreditSlaPolicy (stateKey, maxHours, escalateToRole)`.
- Cron: every 15 min scan in-flight apps; raise EWS + email when threshold passed.
- Dashboard widget: "Aged WIP per state".
- AC: KYC > 5 days surfaces; escalation email to Compliance Head.

### 2.3 — Optimistic concurrency on `CreditApplication` + child entities
**Track:** DATA · **Effort:** M · **Deps:** none
- Add `version` int to mutable entities; backend rejects mismatched version with 409; frontend shows reconciliation dialog ("server has newer data — reload or merge").
- AC: simultaneous edits don't silently overwrite; conflict UI surfaces.

### 2.4 — Row-level access (RM scoping)
**Track:** SEC · **Effort:** M · **Deps:** none
- Without `credit:admin`, list endpoints filter to `assignedRmId = me OR assignedAnalystId = me`.
- AC: RM A cannot enumerate RM B's applications via list; can still resolve if given exact ID + has `credit:read` (audit logs the read).

### 2.5 — DLP on exports (watermark + redact + IP gate)
**Track:** SEC · **Effort:** L · **Deps:** 1.5
- PDFs: watermark with `<user.email> · <timestamp> · CONFIDENTIAL`.
- CSVs: redact NRIC / passport columns (HMAC last-4 only) unless caller has `credit:admin`.
- Optional IP allow-list per environment for export endpoints.
- AC: redacted CSV when called as analyst; full CSV (still audit-logged) when admin.

### 2.6 — Delegation table
**Track:** OPS · **Effort:** M · **Deps:** none
- `UserDelegation (fromUserId, toUserId, scope=['credit:approve'], validFrom, validTo, reason)`.
- Approval routing checks active delegations and routes to delegate.
- AC: approver on leave delegates to peer; pending items route to peer; audit shows original + acting user.

### 2.7 — Ongoing AML re-screening (quarterly)
**Track:** SEC · **Effort:** M · **Deps:** bureau adapter live (Wave 4) for production hits; can stub-run before then
- Cron: quarterly screen all `BorrowerProfile`, `Director`, `Shareholder`, `UltimateBeneficialOwner` against PEP / sanctions adapter; persist as `CreditBureauCheck(type=AML_RESCREEN)`; signal on new hit.
- AC: cron runs in stub mode now, switches automatically when `credit:bureau_checks=true`.

### 2.8 — Per-endpoint rate limits
**Track:** SEC · **Effort:** S · **Deps:** none
- Stricter limits on bureau check, export, score override endpoints (e.g., 5 / min / user).
- AC: 429 returned on burst; metrics tracked.

### 2.9 — Field-encryption extension
**Track:** SEC · **Effort:** M · **Deps:** none
- Encrypt `BorrowerProfile.annualIncome`, `netWorth`, `sourceOfWealth` at rest (AES-256-GCM, same pattern as NRIC).
- AC: existing rows migrated; PII-read log captures access.

---

## WAVE 3 — UX OVERHAUL (Week 7–12)

### 3.1 — Approval Pack PDF preview (full)
**Track:** UX · **Effort:** L · **Deps:** 1.10
- Reorganise CA Memo generator into a single "Approval Pack" template that includes: summary, parties, facilities, scoring, ECL, collateral, conditions, signoff.
- Embed in Approvals tab as primary review surface (sidebar shows raw tabs for drill-down).
- AC: approver makes decision without leaving Approvals tab in ≥ 80 % of cases.

### 3.2 — Mobile committee voting view
**Track:** UX · **Effort:** L · **Deps:** 3.1 (memo embed)
- Dedicated route `/credit/m/committee/:meetingId` optimised for ≤ 768 px.
- Single deal at a time: header + memo (collapsible) + vote (APPROVE / REJECT / ABSTAIN) + comment + next.
- AC: chair can vote on a meeting from phone end-to-end.

### 3.3 — Mobile approval card
**Track:** UX · **Effort:** M · **Deps:** 3.1
- Mobile-optimised approval inbox; one-tap APPROVE / REJECT / DEFER with mandatory comment on reject.
- AC: same flow works on iOS / Android Chrome; touch targets ≥ 44 px.

### 3.4 — Consolidate Facilities + Requests-Facilities tabs
**Track:** UX · **Effort:** M · **Deps:** none
- Single Facilities surface with a "Request type" filter (NEW / RENEWAL / VARIATION / POLICY_BREACH / SICR_IMPAIRMENT).
- AC: one tab; no functionality lost.

### 3.5 — Consolidate ESG + SICR into "Forward-looking risk" tab
**Track:** UX · **Effort:** S · **Deps:** none
- AC: one tab; both data sets editable.

### 3.6 — Submission wizard restructure (3-step + 6-group rail)
**Track:** UX · **Effort:** XL · **Deps:** 1.7, 3.4, 3.5
- Restructure 24-tab page into: Step 1 Borrower & Request · Step 2 Risk & Mitigants · Step 3 Decision & Monitoring; with side rail of 6 grouped sections, completeness indicators, deep-link routes preserved for backwards compatibility.
- AC: legacy tab URLs redirect into the wizard; existing E2E tests pass; click-count for typical SME deal cut by ≥ 30 %.

### 3.7 — Accessibility pass
**Track:** UX · **Effort:** M · **Deps:** runs alongside other UX work
- ARIA labels on icon-only buttons; keyboard nav across approvals, committee voting, document upload; colour-contrast review on RiskBadge amber states.
- AC: axe-core CI check passes; manual keyboard nav test passes.

### 3.8 — Progress indicators on long calls
**Track:** UX · **Effort:** S · **Deps:** none
- Score run, memo generate, bureau check, export — all show a determinate or indeterminate progress UI.
- AC: no silent multi-second waits.

### 3.9 — Smart defaults
**Track:** UX · **Effort:** S · **Deps:** none
- Currency → borrower home currency; tenor → product default; assigned RM → CRM Account owner; reviewer suggestion in maker-checker (any user with `credit:approve` other than maker).
- AC: defaults visible in form opening; user can override.

---

## WAVE 4 — INTEGRATION GO-LIVE (Week 9–16, parallel to Wave 3)

> **Reality check for this wave:** Citadel CWC is a non-bank SME lender. Direct CCRIS access is **not legally available** and is therefore not in this plan. We use the borrower-uploaded eCCRIS workflow (4.1) as the legitimate substitute, plus commercial bureaus (CTOS / Experian) and SSM for company data. Every item in this wave is **blocked on 0.5 being signed off**.

### 4.1 — Borrower-uploaded eCCRIS workflow *(do first — zero vendor dependency)*
**Track:** CTRL / UX · **Effort:** M · **Deps:** 0.5
- Borrower pulls own report from BNM's free `eccris.bnm.gov.my` portal and uploads PDF to the application.
- New required `DocumentClass.CCRIS_SELF_PULL` (or reuse `CREDIT_BUREAU_REPORT` with subtype); enforce as mandatory document for credit decisioning.
- Authenticity controls: BNM PDF marker / metadata checks; RM-witnessed re-pull during site visit for high-ticket deals; freshness rule (report dated ≤ 30 days).
- Parser: extract facility list, outstanding balances, MIA buckets, special-attention accounts; surface into Account Conduct + Risk Rating tabs.
- AC: borrower workflow live; uploaded PDF parsed; extracted fields visible in app; freshness rule enforced; one-click "request fresh report" notification to borrower.
- **Cost:** RM 0.

### 4.2 — Consent capture (per-bureau-pull) *(legal prerequisite for 4.3, 4.4, 4.5)*
**Track:** SEC / Legal · **Effort:** M · **Deps:** 0.5
- New model `CreditBureauConsent (borrowerProfileId, bureauType, purpose, consentText, consentedAt, consentArtefactUrl, ipAddress, channel, expiresAt)`.
- UI: explicit consent modal before any commercial-bureau pull; capture timestamp + IP + signed artefact (PDF receipt emailed to borrower).
- Backend: every bureau adapter call requires a non-expired matching consent or hard-fails.
- CRAA 2010 compliance: consent text reviewed by Legal; retention 7 years.
- AC: no commercial bureau call succeeds without a valid consent row; audit log captures the link.

### 4.3 — CTOS adapter (primary commercial bureau)
**Track:** INT · **Effort:** L · **Deps:** 4.2 + signed CTOS contract (from 0.5)
- Implement real CTOS adapter behind existing `adapters/cbs.ts` interface; vault credentials; circuit breaker; retries; canonicalise response into existing `CreditBureauCheck.matchedHits` + rich-data fields.
- Support both consumer (individual) and corporate report endpoints — both are needed for SME deals (owner-director consumer + corporate entity).
- Sandbox integration tests first; production cutover with first-10-call manual review.
- AC: production call returns real CTOS data; fallback to "manual review required" state if circuit open; vendor sandbox tests green; audit log records bureau call + consent reference.
- **Cost:** ~RM3–10K/month subscription + RM10–RM80/report (confirm at contracting).

### 4.4 — SSM e-Info / MyData adapter (company verification)
**Track:** INT · **Effort:** M · **Deps:** 4.2 (consent not needed for company data but follow procurement) + SSM account from 0.5
- Pull company profile, directors, shareholders, paid-up capital, charges, audited-account filings.
- Auto-populate `BorrowerProfile` (corporate), `Director`, `Shareholder` records as suggestions (reviewer approves before persisting).
- Auto-attach key SSM documents (Form 24, Form 49, audited accounts) into `CreditDocument` with `documentClass=MEMORANDUM_ARTICLES` etc.
- AC: SSM No. entry triggers fetch; reviewer one-click accepts populated fields; SSM docs attached automatically.
- **Cost:** Pay-as-you-go, ~RM5–RM50 per document.

### 4.5 — AML / sanctions / PEP adapter (replace placeholder)
**Track:** SEC · **Effort:** L · **Deps:** 4.2 + signed vendor contract (MemberCheck for cost-efficient Malaysian focus, or ComplyAdvantage / Refinitiv if global coverage required)
- Replace `bureau.placeholder.ts` AML branch with real vendor.
- Wire ongoing re-screen cron from Wave 2.7 to live adapter.
- Tune match-score thresholds; reviewer queue for medium-confidence hits.
- AC: PEP / sanctions screening live across BorrowerProfile, Director, Shareholder, UBO; reviewer queue UI usable; STR-triggering hits flagged to Compliance.
- **Cost:** ~RM2–8K/month depending on vendor.

### 4.6 — e-KYC for retail / individual borrowers
**Track:** SEC · **Effort:** L · **Deps:** 4.2 + e-KYC vendor contract (Innov8tif, MyDigital ID, or similar)
- MyKad NFC / OCR read + liveness check + face-match against MyKad photo.
- Result persisted to BorrowerProfile (verified flag, kyc artefact, score).
- Mandatory for `BorrowerType=INDIVIDUAL` and for personal-guarantor onboarding.
- AC: end-to-end retail borrower onboard completes via e-KYC in under 3 minutes; failed checks routed to manual review.
- **Cost:** ~RM2–RM10 per verification.

### 4.7 — Bank statement analysis pipeline *(critical for non-bank lender — substitutes for limited bureau depth)*
**Track:** INT / DATA · **Effort:** XL · **Deps:** 4.8 (ClamAV) for safe ingest
- For non-bank SME lending this is the **single highest-signal data source you control**, because CCRIS isn't directly available and bank-account conduct is the closest substitute for bank-loan repayment history.
- Pipeline: borrower uploads ≥ 6 months of bank statements (PDF) → ClamAV → OCR → transaction extraction → categorisation (salary / business inflow / loan repayment / bounced cheque / overdraft) → cash-flow ratios (avg inflow, volatility, EOM balance, bounced count, gambling exposure) → surface into Account Conduct + Risk Rating tabs.
- Vendor options: Jocata / Finbox / Trustingsocial (faster, paid), or build in-house with OCR + LLM categorisation (more control, slower).
- Manual fallback: analyst keys summary stats if pipeline fails.
- AC: 6-month statement processed in ≤ 5 min; categorisation ≥ 85 % accuracy on test set; ratios feed scorecard inputs; reviewer can correct categorisation per-transaction.

### 4.8 — ClamAV production (replace placeholder)
**Track:** SEC · **Effort:** M · **Deps:** none
- Wire managed or self-hosted ClamAV; document upload rejected on virus hit; `isScanned` set correctly.
- AC: EICAR test file rejected.

### 4.9 — OCR pipeline (Textract or equivalent) for FS + supporting docs
**Track:** AI · **Effort:** L · **Deps:** 4.8
- Pipeline: upload → ClamAV → OCR → text + extracted fields persisted to `CreditDocument` (new `extractedJson` blob).
- Phase 1 use cases: extract FS line items as suggestions for `FinancialLineItem`; extract MyKad / passport fields; extract eCCRIS PDF structured data (feeds 4.1).
- AC: 80 %+ field-extraction accuracy on sample FS; reviewer one-click accept.

### 4.10 — Flip `credit:bureau_checks=true`
**Track:** INT · **Effort:** XS · **Deps:** 4.3 + 4.5 live + compliance sign-off
- AC: production flag flipped with sign-off; first 10 live calls reviewed jointly by Risk + Compliance.

### 4.11 — Experian RAMCI (secondary bureau) *(optional / defer)*
**Track:** INT · **Effort:** L · **Deps:** 4.3 in production; evidence of CTOS coverage gap
- Add only if CTOS misses material data on specific deal segments.
- AC: same pattern as 4.3; documented decision rationale for adding second bureau.

### 4.12 — CBM (Credit Bureau Malaysia) for SME trade data *(optional / defer)*
**Track:** INT · **Effort:** M · **Deps:** 4.3 in production; SME-trade-data lift justified
- AC: same pattern as 4.3.

### 4.13 — (Reserved / dropped) Direct CCRIS adapter
**Status:** **Out of scope** as long as Citadel is not BNM-licensed. Replaced by 4.1. Re-evaluate only if regulatory status changes.

---

## WAVE 5 — REPORTING & BI (Week 13–18)

### 5.1 — Override analysis report
**Track:** DATA · **Effort:** M · **Deps:** 1.6
- Report: overrides by user / month / Δ-notches / approver; CSV + PDF.
- AC: surfaced in Reports tab.

### 5.2 — Rating migration matrix
**Track:** DATA · **Effort:** M · **Deps:** none
- Period-over-period rating moves; heatmap rendering.
- AC: monthly + quarterly views.

### 5.3 — Concentration risk report
**Track:** DATA · **Effort:** M · **Deps:** none
- By industry / geography / single name / connected-party group.
- AC: top-N + thresholds configurable.

### 5.4 — IFRS 9 staging movement + ECL roll-forward
**Track:** DATA · **Effort:** L · **Deps:** finance team validation
- Stage-1 → 2 → 3 flow; ECL movement reconciled with finance team.
- AC: parallel run against finance team's model for one quarter — variance < 1 %.

### 5.5 — SLA breach report
**Track:** OPS · **Effort:** S · **Deps:** 2.2
- AC: report visible to Operations.

### 5.6 — Bureau-vs-internal rating divergence
**Track:** DATA · **Effort:** S · **Deps:** 4.1
- AC: report visible; > 2-notch divergence flagged.

### 5.7 — Read-replica + Metabase (or Superset)
**Track:** DATA · **Effort:** L · **Deps:** none
- Postgres read-replica; Metabase connected through a redacted view (NRIC HMAC, encrypted financials decrypted only behind admin role).
- AC: analysts build ad-hoc dashboards without hitting OLTP and without raw PII access.

### 5.8 — Configurable / role-tuned dashboards
**Track:** UX · **Effort:** L · **Deps:** none
- Three preset layouts (Executive / Analyst / Manager); pin / unpin widgets; drill-down deep links.
- AC: each role lands on a tailored dashboard.

---

## WAVE 6 — WORKFLOW REFINEMENTS (Week 15–20)

### 6.1 — Committee COI declaration
**Track:** CTRL · **Effort:** M · **Deps:** none
- Pre-vote attestation modal; member declares COI → forced recusal; recorded on `CommitteeVote`.
- AC: can't cast vote without COI step.

### 6.2 — Maker-checker on borrower profile creation
**Track:** CTRL · **Effort:** M · **Deps:** none
- New `BorrowerProfile.verificationStatus (DRAFT/VERIFIED)`; only `VERIFIED` profiles can be linked to a new application.
- AC: applications cannot be created against `DRAFT` borrowers.

### 6.3 — Duplicate borrower detection at create
**Track:** DATA · **Effort:** M · **Deps:** none
- Reuse CRM duplicate-detection patterns (name + SSM No + NRIC HMAC); show "possible duplicate" with link.
- AC: creating an obvious duplicate prompts a warning, not a hard block.

### 6.4 — Application Templates
**Track:** UX · **Effort:** M · **Deps:** none
- `CreditApplicationTemplate` (preset product, tenor, currency, default facilities).
- AC: "Create from template" option in Application Create form.

### 6.5 — Renewal pipeline auto-creation (T-90 days)
**Track:** OPS · **Effort:** M · **Deps:** none
- Cron: for every `ACTIVE` facility, 90 days before maturity create a `RENEWAL` `CreditApplication` shell with prior data copied.
- AC: renewals appear in RM pipeline 90 days early; opt-out per facility.

### 6.6 — Covenant formula validator
**Track:** CTRL · **Effort:** M · **Deps:** none
- Simple expression parser (`DSCR >= 1.20`, `Gearing <= 3.0`); dry-run against latest FS.
- AC: invalid formulas rejected; preview shows pass/fail.

### 6.7 — Tamper-evident audit log
**Track:** SEC · **Effort:** L · **Deps:** 0.3
- Hash-chain `CreditAuditEvent` (each row stores `prevHash + selfHash`); daily anchor hash exported.
- AC: tampering detectable via verification script.

### 6.8 — Notification preferences + digest
**Track:** UX · **Effort:** M · **Deps:** none
- Per-user channel pref (email / SSE / SMS) per topic; digest mode (hourly / daily).
- AC: user can mute non-critical topics; critical topics override mute.

---

## WAVE 7 — AI ADVISORY (Phase 9+, gated by `credit:ai_advisory`)

Do not start until Waves 0–6 are stable in production.

### 7.1 — CA Memo narrative draft (preamble, matters-to-highlight, transaction details)
**Track:** AI · **Effort:** L · **Deps:** 4.6 (OCR for context)
- AC: draft button per narrative field; analyst reviews & accepts; AI metadata persisted (`model_version`, `prompt_id`, `confidence`, `human_reviewed_by`).

### 7.2 — Approval recommendation
**Track:** AI · **Effort:** L · **Deps:** 7.1 pattern
- Synthesised summary + recommended decision + rationale; never auto-approves; explainability panel.
- AC: approver sees recommendation with rationale; can accept / reject.

### 7.3 — Document Q&A
**Track:** AI · **Effort:** L · **Deps:** 4.6
- Q&A over the application's uploaded docs (FS, board res, KYC); cite source page.
- AC: answers cite source; "I don't know" when unsupported.

### 7.4 — Bureau-result triage
**Track:** AI · **Effort:** M · **Deps:** 4.1–4.3
- LLM scores match certainty across CCRIS / CTOS / AML hits.
- AC: cuts false-positive review queue ≥ 30 %.

### 7.5 — Customer risk alerts (narrative EWS)
**Track:** AI · **Effort:** L · **Deps:** 4.7
- Synthesise news + bureau drift + payment behaviour into narrative EWS.
- AC: signal includes 1-paragraph narrative; reviewer rates accuracy.

### 7.6 — Challenger predictive model
**Track:** AI · **Effort:** XL · **Deps:** 5.4 (ECL data), 7.5 cadence
- Run alongside scorecard; champion-challenger A/B reporting; drift monitoring; model card per release.
- AC: never authoritative; CRO sees divergence report.

---

## WAVE 8 — LONG-HORIZON

### 8.1 — Borrower self-service portal
**Track:** UX · **Effort:** XL · **Deps:** 4.5, 4.6
- Document upload, status check, accept-offer.
- AC: pilot with 10 SME borrowers.

### 8.2 — e-Sign integration (DocuSign / Adobe Sign)
**Track:** INT · **Effort:** L · **Deps:** vendor contract
- Sign condition documents, offer letters, guarantees.
- AC: signed PDFs stored as `CreditDocument(version)`; signing event audited.

### 8.3 — Durable job queue (BullMQ)
**Track:** OPS · **Effort:** L · **Deps:** none
- Migrate cron-based tasks (SLA, valuation freshness, insurance, AML re-screen, renewal pipeline) to BullMQ; admin UI for visibility + retry.
- AC: failed jobs visible + retriable; no silent cron failures.

### 8.4 — Portfolio stress-testing harness
**Track:** AI / DATA · **Effort:** XL · **Deps:** 5.4
- Macro scenario inputs (rate up 200bp, GDP −2 %, FX shock); recompute PD / LGD / ECL across portfolio.
- AC: CRO can run scenario; report exportable.

### 8.5 — Islamic product sign-off path (Shariah committee variant)
**Track:** CTRL · **Effort:** L · **Deps:** Shariah committee policy
- Parallel approval workflow for `*_I` facility types.
- AC: Islamic facilities cannot transition past `APPROVED` without Shariah signoff.

### 8.6 — Open-banking / payment-aggregator integration
**Track:** INT · **Effort:** XL · **Deps:** none
- Pull cash-flow data for SME underwriting.
- AC: pilot with one bank's open-banking API.

---

## EXIT CRITERIA — "Production Sanctioning Ready"

All of the following must be green before any live sanctioning:

- [ ] 0.5 — operating-entity regulatory status + bureau procurement decision signed off
- [ ] 4.1 — borrower-uploaded eCCRIS workflow live
- [ ] 4.2 — per-pull consent capture live (CRAA 2010)
- [ ] 4.3 — CTOS adapter live (consumer + corporate)
- [ ] 4.4 — SSM e-Info adapter live
- [ ] 4.5 — AML / sanctions adapter live (MemberCheck or equivalent)
- [ ] 4.6 — e-KYC for retail borrowers live
- [ ] 4.7 — bank-statement analysis pipeline live (critical non-bank-lender signal source)
- [ ] 4.10 — `credit:bureau_checks=true` with compliance sign-off
- [ ] 2.1 — MFA enforced on `credit:approve` + `credit:admin`
- [ ] 2.2 — SLA escalation operational
- [ ] 2.5 — DLP on all exports
- [ ] 2.7 — Quarterly AML re-screen running
- [ ] 1.1 — `credit:disburse` split out
- [ ] 1.2 — Connected-party auto-flag
- [ ] 1.3 + 1.4 — Valuation / insurance freshness alerts
- [ ] 1.6 — Dual approval on Δ ≥ 2 overrides
- [ ] 6.1 — Committee COI declaration
- [ ] 3.2 — Mobile committee voting view
- [ ] 5.4 — IFRS 9 parallel-run reconciled vs finance team
- [ ] Parallel-run cohort: ≥ 30 deals, ≥ 4 weeks, internal audit sign-off

---

## SUGGESTED EXECUTION ORDER (quick reference)

Wave 0 → Wave 1 → Wave 2 (start in parallel with Wave 4 vendor RFP) → Wave 3 → Wave 4 → Wave 5 → Wave 6 → Wave 7 → Wave 8.

Pick the next un-checked item in the lowest-numbered wave when looking for "what's next". When in doubt, finish a wave before starting the next.

---

*End of plan. Pair with `26-comprehensive-audit-2026-05-29.md` for the rationale behind every item.*

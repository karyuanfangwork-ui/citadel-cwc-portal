# W1 — Sprint 1–2 Quick Wins: Implementation Plan

**Source:** `docs/ENTERPRISE_UIUX_AUDIT_2026-05-22.md` §7
**Window:** 2 sprints (~4 weeks)
**Scope:** 15 quick wins (Q1–Q15) — high-visibility, low-risk polish
**Branching:** one branch per Q (`feat/w1-q01-ref-urls` …), one PR each. No batched mega-PRs — each item should be independently reviewable and revertable.
**Total LOE:** 4 × XS + 11 × S ≈ 22–28 engineer-days

---

## Sequencing

```
Sprint 1 (Foundation + zero-risk wins)
  Day 1-2   Q3, Q5, Q6, Q8, Q9      (4 × XS in a single sweep PR if desired)
  Day 3-5   Q1  Reference-number URLs              ← unblocks share-link UX
  Day 6-7   Q10 Environment banner
  Day 8-9   Q4  StateBadge sweep                   ← needs primitive lift (see Q4)
  Day 10    Buffer + QA

Sprint 2 (Feature-touch wins)
  Day 11-12 Q2  SLA progress bar
  Day 13-14 Q11 aria-describedby on form errors
  Day 15-16 Q7  Date-range selector on Reports
  Day 17-18 Q12 Bulk-approve preview modal
  Day 19    Q13 Recently used services
  Day 20    Q14 Save Draft chip
  Day 21-22 Q15 Out-of-office field (FE + BE + migration)
  Day 23    Stakeholder demo + buffer
```

**Dependencies:**
- Q4 depends on lifting `StateBadge` out of `frontend/src/components/credit/` — do this first (1 hr) before sweep.
- Q15 is the only item touching backend + Prisma migration.

---

## Q1 — Reference-number-based URLs `/request/:ref`

**File anchors:** `frontend/App.tsx:496`, `frontend/src/services/request.service.ts`, `backend/src/routes/request.routes.ts`
**LOE:** S (1.5 d)
**Why:** Current UUID URLs (e.g. `/request/8f3a…`) are unshareable in email/Slack. Audit obs 201.

**Approach**
1. Backend: add `GET /api/v1/requests/by-ref/:ref` that resolves `referenceNumber` → request, returns same shape as `GET /:id`.
2. Frontend route: keep `/request/:id` for back-compat, add `/r/:ref` as canonical. `RequestDetail` resolves either param.
3. Update all internal links (`navigate('/request/' + id)`) to use `ref` when present.
4. UUID URLs 301-redirect client-side via `<Navigate>` to `/r/:ref`.

**Acceptance**
- [ ] Opening `/r/REQ-2026-00123` loads the request.
- [ ] Old UUID URLs still work (redirect).
- [ ] All "Copy link" / email-notification URLs use the ref form.
- [ ] Reference uniqueness already enforced by Prisma — verify with grep.

**Test:** unit test on resolver, manual nav from notification email + ApprovalQueue + dashboard widget.

**Risk:** notification emails sent before ship still contain UUID URLs — they still resolve via redirect. OK.

---

## Q2 — SLA progress bar in RequestHeader

**File anchors:** `frontend/src/components/request/RequestHeader.tsx`, `backend/src/services/sla.service.ts`
**LOE:** S (1 d)

**Approach**
- Read `slaDueAt`, `slaStatus`, `slaPausedAt` already on the request payload.
- Compute `elapsed / total` percentage client-side; show segmented bar (green <60%, amber 60–90%, red >90%, gray when paused).
- Tooltip: "Due in 2h 14m" / "Paused since 14:02".
- Use existing `StateBadge` for paused state.

**Acceptance**
- [ ] Bar renders for any request with `slaDueAt`.
- [ ] Hidden for tickets with no SLA policy.
- [ ] `aria-label` describes percent + time remaining.
- [ ] Paused state visually distinct.

---

## Q3 — Fix `href="#"` footer links

**File anchors:** `frontend/App.tsx:418-432`
**LOE:** XS (15 min)

**Approach:** replace `#` with real routes (`/about`, `/privacy`, `/support`) or remove the items. If pages don't exist yet, link to a stub page with "Coming soon" — never leave dead `#` anchors.

**Acceptance**
- [ ] `grep 'href="#"' frontend/` returns 0 results in App.tsx footer block.
- [ ] Keyboard tab through footer reaches no dead targets.

---

## Q4 — Replace inline status hex with `<StateBadge>`

**File anchors:** `frontend/src/components/credit/StateBadge.tsx` (source of truth), `AssetManagement.tsx`, `CRM*.tsx`, `ApprovalQueue.tsx`
**LOE:** S (2 d incl. primitive lift)

**Approach**
1. **Pre-step:** move `StateBadge` and `RiskBadge` to `frontend/src/components/ui/` (audit §11). Keep old import paths via re-export for one release.
2. Grep for hardcoded color literals in status chips: `grep -rE "(bg-(red|amber|green|yellow)-(100|200|500))|#[0-9a-fA-F]{6}" frontend/pages frontend/src/pages`.
3. Replace each occurrence with `<StateBadge state="…" />`. Add any missing state mappings (asset states, CRM stages, approval priority) into the StateBadge map.

**Acceptance**
- [ ] `frontend/src/components/ui/StateBadge.tsx` exists; credit path re-exports.
- [ ] All asset/CRM/approval status chips render via `<StateBadge>`.
- [ ] No new raw hex introduced in changed files (ESLint rule optional — defer to W2).

---

## Q5 — `aria-live` polite region for toasts

**File anchors:** `frontend/App.tsx:434`
**LOE:** XS (20 min)

**Approach:** wrap the toast container in `<div role="status" aria-live="polite" aria-atomic="true">`. Error toasts get `role="alert"` / `aria-live="assertive"`.

**Acceptance**
- [ ] VoiceOver/NVDA announces toast text on appearance.
- [ ] No double-announcement (test with two queued toasts).

---

## Q6 — Replace global spinner in Reports with skeleton

**File anchors:** `frontend/pages/Reports.tsx:48`
**LOE:** XS (45 min)

**Approach:** introduce a minimal `<Skeleton />` primitive in `frontend/src/components/ui/Skeleton.tsx` (animated `bg-gray-200` block). Replace the full-page spinner with skeleton cards mirroring the report layout (3 KPI cards + 1 chart placeholder).

**Acceptance**
- [ ] No layout shift between skeleton and loaded state.
- [ ] Skeleton respects `prefers-reduced-motion` (no shimmer).

---

## Q7 — Date-range selector on Reports

**File anchors:** `frontend/pages/Reports.tsx`, ITSM/CRM/Credit report service endpoints
**LOE:** S (1.5 d)

**Approach**
1. Add a `<DateRangePicker>` with presets (Today, 7d, 30d, MTD, QTD, YTD, Custom). Reuse MUI X DateRangePicker if already on deps, else simple two-input fallback.
2. Pass `from` / `to` as ISO query params to existing report endpoints. Verify backend honors them (it should — `reports.service.ts` already filters by range; confirm).
3. Persist selection in URL (`?from=…&to=…`) so links are shareable.

**Acceptance**
- [ ] Default range = last 30 days.
- [ ] Range change refetches all KPI tiles + charts on the page.
- [ ] URL reflects current range; reload restores it.

---

## Q8 — Promote KB to prod behind feature flag

**File anchors:** `frontend/App.tsx:507`, feature-flag util (create if missing: `frontend/src/lib/featureFlags.ts`)
**LOE:** XS (30 min)

**Approach:** introduce a trivial flag reader (`import.meta.env.VITE_FEATURE_KB` or a `localStorage` override for QA). Gate the KB nav link + route. Default ON in staging, ON for admins in prod (role check), OFF for end users.

**Acceptance**
- [ ] Toggling `VITE_FEATURE_KB=false` hides the nav entry and route.
- [ ] Direct URL access returns 404 (or redirect) when flag off.

---

## Q9 — Hide "OPENAI_API_KEY" from user error text

**File anchors:** `frontend/pages/CrmDashboard.tsx:59`, and backend AI controller error path
**LOE:** XS (15 min)

**Approach:** backend should never echo env-var names in 4xx/5xx bodies. Replace with generic `"AI service unavailable"` + correlation ID. Frontend just renders `error.message` — fix the source.

**Acceptance**
- [ ] Forcing AI failure shows: "AI service is temporarily unavailable. (ref: <id>)" — no secret-name leakage.
- [ ] Server log still has the real reason.

---

## Q10 — Environment banner

**File anchors:** `frontend/App.tsx` (AppShell), `frontend/src/components/ui/EnvironmentBanner.tsx` (new)
**LOE:** S (1 d)

**Approach**
- Read `VITE_ENV` (`local|dev|staging|prod`).
- Render a 24px sticky top strip on non-prod: "DEV ENVIRONMENT — changes do not affect production." Color-coded (orange dev, purple staging).
- Hidden in prod entirely (no DOM).
- Dismissible per-session via `sessionStorage` (but reappears on refresh — intentional safety).

**Acceptance**
- [ ] Banner visible in local/dev/staging only.
- [ ] Adds correct top padding so it doesn't overlap header.
- [ ] Mobile-safe.

---

## Q11 — `aria-describedby` on form errors

**File anchors:** `frontend/src/components/request/RequestFormFields.tsx`, and any other form using the pre-AutosaveTextField pattern
**LOE:** S (1.5 d)

**Approach**
- For every `<input>`/`<select>`/`<textarea>` with an adjacent error message, generate a stable id (`useId()`), set `aria-describedby` and `aria-invalid`.
- Error message gets `role="alert"`.
- Pattern already exists in `AutosaveTextField.tsx` (audit obs 886) — copy that.

**Acceptance**
- [ ] axe-core scan on Create Request form: 0 form-label / aria violations.
- [ ] Screen reader announces the error when validation fails.

---

## Q12 — Bulk-approve preview modal

**File anchors:** `frontend/pages/ApprovalQueue.tsx`, `frontend/src/pages/MyApprovals.tsx`
**LOE:** S (1.5 d)

**Approach**
- Add row checkboxes + a "Bulk approve (N)" button (hidden when N=0).
- On click, show modal listing each selected item: ref, amount/scope, requester, policy match.
- Single comment field applies to all. Confirm → fire approvals sequentially, show per-row success/fail status.
- Disable bulk for items requiring committee review (server marks them `bulkable=false`).

**Acceptance**
- [ ] Cannot bulk-approve items above the user's approval limit.
- [ ] If any approval fails, modal shows which and lets user retry the rest.
- [ ] Keyboard-navigable.

---

## Q13 — "Recently used services" on desk landing

**File anchors:** `frontend/pages/ITSupport.tsx` (+ HR/Finance landings)
**LOE:** S (1 d)

**Approach**
- Backend: `GET /api/v1/requests/recent-services?limit=6` returning the user's last 6 distinct service types.
- Frontend: row of 6 tiles above the full grid, "Recently used".
- Empty state for new users: hide the row entirely (don't show "no recent services").

**Acceptance**
- [ ] Row reflects current user's history, not global.
- [ ] Updates after a new request is submitted.

---

## Q14 — Save Draft chip in CreateRequest

**File anchors:** `frontend/pages/CreateRequest.tsx`
**LOE:** S (1 d)

**Approach**
- Auto-save form state to `localStorage` keyed by service type + userId every 2s (debounced).
- Visible chip top-right: "Draft saved 12s ago" / "Saving…".
- On mount, if a draft exists, banner: "Restore draft from 2h ago? [Restore] [Discard]".
- Clear draft on successful submit.

**Acceptance**
- [ ] Refresh mid-form does not lose data (with consent).
- [ ] Drafts are user-scoped — switching user does not leak data.
- [ ] Manual "Discard draft" works.

---

## Q15 — Out-of-office field on user profile

**File anchors:** `frontend/src/pages/ChangePassword.tsx` (profile page), `backend/src/services/user.service.ts`, Prisma migration
**LOE:** S (2 d — backend + FE + migration)

**Approach**
1. **Schema:** add `outOfOffice Boolean @default(false)`, `oooFrom DateTime?`, `oooUntil DateTime?`, `oooDelegateId String?` on `User`.
2. **API:** `PATCH /api/v1/users/me/ooo`.
3. **Profile UI:** toggle + date range + delegate-picker (optional — full delegation lands in W3).
4. **Display:** show "🌴 Out until 30 May" next to user name in approval queue + request assignee.

**Acceptance**
- [ ] Migration runs cleanly on dev DB.
- [ ] OOO badge visible wherever assignee is shown.
- [ ] No approval routing change yet (delegation is W3) — this only **surfaces** the status.

---

## Cross-cutting checks (run before each PR)

- [ ] `npm run lint` clean
- [ ] `tsc --noEmit` clean in both backend & frontend
- [ ] Tested in Chrome + Safari + Firefox
- [ ] Tested at 375px mobile width
- [ ] axe DevTools: no new violations on touched pages
- [ ] No raw hex colors introduced (`grep -E "#[0-9a-fA-F]{6}"` on diff)
- [ ] Screenshots in PR description (before/after) for visual items (Q2, Q4, Q6, Q10, Q12, Q14)

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Q1 reference URLs collide with existing routes | Use `/r/:ref` prefix to namespace |
| Q4 sweep introduces visual regressions | Land primitive lift first, do sweep in a separate PR with screenshots |
| Q7 backend doesn't accept date range on all 3 report endpoints | Verify before sprint planning; spike on day 1 |
| Q15 migration on prod | Run during low-traffic window; column is nullable so safe |
| Scope creep into W2 items | Hard cutoff: no DataTable refactor, no RequestDetail surgery, no /inbox |

---

## Done definition for W1

- All 15 PRs merged to `main` (or feature branch for staged release).
- Audit scores expected to improve:
  - Accessibility: 5.4 → ~6.2
  - Design Consistency: 5.0 → ~5.8
  - Production Readiness: 6.1 → ~6.6
- Stakeholder demo at end of Sprint 2 covering: ref URLs, SLA bar, env banner, bulk approve, draft restore, OOO.

---

**Next:** awaiting your review. Flag any items to defer, re-sequence, or expand before kickoff.

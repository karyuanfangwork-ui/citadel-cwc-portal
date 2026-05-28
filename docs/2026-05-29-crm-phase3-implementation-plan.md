# CRM Phase 3 — Implementation Plan

**Based on:** `docs/2026-05-27-crm-enterprise-audit.md` (28 May 2026)  
**Date:** 29 May 2026  
**Author:** AI Enterprise Consultant  
**Current state:** Phase 1 & 2 complete (17/28 items resolved, 61%). Score: 5.5 → 7.0/10

---

## Current State Summary

| Area | Already Exists (Backend) | Missing (Frontend/UI) |
|------|--------------------------|----------------------|
| Audit Trail | `AuditLog` model + writes on every CRM CUD op | No CRM-specific audit read UI; admin audit log at `/admin/audit-logs` exists but not surfaced in CRM pages |
| Activity Edit/Delete | `PATCH/DELETE /crm/activities/:id` | No edit/delete buttons on activity cards |
| Document Checklist | `GET /crm/ai/trust-products/:id/document-checklist` + `useDocumentChecklist` hook | Hook never consumed; no UI on Trust Products tab |
| Mobile Nav | N/A | `CrmNav` is horizontal scroll only; no hamburger/bottom nav |
| TypeScript Casts | N/A | `CrmOpportunities` form uses `as any` for field access |
| Reports Date Picker | N/A | Manual from/to state, no date component |
| Activity Pagination | Backend returns all activities | No server-side pagination params |
| AI Next Best Action | N/A | No backend endpoint or frontend UI |

---

## Sprint 1 — Quick Fixes & Compliance (3-4 days)

**Theme:** Low-hanging fruit that directly impacts daily usability and compliance

| # | Item | Effort | Files | Details |
|---|------|--------|-------|---------|
| 1A | **Activity Edit/Delete UI** | 1.5 days | All 4 detail pages (Lead, Contact, Account, Opportunity) | Add "Edit" icon + "Delete" icon on each activity card. Edit opens a modal pre-populated with the activity data (reuse `LogActivity` modal pattern). Delete uses existing `ConfirmDialog`. Service methods `updateActivity`/`deleteActivity` already exist. Gate delete by `crm:delete` permission. |
| 1B | **Document Checklist UI** | 2 days | `CrmAccountDetail.tsx` Trust Products tab | Per trust product row, add "AI Checklist" button → calls `useDocumentChecklist` (already exists in `useCrmAi.ts` but unused). Display checklist in a slide-over or modal: document name, description, required badge, checklist status. Simple toggle for each item (optional enhancement). |
| 1C | **Fix `CrmOpportunities` form `as any` cast** | 0.5 day | `CrmOpportunities.tsx` | Replace `(form as any).fieldName` with properly typed form state. Define a `CrmOpportunityFormData` interface or use Zod schema inference. |
| 1D | **Detail page activity list pagination** | 1 day | Backend: `crm.controller.ts` → `listActivities`; Frontend: All 4 detail pages | Add `page` + `limit` query params to `GET /crm/activities`. Frontend: replace unbounded fetch with paginated list with "Load More" button or simple prev/next. Default `limit=20`. |

---

## Sprint 2 — Audit Trail & Navigation (5-7 days)

**Theme:** Compliance visibility and mobile usability

| # | Item | Effort | Files | Details |
|---|------|--------|-------|---------|
| 2A | **CRM Audit Trail UI** | 3 days | New: `CrmAuditLog.tsx` component; Modify: All 4 detail pages | The `AuditLog` model already exists with `oldValues`/`newValues` JSONB on every CRM CUD. Create a shared `CrmAuditLog` component that calls `GET /admin/audit-logs?resourceType=CrmLead&resourceId=:id` (admin users) or a new lightweight `GET /crm/audit/:entityType/:entityId` endpoint scoped to `crm:read`. Render as a timeline: timestamp, user email, action (CREATED/UPDATED/DELETED), old→new values diff. Add "Audit Log" tab to all 4 detail pages. |
| 2B | **Mobile-Optimized CrmNav** | 2 days | `CrmNav.tsx`, new `MobileCrmNav.tsx` or responsive refactor | On `md:` breakpoint and below, collapse the 10-tab horizontal bar into a hamburger drawer (use existing `Drawer.tsx` component). On mobile, show bottom nav with 5 key tabs: Dashboard, Pipeline, +Add (FAB button), Activities, Profile/More. Use Tailwind `md:` breakpoint. Keep current horizontal tabs for desktop. |
| 2C | **Reports Date Picker Component** | 1 day | `CrmReports.tsx` | Replace the manual `from`/`to` date inputs with a proper `DatePicker` component (can use HTML `<input type="date">` with validation, or a lightweight lib). Add presets: "This Month", "Last 30 Days", "Last Quarter", "Year to Date". Validate that from ≤ to. |

---

## Sprint 3 — Intelligence & Quality (4-5 days)

**Theme:** AI-driven productivity and data quality

| # | Item | Effort | Files | Details |
|---|------|--------|-------|---------|
| 3A | **AI Next Best Action** | 3-4 days | Backend: `crm-ai.service.ts` + `crm-ai.routes.ts` + `crm-ai.controller.ts`; Frontend: `CrmDashboard.tsx` + all 4 detail pages | New AI endpoint `POST /crm/ai/next-best-action` (entityType + entityId). Logic: analyze recent activities (last 7 days) + entity status + days since last contact → suggest 1-3 prioritized actions ("Call within 24h", "Send follow-up email", "Schedule meeting", "Update value estimate", "Review risk profile"). Frontend: show "Suggested Actions" card on Dashboard + action chips on detail pages. Follow existing AI pattern (lazy-init OpenAI, `parseJson()` helper, fire-and-forget on page load). |
| 3B | **Refactor inline AI state → use existing hooks** | 2 days | All 4 CRM detail pages + Dashboard | Each page currently duplicates AI state management inline (useState + useEffect + crmService calls). Refactor to actually import and use `useCrmAi.ts` hooks (`useLeadScore`, `useWinProbability`, `useAnalyzeNote`, etc.) instead of inline duplication. This eliminates ~200 lines of duplicated state logic and makes AI features maintainable. |
| 3C | **Activity Reminder Improvements** | 1 day | Activity cards on detail pages | Already have `reminderSent` field. Enhance: show "Reminded ✓" badge on activities where reminder was sent. Add "Set Reminder" button on future scheduled activities that creates an in-app notification via `notify()`. |

---

## PRIORITY SUMMARY

```
Sprint 1 (3-4 days):  Activity Edit/Delete → Document Checklist → as any fix → Pagination
Sprint 2 (5-7 days):  Audit Trail UI → Mobile Nav → Date Picker
Sprint 3 (4-5 days):  AI Next Best Action → Refactor AI Hooks → Reminder Enhancements
```

**Total estimated effort: 12-16 days (2.5-3 weeks)**

---

## DEFERRED TO PHASE 4

These items from the audit are intentionally deferred — they require significant new infrastructure:

| Item | Reason | Estimated Effort |
|------|--------|-------------------|
| Email/Calendar integration (Gmail, Outlook) | Requires OAuth flows, new models, external API integration | 4-6 weeks |
| Workflow automation engine | Requires trigger/action framework, new Prisma models, UI builder | 4-6 weeks |
| Import/Export tool (CSV/Excel) | New upload pipeline, validation, async processing | 2 weeks |
| Configurable dashboard widgets | Drag-and-drop widget framework | 3-4 weeks |
| AI Pipeline Anomaly Detection | Needs historical stage dwell data accumulated first | 3-4 weeks |
| Custom fields/objects | Schema extension framework | 6-8 weeks |
| Bulk merge/duplicate detection | Fuzzy matching + merge UI | 2-3 weeks |
| Territory/Quotas model + UI | New Prisma models, assignment rules, quota tracking | 3-4 weeks |

---

## REMEDIATION TRACKER UPDATE

> Extending the audit tracker from `2026-05-27-crm-enterprise-audit.md`

| # | Audit Finding | Severity | Sprint | Status |
|---|---------------|----------|--------|--------|
| 18 | No mobile-first design (CrmNav overflows) | Medium | Phase 3 Sprint 2 | 🟡 PLANNED |
| 19 | No real-time updates (polling/SSE for CRM data) | Low | — | 🔴 DEFERRED (Phase 4+) |
| 20 | No audit trail for CRM entity changes | High | Phase 3 Sprint 2 | 🟡 PLANNED |
| 21 | No email/calendar integration | High | — | 🔴 DEFERRED (Phase 4) |
| 22 | No workflow automation engine | High | — | 🔴 DEFERRED (Phase 4) |
| 23 | Document Checklist UI missing (API exists) | Medium | Phase 3 Sprint 1 | 🟡 PLANNED |
| 24 | No bulk merge/duplicate detection UI | Medium | — | 🔴 DEFERRED (Phase 4) |
| 25 | No configurable dashboard widgets | Medium | — | 🔴 DEFERRED (Phase 4) |
| 26 | Activity edit/delete missing | Medium | Phase 3 Sprint 1 | 🟡 PLANNED |
| 27 | No pagination on detail page activity lists | Low | Phase 3 Sprint 1 | 🟡 PLANNED |
| 28 | Fix CrmOpportunities form `as any` TypeScript cast | Medium | Phase 3 Sprint 1 | 🟡 PLANNED |
| 29 | Reports date picker component | Low-Medium | Phase 3 Sprint 2 | 🟡 PLANNED |
| 30 | AI Next Best Action | High | Phase 3 Sprint 3 | 🟡 PLANNED |
| 31 | Refactor inline AI hooks (technical debt) | Medium | Phase 3 Sprint 3 | 🟡 PLANNED |
| 32 | Activity reminder enhancements (badge + set button) | Low | Phase 3 Sprint 3 | 🟡 PLANNED |

---

## ARCHITECTURE NOTES

### Audit Trail UI — Design Decisions

1. **Endpoint choice:** Option A — reuse `GET /admin/audit-logs` with `resourceType=CrmLead&resourceId=:id` filter (requires `admin:access` permission). Option B — new `GET /crm/audit/:entityType/:entityId` scoped to `crm:read`. Recommend Option B for CRM users who aren't admins.

2. **Diff rendering:** `oldValues` and `newValues` are JSONB. Show as key-value diff: `Status: NEW → CONTACTED`, `Value: 50000 → 75000`. Use color coding (red for removed, green for added).

3. **Tab placement:** Add "Audit Log" as the last tab on all 4 detail pages (Lead, Contact, Account, Opportunity). Lazy-load on tab click.

### Mobile CrmNav — Design Decisions

1. **Breakpoint:** Use `md:` (768px) as the toggle point. Below 768px → hamburger/drawer. Above → current horizontal tabs.

2. **Bottom nav items (mobile):** Dashboard, Pipeline, "+Add" (FAB), Activities, More (drawer). The "More" item opens the full tab list in a Drawer component.

3. **Existing Drawer.tsx:** Already available at `frontend/src/components/ui/Drawer.tsx`. Reuse it.

### Activity Edit/Delete — Design Pattern

1. **Edit:** Reuse existing "Log Activity" modal. Pre-populate all fields. Change title to "Edit Activity". Call `crmService.updateActivity(id, data)`.

2. **Delete:** Use existing `ConfirmDialog` component. Call `crmService.deleteActivity(id)`. Refresh activity list on success.

3. **Permission:** Delete gated by `crm:delete` permission (same as entity delete pattern). Edit gated by `crm:write`.

4. **Icons:** `EditIcon` (pencil) and `DeleteIcon` (trash) appear on hover, top-right of each activity card. Consistent with existing inline-edit patterns.

### Document Checklist — Design Pattern

1. **Trigger:** "AI Checklist" button per trust product row in the Trust Products tab of AccountDetail.

2. **Display:** Modal/panel showing checklist items: name, description, required badge. Follow existing AI card pattern (`AiInsightCard.tsx`).

3. **Hook:** `useDocumentChecklist(trustProductId)` already exists in `useCrmAi.ts` but is never imported. Simply import and use it.

---

*End of Phase 3 implementation plan.*
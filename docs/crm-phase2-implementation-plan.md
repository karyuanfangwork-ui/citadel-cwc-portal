# CRM Phase 2 — Implementation Plan

> **Based on:** Enterprise CRM Module Audit (docs/2026-05-27-crm-enterprise-audit.md), Phase 2 items #11–20
> **Phase 1 Status:** Complete (items #1–10, all 3 sprints done)
> **Phase 2 Goal:** Transform CRM from "functional CRUD" to "daily workflow powerhouse" — inline editing, charts, reassignment, bulk ops, reminders, and reports that drive decisions.

---

## Phase 2 Coverage Map

| Audit # | Item | Sprint | Notes |
|---------|------|--------|-------|
| 11 | Inline editing on detail pages | 1 | Click-to-edit on LeadDetail, OppDetail, AccountDetail, ContactDetail |
| 12 | Chart visualizations in Reports | 1 | Recharts bars, pies, funnels replacing 5 table-only reports |
| 13 | Lead reassignment UI | 1 | Owner dropdown on Team Dashboard + detail pages |
| 14 | Activity reminder/notification system | 2 | CrmActivity.scheduledAt → notification on due; SSE reminder |
| 15 | Bulk operations | 2 | Multi-select rows, bulk assign, bulk status change |
| 16 | Drill-down from Team Dashboard | 2 | Clickable agent names → filtered pipeline |
| 17 | ~~Form validation with error messages~~ | — | **Done in Phase 1 Sprint 3** |
| 18 | Mobile-optimized CrmNav | 3 | Hamburger menu on mobile, bottom nav |
| 19 | Document Checklist UI | 3 | ContactDetail/KYC tab → checklist panel |
| 20 | Configurable list view | 3 | Column chooser, sort, page size peristence |

---

## Sprint 1 (Week 1–2): Inline Edit + Charts + Reassignment

> **Theme:** "Make everything editable and everything visual"

### 1.1 Inline Editing on Detail Pages

**Goal:** Click any field value on LeadDetail, OppDetail, AccountDetail, ContactDetail to edit in-place. No more "open modal, find field, save" friction.

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`
- Modify: `frontend/pages/CrmOpportunityDetail.tsx`
- Modify: `frontend/pages/CrmAccountDetail.tsx`
- Modify: `frontend/pages/CrmContactDetail.tsx`
- Create: `frontend/src/components/crm/InlineEdit.tsx`

**Implementation:**

Create a reusable `InlineEdit` component:

```tsx
// InlineEdit.tsx — renders value as text, switches to input on click
interface InlineEditProps {
  value: string | number | null;
  onSave: (newValue: string) => Promise<void>;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { label: string; value: string }[];  // for select type
  display?: string;  // override display (e.g., for enums => labels)
  className?: string;
  editable?: boolean;  // default true, false = read-only
}
```

Behavior:
- Default: renders value as styled text with subtle hover underline + pencil icon
- Click: transforms to input/select with the current value, Save/Cancel buttons
- Save: calls `onSave` with new value, shows spinner, reverts on error
- Cancel / Escape: reverts to display mode
- Tab: moves to next InlineEdit on the page (natural tab order)

Apply to high-value fields on each detail page:
- **LeadDetail:** title, estimatedValue, source, status, contactName, contactEmail, contactPhone, companyName
- **OppDetail:** name, value, probability, expectedCloseDate, stage (select)
- **AccountDetail:** name, industry, companySize, website, phone, email, annualRevenue, address fields
- **ContactDetail:** firstName, lastName, email, phone, mobile, jobTitle, department, riskProfile (select)

### 1.2 Chart Visualizations in Reports

**Goal:** Replace 5 table-only report tabs with Recharts visualizations. Keep tables below charts as detail.

**Files:**
- Modify: `frontend/pages/CrmReports.tsx`
- Package: `recharts` (add to frontend dependencies)

**Implementation:**

Install Recharts:
```bash
cd frontend && npm install recharts
```

Add charts to 5 report tabs:

| Report Tab | Chart Type | Data Mapping |
|------------|-----------|--------------|
| Lead Conversion | BarChart (by source), PieChart (by status) | `report.data.bySource` / `report.data.byStatus` |
| Sales Performance | BarChart (by agent, colored by won/lost) | `report.data.agents` |
| Pipeline Forecast | FunnelChart (stages × probability) | `report.data.stages` |
| Win/Loss | PieChart (won vs lost), BarChart (by month) | `report.data` |
| Lead Aging | BarChart (stacked: >30d, >60d, >90d) | `report.data.segments` |

Chart specs:
- Responsive container (width="100%", height=300)
- Brand color palette: `#4F46E5` (indigo-600), `#10B981` (emerald-500), `#F59E0B` (amber-500), `#EF4444` (red-500), `#8B5CF6` (violet-500)
- Tooltip with formatted values (RM currency for monetary)
- Legend at bottom
- Chart + table layout: chart on top (60% height), table below (collapsible)

### 1.3 Lead Reassignment UI

**Goal:** Managers can reassign leads/opportunities from Team Dashboard. Reps can see owner and request reassignment from detail pages.

**Files:**
- Modify: `frontend/pages/CrmTeamDashboard.tsx`
- Modify: `frontend/pages/CrmLeadDetail.tsx`
- Modify: `frontend/pages/CrmOpportunityDetail.tsx`
- Modify: `frontend/src/services/crm.service.ts`

**Implementation:**

**Team Dashboard — Assign action column:**
- Add "Reassign" button to each agent row's menu
- Click opens dropdown of all active sales reps
- Selection calls `crmService.updateLead(id, { ownerId })` or `crmService.updateOpportunity(id, { ownerId })`
- Success toast: "Lead reassigned to Alice Tan"

**Detail Pages — Owner chip with edit:**
- Replace static owner display with clickable owner chip
- Click opens a small popover with rep selector
- Uses existing `crmService.updateLead`/`updateOpportunity` with `{ ownerId }`
- Permission gate: `crm:admin` for reassign, `crm:read` for view-only

**Prerequisite check:**
```bash
# Verify updateLead/updateOpportunity accept ownerId
grep -n "ownerId" backend/src/controllers/crm.controller.ts | head -10
```

---

## Sprint 2 (Week 3–4): Reminders + Bulk Ops + Team Drill-Down

> **Theme:** "Never miss a follow-up, manage at scale"

### 2.1 Activity Reminder / Notification System

**Goal:** When a CrmActivity has `scheduledAt` in the future, fire an in-app notification + SSE push 15min before due time. Show overdue badge on activities.

**Files:**
- Modify: `backend/prisma/schema.prisma` — Add `reminderSent` flag to CrmActivity
- Create: `backend/src/services/crm-reminder.service.ts` — Check due activities, create notifications
- Modify: `backend/src/jobs/crm-checker.ts` — Add 15-min cron for reminder checks
- Modify: `frontend/src/services/crm.service.ts` — Add `reminderSent` to CrmActivity interface
- Modify: `frontend/pages/CrmLeadDetail.tsx` — Show overdue badge on activities
- Modify: `frontend/pages/CrmOpportunityDetail.tsx` — Show overdue badge on activities

**Implementation:**

1. **Schema change:** Add `reminderSent Boolean @default(false)` to CrmActivity
2. **Backend service:** `checkDueActivities()` — find activities where `scheduledAt <= now + 15min AND reminderSent = false`, create notification for `userId`, mark `reminderSent = true`
3. **Cron job:** `*/15 * * * *` — every 15 minutes check
4. **Frontend:** Overdue badge (red pill) on activities where `scheduledAt < now && completedAt == null`
5. **SSE integration:** Activity reminder notifications show via existing SSE notification stream

### 2.2 Bulk Operations

**Goal:** Multi-select rows on list pages, then bulk assign, bulk status change, or bulk delete.

**Files:**
- Create: `frontend/src/components/crm/BulkActionBar.tsx` — Floating action bar (appears when rows selected)
- Modify: `frontend/pages/CrmLeads.tsx`
- Modify: `frontend/pages/CrmOpportunities.tsx`
- Modify: `frontend/pages/CrmContacts.tsx`
- Modify: `frontend/pages/CrmAccounts.tsx`
- Add: Backend batch endpoints (or loop existing API calls client-side for simplicity)

**Implementation:**

1. **BulkActionBar component:**
   - Appears at bottom of viewport when 1+ rows selected
   - Shows count: "3 leads selected"
   - Actions: Assign Owner, Change Status, Delete
   - ConfirmDialog before destructive actions

2. **Row selection:**
   - Add checkbox column to each list's first column
   - "Select All" checkbox in header
   - Selected state: `Set<string>` of IDs
   - Shift-click for range selection

3. **Bulk actions:**
   - Assign: dropdown of reps → calls `updateLead(id, { ownerId })` for each
   - Status: dropdown of statuses → calls `updateLead(id, { status })` for each
   - Delete: ConfirmDialog → calls `deleteLead(id)` for each
   - Toast on completion: "3 leads reassigned to Alice Tan"

4. **Backend approach:** Client-side loop for Phase 2 (simplicity). If performance issues arise, add `POST /api/v1/crm/leads/batch` in Phase 3.

### 2.3 Drill-Down from Team Dashboard

**Goal:** Click manager's name or KPI → see their pipeline. Click agent row → see that agent's leads/opportunities.

**Files:**
- Modify: `frontend/pages/CrmTeamDashboard.tsx`
- (No backend changes — existing list endpoints accept `ownerId` filter)

**Implementation:**

1. **Agent table rows are now clickable:**
   - Click agent row → navigate to `/crm/leads?ownerId={agentId}` or `/crm/opportunities?ownerId={agentId}`
   - Cursor pointer, hover highlight

2. **KPI cards on Team Dashboard are now clickable:**
   - "Total Pipeline Value" → `/crm/opportunities`
   - "Open Leads" → `/crm/leads`
   - Pass `ownerId` query param when drilling from a specific agent

3. **URL filter support:**
   - `CrmLeads.tsx` and `CrmOpportunities.tsx` read `ownerId` from URL search params
   - Pre-filter list by owner on page load
   - Show active filter chip: "Showing Alice Tan's leads" with X to clear

---

## Sprint 3 (Week 5–6): Mobile Nav + Document Checklist + Configurable Views

> **Theme:** "Professional on any device, compliance-ready, personalized workspace"

### 3.1 Mobile-Optimized CrmNav

**Goal:** CrmNav collapses to hamburger on mobile. Bottom nav appears on small screens for 5 key sections.

**Files:**
- Modify: `frontend/src/components/CrmNav.tsx`
- Create: `frontend/src/components/crm/MobileCrmNav.tsx` (bottom nav bar)

**Implementation:**

1. **Desktop (≥768px):** Current horizontal tab bar (unchanged)
2. **Mobile (<768px):**
   - Top: Hamburger menu → slide-down panel with all 10 CRM nav items
   - Bottom: 5-item bottom nav (Dashboard / Pipeline / + Add / Team / Reports)
   - Active tab highlighted on bottom nav
   - "More" item on bottom nav opens the full hamburger menu
3. **CSS:** `hidden md:flex` on current tabs, `flex md:hidden` on bottom nav

### 3.2 Document Checklist UI

**Goal:** Surface the existing `getDocumentChecklist` AI feature on ContactDetail KYC tab as an interactive checklist.

**Files:**
- Modify: `frontend/pages/CrmContactDetail.tsx`
- Create: `frontend/src/components/crm/DocumentChecklist.tsx`
- Modify: `frontend/src/services/crm.service.ts` — Add `getDocumentChecklist` method (API exists, frontend method may be missing)
- Modify: `frontend/src/hooks/useCrmAi.ts` — Add `useDocumentChecklist` hook

**Implementation:**

1. **Checklist panel** on KYC tab (after existing KYC status cards):
   - Heading: "Document Checklist (AI-Generated)"
   - Generate button (calls AI endpoint)
   - List of required documents with:
     - Checkbox (mark as received/collected)
     - Document name + description
     - Status: Pending / Received / Expired
     - Expiry date (if applicable)
   - Progress bar: "5/8 documents collected"

2. **Persistence:**
   - Checklist state stored client-side initially (localStorage per contactId)
   - Phase 3 can add `CrmDocumentChecklistItem` model for server persistence

3. **AI integration:**
   - Calls `GET /api/v1/crm/ai/document-checklist/:contactId`
   - Returns `{ items: [{ name, description, required, category }] }`
   - Loading skeleton while generating

### 3.3 Configurable List Views

**Goal:** Users can choose visible columns, sort order, and page size on list pages. Settings persist in localStorage.

**Files:**
- Create: `frontend/src/components/crm/ColumnChooser.tsx` — Dropdown with toggle switches for columns
- Modify: `frontend/pages/CrmLeads.tsx`
- Modify: `frontend/pages/CrmOpportunities.tsx`
- Modify: `frontend/pages/CrmContacts.tsx`
- Modify: `frontend/pages/CrmAccounts.tsx`

**Implementation:**

1. **ColumnChooser component:**
   - Gear icon button in table header
   - Dropdown panel with all available columns as toggle switches
   - Drag to reorder (stretch goal — can defer)
   - "Reset to default" link
   - Minimum 2 columns must stay visible

2. **Persistence:**
   - `localStorage.setItem('crm-leads-columns', JSON.stringify(selectedColumns))`
   - Key pattern: `crm-{entity}-columns`
   - Page size: `crm-{entity}-pageSize` (10/25/50)

3. **Sort persistence:**
   - Click column header to sort (already works with current tables)
   - Store sort in URL params + localStorage
   - Restore on page load

4. **Column config type:**
```tsx
interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  sortable?: boolean;
  width?: string;
}
```

---

## Testing Checklist

After each sprint, verify:

### Sprint 1
- [ ] InlineEdit: click title on LeadDetail → edit → save → value updates without page reload
- [ ] InlineEdit: Escape cancels edit, reverts to original
- [ ] InlineEdit: select type works (status, source dropdowns)
- [ ] InlineEdit: error handling — API failure shows toast, reverts edit
- [ ] Charts: Lead Conversion bar chart renders with correct data
- [ ] Charts: Pipeline Forecast funnel chart renders
- [ ] Charts: Charts are responsive (resize window)
- [ ] Reassign: Manager clicks reassign on Team Dashboard → selects rep → lead ownership changes
- [ ] Reassign: Owner chip on detail pages opens rep selector
- [ ] Reassign: Permission gate — non-admins see owner but cannot change

### Sprint 2
- [ ] Reminder: Activity with scheduledAt 15min from now → notification fires
- [ ] Reminder: reminderSent flag prevents duplicate notifications
- [ ] Overdue badge: past-due activity shows red badge
- [ ] Bulk select: checkbox column on CrmLeads, shift-click range
- [ ] Bulk assign: select 3 leads → assign to rep → all 3 update
- [ ] Bulk delete: select 2 leads → confirm → both deleted
- [ ] BulkActionBar: appears/disappears with selection
- [ ] Drill-down: click agent row on Team Dashboard → filtered leads/opportunities
- [ ] Drill-down: URL param `?ownerId=X` pre-filters list

### Sprint 3
- [ ] Mobile: CrmNav collapses to hamburger on <768px viewport
- [ ] Mobile: Bottom nav shows 5 items, active tab highlighted
- [ ] Document Checklist: AI generates checklist on KYC tab
- [ ] Document Checklist: checkboxes toggle received status
- [ ] Document Checklist: progress bar updates
- [ ] Column chooser: toggle column visibility → table updates
- [ ] Column chooser: settings persist after page reload (localStorage)
- [ ] Page size: change to 25 → table shows 25 rows per page

---

## Build Verification Commands

After each sprint:
```bash
cd /Users/fangkaryuan/cwc2.0/citadel-cwc-portal
cd frontend && npx tsc --noEmit && npm run build
cd ../backend && npx tsc --noEmit && npm run build
```

---

## Risk Notes

1. **Recharts bundle size:** ~45KB gzipped. Acceptable for the value. If bundle size is a concern, use dynamic import: `const BarChart = lazy(() => import('recharts').then(m => ({ default: m.BarChart })))`.
2. **Bulk ops client-side loop:** For <50 items this is fine. For >50, add a batch endpoint in Phase 3.
3. **Document Checklist persistence:** Client-side localStorage for Phase 2. Add `CrmDocumentChecklistItem` Prisma model + API in Phase 3 if server persistence is needed.
4. **InlineEdit on mobile:** Tap-to-edit works on mobile but consider adding explicit edit icons for touch targets.
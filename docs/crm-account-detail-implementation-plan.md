# CRM Account Detail Page — Implementation Plan

**Parent audit:** `docs/crm-account-detail-audit.md`
**Date:** 4 June 2026
**Total issues:** 32 (4 HIGH, 19 MEDIUM, 9 LOW)
> Note: audit summary table incorrectly stated 15 MEDIUM; body documents 19 MEDIUM issues.
**Estimated total effort:** 12-14 days across 3 sprints

---

## Sprint 1: HIGH Severity + Quick Wins (3.5-4 days)

Focus: Eliminate data integrity risks and the most painful UX gaps.

| # | Audit Ref | Issue | Task | Effort |
|---|-----------|-------|------|--------|
| 1 | 5.2 | Dual edit-path inconsistency | Remove InlineEdit from Overview tab; route all field edits through the Edit Account modal only. The "Edit" button already opens the modal — this is the authoritative path. Delete InlineEdit imports and usage in Account Info card rows. | 0.5d |
| 2 | 5.1 | InlineEdit no undo/confirm | Resolved implicitly by #1 (removing InlineEdit). Add a success toast to the Edit Account modal save handler as extra polish. | 0.25d |
| 3 | 9.2 | No note actions (edit, delete, pin) | Add edit (pencil icon), delete (trash icon), and pin/unpin toggle buttons to each note card. Create `updateNote` and `deleteNote` service calls in `crm.service.ts` if missing. Add `showEditNote` / `editingNote` state + `handleEditNote` / `handleDeleteNote` handlers. | 1d |
| 4 | 11.2 | Trust Product Owner ID raw UUID | Replace the text input in Create/Edit Trust Product modal with a `<select>` dropdown populated from `crmUsers` state (already fetched on mount). Match the pattern used for Account Owner on Overview. | 0.5d |
| 5 | 2.1 | Stat chips not clickable | Add onClick to each stat chip: Contacts → `setActiveTab('contacts')`, Deals → `setActiveTab('deals')`, Leads → scroll to leads info, Revenue → `setActiveTab('deals')`. | 0.25d |
| 6 | 3.1 | AI action pills not clickable | Wire each pill: "Call within 24h" → `setShowAddActivity(true)` + `setActivityForm({ activityType: 'CALL' })`; "Send follow-up email" → `window.open(mailto:)` or open activity form as EMAIL; "Schedule meeting" → `setActivityForm({ activityType: 'MEETING' })` + `setShowAddActivity(true)`. | 0.5d |
| 7 | 6.2 | Email not clickable in Contacts tab | Wrap `c.email` in `<a href={\`mailto:\${c.email}\`} className="hover:underline">`. | 0.25d |
| 8 | 6.3 | Phone not clickable | Wrap `c.phone` in `<a href={\`tel:\${c.phone}\`} className="hover:underline">`. | 0.25d |
| 9 | 5.5 | Description card hidden when empty | Show Description card always. If `!account.description`, display placeholder "No description added — click Edit to add one." with a subtle prompt. | 0.25d |
| 10 | 11.1/12.1 | Empty state inconsistency | Replace plain text empty states in Trust Products tab and Audit Log tab with `<EmptyState>` component for consistency with other tabs. | 0.25d |

### Sprint 1 Dependency Notes
- Task #1 (remove InlineEdit) must be done first; it resolves #2 implicitly.
- Task #3 (note actions) may need backend API additions — check if `PATCH /api/v1/crm/notes/:id` and `DELETE /api/v1/crm/notes/:id` exist. If not, add them to the backend first.
- Task #4 reuses the `crmUsers` state already fetched on mount — no new API call needed.

### Sprint 1 Acceptance Criteria
- [ ] No InlineEdit components remain on the Overview tab
- [ ] Edit Account modal shows success toast on save
- [ ] Each note card has edit, delete, and pin/unpin buttons that work
- [ ] Trust Product Owner field is a user-name dropdown, not a UUID text input
- [ ] Clicking "2 Contacts" chip switches to Contacts tab (same for Deals, Revenue)
- [ ] Clicking AI action pill opens the correct pre-filled Log Activity modal
- [ ] Contact emails are clickable mailto links; phones are clickable tel links
- [ ] Description card always visible (with placeholder when empty)
- [ ] Trust Products and Audit Log empty states use <EmptyState> component

---

## Sprint 2: MEDIUM Severity — Structural & Navigation (6-7 days)

Focus: Tab UX, action grouping, form completeness, data display.

| # | Audit Ref | Issue | Task | Effort |
|---|-----------|-------|------|--------|
| 11 | 4.1 | Weak active tab styling | Bold font-weight + brand-700 text color on active tab. Currently only the 2px bottom border changes. Add `font-bold` and `text-brand-700` to active tab className. | 0.25d |
| 12 | 4.3 | No ARIA tab roles | Add `role="tablist"` to tab container div, `role="tab"` + `aria-selected={activeTab === tab}` + `aria-controls` to each tab button. Add `role="tabpanel"` to tab content panels. Add left/right arrow key handler for keyboard navigation. | 0.5d |
| 13 | 1.1 | Delete button risk | Move Delete out of the header button row. Add a "More" dropdown (kebab icon) containing Delete. Keep Edit and Log Activity as visible buttons. The dropdown should have a danger-styled Delete option with a warning icon. | 0.5d |
| 14 | 1.2 | Action button grouping on narrow screens | Restructure header buttons: primary group (Log Activity, Add Note) always visible; secondary group (Website, Edit, More) with smaller styling. "More" dropdown contains Delete. Add `flex-wrap` with consistent gap. | 0.5d |
| 15 | 5.3 | Read-only vs editable visual distinction | Add `bg-bg-subtle` background + `opacity-80` + a small lock icon (`lock` material symbol) to read-only field rows (Registration No, Tax No, Bank Account, Purchase Cash Trust, Active, Created, Updated). | 0.25d |
| 16 | 5.4 | No address on Overview | Add address display rows at the bottom of the Account Info card: Address, City, State, Postal Code, Country — all read-only. Format as a single address block or individual rows matching existing layout. | 0.5d |
| 17 | 6.1 | No Add Contact button in Contacts tab | Add "Add Contact" button at top of Contacts tab (right-aligned). On click, navigate to `/crm/contacts/new?accountId=${account.id}`. | 0.25d |
| 18 | 7.1 | No Create Opportunity button | Add "Create Opportunity" button at top of Deals tab. Navigate to `/crm/opportunities/new?accountId=${account.id}`. | 0.25d |
| 19 | 8.1 | No activity filter/sort | Add filter pill row at top of Activities tab: All, Call, Email, Meeting, Note, Task, Follow Up, WhatsApp, Site Visit. Client-side filter on `account.activities` by `activityType`. Add sort dropdown: Newest first / Oldest first. | 1d |
| 20 | 8.2 | Create Activity modal missing fields | Add Scheduled At (`datetime-local` input), Completed At (`datetime-local` input), and Duration (`number` input, minutes) fields to the Create Activity modal (`showAddActivity`). Update `activityForm` initial state and `handleAddActivity` to include all three fields. | 0.5d |
| 21 | 9.1 | Raw markdown notes | **Decision required:** The audit explicitly recommends the Tiptap viewer ("per WYSIWYG preference"), which is consistent if Tiptap is already used in the note creation form. If note creation uses Tiptap, use `@tiptap/react` `EditorContent` in read-only mode to avoid rendering inconsistency. If note creation is plain textarea, use `react-markdown` (or `snarkdown` ~1KB for smaller bundle). Confirm before implementing. Render note `content` as HTML instead of raw `<p>`. Ensure XSS-safe rendering. | 1d |
| 22 | 10.1 | Credit tab navigation-only | Fetch borrower profile count for this account via credit service. If API endpoint doesn't exist, add `GET /api/v1/credit/borrowers?accountId=X&count=true` to backend. Show summary card with: # borrower profiles, # open applications, total outstanding (if available). Below summary, keep existing link buttons. | 1d |
| 23 | 13.3 | Industry/Company Size free text in Edit modal | Convert both to `<select>` dropdowns. Industry options: Technology, Finance, Healthcare, Manufacturing, Retail, Education, Construction, Real Estate, Legal, Conglomerate, Family Office, Other (matching list page filter). Company Size options: 1-10, 11-50, 51-200, 201-500, 501-1000, 1000+. | 0.5d |
| 24 | 13.1 | Modal Save/Cancel hidden below scroll | Make the modal footer (`flex justify-end gap-3`) sticky. Apply `sticky bottom-0 bg-white border-t border-border p-4 z-10` to the footer container. | 0.25d |
| 25 | 13.2 | Revenue raw number in edit modal | Add input formatting: on change, strip non-numeric chars; on display, format with commas. Use a controlled component that displays "12,000,000" but stores 12000000. | 0.25d |
| 26 | 14.1 | Sidebar no tooltips | Audit rates MEDIUM — moved here from Sprint 3. Add `title` attributes to all 19 sidebar nav `<Link>` elements in the sidebar layout component (not in CrmAccountDetail.tsx). | 0.25d |

### Sprint 2 Dependency Notes
- Tasks #13 and #14 overlap (both restructure header buttons) — do them together.
- Task #21 (markdown notes): confirm whether note creation uses Tiptap or plain textarea first — use `@tiptap/react` read-only `EditorContent` if Tiptap is already in use, otherwise `react-markdown`. See task for full decision guide.
- Task #22 (Credit tab summary) may need a new backend endpoint. Check with backend team first. If blocked, implement with a loading skeleton and proceed with other tasks.
- Task #19 (activity filter/sort) should be designed to work with the existing `loadMoreActivities` pagination — filter only applies to already-loaded items.

### Sprint 2 Acceptance Criteria
- [ ] Active tab has bold text + brand color (clearly distinct from inactive)
- [ ] Tabs have ARIA roles and support arrow-key navigation
- [ ] Delete is in a "More" dropdown, not a standalone button
- [ ] Header buttons are grouped: primary (Log Activity, Add Note) + secondary (More dropdown)
- [ ] Read-only fields on Overview have distinct visual styling (subtle bg + lock icon)
- [ ] Address is displayed on the Overview tab
- [ ] Contacts tab has "Add Contact" button
- [ ] Deals tab has "Create Opportunity" button
- [ ] Activities tab has filter pills and sort dropdown
- [ ] Create Activity modal includes Scheduled At, Completed At, and Duration fields
- [ ] Notes render markdown correctly (bold, lists, links) — renderer matches note creation editor
- [ ] Credit tab shows borrower/application counts (or skeleton if API missing)
- [ ] Industry and Company Size are dropdown selects in Edit Account modal
- [ ] Edit Account modal footer is sticky (visible without scrolling)
- [ ] Revenue input shows comma-formatted numbers
- [ ] All sidebar icons have tooltip text on hover

---

## Sprint 3: LOW Severity + Polish (2.5 days)

Focus: Visual polish, micro-interactions, and consistency.

| # | Audit Ref | Issue | Task | Effort |
|---|-----------|-------|------|--------|
| 26 | 4.2 | Tab overflow on narrow screens | Add `overflow-x: auto` + `-webkit-overflow-scrolling: touch` + hide-scrollbar CSS (`scrollbar-width: none; &::-webkit-scrollbar { display: none }`) to tab bar container. | 0.25d |
| 27 | 3.2 | AI skeleton loading | Replace "Loading suggested actions..." text with 3 grey pill-shaped divs with `animate-pulse` class matching the final action badge dimensions (~80x24px). | 0.25d |
| 28 | 8.3 | Activity type as plain text | Render as colored badge. Map each type to a color: CALL=blue, EMAIL=purple, MEETING=teal, NOTE=amber, TASK=gray, FOLLOW_UP=rose, WHATSAPP=green, SITE_VISIT=indigo. Use `bg-{color}-100 text-{color}-700` pill. | 0.25d |
| 29 | 8.4 | Set Reminder button too small | Restyle from `text-[10px]` to proper small button: `text-xs font-semibold px-2 py-1 rounded-lg border border-brand-200 hover:bg-brand-50`. | 0.25d |
| 30 | 8.5 | No Log Activity button in Activities tab | Add "Log Activity" button (duplicate of header) at top-right of Activities tab content area. | 0.25d |
| 31 | 9.3 | No Add Note button in Notes tab | Add "Add Note" button at top-right of Notes tab content area. | 0.25d |
| 32 | 7.2 | Deal cards no action menu | Add a small kebab/dots icon button on each deal card. On click, show a dropdown with: View Detail, Edit (navigate), Delete (with confirmation). | 0.5d |
| 33 | 2.2 | Revenue chip no drill-down | Add onClick to Revenue chip → `setActiveTab('deals')`. | 0.25d |
| 34 | 1.3 | No back button | Add `chevron_left` icon button before breadcrumb on the detail page. onClick → `navigate('/crm/accounts')`. | 0.25d |

### Sprint 3 Acceptance Criteria
- [ ] Tab bar scrolls horizontally on narrow screens with no visible scrollbar
- [ ] AI suggested actions show 3 animated skeleton pills while loading
- [ ] Activity type rendered as a colored badge (not plain text)
- [ ] Set Reminder is a proper small button with clear affordance
- [ ] Activities tab has a Log Activity button at top
- [ ] Notes tab has an Add Note button at top
- [ ] Deal cards have a kebab menu with View/Edit/Delete options
- [ ] Revenue chip clicks navigate to Deals tab
- [ ] Back button (chevron_left) visible before breadcrumb

---

## Risk & Blockers

| Risk | Impact | Mitigation |
|------|--------|------------|
| Note CRUD APIs may not exist on backend | Sprint 1 #3 blocked | Check backend routes first; add `PATCH /notes/:id`, `DELETE /notes/:id`, and pin endpoint (e.g. `PATCH /notes/:id/pin` or `isPinned` flag on the update route) if missing |
| Credit borrower count API may not exist | Sprint 2 #22 blocked | Implement with loading skeleton; add API endpoint in parallel |
| `react-markdown` adds bundle size | Sprint 2 #21 | Measure impact; if >20KB gzipped, consider alternatives (snarkdown ~1KB) or Tiptap renderer |
| Removing InlineEdit may feel like a regression to users who liked it | Sprint 1 #1 | Monitor feedback; can re-add with validation in a future sprint if needed |

---

## File Impact Summary

| File | Changes |
|------|---------|
| `frontend/pages/CrmAccountDetail.tsx` | Primary target — most changes happen here |
| `frontend/src/components/crm/InlineEdit.tsx` | Sprint 1: removed from AccountDetail (component kept for other CRM pages) |
| `frontend/src/services/crm.service.ts` | Sprint 1: add `updateNote`, `deleteNote`, `togglePinNote` methods |
| `frontend/src/components/crm/CrmAuditLog.tsx` | Sprint 1: replace plain text empty state with `<EmptyState>` |
| `frontend/src/components/layout/Sidebar.tsx` (or equivalent) | Sprint 3: add `title` attributes to nav links |
| `backend/src/routes/crm.routes.ts` | Sprint 1: add note CRUD endpoints if missing |
| `frontend/package.json` | Sprint 2: add `react-markdown` or `snarkdown` |

---

## Timeline

| Sprint | Start | End | Days |
|--------|-------|-----|------|
| Sprint 1 | Day 1 | Day 4 | 3.5-4d |
| Sprint 2 | Day 5 | Day 11 | 6-7d |
| Sprint 3 | Day 12 | Day 14 | 2.5d |
| **Total** | | | **12-14d** |
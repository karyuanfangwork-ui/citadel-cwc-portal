# CRM Account Detail Page — UX/UI Audit Report

**Page URL:** `/crm/accounts/:id`
**Date:** 4 June 2026
**Auditor:** Hermes Agent
**Source file:** `frontend/pages/CrmAccountDetail.tsx` (1,223 lines)

---

## Executive Summary

The CRM Account Detail page is a functional but UX-rough 8-tab view showing account information, contacts, deals, activities, notes, credit cross-links, trust products, and audit log. There are **28 distinct issues** — 4 HIGH, 15 MEDIUM, 9 LOW — spanning action affordances, edit-path inconsistencies, missing CRUD actions within tabs, accessibility gaps, and visual polish.

---

## 1. Header Area

### 1.1 Delete button next to Edit — high accidental click risk
- **Severity:** HIGH
- **Observation:** Delete (red border) sits immediately beside Edit with no spacer. Both are same height/shape. A misclick on Edit could hit Delete instead.
- **Recommendation:** Move Delete into a dropdown/kebab menu, or add a minimum 12px gap + divider between Edit and Delete.

### 1.2 Action buttons not responsive — overflow on narrow screens
- **Severity:** MEDIUM
- **Observation:** 5 buttons (Website, Edit, Delete, Log Activity, Add Note) in a flex-wrap row. On tablets they wrap to a 2nd line but no visual grouping.
- **Recommendation:** Group primary actions (Log Activity, Add Note) vs secondary (Website, Edit) vs destructive (Delete). Consider a "More actions" dropdown for secondary/destructive actions.

### 1.3 No explicit "back to list" navigation affordance
- **Severity:** LOW
- **Observation:** Breadcrumb exists (CRM / Accounts / [Name]) but no explicit back button. Only the breadcrumb "Accounts" link returns to list.
- **Recommendation:** Acceptable for enterprise apps. Optionally add a chevron_back icon in the header.

---

## 2. Stat Chips

### 2.1 Stat chips are not clickable / not linked to tabs
- **Severity:** MEDIUM
- **Observation:** "2 Contacts" chip doesn't navigate to Contacts tab. "1 Deals" doesn't navigate to Deals tab. Same for Leads and Revenue.
- **Recommendation:** Make stat chips clickable — onclick should call `setActiveTab('contacts')` etc. Standard CRM UX pattern.

### 2.2 Revenue chip shows formatted currency but no drill-down
- **Severity:** LOW
- **Observation:** "RM12,000,000" Revenue — clicking does nothing.
- **Recommendation:** Link to Deals tab or show a tooltip with deal breakdown on hover.

---

## 3. AI Suggested Actions

### 3.1 AI action pills are not clickable
- **Severity:** MEDIUM
- **Observation:** "Call within 24h", "Send follow-up email", "Schedule meeting" look like pills but clicking does nothing. Pure display only.
- **Recommendation:** Wire each action pill: "Call within 24h" → open Log Activity modal pre-filled as CALL; "Send follow-up email" → open email; "Schedule meeting" → open activity form as MEETING.

### 3.2 No loading skeleton matching final pill shape
- **Severity:** LOW
- **Observation:** While AI actions load, there's only a small "Loading suggested actions..." text. No skeleton matching the eventual pill layout.
- **Recommendation:** Add skeleton pills (grey rounded pills with pulse animation) matching the final action badge shape.

---

## 4. Tabs

### 4.1 Weak active tab indication
- **Severity:** MEDIUM
- **Observation:** Active tab has only a thin bottom border in brand-700. Text color is identical to inactive state. Hard to distinguish at a glance.
- **Recommendation:** Use bolder font-weight + brand color for active tab label text, not just the underline.

### 4.2 Eight tabs with no scroll/overflow handling
- **Severity:** MEDIUM
- **Observation:** Overview, Contacts, Deals, Activities, Notes, Credit, Trust Products, Audit Log — on narrow screens these overflow or wrap.
- **Recommendation:** Add `overflow-x: auto` with horizontal scroll, or collapse less-used tabs (Credit, Trust Products, Audit Log) into a "More" dropdown.

### 4.3 No ARIA tab roles or keyboard navigation
- **Severity:** MEDIUM
- **Observation:** Tab buttons are plain `<button>` elements with no `role="tablist"` / `role="tab"` ARIA attributes. Arrow-key navigation between tabs doesn't work.
- **Recommendation:** Add ARIA tab roles, `aria-selected`, and keyboard arrow navigation.

---

## 5. Overview Tab

### 5.1 InlineEdit fields have no undo/confirm feedback
- **Severity:** HIGH
- **Observation:** Click a field value → edit → click away (onBlur = auto-save). No confirmation toast, no undo. Accidental edit + click away = silent save.
- **Recommendation:** Add a brief success toast on inline save. Consider adding Ctrl+Z undo for the last change.

### 5.2 Dual edit paths: InlineEdit on Overview + Edit modal create inconsistency
- **Severity:** HIGH
- **Observation:** Users can edit Name, Industry, Email etc. via InlineEdit (no validation) or via Edit modal (with validation). InlineEdit lets users save an invalid email, phone, etc. The two paths produce different validation outcomes.
- **Recommendation:** Option A — Remove InlineEdit from Overview; route all edits through the modal with full validation. Option B — Add full validation to InlineEdit's save handler and show inline error states. Option A is simpler and less error-prone.

### 5.3 Read-only fields mixed with editable fields — no visual distinction
- **Severity:** MEDIUM
- **Observation:** Registration No., Tax No., Bank Account, Purchase Cash Trust, Active, Created, Updated are read-only but look identical to editable fields (same font, same spacing). The only clue is the absence of a hover edit icon, which is too subtle.
- **Recommendation:** Use a muted background (`bg-bg-subtle`) or a small lock icon for read-only field rows.

### 5.4 No address section on Overview
- **Severity:** MEDIUM
- **Observation:** Address, City, State, Postal Code, Country exist in the Edit modal but are completely absent from the Overview tab.
- **Recommendation:** Add an "Address" row or section in the Account Info card showing the full address.

### 5.5 Description card hidden when empty
- **Severity:** LOW
- **Observation:** If `account.description` is falsy, the entire Description card disappears, leaving Account Info as a single orphaned card on the left.
- **Recommendation:** Show Description card with empty state placeholder ("No description added — click to add") or an InlineEdit prompt.

---

## 6. Contacts Tab

### 6.1 No "Add Contact" button within the tab
- **Severity:** MEDIUM
- **Observation:** Users can view contacts but cannot add a new one from this tab.
- **Recommendation:** Add "Add Contact" button that navigates to `/crm/contacts/new?accountId=X` or opens a creation modal.

### 6.2 Contact email not clickable (no mailto link)
- **Severity:** MEDIUM
- **Observation:** Email is plain text. Clicking does nothing.
- **Recommendation:** Wrap email in `<a href="mailto:...">`.

### 6.3 Phone not clickable on mobile
- **Severity:** LOW
- **Observation:** Phone is plain text. On mobile, `tel:` links are expected.
- **Recommendation:** Wrap phone in `<a href="tel:...">`.

---

## 7. Deals Tab

### 7.1 No "Add Deal / Create Opportunity" button
- **Severity:** MEDIUM
- **Observation:** No inline creation from the tab.
- **Recommendation:** Add "Create Opportunity" button linking to `/crm/opportunities/new?accountId=X`.

### 7.2 Deal cards have no action menu
- **Severity:** LOW
- **Observation:** No edit/delete/advance stage actions on individual deal cards. Only the whole card is clickable (navigates to detail).
- **Recommendation:** Add a contextual kebab/dots menu on each card for quick actions.

---

## 8. Activities Tab

### 8.1 No filter/sort controls
- **Severity:** MEDIUM
- **Observation:** Users cannot filter by type (Call, Email, Meeting) or sort by date.
- **Recommendation:** Add a filter bar with activity type pills and a sort dropdown (Newest first / Oldest first).

### 8.2 Create Activity modal has fewer fields than Edit Activity modal
- **Severity:** MEDIUM
- **Observation:** Create modal: Type, Subject, Description only. Edit modal adds: Scheduled At, Completed At, Duration. Users can't schedule a future activity on creation.
- **Recommendation:** Add Scheduled At and Duration fields to the Create Activity modal.

### 8.3 Activity type label is plain text, not a badge
- **Severity:** LOW
- **Observation:** "FOLLOW_UP" appears as plain text in the top-right of the card. Not visually distinct.
- **Recommendation:** Render activity type as a colored badge matching the icon color.

### 8.4 "Set Reminder" button too small
- **Severity:** LOW
- **Observation:** Set Reminder button uses 10px text with a tiny icon. Easy to miss.
- **Recommendation:** Increase to proper small-button styling with clear affordance.

### 8.5 No "Log Activity" button within the tab
- **Severity:** LOW
- **Observation:** "Log Activity" button is in the page header only, not near the activity list.
- **Recommendation:** Duplicate the "Log Activity" button at the top of the Activities tab for contextual access.

---

## 9. Notes Tab

### 9.1 Notes display raw markdown without rendering
- **Severity:** MEDIUM
- **Observation:** The note "[DEMO] **Compliance Reminder**\n\n- All trust setups..." shows raw `**` markers and `-` prefixes. No markdown rendering.
- **Recommendation:** Use a Tiptap viewer (per WYSIWYG preference) or at minimum basic markdown rendering for notes.

### 9.2 No note actions (edit, delete, pin/unpin)
- **Severity:** HIGH
- **Observation:** Notes show a pinned indicator but there are no Edit, Delete, or Pin toggle buttons on note cards.
- **Recommendation:** Add edit, delete, and pin/unpin action buttons to each note card.

### 9.3 No "Add Note" button within the tab
- **Severity:** LOW
- **Observation:** "Add Note" button is in the page header only.
- **Recommendation:** Duplicate the Add Note button at the top of the Notes tab.

---

## 10. Credit Tab

### 10.1 Credit tab is purely navigational — no inline data
- **Severity:** MEDIUM
- **Observation:** The entire tab shows 3 links to the Credit module + an info banner. No actual credit data displayed.
- **Recommendation:** Show a summary (e.g., number of borrower profiles, open applications, outstanding amounts) before the navigation links. Alternatively, move this to a sidebar link instead of occupying a full tab.

---

## 11. Trust Products Tab

### 11.1 Empty state uses plain text, not EmptyState component
- **Severity:** LOW
- **Observation:** "No trust products yet. Add one." is plain `<p>` text. Other tabs use `<EmptyState>` component.
- **Recommendation:** Use `<EmptyState icon="trust" title="No trust products" description="..." />`.

### 11.2 Trust Product "Owner ID" field shows raw UUID in create/edit modal
- **Severity:** HIGH
- **Observation:** The modal has a text input labeled "Owner ID" where users must type a UUID string. No select dropdown with user names.
- **Recommendation:** Replace with a `<select>` dropdown populated from `crmUsers`, same as the Account Owner field on Overview.

---

## 12. Audit Log Tab

### 12.1 Minimal empty state handling
- **Severity:** LOW
- **Observation:** "No audit trail entries yet." — plain text, not using the EmptyState component.
- **Recommendation:** Use `<EmptyState icon="history" ... />` for consistency.

---

## 13. Modals (Edit Account, Log Activity, Add Note, Trust Products)

### 13.1 Edit Account modal: Save/Cancel buttons hidden at bottom, requires scroll
- **Severity:** MEDIUM
- **Observation:** Modal has `max-h-[85vh]` with scroll. On standard screens, the lower fields (Address, Description) and Save/Cancel buttons are below the fold.
- **Recommendation:** Make the modal footer (Save/Cancel) sticky at the bottom, or move buttons to a fixed position at the modal bottom.

### 13.2 Annual Revenue shows raw number without formatting
- **Severity:** MEDIUM
- **Observation:** "12000000" displayed in the input field instead of "12,000,000".
- **Recommendation:** Use a formatted input with comma separators, or show a formatted preview beside/below the input.

### 13.3 Industry and Company Size are free-text inputs instead of dropdowns
- **Severity:** MEDIUM
- **Observation:** Industry should match the list page filter options (Technology, Finance, Healthcare, etc.). Company Size should be a select (1-10, 11-50, 51-200, etc.). Both are currently free-text.
- **Recommendation:** Convert to `<select>` dropdowns with predefined options matching the list page filters.

---

## 14. Cross-Cutting / Global Issues

### 14.1 Left sidebar icon rail: 19 items with no labels/tooltips
- **Severity:** MEDIUM
- **Observation:** The sidebar is icon-only with 19 items. No tooltips on hover. Hard to navigate.
- **Recommendation:** Add `title` attributes or tooltip overlays to all sidebar links.

---

## Summary Table

| Severity | Count | Key Issues |
|----------|-------|------------|
| HIGH | 4 | InlineEdit no undo (#5.1), dual-edit-path (#5.2), no note actions (#9.2), Owner ID raw UUID (#11.2) |
| MEDIUM | 15 | Stat chips not linked (#2.1), AI actions not clickable (#3.1), weak tab styling (#4.1), tab overflow (#4.2), no ARIA (#4.3), readonly vs editable (#5.3), no address (#5.4), no Add Contact (#6.1), email not clickable (#6.2), no Add Deal (#7.1), no activity filters (#8.1), modal field mismatch (#8.2), raw markdown notes (#9.1), credit tab navigation-only (#10.1), modal scroll hides buttons (#13.1), revenue raw number (#13.2), Industry/Size free text (#13.3) |
| LOW | 9 | No back button (#1.3), no revenue drill-down (#2.2), AI skeleton (#3.2), description card hidden (#5.5), phone not clickable (#6.3), deal card actions (#7.2), activity type as text (#8.3), small reminder button (#8.4), empty state inconsistency (#11.1, #12.1) |

**Total: 28 distinct issues**
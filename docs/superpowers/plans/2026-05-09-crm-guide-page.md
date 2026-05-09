# CRM Guide Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a long-scrollable `/crm/guide` page that walks sales staff through the full CRM lead lifecycle, linked from the CRM Dashboard.

**Architecture:** Pure presentational React component (`CrmGuide.tsx`) with no API calls. Styled with existing Tailwind brand tokens and Material Symbols icons. Registered as a new route in `App.tsx` and linked from `CrmDashboard.tsx` via a hero banner card.

**Tech Stack:** React 19, TypeScript, React Router v7, Tailwind CSS, Material Symbols icons (already globally loaded)

---

## Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `frontend/pages/CrmGuide.tsx` | Full guide page — all 12 sections, sticky anchor nav, no API calls |
| Modify | `frontend/App.tsx` | Add import + route for `/crm/guide` |
| Modify | `frontend/pages/CrmDashboard.tsx` | Add "How to Use the CRM" entry card in quick nav area |

---

## Task 1: Create `CrmGuide.tsx` — scaffold and sticky anchor nav

**Files:**
- Create: `frontend/pages/CrmGuide.tsx`

- [ ] **Step 1: Create the file with scaffold and sticky nav**

Create `frontend/pages/CrmGuide.tsx` with the following content:

```tsx
import React from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  { id: 'what-is-crm', label: 'What Is the CRM?' },
  { id: 'navigation', label: 'Navigation Overview' },
  { id: 'create-lead', label: 'Step 1: Create a Lead' },
  { id: 'status-flow', label: 'Step 2: Lead Status Flow' },
  { id: 'log-activities', label: 'Step 3: Log Activities' },
  { id: 'notes', label: 'Step 4: Add Notes' },
  { id: 'follow-up', label: 'Step 5: Follow-Up Dates' },
  { id: 'qualify', label: 'Step 6: Qualify or Disqualify' },
  { id: 'convert', label: 'Step 7: Convert to Deal' },
  { id: 'pipeline', label: 'Step 8: Manage the Pipeline' },
  { id: 'close', label: 'Step 9: Close a Deal' },
  { id: 'tips', label: 'Tips & Best Practices' },
];

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mb-12 scroll-mt-24">
    <h2 className="text-xl font-black text-text-primary mb-4 flex items-center gap-2 border-b border-border pb-2">
      {title}
    </h2>
    {children}
  </section>
);

const InfoBox = ({ icon, color, children }: { icon: string; color: string; children: React.ReactNode }) => (
  <div className="flex gap-3 rounded-xl p-4 mb-4" style={{ background: color }}>
    <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">{icon}</span>
    <div className="text-sm leading-relaxed">{children}</div>
  </div>
);

const StatusBadge = ({ label, bg, text }: { label: string; bg: string; text: string }) => (
  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={{ background: bg, color: text }}>
    {label}
  </span>
);

const CrmGuide = () => {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-6">
      {/* Page header */}
      <div className="mb-8">
        <Link to="/crm" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-brand-700 mb-4" style={{ textDecoration: 'none' }}>
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to CRM Dashboard
        </Link>
        <h1 className="text-3xl font-black text-text-primary mb-2">CRM User Guide</h1>
        <p className="text-text-secondary text-base">A step-by-step walkthrough for sales staff — from creating your first lead to closing a deal.</p>
      </div>

      {/* Sticky anchor nav */}
      <nav className="sticky top-0 z-10 bg-surface border border-border rounded-xl p-3 mb-10 shadow-sm overflow-x-auto">
        <div className="flex gap-2 flex-wrap">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-text-secondary hover:bg-brand-50 hover:text-brand-700 transition-colors whitespace-nowrap"
              style={{ textDecoration: 'none' }}
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Sections — filled in subsequent tasks */}
    </div>
  );
};

export default CrmGuide;
```

- [ ] **Step 2: Verify file saved correctly**

```bash
head -10 frontend/pages/CrmGuide.tsx
```

Expected: starts with `import React from 'react';`

---

## Task 2: Register route and add dashboard entry card

**Files:**
- Modify: `frontend/App.tsx` lines ~59 and ~415
- Modify: `frontend/pages/CrmDashboard.tsx` lines ~184–195

- [ ] **Step 1: Add import to `App.tsx`**

In `frontend/App.tsx`, after line 59 (`import CrmReports from './pages/CrmReports';`), add:

```tsx
import CrmGuide from './pages/CrmGuide';
```

- [ ] **Step 2: Add route to `App.tsx`**

In `frontend/App.tsx`, after line 415 (`<Route path="/crm/reports" ...`), add:

```tsx
              <Route path="/crm/guide" element={<ProtectedRoute requirePermission="crm:read"><CrmGuide /></ProtectedRoute>} />
```

- [ ] **Step 3: Add guide card to `CrmDashboard.tsx` quick nav**

In `frontend/pages/CrmDashboard.tsx`, inside the quick nav array at lines 184–195, add a guide button after the existing items:

Replace the quick nav block (lines 183–196) with:

```tsx
          {/* Quick nav */}
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            {[
              { icon: 'business', label: 'Accounts', to: '/crm/accounts' },
              { icon: 'person', label: 'Contacts', to: '/crm/contacts' },
              { icon: 'lightbulb', label: 'Leads', to: '/crm/leads' },
              { icon: 'view_kanban', label: 'Pipeline', to: '/crm/pipeline' },
              { icon: 'groups', label: 'Team', to: '/crm/team' },
              { icon: 'menu_book', label: 'User Guide', to: '/crm/guide' },
            ].map(btn => (
              <Link key={btn.to} to={btn.to} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white/90 text-xs font-bold rounded-full py-1.5 px-3 transition-colors" style={{ textDecoration: 'none' }}>
                <span className="material-symbols-outlined text-sm">{btn.icon}</span>
                {btn.label}
              </Link>
            ))}
          </div>
```

- [ ] **Step 4: Verify the app compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to CrmGuide.

- [ ] **Step 5: Commit**

```bash
git add frontend/App.tsx frontend/pages/CrmDashboard.tsx frontend/pages/CrmGuide.tsx
git commit -m "feat(crm): scaffold CrmGuide page with route and dashboard link"
```

---

## Task 3: Add Sections 1–2 (What Is the CRM + Navigation Overview)

**Files:**
- Modify: `frontend/pages/CrmGuide.tsx`

- [ ] **Step 1: Replace the `{/* Sections */}` placeholder with Sections 1 and 2**

In `frontend/pages/CrmGuide.tsx`, replace the comment `{/* Sections — filled in subsequent tasks */}` with:

```tsx
      <Section id="what-is-crm" title="What Is the CRM?">
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          The CRM (Customer Relationship Management) module is where your sales team tracks every potential client — from the moment you first hear about them, through to a signed deal. Everything is logged here: your calls, meetings, emails, and notes. Nothing falls through the cracks.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          There are two main roles in the CRM. <strong className="text-text-primary">Sales reps</strong> manage their own leads and deals day-to-day. <strong className="text-text-primary">Managers</strong> get an additional Team Dashboard and access to reports across the whole team.
        </p>
        <InfoBox icon="lightbulb" color="#eff6ff">
          <strong>New to CRMs?</strong> Think of the CRM as a shared notebook for your sales team. Instead of tracking clients in WhatsApp or a spreadsheet, every interaction is recorded here — so anyone on the team can pick up where another left off.
        </InfoBox>
      </Section>

      <Section id="navigation" title="Navigation Overview">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The CRM has several sections. Here is what each one does:
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Section</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">Path</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { section: 'Dashboard', path: '/crm', purpose: 'Your daily snapshot — active leads, overdue follow-ups, pipeline summary' },
                { section: 'Leads', path: '/crm/leads', purpose: 'All prospects before they become deals' },
                { section: 'Pipeline', path: '/crm/pipeline', purpose: 'Kanban board of active deals by stage' },
                { section: 'Opportunities', path: '/crm/opportunities', purpose: 'List view of all deals' },
                { section: 'Contacts', path: '/crm/contacts', purpose: 'Individual people you are in contact with' },
                { section: 'Accounts', path: '/crm/accounts', purpose: 'Companies and organisations' },
                { section: 'Reports', path: '/crm/reports', purpose: 'Performance analytics and team metrics' },
              ].map(row => (
                <tr key={row.path} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">{row.section}</td>
                  <td className="px-4 py-3 font-mono text-xs text-brand-700 whitespace-nowrap">{row.path}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <InfoBox icon="info" color="#f0fdf4">
          <strong>Start here every morning:</strong> Open the Dashboard first. It shows what needs your attention today — overdue follow-ups, stale leads, and recent team activity.
        </InfoBox>
      </Section>

      {/* Sections 3–12 — filled in subsequent tasks */}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmGuide.tsx
git commit -m "feat(crm): add guide sections 1-2 — intro and navigation overview"
```

---

## Task 4: Add Sections 3–5 (Create Lead, Status Flow, Log Activities)

**Files:**
- Modify: `frontend/pages/CrmGuide.tsx`

- [ ] **Step 1: Replace `{/* Sections 3–12 */}` placeholder with Sections 3–5**

In `frontend/pages/CrmGuide.tsx`, replace `{/* Sections 3–12 — filled in subsequent tasks */}` with:

```tsx
      <Section id="create-lead" title="Step 1: Create a Lead">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Go to <Link to="/crm/leads" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Leads</Link> and click the <strong className="text-text-primary">New Lead</strong> button in the top-right corner. Fill in the form:
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Field</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">Required?</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">What to enter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { field: 'Title', required: 'Yes', desc: "The prospect's name or a short description (e.g. \"Ahmad bin Razak — Cash Trust\")" },
                { field: 'Source', required: 'No', desc: 'How you found them: Website, Referral, Cold Call, Trade Show, LinkedIn, Advertisement, Partner, or Other' },
                { field: 'Company Name', required: 'No', desc: 'Their organisation or employer' },
                { field: 'Contact', required: 'No', desc: 'Link to an existing Contact record if one exists' },
                { field: 'Estimated Value (MYR)', required: 'No', desc: 'Your best guess at the deal size — helps with pipeline forecasting' },
                { field: 'Follow-Up Date', required: 'No', desc: 'When you plan to next contact them — set this for every active lead' },
              ].map(row => (
                <tr key={row.field} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">{row.field}</td>
                  <td className="px-4 py-3 text-center">
                    {row.required === 'Yes'
                      ? <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Required</span>
                      : <span className="text-xs text-text-secondary">Optional</span>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-secondary text-sm">Click <strong className="text-text-primary">Save</strong>. The lead is created with status <StatusBadge label="NEW" bg="#eff6ff" text="#1d4ed8" />.</p>
      </Section>

      <Section id="status-flow" title="Step 2: The Lead Status Flow">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Every lead has a status that shows where it is in your sales process. Update it on the Lead Detail page as things progress. <strong className="text-text-primary">Update the status the same day something changes.</strong>
        </p>
        {/* Status flow diagram */}
        <div className="flex flex-wrap items-center gap-2 mb-6 p-4 bg-gray-50 rounded-xl border border-border">
          {[
            { label: 'NEW', bg: '#eff6ff', text: '#1d4ed8' },
            { label: '→', bg: 'transparent', text: '#9ca3af' },
            { label: 'CONTACTED', bg: '#fef3c7', text: '#92400e' },
            { label: '→', bg: 'transparent', text: '#9ca3af' },
            { label: 'QUALIFIED', bg: '#ecfdf5', text: '#065f46' },
            { label: '→', bg: 'transparent', text: '#9ca3af' },
            { label: 'CONVERTED', bg: '#f0fdf4', text: '#166534' },
          ].map((item, i) => (
            item.label === '→'
              ? <span key={i} className="text-gray-400 font-bold text-lg">→</span>
              : <StatusBadge key={i} label={item.label} bg={item.bg} text={item.text} />
          ))}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Status</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { status: 'NEW', bg: '#eff6ff', text: '#1d4ed8', meaning: 'Just created — you have not yet made any contact' },
                { status: 'CONTACTED', bg: '#fef3c7', text: '#92400e', meaning: 'You have reached out at least once (call, email, WhatsApp, etc.)' },
                { status: 'QUALIFIED', bg: '#ecfdf5', text: '#065f46', meaning: 'Budget confirmed, genuine interest, decision-maker identified — ready to pitch' },
                { status: 'UNQUALIFIED', bg: '#fef2f2', text: '#991b1b', meaning: 'Not a fit — wrong profile, no budget, or not interested' },
                { status: 'CONVERTED', bg: '#f0fdf4', text: '#166534', meaning: 'Lead has been converted into a Deal (the lead is now locked)' },
                { status: 'LOST', bg: '#f3f4f6', text: '#6b7280', meaning: 'Was progressing but the deal has fallen through — record a reason in notes' },
              ].map(row => (
                <tr key={row.status} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge label={row.status} bg={row.bg} text={row.text} /></td>
                  <td className="px-4 py-3 text-text-secondary">{row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="log-activities" title="Step 3: Log Every Touchpoint (Activities)">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          On the Lead Detail page, click <strong className="text-text-primary">Log Activity</strong> after every interaction. Choose the activity type that best describes what you did:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            { type: 'CALL', icon: 'call', color: '#2563eb', desc: 'Phone call made or received' },
            { type: 'EMAIL', icon: 'mail', color: '#7c3aed', desc: 'Email sent or received' },
            { type: 'MEETING', icon: 'groups', color: '#059669', desc: 'In-person or video meeting' },
            { type: 'WHATSAPP', icon: 'chat', color: '#16a34a', desc: 'WhatsApp message or conversation' },
            { type: 'SITE_VISIT', icon: 'location_on', color: '#dc2626', desc: 'You visited a site or they came to you' },
            { type: 'FOLLOW_UP', icon: 'event_repeat', color: '#ea580c', desc: 'Scheduled follow-up action completed' },
            { type: 'TASK', icon: 'task_alt', color: '#d97706', desc: 'Any to-do item related to this lead' },
            { type: 'NOTE', icon: 'sticky_note_2', color: '#6b7280', desc: 'General observation (no specific action)' },
          ].map(item => (
            <div key={item.type} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-surface">
              <span className="material-symbols-outlined text-xl shrink-0 mt-0.5" style={{ color: item.color }}>{item.icon}</span>
              <div>
                <div className="font-bold text-text-primary text-sm">{item.type}</div>
                <div className="text-xs text-text-secondary">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <InfoBox icon="warning" color="#fffbeb">
          <strong>Log activities immediately.</strong> The activity log is your evidence trail. Managers can see it. If you hand a lead to a colleague, they see exactly what happened and when.
        </InfoBox>
      </Section>

      {/* Sections 6–12 — filled in subsequent tasks */}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmGuide.tsx
git commit -m "feat(crm): add guide sections 3-5 — create lead, status flow, activities"
```

---

## Task 5: Add Sections 6–9 (Notes, Follow-Up, Qualify, Convert)

**Files:**
- Modify: `frontend/pages/CrmGuide.tsx`

- [ ] **Step 1: Replace `{/* Sections 6–12 */}` placeholder**

In `frontend/pages/CrmGuide.tsx`, replace `{/* Sections 6–12 — filled in subsequent tasks */}` with:

```tsx
      <Section id="notes" title="Step 4: Add Notes">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Notes are for context that doesn't fit an activity type — for example: <em>"Client mentioned they are currently using a competitor"</em> or <em>"The decision maker is the CFO, not the person I spoke to."</em>
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Notes live in the <strong className="text-text-primary">Notes</strong> tab on the Lead Detail page. Add them any time.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl border border-border bg-surface">
            <div className="font-bold text-text-primary text-sm mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-brand-700">task_alt</span>
              Activities
            </div>
            <p className="text-xs text-text-secondary">Log an activity when you <em>did</em> something — a call, a meeting, a site visit. Activities are tracked in reports.</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-surface">
            <div className="font-bold text-text-primary text-sm mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-600">sticky_note_2</span>
              Notes
            </div>
            <p className="text-xs text-text-secondary">Write a note when you <em>learned</em> something — context, observations, key details. Notes are not tracked in reports.</p>
          </div>
        </div>
      </Section>

      <Section id="follow-up" title="Step 5: Set Follow-Up Dates">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Every open lead should have a follow-up date. Set it in the <strong className="text-text-primary">Overview</strong> tab of the Lead Detail page. The Leads list shows urgency badges next to any lead that needs attention:
        </p>
        <div className="space-y-3 mb-4">
          {[
            { label: 'Overdue', bg: '#fef2f2', text: '#dc2626', icon: 'error', desc: 'Follow-up date has passed. Contact them today or reschedule.' },
            { label: 'Due Today', bg: '#fffbeb', text: '#b45309', icon: 'schedule', desc: "Follow-up is today. Reach out before the day ends." },
            { label: 'Stale', bg: '#f3f4f6', text: '#6b7280', icon: 'hourglass_empty', desc: 'No activity logged in 7+ days. Log an activity or close the lead.' },
          ].map(badge => (
            <div key={badge.label} className="flex items-start gap-3 p-4 rounded-xl border border-border">
              <span className="material-symbols-outlined text-xl shrink-0 mt-0.5" style={{ color: badge.text }}>{badge.icon}</span>
              <div>
                <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold mb-1" style={{ background: badge.bg, color: badge.text }}>{badge.label}</span>
                <p className="text-sm text-text-secondary">{badge.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <InfoBox icon="tips_and_updates" color="#eff6ff">
          <strong>Daily habit:</strong> Check the Leads list first thing every morning. Clear all Overdue and Due Today badges before starting new outreach.
        </InfoBox>
      </Section>

      <Section id="qualify" title="Step 6: Qualify or Disqualify">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          When you have enough information to judge whether this lead is worth pursuing, update the status on the Lead Detail page.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50">
            <div className="font-black text-emerald-700 text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">verified</span>
              Mark QUALIFIED when:
            </div>
            <ul className="text-xs text-emerald-800 space-y-1 list-disc list-inside">
              <li>You have spoken to the decision maker</li>
              <li>They have confirmed interest</li>
              <li>Budget is confirmed or likely</li>
              <li>You are ready to present a proposal</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50">
            <div className="font-black text-red-700 text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">block</span>
              Mark UNQUALIFIED when:
            </div>
            <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
              <li>They are not the right profile</li>
              <li>No budget available</li>
              <li>No interest in the product</li>
              <li>Not eligible (e.g. regulatory reasons)</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
            <div className="font-black text-gray-600 text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">cancel</span>
              Mark LOST when:
            </div>
            <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
              <li>Was progressing but fell through</li>
              <li>Client chose a competitor</li>
              <li>Deal cancelled after qualification</li>
              <li>Always record a reason in Notes</li>
            </ul>
          </div>
        </div>
        <p className="text-text-secondary text-sm">Only <StatusBadge label="QUALIFIED" bg="#ecfdf5" text="#065f46" /> leads can be converted to a Deal.</p>
      </Section>

      <Section id="convert" title="Step 7: Convert a Lead to a Deal">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          When a lead is QUALIFIED, the <strong className="text-text-primary">Convert to Deal</strong> button appears at the top of the Lead Detail page. Click it and fill in the form:
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Field</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">What to enter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { field: 'Pipeline', desc: 'Which sales pipeline this deal belongs to (e.g. Cash Trust Pipeline)' },
                { field: 'Stage', desc: 'Which stage the deal starts at (usually the first stage in the pipeline)' },
                { field: 'Deal Name', desc: 'Auto-filled from the lead title — edit if needed' },
                { field: 'Deal Value (MYR)', desc: 'The confirmed or estimated deal value' },
              ].map(row => (
                <tr key={row.field} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">{row.field}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          Click <strong className="text-text-primary">Convert</strong>. The lead status becomes <StatusBadge label="CONVERTED" bg="#f0fdf4" text="#166534" /> and is locked. A new <strong className="text-text-primary">Opportunity</strong> (Deal) is created and linked from the Lead Detail page.
        </p>
        <InfoBox icon="swap_horiz" color="#f0fdf4">
          After conversion, manage the deal in <Link to="/crm/pipeline" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Pipeline</Link> or <Link to="/crm/opportunities" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Opportunities</Link>. The original lead is kept for reference.
        </InfoBox>
      </Section>

      {/* Sections 10–12 — filled in subsequent tasks */}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmGuide.tsx
git commit -m "feat(crm): add guide sections 6-9 — notes, follow-up, qualify, convert"
```

---

## Task 6: Add Sections 10–12 (Pipeline, Close Deal, Tips)

**Files:**
- Modify: `frontend/pages/CrmGuide.tsx`

- [ ] **Step 1: Replace `{/* Sections 10–12 */}` placeholder**

In `frontend/pages/CrmGuide.tsx`, replace `{/* Sections 10–12 — filled in subsequent tasks */}` with:

```tsx
      <Section id="pipeline" title="Step 8: Manage the Pipeline">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Go to <Link to="/crm/pipeline" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Pipeline</Link> to see all your active deals as a Kanban board, grouped by stage. Each card shows the deal name, value, account, and how long it has been in the current stage.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Click on a deal card to open it. From there you can:
        </p>
        <ul className="space-y-2 mb-4">
          {[
            { icon: 'swap_horiz', text: 'Change the deal stage (move it forward or backward)' },
            { icon: 'task_alt', text: 'Log activities and notes against the deal' },
            { icon: 'edit', text: 'Update the deal value' },
            { icon: 'person', text: 'Link contacts to the deal' },
          ].map(item => (
            <li key={item.text} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="material-symbols-outlined text-base text-brand-700">{item.icon}</span>
              {item.text}
            </li>
          ))}
        </ul>
        <InfoBox icon="warning" color="#fffbeb">
          <strong>Move deals forward promptly.</strong> Do not leave a deal sitting in a stage once it has progressed. Your manager's pipeline view reflects exactly where each deal is in real time.
        </InfoBox>
      </Section>

      <Section id="close" title="Step 9: Close a Deal">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          On the Opportunity Detail page, when the deal reaches its outcome, mark it as closed:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50">
            <div className="font-black text-emerald-700 text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">emoji_events</span>
              Won
            </div>
            <p className="text-xs text-emerald-800">Mark Won and record the final deal value. The deal is archived as a success and counted in your performance metrics.</p>
          </div>
          <div className="p-4 rounded-xl border-2 border-red-200 bg-red-50">
            <div className="font-black text-red-700 text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">cancel</span>
              Lost
            </div>
            <p className="text-xs text-red-800">Mark Lost and record a reason. This feeds the Reports page so the team can learn from losses and improve over time.</p>
          </div>
        </div>
        <p className="text-text-secondary text-sm">Closed deals leave the active Pipeline view but remain searchable in <Link to="/crm/opportunities" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Opportunities</Link>.</p>
      </Section>

      <Section id="tips" title="Tips & Best Practices">
        <div className="space-y-3">
          {[
            { icon: 'today', color: '#2563eb', title: 'Same-day rule', desc: 'Update the lead status and log an activity on the same day you make contact. Memory fades — log it immediately.' },
            { icon: 'hourglass_empty', color: '#d97706', title: 'No stale leads', desc: 'Check the Leads list daily. If a lead has the Stale badge (no activity in 7+ days), either log an activity or close it.' },
            { icon: 'event', color: '#059669', title: 'Every lead needs a follow-up date', desc: 'Unless the lead is Converted, Lost, or Unqualified, always set a follow-up date. This is how the system surfaces what needs attention today.' },
            { icon: 'task_alt', color: '#7c3aed', title: 'Notes are not a substitute for activities', desc: 'Notes are invisible to automated reports. Use activities for trackable touchpoints (calls, emails, meetings) — they feed your performance metrics.' },
            { icon: 'link', color: '#dc2626', title: 'Use Accounts and Contacts', desc: 'Link your leads and opportunities to Contact and Account records. This gives a full relationship history with a company across multiple deals over time.' },
            { icon: 'dashboard', color: '#0891b2', title: 'Check the Dashboard first', desc: 'Start every workday at the CRM Dashboard. It surfaces overdue follow-ups, stale leads, and your pipeline summary — everything that needs attention today.' },
          ].map(tip => (
            <div key={tip.title} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface">
              <span className="material-symbols-outlined text-xl shrink-0 mt-0.5" style={{ color: tip.color }}>{tip.icon}</span>
              <div>
                <div className="font-bold text-text-primary text-sm mb-0.5">{tip.title}</div>
                <p className="text-xs text-text-secondary leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmGuide.tsx
git commit -m "feat(crm): add guide sections 10-12 — pipeline, close deal, tips"
```

---

## Task 7: Final TypeScript check and smoke test

**Files:** (no changes — verification only)

- [ ] **Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors in `CrmGuide.tsx`, `App.tsx`, or `CrmDashboard.tsx`.

- [ ] **Step 2: Start the dev server and verify**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/crm/guide` in browser. Verify:
- Page loads without errors
- Sticky anchor nav is visible at top
- All 12 sections render with correct content
- Status badges display correct colours
- All internal links (Back to Dashboard, Leads, Pipeline, Opportunities) are correct
- "User Guide" link appears in CRM Dashboard quick nav

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(crm): complete CRM guide page — all 12 sections, route, dashboard link"
```

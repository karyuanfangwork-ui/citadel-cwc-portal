import React from 'react';
import { Link } from 'react-router-dom';

const SECTIONS = [
  { id: 'what-is-crm', label: 'What Is the CRM?' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'create-lead', label: 'Create a Lead' },
  { id: 'status-flow', label: 'Lead Status Flow' },
  { id: 'log-activities', label: 'Log Activities' },
  { id: 'notes', label: 'Add Notes' },
  { id: 'follow-up', label: 'Follow-Up Dates' },
  { id: 'qualify', label: 'Qualify or Disqualify' },
  { id: 'convert', label: 'Convert to Deal' },
  { id: 'pipeline', label: 'Manage the Pipeline' },
  { id: 'close', label: 'Close a Deal' },
  { id: 'ai-features', label: 'AI Features' },
  { id: 'contacts-accounts', label: 'Contacts & Accounts' },
  { id: 'team-dashboard', label: 'Team Dashboard' },
  { id: 'reports', label: 'Reports' },
  { id: 'territories', label: 'Territories' },
  { id: 'quotas', label: 'Quotas' },
  { id: 'workflows', label: 'Workflows' },
  { id: 'import-export', label: 'Import & Export' },
  { id: 'duplicates', label: 'Duplicate Detection' },
  { id: 'custom-fields', label: 'Custom Fields' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'ai-alerts', label: 'AI Alerts' },
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
    <>
      <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-6">
      {/* Page header */}
      <div className="mb-8">
        <Link to="/crm" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-brand-700 mb-4" style={{ textDecoration: 'none' }}>
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to CRM Dashboard
        </Link>
        <h1 className="text-3xl font-black text-text-primary mb-2">CRM User Guide</h1>
        <p className="text-text-secondary text-base">A complete walkthrough for the CWC CRM — from creating your first lead to automating workflows and interpreting AI insights.</p>
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

      {/* ────── What Is the CRM? ────── */}
      <Section id="what-is-crm" title="What Is the CRM?">
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          The CRM (Customer Relationship Management) module is where your sales team tracks every potential client — from the moment you first hear about them, through to a signed deal. Everything is logged here: your calls, meetings, emails, and notes. Nothing falls through the cracks.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          There are two main roles in the CRM. <strong className="text-text-primary">Sales reps</strong> manage their own leads and deals day-to-day. <strong className="text-text-primary">Managers</strong> get an additional Team Dashboard with performance metrics, pipeline oversight, and lead reassignment across the whole team.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          The CRM also includes <strong className="text-text-primary">AI-powered features</strong>: lead scoring, win-probability predictions, note analysis, daily briefings, and suggested next actions — all designed to help you work smarter, not harder.
        </p>
        <InfoBox icon="lightbulb" color="var(--color-it-50)">
          <strong>New to CRMs?</strong> Think of the CRM as a shared notebook for your sales team. Instead of tracking clients in WhatsApp or a spreadsheet, every interaction is recorded here — so anyone on the team can pick up where another left off.
        </InfoBox>
      </Section>

      {/* ────── Navigation ────── */}
      <Section id="navigation" title="Navigation Overview">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The CRM has several sections accessible from the top navigation bar. On mobile, tap <strong className="text-text-primary">More</strong> to see additional items.
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
                { section: 'Dashboard', path: '/crm', purpose: 'Your daily snapshot — priorities, AI briefing, stats, recent activity' },
                { section: 'Leads', path: '/crm/leads', purpose: 'All prospects before they become deals' },
                { section: 'Opportunities', path: '/crm/opportunities', purpose: 'List view of all deals (deals)' },
                { section: 'Pipeline', path: '/crm/pipeline', purpose: 'Kanban board of active deals by stage' },
                { section: 'Accounts', path: '/crm/accounts', purpose: 'Companies and organisations' },
                { section: 'Contacts', path: '/crm/contacts', purpose: 'Individual people you are in contact with' },
                { section: 'Team', path: '/crm/team', purpose: 'Manager view — performance, reassignment (admin only)' },
                { section: 'Reports', path: '/crm/reports', purpose: 'Performance analytics and team metrics' },
                { section: 'Guide', path: '/crm/guide', purpose: 'This user guide' },
                { section: 'Import/Export', path: '/crm/import-export', purpose: 'Bulk data via CSV/Excel (requires CRM import/export permissions)' },
                { section: 'Territories', path: '/crm/territories', purpose: 'Geographic sales territories (admin only)' },
                { section: 'Quotas', path: '/crm/quotas', purpose: 'Sales targets and attainment tracking' },
                { section: 'Workflows', path: '/crm/workflows', purpose: 'Automated rules triggered by CRM events (admin only)' },
                { section: 'Integrations', path: '/crm/integrations', purpose: 'Email and calendar sync (Google/Outlook)' },
                { section: 'AI Alerts', path: '/crm/anomalies', purpose: 'Configure pipeline anomaly detection (admin only)' },
                { section: 'Custom Fields', path: '/crm/custom-fields', purpose: 'Extend CRM entities with custom attributes (admin only)' },
                { section: 'Duplicates', path: '/crm/duplicates', purpose: 'Detect and resolve duplicate records (admin only)' },
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
        <InfoBox icon="info" color="var(--color-hr-50)">
          <strong>Start here every morning:</strong> Open the Dashboard first. It shows what needs your attention today — overdue follow-ups, stale leads, and AI-suggested actions.
        </InfoBox>
      </Section>

      {/* ────── Dashboard ────── */}
      <Section id="dashboard" title="The Dashboard">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Dashboard</Link> is your daily command centre. It surfaces everything that needs your attention.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Widget</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">What It Shows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { widget: "Today's Priorities", desc: 'Three cards: follow-ups due today, stale leads, overdue deals — each clickable to the filtered list' },
                { widget: 'AI Daily Briefing', desc: 'AI-generated headline, bullet points, and top priority for the day' },
                { widget: 'AI Suggested Actions', desc: 'Quick links to leads, contacts, accounts, or opportunities the AI thinks need your attention' },
                { widget: 'Stats Cards', desc: 'Account count, open leads, pipeline value (MYR), win rate percentage' },
                { widget: 'Won / Lost Summary', desc: 'Total won deals (count + value) and total lost deals (count + value)' },
                { widget: 'My Performance', desc: 'Your leads, open deals, pipeline value, won this month, stale leads, activities this week' },
                { widget: 'Lead Status Breakdown', desc: 'How many leads are in each status (New, Contacted, Qualified, etc.)' },
                { widget: 'Recent Activity', desc: 'Timeline of latest activities across the team' },
                { widget: 'Global Search', desc: 'Search across accounts, contacts, leads, and opportunities from one field' },
              ].map(row => (
                <tr key={row.widget} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">{row.widget}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <InfoBox icon="tune" color="var(--color-brand-50, #eff6ff)">
          <strong>Customise your dashboard.</strong> Click the <em>Customise</em> button at the top of the Dashboard to show or hide widgets based on what matters to you.
        </InfoBox>
      </Section>

      {/* ────── Create a Lead ────── */}
      <Section id="create-lead" title="Step 1: Create a Lead">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Go to <Link to="/crm/leads" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Leads</Link> and click the <strong className="text-text-primary">New Lead</strong> button. Fill in the form:
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Field</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">Required?</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">What to Enter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { field: 'Title', required: 'Yes', desc: 'The prospect\'s name or a short description (e.g. "Ahmad bin Razak — Trust Service")' },
                { field: 'Contact Name', required: 'No', desc: 'Primary contact person\'s name' },
                { field: 'Contact Email', required: 'No', desc: 'Email address — also used for duplicate detection' },
                { field: 'Contact Phone', required: 'No', desc: 'Phone number — also used for duplicate detection' },
                { field: 'Company Name', required: 'No', desc: 'Their organisation or employer' },
                { field: 'Owner', required: 'No', desc: 'Assigned sales rep (defaults to you)' },
                { field: 'Source', required: 'No', desc: 'How you found them: Website, Referral, Cold Call, Trade Show, LinkedIn, Advertisement, Partner, or Other' },
                { field: 'Estimated Value (MYR)', required: 'No', desc: 'Your best guess at the deal size — helps with pipeline forecasting' },
                { field: 'Follow-Up Date', required: 'No', desc: 'When you plan to next contact them — set this for every active lead' },
              ].map(row => (
                <tr key={row.field} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">{row.field}</td>
                  <td className="px-4 py-3 text-center">
                    {row.required === 'Yes'
                      ? <span className="text-xs font-bold text-danger bg-danger/10 px-2 py-0.5 rounded-full">Required</span>
                      : <span className="text-xs text-text-secondary">Optional</span>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          If the email or phone matches an existing lead, you will see a <strong className="text-text-primary">duplicate warning</strong> before saving. You can still create the lead, but it is best to check the existing record first.
        </p>
        <p className="text-text-secondary text-sm">Click <strong className="text-text-primary">Save</strong>. The lead is created with status <StatusBadge label="NEW" bg="var(--color-it-50)" text="var(--color-it-500)" />.</p>
      </Section>

      {/* ────── Lead Status Flow ────── */}
      <Section id="status-flow" title="Step 2: The Lead Status Flow">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Every lead has a status that shows where it is in your sales process. Update it on the Lead Detail page as things progress. <strong className="text-text-primary">Update the status the same day something changes.</strong>
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-6 p-4 bg-gray-50 rounded-xl border border-border">
          {[
            { label: 'NEW', bg: 'var(--color-it-50)', text: 'var(--color-it-500)' },
            { label: '→', bg: 'transparent', text: 'var(--color-text-tertiary)' },
            { label: 'CONTACTED', bg: 'var(--color-fin-50)', text: 'var(--color-warning)' },
            { label: '→', bg: 'transparent', text: 'var(--color-text-tertiary)' },
            { label: 'QUALIFIED', bg: 'var(--color-hr-50)', text: 'var(--color-success)' },
            { label: '→', bg: 'transparent', text: 'var(--color-text-tertiary)' },
            { label: 'CONVERTED', bg: 'var(--color-hr-50)', text: 'var(--color-success)' },
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
                { status: 'NEW', bg: 'var(--color-it-50)', text: 'var(--color-it-500)', meaning: 'Just created — you have not yet made any contact' },
                { status: 'CONTACTED', bg: 'var(--color-fin-50)', text: 'var(--color-warning)', meaning: 'You have reached out at least once (call, email, WhatsApp, etc.)' },
                { status: 'QUALIFIED', bg: 'var(--color-hr-50)', text: 'var(--color-success)', meaning: 'Budget confirmed, genuine interest, decision-maker identified — ready to pitch' },
                { status: 'UNQUALIFIED', bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', meaning: 'Not a fit — wrong profile, no budget, or not interested' },
                { status: 'CONVERTED', bg: 'var(--color-hr-50)', text: 'var(--color-success)', meaning: 'Lead has been converted into a Deal (the lead is now locked)' },
                { status: 'LOST', bg: 'var(--color-surface-muted)', text: 'var(--color-text-secondary)', meaning: 'Was progressing but the deal has fallen through — record a reason in notes' },
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

      {/* ────── Log Activities ────── */}
      <Section id="log-activities" title="Step 3: Log Every Touchpoint (Activities)">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          On the Lead Detail page, click <strong className="text-text-primary">Log Activity</strong> after every interaction. Choose the activity type that best describes what you did:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            { type: 'CALL', icon: 'call', color: 'var(--color-brand-600)', desc: 'Phone call made or received' },
            { type: 'EMAIL', icon: 'mail', color: 'var(--color-brand-500)', desc: 'Email sent or received' },
            { type: 'MEETING', icon: 'groups', color: 'var(--color-success)', desc: 'In-person or video meeting' },
            { type: 'WHATSAPP', icon: 'chat', color: 'var(--color-success)', desc: 'WhatsApp message or conversation' },
            { type: 'SITE_VISIT', icon: 'location_on', color: 'var(--color-danger)', desc: 'You visited a site or they came to you' },
            { type: 'FOLLOW_UP', icon: 'event_repeat', color: 'var(--color-warning)', desc: 'Scheduled follow-up action completed' },
            { type: 'TASK', icon: 'task_alt', color: 'var(--color-warning)', desc: 'Any to-do item related to this lead' },
            { type: 'NOTE', icon: 'sticky_note_2', color: 'var(--color-text-secondary)', desc: 'General observation (no specific action)' },
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
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          You can also <strong className="text-text-primary">schedule activities</strong> by setting a future date. Scheduled activities appear with a reminder badge and an option to set a push notification reminder.
        </p>
        <InfoBox icon="warning" color="var(--color-fin-50)">
          <strong>Log activities immediately.</strong> The activity log is your evidence trail. Managers can see it. If you hand a lead to a colleague, they see exactly what happened and when.
        </InfoBox>
      </Section>

      {/* ────── Notes ────── */}
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
              <span className="material-symbols-outlined text-base text-warning">sticky_note_2</span>
              Notes
            </div>
            <p className="text-xs text-text-secondary">Write a note when you <em>learned</em> something — context, observations, key details. Notes are not tracked in reports.</p>
          </div>
        </div>
      </Section>

      {/* ────── Follow-Up Dates ────── */}
      <Section id="follow-up" title="Step 5: Set Follow-Up Dates">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Every open lead should have a follow-up date. Set it in the <strong className="text-text-primary">Overview</strong> tab of the Lead Detail page. The Leads list shows urgency badges next to any lead that needs attention:
        </p>
        <div className="space-y-3 mb-4">
          {[
            { label: 'Overdue', bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'error', desc: 'Follow-up date has passed. Contact them today or reschedule.' },
            { label: 'Due Today', bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'schedule', desc: 'Follow-up is today. Reach out before the day ends.' },
            { label: 'Stale', bg: 'var(--color-surface-muted)', text: 'var(--color-text-secondary)', icon: 'hourglass_empty', desc: 'No activity logged in 7+ days. Log an activity or close the lead.' },
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
        <InfoBox icon="tips_and_updates" color="var(--color-it-50)">
          <strong>Daily habit:</strong> Check the Leads list first thing every morning. Clear all Overdue and Due Today badges before starting new outreach.
        </InfoBox>
      </Section>

      {/* ────── Qualify ────── */}
      <Section id="qualify" title="Step 6: Qualify or Disqualify">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          When you have enough information to judge whether this lead is worth pursuing, update the status on the Lead Detail page.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-xl border-2 border-success/40 bg-success/10">
            <div className="font-black text-success text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">verified</span>
              Mark QUALIFIED when:
            </div>
            <ul className="text-xs text-success space-y-1 list-disc list-inside">
              <li>You have spoken to the decision maker</li>
              <li>They have confirmed interest</li>
              <li>Budget is confirmed or likely</li>
              <li>You are ready to present a proposal</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl border-2 border-danger/40 bg-danger/10">
            <div className="font-black text-danger text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">block</span>
              Mark UNQUALIFIED when:
            </div>
            <ul className="text-xs text-danger space-y-1 list-disc list-inside">
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
        <p className="text-text-secondary text-sm">Only <StatusBadge label="QUALIFIED" bg="var(--color-hr-50)" text="var(--color-success)" /> leads can be converted to a Deal.</p>
      </Section>

      {/* ────── Convert ────── */}
      <Section id="convert" title="Step 7: Convert a Lead to a Deal">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          When a lead is <StatusBadge label="QUALIFIED" bg="var(--color-hr-50)" text="var(--color-success)" />, the <strong className="text-text-primary">Convert to Opportunity</strong> button appears at the top of the Lead Detail page. Click it and fill in the form:
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Field</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">What to Enter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { field: 'Pipeline', desc: 'Which sales pipeline this deal belongs to (e.g. Trust Services Pipeline)' },
                { field: 'Stage', desc: 'Which stage the deal starts at (usually the first stage in the pipeline)' },
                { field: 'Deal Name', desc: 'Auto-filled from the lead title — edit if needed' },
                { field: 'Deal Value (MYR)', desc: 'The confirmed or estimated deal value' },
                { field: 'Close Date', desc: 'Expected close date for the deal' },
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
          Click <strong className="text-text-primary">Convert</strong>. The lead status becomes <StatusBadge label="CONVERTED" bg="var(--color-hr-50)" text="var(--color-success)" /> and is locked. A new <strong className="text-text-primary">Opportunity</strong> (Deal) is created and linked from the Lead Detail page. The lead's contact and account are automatically linked to the new opportunity.
        </p>
        <InfoBox icon="swap_horiz" color="var(--color-hr-50)">
          After conversion, manage the deal in <Link to="/crm/pipeline" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Pipeline</Link> or <Link to="/crm/opportunities" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Opportunities</Link>. The original lead is kept for reference.
        </InfoBox>
      </Section>

      {/* ────── Pipeline ────── */}
      <Section id="pipeline" title="Step 8: Manage the Pipeline">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Go to <Link to="/crm/pipeline" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Pipeline</Link> to see all your active deals as a Kanban board, grouped by stage. Each card shows the deal name, value, AI win probability, account, expected close date, and owner.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          <strong className="text-text-primary">Drag and drop</strong> cards between stage columns to move deals forward or backward. If you drop a card on the Lost stage, a modal will ask for a Lost Reason.
        </p>
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Click on a deal card to open its Opportunity Detail page. From there you can:
        </p>
        <ul className="space-y-2 mb-4">
          {[
            { icon: 'swap_horiz', text: 'Move the deal to another stage via the Move Stage button' },
            { icon: 'task_alt', text: 'Log activities and notes against the deal' },
            { icon: 'edit', text: 'Update the deal value and other fields inline' },
            { icon: 'person', text: 'View linked contacts and the account' },
            { icon: 'history', text: 'See the full stage history timeline' },
            { icon: 'psychology', text: 'Get AI win probability and next best action' },
          ].map(item => (
            <li key={item.text} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="material-symbols-outlined text-base text-brand-700">{item.icon}</span>
              {item.text}
            </li>
          ))}
        </ul>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          Use the pipeline selector dropdown at the top to switch between pipelines if your organisation has more than one. The total pipeline value is shown in the header.
        </p>
        <InfoBox icon="warning" color="var(--color-fin-50)">
          <strong>Move deals forward promptly.</strong> Do not leave a deal sitting in a stage once it has progressed. Your manager's pipeline view reflects exactly where each deal is in real time.
        </InfoBox>
      </Section>

      {/* ────── Close ────── */}
      <Section id="close" title="Step 9: Close a Deal">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          On the Opportunity Detail page, when the deal reaches its outcome, use <strong className="text-text-primary">Move Stage</strong> to move it to a Won or Lost stage:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl border-2 border-success/40 bg-success/10">
            <div className="font-black text-success text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">emoji_events</span>
              Won
            </div>
            <p className="text-xs text-success">Mark Won by moving to the Won stage and record the final deal value. The deal is archived as a success and counted in your performance metrics. An AI Win/Loss Debrief is generated automatically.</p>
          </div>
          <div className="p-4 rounded-xl border-2 border-danger/40 bg-danger/10">
            <div className="font-black text-danger text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">cancel</span>
              Lost
            </div>
            <p className="text-xs text-danger">Mark Lost by moving to the Lost stage. You will be prompted for a Lost Reason. This feeds the Reports page so the team can learn from losses and improve over time. An AI Win/Loss Debrief is generated with key factors and lessons.</p>
          </div>
        </div>
        <p className="text-text-secondary text-sm">Closed deals leave the active Pipeline view but remain searchable in <Link to="/crm/opportunities" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Opportunities</Link>.</p>
      </Section>

      {/* ────── AI Features ────── */}
      <Section id="ai-features" title="AI Features">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The CRM includes several AI-powered features to help you sell smarter. These are available across multiple pages.
        </p>
        <div className="space-y-4 mb-4">
          {[
            {
              icon: 'psychology',
              title: 'Lead Scoring',
              desc: 'On any Lead Detail page, click the AI Score badge to generate a score from 0-100. The AI analyses lead data, activities, and contact info to predict how likely this lead is to convert. A tooltip explains the reasoning.',
              where: 'Lead Detail → AI Score badge'
            },
            {
              icon: 'insights',
              title: 'Win Probability',
              desc: 'On any Opportunity Detail page, click the AI Win % button. The AI predicts your probability of winning and provides confidence level (Low / Medium / High) with an explanation.',
              where: 'Opportunity Detail → AI Win % button'
            },
            {
              icon: 'summarize',
              title: 'AI Lead Summary',
              desc: "Automatically generates a summary of a lead's status, key facts, and recommended next step. Shown on the Lead Detail Overview tab.",
              where: 'Lead Detail → Overview → AI Summary'
            },
            {
              icon: 'next_plan',
              title: 'Next Best Action',
              desc: 'AI-suggested actions with priority (High / Medium / Low) shown on Lead, Contact, Account, and Opportunity detail pages.',
              where: 'Detail pages → Suggested Actions section'
            },
            {
              icon: 'sentiment_satisfied',
              title: 'Note Analyser',
              desc: 'After logging a CALL, MEETING, or WHATSAPP activity, the AI analyses the note content for sentiment, extracts key facts, suggests next actions, and may recommend a status change.',
              where: 'Lead/Opportunity Detail → Activities → AI Analyse button'
            },
            {
              icon: 'edit_note',
              title: 'Draft Message',
              desc: 'Generate WhatsApp or email drafts based on the lead/contact context. Choose tone (Friendly or Formal) and edit before sending.',
              where: 'Lead/Contact Detail → Draft Message button'
            },
            {
              icon: 'auto_awesome',
              title: 'Daily Briefing',
              desc: 'AI-generated headline, bullet-point summary, and top priority action for the day, shown on the Dashboard.',
              where: 'Dashboard → AI Daily Briefing widget'
            },
            {
              icon: 'analytics',
              title: 'Win/Loss Debrief',
              desc: 'For Won or Lost deals, the AI generates a debrief summarising key factors, lessons learned, and follow-on actions.',
              where: 'Opportunity Detail → Overview → AI Debrief (won/lost only)'
            },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl border border-border bg-surface">
              <span className="material-symbols-outlined text-xl shrink-0 mt-0.5 text-brand-700">{item.icon}</span>
              <div>
                <div className="font-bold text-text-primary text-sm mb-0.5">{item.title}</div>
                <p className="text-xs text-text-secondary mb-1">{item.desc}</p>
                <div className="text-xs text-brand-700 font-mono">{item.where}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ────── Contacts & Accounts ────── */}
      <Section id="contacts-accounts" title="Contacts & Accounts">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          <strong className="text-text-primary">Contacts</strong> are individual people. <strong className="text-text-primary">Accounts</strong> are companies or organisations. Link them together for a complete relationship history.
        </p>

        <h3 className="text-base font-bold text-text-primary mb-3">Contacts</h3>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Feature</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { feature: 'Fields', details: 'First/Last Name, Email, Phone, Mobile, Job Title, Department, Account, Is Primary, Follow-up Date' },
                { feature: 'Detail Tabs', details: 'Overview, Activities, KYC, Deals, Notes, Beneficiaries, Audit' },
                { feature: 'KYC Tab', details: 'Full KYC compliance — verification checklist, risk level (Low/Medium/High), PEP flag, AI gap detector, AI risk classification' },
                { feature: 'Beneficiaries', details: 'Addtrust beneficiaries with name, relationship, allocation %, NRIC/Passport, DOB, minor flag' },
                { feature: 'AI Features', details: 'Next Best Action, Draft Message (WhatsApp/Email)' },
              ].map(row => (
                <tr key={row.feature} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">{row.feature}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="text-base font-bold text-text-primary mb-3">Accounts</h3>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Feature</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { feature: 'Fields', details: 'Company Name, Registration No. (SSM), Tax No., Industry, Company Size, Website, Email, Phone, Revenue (MYR), Bank Account, Address, City, State, Postcode, Country' },
                { feature: 'Detail Tabs', details: 'Overview, Contacts, Deals, Activities, Notes, Credit (cross-module), Trust Products, Audit' },
                { feature: 'Trust Products', details: 'CRUD for trust products linked to the account — Trust Type, Deed Ref, Status, Asset Value, Trustee details, Review/Maturity dates, AI Document Checklist' },
                { feature: 'AI Features', details: 'Next Best Action' },
              ].map(row => (
                <tr key={row.feature} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">{row.feature}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <InfoBox icon="link" color="var(--color-it-50)">
          <strong>Always link your leads and opportunities to Contact and Account records.</strong> This gives a full relationship history with a company across multiple deals over time.
        </InfoBox>
      </Section>

      {/* ────── Team Dashboard ────── */}
      <Section id="team-dashboard" title="Team Dashboard (Managers Only)">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm/team" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Team Dashboard</Link> is available to managers with <StatusBadge label="crm:admin" bg="var(--color-brand-50, #eff6ff)" text="var(--color-brand-700)" /> permission. It provides an overview of the entire sales team.
        </p>
        <ul className="space-y-2 mb-4">
          {[
            { icon: 'smart_toy', text: 'AI Pipeline Briefing — at-risk deals, activity gaps, and recommendations' },
            { icon: 'pie_chart', text: 'Summary Cards — total leads, pipeline value, and won this month' },
            { icon: 'groups', text: 'Agent Performance Table — each rep\'s leads, open deals, pipeline value, won count, stale leads' },
            { icon: 'swap_horiz', text: 'Lead Reassignment — click any agent\'s stale leads to reassign them to another rep' },
          ].map(item => (
            <li key={item.text} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="material-symbols-outlined text-base text-brand-700">{item.icon}</span>
              {item.text}
            </li>
          ))}
        </ul>
      </Section>

      {/* ────── Reports ────── */}
      <Section id="reports" title="Reports">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm/reports" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Reports</Link> page has 7 report types. All support CSV export.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Report</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">What It Shows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { report: 'Lead Conversion', desc: 'Conversion rates by source, pie chart by status, overall conversion rate' },
                { report: 'Sales Performance', desc: 'Won/Lost deals by agent, win rate, total revenue, average deal size' },
                { report: 'Pipeline Forecast', desc: 'Total/weighted pipeline value, overdue deals, funnel by stage' },
                { report: 'Activity Summary', desc: 'Total activities, breakdown by type, per-agent activity counts' },
                { report: 'Lead Aging', desc: 'Stale lead count, average age, stacked chart by status and time bucket' },
                { report: 'Win/Loss Analysis', desc: 'Win rate, won/lost counts and values, lost reason distribution' },
                { report: 'KYC Compliance', desc: 'Compliance rate, approved/pending/expired counts, PEP flags' },
              ].map(row => (
                <tr key={row.report} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap">{row.report}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-secondary text-sm">Most reports support a date range filter with presets: This Month, Last 30 Days, Last Quarter, Year to Date.</p>
      </Section>

      {/* ────── Territories ────── */}
      <Section id="territories" title="Territories (Admin)">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          <Link to="/crm/territories" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Territories</Link> let you organise sales regions and assign team members to cover specific areas.
        </p>
        <ul className="space-y-2 mb-4">
          {[
            { icon: 'map', text: 'Create territories with name, description, states, and countries' },
            { icon: 'groups', text: 'Add members with Manager or Member roles' },
            { icon: 'flag', text: 'Set quotas per territory (see Quotas section)' },
            { icon: 'visibility_off', text: 'Deactivate territories you no longer need (soft delete)' },
            { icon: 'link', text: 'Leads and opportunities can be assigned to territory members' },
          ].map(item => (
            <li key={item.text} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="material-symbols-outlined text-base text-brand-700">{item.icon}</span>
              {item.text}
            </li>
          ))}
        </ul>
        <p className="text-text-secondary text-sm">Click a territory to view its members, assign quotas, and manage territory details.</p>
      </Section>

      {/* ────── Quotas ────── */}
      <Section id="quotas" title="Quotas">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm/quotas" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Quotas</Link> page shows sales target attainment for each period.
        </p>
        <ul className="space-y-2 mb-4">
          {[
            { icon: 'calendar_today', text: 'Select a period (e.g. 2026-Q1) to view quota data' },
            { icon: 'speed', text: 'Summary cards show Total Target, Closed Won, and Attainment % (colour-coded: green ≥ 100%, amber ≥ 50%, red < 50%)' },
            { icon: 'person', text: 'Per-Rep Attainment table — each rep\'s target, closed won, and progress' },
            { icon: 'map', text: 'Per-Territory Attainment table — territory-level targets and achievement' },
            { icon: 'table_chart', text: 'Quota Details table — individual quota records with period, territory, user, and target amount' },
          ].map(item => (
            <li key={item.text} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="material-symbols-outlined text-base text-brand-700">{item.icon}</span>
              {item.text}
            </li>
          ))}
        </ul>
      </Section>

      {/* ────── Workflows ────── */}
      <Section id="workflows" title="Workflows (Admin)">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          <Link to="/crm/workflows" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Workflows</Link> let you automate actions when CRM events happen — no coding required.
        </p>
        <h3 className="text-base font-bold text-text-primary mb-3">How Workflows Work</h3>
        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2 p-3 rounded-xl border border-border bg-surface">
            <span className="material-symbols-outlined text-brand-700 mt-0.5">notifications_active</span>
            <div>
              <div className="font-bold text-text-primary text-sm">1. Trigger Event</div>
              <p className="text-xs text-text-secondary">Choose what starts the workflow: Lead Created, Lead Status Changed, Opportunity Created, Deal Stage Changed, Activity Created, or Lead Stale</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl border border-border bg-surface">
            <span className="material-symbols-outlined text-brand-700 mt-0.5">filter_list</span>
            <div>
              <div className="font-bold text-text-primary text-sm">2. Conditions (Optional)</div>
              <p className="text-xs text-text-secondary">Add filters like "Source equals Referral" or "Estimated Value greater than 50000" so the workflow only fires when it matters</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl border border-border bg-surface">
            <span className="material-symbols-outlined text-brand-700 mt-0.5">play_arrow</span>
            <div>
              <div className="font-bold text-text-primary text-sm">3. Actions</div>
              <p className="text-xs text-text-secondary">
                What happens when the trigger fires: <strong>Create Task</strong> (assign to owner or manager), <strong>Send Notification</strong> (to admin, agent, or owner), <strong>Update Field</strong> (change a value on the record), or <strong>Reassign Owner</strong> (to a specific user or manager)
              </p>
            </div>
          </div>
        </div>
        <InfoBox icon="tips_and_updates" color="var(--color-it-50)">
          <strong>Quick start:</strong> Use workflow templates to get going fast. Click <em>Create from Template</em> on the Workflows page to pick from pre-built automations.
        </InfoBox>
      </Section>

      {/* ────── Import & Export ────── */}
      <Section id="import-export" title="Import & Export">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm/import-export" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Import/Export</Link> page lets you move CRM data in and out via bulk file operations.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl border border-border bg-surface">
            <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-brand-700">upload</span>
              Import
            </div>
            <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
              <li>Select entity type: Lead, Contact, Account, or Opportunity</li>
              <li>Upload CSV, XLS, or XLSX file (drag-and-drop or browse)</li>
              <li>Map your file columns to CRM fields (AI-suggested mappings)</li>
              <li>Validate — see errors/warnings before committing</li>
              <li>Import — see summary of imported and failed rows</li>
              <li>Download a template to get the right column structure</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl border border-border bg-surface">
            <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-brand-700">download</span>
              Export
            </div>
            <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
              <li>Select entity type and format (CSV or XLSX)</li>
              <li>Export runs asynchronously — download when ready</li>
              <li>View export history with download links</li>
            </ul>
          </div>
        </div>
        <InfoBox icon="warning" color="var(--color-fin-50)">
          <strong>Always validate before importing.</strong> The validation step shows you exactly which rows have errors so you can fix your file before committing changes.
        </InfoBox>
      </Section>

      {/* ────── Duplicates ────── */}
      <Section id="duplicates" title="Duplicate Detection (Admin)">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm/duplicates" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Duplicates</Link> page automatically detects potential duplicate leads and contacts based on matching email, phone, or name. It also highlights duplicates at creation time with a warning.
        </p>
        <ul className="space-y-2 mb-4">
          {[
            { icon: 'content_copy', text: 'View all detected duplicate pairs with confidence percentage (colour-coded: red ≥ 80%, amber ≥ 60%, yellow < 60%)' },
            { icon: 'call_merge', text: 'Merge duplicates — side-by-side comparison lets you pick which values to keep from each record (Record A is the master; Record B is soft-deleted)' },
            { icon: 'block', text: 'Dismiss false positives — marks a pair as not a real duplicate' },
            { icon: 'filter_list', text: 'Filter by entity type (Lead / Contact) and status (Open / Merged / Dismissed)' },
          ].map(item => (
            <li key={item.text} className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="material-symbols-outlined text-base text-brand-700">{item.icon}</span>
              {item.text}
            </li>
          ))}
        </ul>
      </Section>

      {/* ────── Custom Fields ────── */}
      <Section id="custom-fields" title="Custom Fields (Admin)">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm/custom-fields" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Custom Fields</Link> page lets you extend any CRM entity with your own attributes — no developer needed.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Field Type</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">Use For</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { type: 'TEXT', desc: 'Short text (e.g. "Preferred Name")' },
                { type: 'NUMBER', desc: 'Numeric values (e.g. "Annual Turnover")' },
                { type: 'DATE', desc: 'Date picker (e.g. "Contract Expiry Date")' },
                { type: 'DROPDOWN', desc: 'Single-select with custom options (e.g. "Industry Sector")' },
                { type: 'MULTI_SELECT', desc: 'Multi-select checkboxes with custom options (e.g. "Services Interested In")' },
                { type: 'CHECKBOX', desc: 'Yes/No toggle (e.g. "VIP Client")' },
                { type: 'URL', desc: 'Web links (e.g. "Company Website")' },
              ].map(row => (
                <tr key={row.type} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap font-mono text-xs">{row.type}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          Custom fields can be added to <strong>Leads, Contacts, Accounts, Opportunities,</strong> and <strong>Activities</strong>. Organise them into groups (tabs/sections), mark them as Required or Searchable, and set a display order.
        </p>
      </Section>

      {/* ────── Integrations ────── */}
      <Section id="integrations" title="Integrations">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm/integrations" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>Integrations</Link> page lets you connect your email and calendar for automatic sync.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl border border-border bg-surface">
            <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-brand-700">mail</span>
              Google Workspace
            </div>
            <p className="text-xs text-text-secondary">Connect Gmail + Google Calendar. OAuth-based sign-in.</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-surface">
            <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-brand-700">business</span>
              Microsoft 365
            </div>
            <p className="text-xs text-text-secondary">Connect Outlook + Microsoft Calendar. OAuth-based sign-in.</p>
          </div>
        </div>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          Once connected, you can configure the <strong className="text-text-primary">sync frequency</strong> (Every 15 min, 30 min, 1 hr, or Manual only), trigger a manual <strong className="text-text-primary">Sync Now</strong>, or <strong className="text-text-primary">Disconnect</strong> at any time.
        </p>
      </Section>

      {/* ────── AI Alerts ────── */}
      <Section id="ai-alerts" title="AI Alerts — Anomaly Configuration (Admin)">
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          The <Link to="/crm/anomalies" className="text-brand-700 font-semibold" style={{ textDecoration: 'none' }}>AI Alerts</Link> page configures automated anomaly detection for your pipeline. When an anomaly is detected, it surfaces as an alert that needs attention.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th className="text-left px-4 py-3 font-bold text-text-primary">Anomaly Type</th>
                <th className="text-left px-4 py-3 font-bold text-text-primary">What It Detects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { type: 'DEAL_STUCK', desc: 'Opportunities stuck in a stage for too long (configurable days threshold)' },
                { type: 'PROBABILITY_DROP', desc: 'Deal win probability drops significantly' },
                { type: 'VELOCITY_ANOMALY', desc: 'Deals are moving unusually fast or slow compared to benchmarks' },
                { type: 'STALE_LEAD', desc: 'Leads with no activity for an extended period' },
              ].map(row => (
                <tr key={row.type} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-text-primary whitespace-nowrap font-mono text-xs">{row.type}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-text-secondary text-sm">
          For each anomaly type, configure the <strong className="text-text-primary">threshold</strong> (e.g. days stuck), <strong className="text-text-primary">default severity</strong> (Low / Moderate / Critical), and <strong className="text-text-primary">active</strong> toggle. Changes save immediately.
        </p>
      </Section>

      {/* ────── Tips ────── */}
      <Section id="tips" title="Tips & Best Practices">
        <div className="space-y-3">
          {[
            { icon: 'today', color: 'var(--color-brand-600)', title: 'Same-day rule', desc: 'Update the lead status and log an activity on the same day you make contact. Memory fades — log it immediately.' },
            { icon: 'hourglass_empty', color: 'var(--color-warning)', title: 'No stale leads', desc: 'Check the Leads list daily. If a lead has the Stale badge (no activity in 7+ days), either log an activity or close it.' },
            { icon: 'event', color: 'var(--color-success)', title: 'Every lead needs a follow-up date', desc: 'Unless the lead is Converted, Lost, or Unqualified, always set a follow-up date. This is how the system surfaces what needs attention today.' },
            { icon: 'task_alt', color: 'var(--color-brand-500)', title: 'Notes are not a substitute for activities', desc: 'Notes are invisible to automated reports. Use activities for trackable touchpoints (calls, emails, meetings) — they feed your performance metrics.' },
            { icon: 'link', color: 'var(--color-danger)', title: 'Use Accounts and Contacts', desc: 'Link your leads and opportunities to Contact and Account records. This gives a full relationship history with a company across multiple deals over time.' },
            { icon: 'dashboard', color: 'var(--color-brand-500)', title: 'Check the Dashboard first', desc: 'Start every workday at the CRM Dashboard. It surfaces overdue follow-ups, stale leads, AI briefing, and your pipeline summary — everything that needs attention today.' },
            { icon: 'psychology', color: 'var(--color-brand-600)', title: 'Leverage AI features', desc: 'Click the AI Score, AI Win %, and Next Best Action buttons regularly. They surface insights you might miss and help you focus on the highest-potential deals.' },
            { icon: 'swap_horiz', color: 'var(--color-brand-500)', title: 'Automate with Workflows', desc: 'Set up workflow rules for repetitive tasks — auto-assign new referrals, notify managers on big deals, or flag stale leads. Templates are available to get started quickly.' },
            { icon: 'upload', color: 'var(--color-success)', title: 'Bulk import for onboarding', desc: 'When onboarding existing data, use Import/Export rather than manual entry. Download the template, fill it in, validate, and import — AI will suggest column mappings.' },
            { icon: 'content_copy', color: 'var(--color-warning)', title: 'Review duplicates regularly', desc: 'Check the Duplicates page periodically. Merge true duplicates to keep your data clean — the side-by-side view makes it easy to pick the best values.' },
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

    </div>
    </>
  );
};

export default CrmGuide;
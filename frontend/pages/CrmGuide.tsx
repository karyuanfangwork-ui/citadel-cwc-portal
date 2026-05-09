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
    </div>
  );
};

export default CrmGuide;

# CRM Onboarding & Operational Documentation Suite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 6 standalone enterprise-grade HTML documentation files covering the full CRM onboarding and operational documentation suite for internal staff use.

**Architecture:** Each file is a self-contained HTML portal matching the existing `docs/CRM-Module-Documentation.html` design system (Bootstrap 5 + Tailwind CDN + FontAwesome + Mermaid.js + Chart.js, dark `#1e3a5f` sidebar, white content area, sticky topbar). Files live in `docs/crm-onboarding/` and share no runtime dependencies — all CDN assets are loaded per file. Content is grounded in the actual CRM module: Leads, Opportunities, Accounts, Contacts, Pipeline, Activities, Reports, Team Dashboard, AI features, Trust Products, and BNM-aligned compliance workflows.

**Tech Stack:** HTML5, Bootstrap 5.3.2 (CDN), Tailwind CSS (CDN), Font Awesome 6.5.0 (CDN), Mermaid.js 10.6.1 (CDN), Chart.js 4.4.0 (CDN)

---

## Shared HTML Shell

Every file uses this consistent shell. The sidebar nav items, page title, and main content differ per file.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title><!-- FILE TITLE --> | CWC 2.0 CRM</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
<style>
  :root {
    --brand-primary: #1e3a5f;
    --brand-secondary: #2563eb;
    --brand-accent: #0ea5e9;
    --brand-success: #059669;
    --brand-warning: #d97706;
    --brand-danger: #dc2626;
    --sidebar-w: 280px;
    --header-h: 64px;
  }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; }
  #sidebar {
    position: fixed; top: 0; left: 0; width: var(--sidebar-w);
    height: 100vh; background: var(--brand-primary); overflow-y: auto;
    z-index: 1000; display: flex; flex-direction: column;
  }
  #sidebar .brand { padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,.1); background: rgba(0,0,0,.2); }
  #sidebar .brand h1 { font-size: .85rem; font-weight: 700; color: #93c5fd; letter-spacing: .08em; text-transform: uppercase; margin: 0; }
  #sidebar .brand p { font-size: .7rem; color: rgba(255,255,255,.5); margin: .15rem 0 0; }
  #sidebar nav { flex: 1; padding: .75rem 0; }
  .nav-section-label { font-size: .65rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.35); padding: .75rem 1.5rem .25rem; }
  .nav-link-item { display: flex; align-items: center; gap: .65rem; padding: .55rem 1.5rem; color: rgba(255,255,255,.7); text-decoration: none; font-size: .82rem; font-weight: 500; transition: all .15s; border-left: 3px solid transparent; cursor: pointer; }
  .nav-link-item:hover { background: rgba(255,255,255,.08); color: #fff; border-left-color: var(--brand-accent); }
  .nav-link-item.active { background: rgba(14,165,233,.15); color: #7dd3fc; border-left-color: #7dd3fc; }
  .nav-link-item i { width: 16px; text-align: center; opacity: .7; font-size: .8rem; }
  #topbar { position: fixed; top: 0; left: var(--sidebar-w); right: 0; height: var(--header-h); background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; padding: 0 2rem; z-index: 900; gap: 1rem; }
  #main { margin-left: var(--sidebar-w); padding-top: var(--header-h); min-height: 100vh; }
  .content-section { padding: 2.5rem 2.5rem 1.5rem; max-width: 1100px; }
  .section-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 2rem; margin-bottom: 1.5rem; }
  .section-header { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #f1f5f9; }
  .section-header h2 { font-size: 1.35rem; font-weight: 700; color: var(--brand-primary); margin: 0; }
  .badge-role { display: inline-flex; align-items: center; gap: .35rem; padding: .2rem .65rem; border-radius: 99px; font-size: .72rem; font-weight: 600; }
  .kpi-card { background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border: 1px solid #bae6fd; border-radius: 10px; padding: 1.25rem; }
  .step-item { display: flex; gap: 1rem; padding: .85rem 0; border-bottom: 1px solid #f1f5f9; }
  .step-num { width: 28px; height: 28px; background: var(--brand-secondary); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
  .risk-high { color: var(--brand-danger); }
  .risk-med { color: var(--brand-warning); }
  .risk-low { color: var(--brand-success); }
  .mermaid-wrap { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.5rem; overflow-x: auto; margin: 1rem 0; }
  table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  th { background: var(--brand-primary); color: #fff; padding: .65rem 1rem; text-align: left; font-weight: 600; font-size: .8rem; }
  td { padding: .6rem 1rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:hover td { background: #f8fafc; }
  .checklist-item { display: flex; align-items: flex-start; gap: .65rem; padding: .4rem 0; font-size: .875rem; }
  .checklist-item i { color: var(--brand-success); margin-top: 2px; }
  .alert-box { padding: 1rem 1.25rem; border-radius: 8px; margin: 1rem 0; font-size: .875rem; }
  .alert-info { background: #eff6ff; border-left: 4px solid var(--brand-secondary); }
  .alert-warn { background: #fffbeb; border-left: 4px solid var(--brand-warning); }
  .alert-danger { background: #fef2f2; border-left: 4px solid var(--brand-danger); }
  .alert-success { background: #f0fdf4; border-left: 4px solid var(--brand-success); }
</style>
</head>
<body>
<div id="sidebar">
  <div class="brand">
    <h1>CRM Documentation</h1>
    <p>CWC 2.0 — Citadel Group</p>
  </div>
  <nav><!-- SIDEBAR NAV --></nav>
  <div style="padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.1)">
    <div style="font-size:.7rem;color:rgba(255,255,255,.35)">Suite Navigation</div>
    <a href="01-quick-start.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Quick Start Guide</a>
    <a href="02-sop.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">SOP Documentation</a>
    <a href="03-workflows.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Workflow Documentation</a>
    <a href="04-business-rules.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Business Rules</a>
    <a href="05-role-guides.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Role-Based Guides</a>
    <a href="06-reporting-kpi.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Reporting &amp; KPI</a>
  </div>
</div>
<div id="topbar">
  <div style="display:flex;align-items:center;gap:.75rem">
    <span style="font-size:.8rem;color:#94a3b8">CRM Documentation Suite</span>
    <span style="color:#cbd5e1">›</span>
    <span style="font-size:.875rem;font-weight:600;color:#1e293b"><!-- PAGE TITLE --></span>
  </div>
  <div style="font-size:.75rem;color:#94a3b8">Citadel Group Technologies Sdn Bhd · CWC 2.0</div>
</div>
<div id="main"><!-- MAIN CONTENT --></div>
<script>
  mermaid.initialize({ startOnLoad: true, theme: 'base', themeVariables: { primaryColor: '#1e3a5f', primaryTextColor: '#fff', primaryBorderColor: '#2563eb', lineColor: '#94a3b8', secondaryColor: '#eff6ff', tertiaryColor: '#f8fafc' }});
  // Sidebar active state
  document.querySelectorAll('.nav-link-item[data-section]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.nav-link-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      const target = document.getElementById(el.dataset.section);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
</script>
</body>
</html>
```

---

## File Map

| # | File | Size estimate | Key content |
|---|------|--------------|-------------|
| 1 | `docs/crm-onboarding/01-quick-start.html` | ~600 lines | Login, dashboard, navigation, daily activities, best practices |
| 2 | `docs/crm-onboarding/02-sop.html` | ~900 lines | 8 SOPs: Lead Creation, Assignment, Opportunity, Follow-Up, Approval, Complaint, Data Quality, Reporting |
| 3 | `docs/crm-onboarding/03-workflows.html` | ~800 lines | 5 workflows with Mermaid diagrams: Lead, Opportunity, Escalation, Approval, Reporting |
| 4 | `docs/crm-onboarding/04-business-rules.html` | ~700 lines | 11 rule categories: naming, classification, stages, mandatory data, SLA, escalation, approval, RBAC, data quality, duplicates, reporting |
| 5 | `docs/crm-onboarding/05-role-guides.html` | ~700 lines | 6 roles: Sales Rep, Sales Manager, Customer Service, Operations, Admin, Management |
| 6 | `docs/crm-onboarding/06-reporting-kpi.html` | ~700 lines | Dashboard overview, 8 KPI categories, pipeline/performance/SLA/retention reporting |

---

## Task 1: Create `docs/crm-onboarding/` directory and `01-quick-start.html`

**Files:**
- Create: `docs/crm-onboarding/01-quick-start.html`

This file covers all of Part 1: System Introduction, Login Guide, Dashboard Overview, Navigation Guide, Daily Core Activities, Best Practices, Support & Escalation.

- [ ] **Step 1: Create the directory and file**

Create `docs/crm-onboarding/01-quick-start.html` with the full content below. Use the shared HTML shell. Sidebar nav sections: Introduction, Login Guide, Dashboard Overview, Navigation, Daily Activities, Best Practices, Support.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Quick Start Guide | CWC 2.0 CRM</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
<style>
  /* [paste shared CSS block from Shared HTML Shell above] */
</style>
</head>
<body>
<div id="sidebar">
  <div class="brand"><h1>CRM Documentation</h1><p>CWC 2.0 — Citadel Group</p></div>
  <nav>
    <div class="nav-section-label">Quick Start Guide</div>
    <a class="nav-link-item active" data-section="s-intro"><i class="fa fa-home"></i> System Introduction</a>
    <a class="nav-link-item" data-section="s-login"><i class="fa fa-sign-in-alt"></i> Login Guide</a>
    <a class="nav-link-item" data-section="s-dashboard"><i class="fa fa-th-large"></i> Dashboard Overview</a>
    <a class="nav-link-item" data-section="s-nav"><i class="fa fa-bars"></i> Navigation Guide</a>
    <a class="nav-link-item" data-section="s-activities"><i class="fa fa-tasks"></i> Daily Core Activities</a>
    <a class="nav-link-item" data-section="s-best"><i class="fa fa-star"></i> Best Practices</a>
    <a class="nav-link-item" data-section="s-support"><i class="fa fa-life-ring"></i> Support & Escalation</a>
  </nav>
  <div style="padding:1rem 1.5rem;border-top:1px solid rgba(255,255,255,.1)">
    <div style="font-size:.7rem;color:rgba(255,255,255,.35);margin-bottom:.4rem">Suite Navigation</div>
    <a href="01-quick-start.html" style="display:block;color:#7dd3fc;font-size:.75rem;padding:.25rem 0;text-decoration:none;font-weight:600">→ Quick Start Guide</a>
    <a href="02-sop.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">SOP Documentation</a>
    <a href="03-workflows.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Workflow Documentation</a>
    <a href="04-business-rules.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Business Rules</a>
    <a href="05-role-guides.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Role-Based Guides</a>
    <a href="06-reporting-kpi.html" style="display:block;color:rgba(255,255,255,.5);font-size:.75rem;padding:.25rem 0;text-decoration:none">Reporting &amp; KPI</a>
  </div>
</div>
<div id="topbar">
  <div style="display:flex;align-items:center;gap:.75rem">
    <span style="font-size:.8rem;color:#94a3b8">CRM Documentation Suite</span>
    <span style="color:#cbd5e1">›</span>
    <span style="font-size:.875rem;font-weight:600;color:#1e293b">Quick Start Guide</span>
  </div>
  <div style="display:flex;align-items:center;gap:.75rem">
    <span class="badge-role" style="background:#dbeafe;color:#1d4ed8"><i class="fa fa-book-open"></i> Part 1 of 6</span>
    <span style="font-size:.75rem;color:#94a3b8">Citadel Group Technologies · CWC 2.0</span>
  </div>
</div>
<div id="main">

<!-- ═══ SECTION: System Introduction ═══ -->
<div class="content-section" id="s-intro">
  <div class="section-card">
    <div class="section-header">
      <i class="fa fa-home fa-lg" style="color:var(--brand-secondary)"></i>
      <h2>1. System Introduction</h2>
    </div>
    <div class="alert-box alert-info" style="margin-bottom:1.5rem">
      <strong>Welcome to CWC 2.0 CRM.</strong> This guide is your starting point. Read it before your first login.
    </div>
    <div class="row g-3 mb-4">
      <div class="col-md-6">
        <div class="kpi-card">
          <div style="font-size:.75rem;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">CRM Purpose</div>
          <p style="font-size:.875rem;margin:0">Manage the full customer lifecycle — from lead capture through to deal closure and post-sale trust product management — within a single platform aligned to Malaysian financial services compliance (BNM/KYC/AML).</p>
        </div>
      </div>
      <div class="col-md-6">
        <div class="kpi-card" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-color:#bbf7d0">
          <div style="font-size:.75rem;font-weight:700;color:#065f46;text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Business Objectives</div>
          <ul style="font-size:.875rem;margin:0;padding-left:1.2rem">
            <li>Centralise all customer and prospect data</li>
            <li>Reduce lead response time to under 24 hours</li>
            <li>Improve pipeline forecast accuracy</li>
            <li>Ensure BNM-compliant KYC documentation</li>
            <li>Increase sales team productivity via AI assistance</li>
          </ul>
        </div>
      </div>
    </div>
    <h5 style="font-weight:700;margin-bottom:1rem">Key Modules</h5>
    <table>
      <thead><tr><th>Module</th><th>What It Does</th><th>Who Uses It</th></tr></thead>
      <tbody>
        <tr><td><strong>Dashboard</strong></td><td>AI daily briefing, KPIs, activity timeline</td><td>All users</td></tr>
        <tr><td><strong>Accounts</strong></td><td>Company/entity records, trust products, KYC status</td><td>Sales Rep, Manager</td></tr>
        <tr><td><strong>Contacts</strong></td><td>Individual contacts, KYC data, relationship mapping</td><td>Sales Rep, Manager</td></tr>
        <tr><td><strong>Leads</strong></td><td>Prospect capture, AI scoring, qualification workflow</td><td>Sales Rep, Manager</td></tr>
        <tr><td><strong>Pipeline</strong></td><td>Kanban deal board, stage management, win probability</td><td>Sales Rep, Manager</td></tr>
        <tr><td><strong>Team</strong></td><td>Team performance, rep comparison, manager AI</td><td>Manager, Admin</td></tr>
        <tr><td><strong>Reports</strong></td><td>7 report types, CSV export, trend charts</td><td>Manager, Management</td></tr>
      </tbody>
    </table>
    <h5 style="font-weight:700;margin:1.5rem 0 1rem">Target Users</h5>
    <div class="row g-2">
      <div class="col-auto"><span class="badge-role" style="background:#dbeafe;color:#1e40af;padding:.4rem .9rem"><i class="fa fa-user-tie"></i> Sales Representative</span></div>
      <div class="col-auto"><span class="badge-role" style="background:#fef9c3;color:#713f12;padding:.4rem .9rem"><i class="fa fa-users"></i> Sales Manager</span></div>
      <div class="col-auto"><span class="badge-role" style="background:#f0fdf4;color:#14532d;padding:.4rem .9rem"><i class="fa fa-headset"></i> Customer Service</span></div>
      <div class="col-auto"><span class="badge-role" style="background:#fdf4ff;color:#581c87;padding:.4rem .9rem"><i class="fa fa-cogs"></i> Operations</span></div>
      <div class="col-auto"><span class="badge-role" style="background:#fff7ed;color:#7c2d12;padding:.4rem .9rem"><i class="fa fa-shield-alt"></i> Admin</span></div>
      <div class="col-auto"><span class="badge-role" style="background:#f1f5f9;color:#475569;padding:.4rem .9rem"><i class="fa fa-chart-line"></i> Management</span></div>
    </div>
  </div>
</div>

<!-- ═══ SECTION: Login Guide ═══ -->
<div class="content-section" id="s-login">
  <div class="section-card">
    <div class="section-header">
      <i class="fa fa-sign-in-alt fa-lg" style="color:var(--brand-secondary)"></i>
      <h2>2. Login Guide</h2>
    </div>
    <div class="row g-3">
      <div class="col-md-7">
        <h5 style="font-weight:700;margin-bottom:1rem">Login Process</h5>
        <div class="step-item"><div class="step-num">1</div><div><strong>Open browser</strong> — Use Chrome 110+, Edge 110+, or Firefox 115+. Safari 16+ supported.</div></div>
        <div class="step-item"><div class="step-num">2</div><div><strong>Navigate to the CWC 2.0 portal URL</strong> provided by your IT administrator.</div></div>
        <div class="step-item"><div class="step-num">3</div><div><strong>Enter your email address</strong> — use your Citadel Group corporate email (@citadelgroup.com.my).</div></div>
        <div class="step-item"><div class="step-num">4</div><div><strong>Enter your password</strong> — minimum 8 characters. Passwords are case-sensitive.</div></div>
        <div class="step-item"><div class="step-num">5</div><div><strong>Click "Sign In"</strong> — you will be directed to your dashboard based on your role.</div></div>
        <div class="alert-box alert-warn" style="margin-top:1rem">
          <strong>Session Timeout Policy:</strong> Sessions expire after <strong>8 hours</strong> of inactivity. Save your work before stepping away.
        </div>
      </div>
      <div class="col-md-5">
        <div class="section-card" style="background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;padding:2rem">
          <i class="fa fa-desktop fa-3x" style="color:#cbd5e1;margin-bottom:1rem"></i>
          <p style="font-size:.8rem;color:#94a3b8;margin:0">[Screenshot placeholder: Login page]</p>
        </div>
        <h5 style="font-weight:700;margin:1.25rem 0 .75rem">Password Reset</h5>
        <div class="step-item"><div class="step-num">1</div><div>Click <strong>"Forgot Password?"</strong> on the login page.</div></div>
        <div class="step-item"><div class="step-num">2</div><div>Enter your corporate email address.</div></div>
        <div class="step-item"><div class="step-num">3</div><div>Check your inbox for the reset link (valid 30 minutes).</div></div>
        <div class="step-item"><div class="step-num">4</div><div>Set a new password and log in.</div></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECTION: Dashboard Overview ═══ -->
<div class="content-section" id="s-dashboard">
  <div class="section-card">
    <div class="section-header">
      <i class="fa fa-th-large fa-lg" style="color:var(--brand-secondary)"></i>
      <h2>3. Dashboard Overview</h2>
    </div>
    <div class="alert-box alert-info" style="margin-bottom:1.25rem">
      The CRM Dashboard is your operational command centre. It shows your daily AI briefing, KPI snapshot, pending tasks, recent activity, and quick-action buttons.
    </div>
    <div class="row g-3 mb-4">
      <div class="col-md-6">
        <div class="section-card" style="background:#f8fafc;border:1px dashed #cbd5e1;text-align:center;padding:2rem">
          <i class="fa fa-chart-bar fa-3x" style="color:#cbd5e1;margin-bottom:1rem"></i>
          <p style="font-size:.8rem;color:#94a3b8;margin:0">[Screenshot placeholder: CRM Dashboard — KPI cards and AI briefing panel]</p>
        </div>
      </div>
      <div class="col-md-6">
        <h5 style="font-weight:700;margin-bottom:1rem">Dashboard Components</h5>
        <table>
          <thead><tr><th>Component</th><th>What It Shows</th></tr></thead>
          <tbody>
            <tr><td><strong>AI Daily Briefing</strong></td><td>Priority customers to contact today, generated by AI based on activity history</td></tr>
            <tr><td><strong>KPI Cards</strong></td><td>My Leads, Open Opportunities, Overdue Activities, Pipeline Value</td></tr>
            <tr><td><strong>Task Panel</strong></td><td>Today's pending tasks sorted by due date</td></tr>
            <tr><td><strong>Activity Timeline</strong></td><td>Recent calls, emails, meetings logged across your accounts</td></tr>
            <tr><td><strong>Quick Actions</strong></td><td>New Lead, New Activity, New Opportunity buttons</td></tr>
            <tr><td><strong>Notifications Bell</strong></td><td>Unread alerts: task reminders, lead assignments, approval responses</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <h5 style="font-weight:700;margin-bottom:1rem">Common Dashboard Actions</h5>
    <div class="row g-2">
      <div class="col-md-4"><div class="alert-box alert-success"><i class="fa fa-search"></i> <strong>Search:</strong> Use the global search bar (top nav) to find any account, contact, lead, or opportunity by name or IC/company number.</div></div>
      <div class="col-md-4"><div class="alert-box alert-info"><i class="fa fa-filter"></i> <strong>Filter:</strong> On list pages, use the filter bar to narrow by status, owner, date range, or source.</div></div>
      <div class="col-md-4"><div class="alert-box alert-warn"><i class="fa fa-bell"></i> <strong>Notifications:</strong> Click the bell icon to review pending approvals, task reminders, and system alerts.</div></div>
    </div>
  </div>
</div>

<!-- ═══ SECTION: Navigation Guide ═══ -->
<div class="content-section" id="s-nav">
  <div class="section-card">
    <div class="section-header">
      <i class="fa fa-bars fa-lg" style="color:var(--brand-secondary)"></i>
      <h2>4. Navigation Guide</h2>
    </div>
    <div class="row g-4">
      <div class="col-md-6">
        <h5 style="font-weight:700;margin-bottom:1rem">CRM Sidebar Menu</h5>
        <table>
          <thead><tr><th>Menu Item</th><th>Route</th><th>Access</th></tr></thead>
          <tbody>
            <tr><td><i class="fa fa-home" style="color:#0ea5e9"></i> Dashboard</td><td>/crm</td><td>All CRM users</td></tr>
            <tr><td><i class="fa fa-building" style="color:#0ea5e9"></i> Accounts</td><td>/crm/accounts</td><td>All CRM users</td></tr>
            <tr><td><i class="fa fa-address-book" style="color:#0ea5e9"></i> Contacts</td><td>/crm/contacts</td><td>All CRM users</td></tr>
            <tr><td><i class="fa fa-user-plus" style="color:#0ea5e9"></i> Leads</td><td>/crm/leads</td><td>All CRM users</td></tr>
            <tr><td><i class="fa fa-funnel-dollar" style="color:#0ea5e9"></i> Pipeline</td><td>/crm/pipeline</td><td>All CRM users</td></tr>
            <tr><td><i class="fa fa-users" style="color:#f59e0b"></i> Team</td><td>/crm/team</td><td>Manager / Admin only</td></tr>
            <tr><td><i class="fa fa-chart-pie" style="color:#0ea5e9"></i> Reports</td><td>/crm/reports</td><td>All CRM users</td></tr>
          </tbody>
        </table>
      </div>
      <div class="col-md-6">
        <h5 style="font-weight:700;margin-bottom:1rem">Top Navigation Elements</h5>
        <table>
          <thead><tr><th>Element</th><th>Function</th></tr></thead>
          <tbody>
            <tr><td><strong>Search Bar</strong></td><td>Global search across all CRM records — type 3+ characters to activate</td></tr>
            <tr><td><strong>Bell Icon</strong></td><td>Notification centre — shows unread count badge</td></tr>
            <tr><td><strong>User Avatar</strong></td><td>Profile, settings, password change, logout</td></tr>
            <tr><td><strong>Module Switcher</strong></td><td>Switch between CRM, ITSM, HR, Finance modules</td></tr>
          </tbody>
        </table>
        <div class="alert-box alert-warn" style="margin-top:1rem">
          <strong>Important:</strong> The <strong>Team</strong> tab is hidden for Sales Representatives. If you need team-level data, request access through your manager.
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECTION: Daily Core Activities ═══ -->
<div class="content-section" id="s-activities">
  <div class="section-card">
    <div class="section-header">
      <i class="fa fa-tasks fa-lg" style="color:var(--brand-secondary)"></i>
      <h2>5. Daily Core Activities</h2>
    </div>

    <!-- Create Lead -->
    <div style="margin-bottom:2rem">
      <h5 style="font-weight:700;color:var(--brand-primary);margin-bottom:.75rem"><i class="fa fa-user-plus" style="color:var(--brand-secondary);margin-right:.5rem"></i>5.1 Create a Lead</h5>
      <div class="row g-3">
        <div class="col-md-8">
          <table style="margin-bottom:1rem">
            <thead><tr><th>Field</th><th>Required</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td>Lead Name</td><td><span style="color:var(--brand-danger)">✱ Required</span></td><td>Full legal name (individual) or registered company name</td></tr>
              <tr><td>Source</td><td><span style="color:var(--brand-danger)">✱ Required</span></td><td>Referral / Cold Call / Website / Event / Walk-in</td></tr>
              <tr><td>Phone / Email</td><td><span style="color:var(--brand-danger)">✱ Required</span></td><td>At least one contact method mandatory</td></tr>
              <tr><td>Assigned To</td><td><span style="color:var(--brand-danger)">✱ Required</span></td><td>Defaults to self; manager can reassign</td></tr>
              <tr><td>Lead Value (Est.)</td><td>Optional</td><td>Estimated deal value in MYR</td></tr>
              <tr><td>Notes</td><td>Optional</td><td>First contact notes, context, referral details</td></tr>
            </tbody>
          </table>
          <div class="alert-box alert-danger"><strong>Common mistake:</strong> Leaving Source blank. Every lead must have a traceable source for pipeline reporting.</div>
        </div>
        <div class="col-md-4">
          <h6 style="font-weight:700;margin-bottom:.75rem">Steps</h6>
          <div class="step-item"><div class="step-num">1</div><div>Click <strong>Leads</strong> in the sidebar</div></div>
          <div class="step-item"><div class="step-num">2</div><div>Click <strong>"+ New Lead"</strong> button (top right)</div></div>
          <div class="step-item"><div class="step-num">3</div><div>Fill all required fields</div></div>
          <div class="step-item"><div class="step-num">4</div><div>Check for <strong>duplicate warning</strong> — if shown, review before saving</div></div>
          <div class="step-item"><div class="step-num">5</div><div>Click <strong>"Save Lead"</strong></div></div>
          <div class="step-item"><div class="step-num">6</div><div>Add an initial activity note within 24 hours</div></div>
        </div>
      </div>
    </div>

    <!-- Update Opportunity -->
    <div style="margin-bottom:2rem;padding-top:1.5rem;border-top:1px solid #f1f5f9">
      <h5 style="font-weight:700;color:var(--brand-primary);margin-bottom:.75rem"><i class="fa fa-chart-line" style="color:var(--brand-secondary);margin-right:.5rem"></i>5.2 Update an Opportunity</h5>
      <div class="row g-3">
        <div class="col-md-8">
          <p style="font-size:.875rem">Opportunities must be updated every time a meaningful customer interaction occurs. Stale opportunities (no update for 14+ days) trigger an automated escalation alert.</p>
          <table>
            <thead><tr><th>Stage</th><th>Meaning</th><th>Required Action</th></tr></thead>
            <tbody>
              <tr><td>Prospecting</td><td>Initial contact made</td><td>Log first meeting/call activity</td></tr>
              <tr><td>Qualification</td><td>Needs confirmed</td><td>Update estimated value, attach KYC docs</td></tr>
              <tr><td>Proposal</td><td>Proposal sent</td><td>Attach proposal document, set follow-up date</td></tr>
              <tr><td>Negotiation</td><td>Terms being discussed</td><td>Log each negotiation call, update close date</td></tr>
              <tr><td>Closed Won</td><td>Deal agreed</td><td>Convert to Account/Contact; trigger trust product setup</td></tr>
              <tr><td>Closed Lost</td><td>Deal lost</td><td>Mandatory: fill Lost Reason field</td></tr>
            </tbody>
          </table>
        </div>
        <div class="col-md-4">
          <h6 style="font-weight:700;margin-bottom:.75rem">Steps to Update</h6>
          <div class="step-item"><div class="step-num">1</div><div>Open <strong>Pipeline</strong> or <strong>Opportunities</strong> list</div></div>
          <div class="step-item"><div class="step-num">2</div><div>Click the opportunity card/row</div></div>
          <div class="step-item"><div class="step-num">3</div><div>Click <strong>"Edit"</strong> or use inline editing on the Kanban card</div></div>
          <div class="step-item"><div class="step-num">4</div><div>Update stage, value, close date</div></div>
          <div class="step-item"><div class="step-num">5</div><div>Log a new activity note explaining the update</div></div>
          <div class="step-item"><div class="step-num">6</div><div>Click <strong>"Save"</strong></div></div>
        </div>
      </div>
    </div>

    <!-- Schedule Follow-up -->
    <div style="margin-bottom:2rem;padding-top:1.5rem;border-top:1px solid #f1f5f9">
      <h5 style="font-weight:700;color:var(--brand-primary);margin-bottom:.75rem"><i class="fa fa-calendar" style="color:var(--brand-secondary);margin-right:.5rem"></i>5.3 Schedule a Follow-Up</h5>
      <div class="row g-3">
        <div class="col-md-5">
          <div class="step-item"><div class="step-num">1</div><div>Open any Lead, Opportunity, or Contact detail page</div></div>
          <div class="step-item"><div class="step-num">2</div><div>Click <strong>"+ Add Activity"</strong></div></div>
          <div class="step-item"><div class="step-num">3</div><div>Set type: <em>Call / Meeting / Email / Task</em></div></div>
          <div class="step-item"><div class="step-num">4</div><div>Set <strong>Due Date</strong> — required for scheduled activities</div></div>
          <div class="step-item"><div class="step-num">5</div><div>Write a brief note describing the purpose</div></div>
          <div class="step-item"><div class="step-num">6</div><div>Click <strong>"Save Activity"</strong></div></div>
        </div>
        <div class="col-md-7">
          <div class="alert-box alert-info"><strong>Best practice:</strong> Never leave a completed activity without scheduling the next follow-up. Zero-gap follow-up is a team KPI.</div>
          <div class="alert-box alert-warn" style="margin-top:.75rem"><strong>Rule:</strong> All customer-facing activities must be logged within <strong>24 hours</strong> of occurrence. Activities logged later are flagged in reporting.</div>
        </div>
      </div>
    </div>

    <!-- Search Customer -->
    <div style="padding-top:1.5rem;border-top:1px solid #f1f5f9">
      <h5 style="font-weight:700;color:var(--brand-primary);margin-bottom:.75rem"><i class="fa fa-search" style="color:var(--brand-secondary);margin-right:.5rem"></i>5.4 Search a Customer</h5>
      <div class="row g-3">
        <div class="col-md-6">
          <div class="step-item"><div class="step-num">1</div><div>Click the <strong>Search bar</strong> in the top nav (or press <kbd>Ctrl+K</kbd>)</div></div>
          <div class="step-item"><div class="step-num">2</div><div>Type the customer name, IC number, or company registration number</div></div>
          <div class="step-item"><div class="step-num">3</div><div>Results show across Accounts, Contacts, and Leads</div></div>
          <div class="step-item"><div class="step-num">4</div><div>Click the matching result to open the detail page</div></div>
        </div>
        <div class="col-md-6">
          <div class="alert-box alert-info"><strong>Tip:</strong> Search by partial name — 3 characters minimum. Use IC number for exact individual matches to avoid duplicate record creation.</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECTION: Best Practices ═══ -->
<div class="content-section" id="s-best">
  <div class="section-card">
    <div class="section-header">
      <i class="fa fa-star fa-lg" style="color:var(--brand-secondary)"></i>
      <h2>6. Best Practices Guide</h2>
    </div>
    <div class="row g-3">
      <div class="col-md-6">
        <h5 style="font-weight:700;margin-bottom:1rem">Data Quality</h5>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Always search before creating — prevent duplicate records</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Use full legal names for Accounts and Contacts</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Keep IC/Passport numbers consistent (no spaces, correct format)</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Update opportunity stage within 48 hours of a customer interaction</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Never leave the Source field blank on leads</span></div>
        <div class="checklist-item"><i class="fa fa-times-circle" style="color:var(--brand-danger)"></i><span>Do NOT enter placeholder names like "Test Customer" or "TBC"</span></div>
      </div>
      <div class="col-md-6">
        <h5 style="font-weight:700;margin-bottom:1rem">Activity Logging</h5>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Log every customer interaction — call, email, meeting — same day</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Use the AI Note Analysis feature to auto-extract action items from meeting notes</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Schedule the next follow-up before closing an activity</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Use specific activity types (Call/Meeting/Email) — not generic "Task" for everything</span></div>
        <h5 style="font-weight:700;margin:1.25rem 0 1rem">Approval Submission</h5>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Attach all supporting documents before submitting for approval</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Fill the Notes field explaining the request context</span></div>
        <div class="checklist-item"><i class="fa fa-check-circle"></i><span>Check the approval status within 24 hours — follow up if pending</span></div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ SECTION: Support ═══ -->
<div class="content-section" id="s-support">
  <div class="section-card">
    <div class="section-header">
      <i class="fa fa-life-ring fa-lg" style="color:var(--brand-secondary)"></i>
      <h2>7. Support & Escalation</h2>
    </div>
    <div class="row g-3">
      <div class="col-md-6">
        <h5 style="font-weight:700;margin-bottom:1rem">How to Get Help</h5>
        <table>
          <thead><tr><th>Issue Type</th><th>First Contact</th><th>SLA</th></tr></thead>
          <tbody>
            <tr><td>Login / Access Problem</td><td>IT Helpdesk via CWC portal</td><td>4 hours</td></tr>
            <tr><td>Data Error / Duplicate Record</td><td>CRM Admin (your department)</td><td>1 business day</td></tr>
            <tr><td>Approval Workflow Issue</td><td>Your Line Manager</td><td>Same day</td></tr>
            <tr><td>System Bug / Error</td><td>IT Helpdesk — log a ticket</td><td>4 hours</td></tr>
            <tr><td>CRM Training Request</td><td>HR / Training Coordinator</td><td>3 business days</td></tr>
          </tbody>
        </table>
      </div>
      <div class="col-md-6">
        <h5 style="font-weight:700;margin-bottom:1rem">Escalation Hierarchy</h5>
        <div class="step-item"><div class="step-num">1</div><div><strong>Self-service:</strong> Check this documentation suite first</div></div>
        <div class="step-item"><div class="step-num">2</div><div><strong>Team Lead / Senior Colleague:</strong> For process questions</div></div>
        <div class="step-item"><div class="step-num">3</div><div><strong>Line Manager:</strong> For approval and access issues</div></div>
        <div class="step-item"><div class="step-num">4</div><div><strong>CRM Admin:</strong> For data corrections and permission changes</div></div>
        <div class="step-item"><div class="step-num">5</div><div><strong>IT Helpdesk:</strong> For system errors — via CWC ITSM portal</div></div>
        <div class="alert-box alert-info" style="margin-top:1rem">
          <strong>Ticketing:</strong> Log all IT issues via the CWC 2.0 portal under <em>IT Support → General IT Request</em>. Include screenshots and error messages.
        </div>
      </div>
    </div>
  </div>
</div>

</div><!-- /#main -->
<script>
  mermaid.initialize({ startOnLoad: true, theme: 'base' });
  document.querySelectorAll('.nav-link-item[data-section]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.nav-link-item').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      const target = document.getElementById(el.dataset.section);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
</script>
</body>
</html>
```

- [ ] **Step 2: Verify the file renders**

Open `docs/crm-onboarding/01-quick-start.html` in a browser. Confirm:
- Sidebar shows all 7 nav items
- Suite navigation links at the bottom of sidebar are present
- All 7 sections render with correct content
- Tables, step items, alert boxes, badge-role chips display correctly
- No broken HTML (missing closing tags, unclosed divs)

- [ ] **Step 3: Commit**

```bash
git add docs/crm-onboarding/01-quick-start.html
git commit -m "docs(crm): add Quick Start Guide HTML — Part 1 of 6 onboarding suite"
```

---

## Task 2: `02-sop.html` — SOP Documentation

**Files:**
- Create: `docs/crm-onboarding/02-sop.html`

Contains 8 SOPs. Each SOP follows a consistent structure: SOP ID, Objective, Scope, Responsible Roles, Preconditions, Process Steps, Validation Rules, SLA, Escalation, Exception Handling, Audit Requirements, KPI Impact.

- [ ] **Step 1: Create `docs/crm-onboarding/02-sop.html`**

The file structure uses the shared shell. Sidebar nav items: SOP Overview, + one nav item per SOP. Use an accordioned layout — each SOP is a collapsible section card using Bootstrap accordion.

Key SOP content to include for each of the 8 SOPs:

**SOP-CRM-001: Lead Creation**
- ID: SOP-CRM-001 | Owner: Sales Representative | Frequency: Per event
- Objective: Ensure every prospect is captured accurately, deduplicated, and assigned within the same business day
- Preconditions: User has `crm:write` permission; prospect information obtained from approved source
- Steps: 1) Search for existing record first 2) Navigate to Leads → New Lead 3) Fill all required fields (Name, Source, Contact, Assigned To) 4) Review AI duplicate warning if shown 5) Save 6) Log initial contact activity within 24h
- Validation: Source must not be blank; either phone or email required; name must match legal format
- SLA: Lead must be created same day contact is made; first activity logged within 24 hours
- Escalation: Unactioned leads after 48h trigger manager alert
- Audit: Every lead creation is timestamped and attributed to creator; changes are logged
- KPI Impact: Lead Response Time, Lead Conversion Rate

**SOP-CRM-002: Lead Assignment**
- ID: SOP-CRM-002 | Owner: Sales Manager | Frequency: Daily
- Objective: Ensure all new leads are assigned to an active sales representative within 4 business hours
- Preconditions: Lead exists in Unassigned or New status; manager has `crm:admin` permission
- Steps: 1) Open Leads list, filter by Status = Unassigned 2) Review lead details and source 3) Select best-fit rep based on territory/capacity 4) Click Assign → select rep 5) System sends notification to rep 6) Manager confirms assignment in Team Dashboard
- Validation: Cannot assign to inactive or suspended users; reassignment requires reason note
- SLA: Assignment within 4 business hours of lead creation
- Escalation: Unassigned leads after 4h trigger manager notification; after 8h trigger senior manager
- KPI Impact: Lead Assignment Rate, Response Time SLA Compliance

**SOP-CRM-003: Opportunity Management**
- ID: SOP-CRM-003 | Owner: Sales Representative | Frequency: Per event
- Objective: Maintain accurate opportunity stage, value, and close date to ensure pipeline integrity
- Steps: 1) Open opportunity 2) Review current stage and last activity date 3) Update stage if customer interaction occurred 4) Update estimated value and close date 5) Log activity note with interaction summary 6) Schedule next follow-up 7) If stage = Closed Won → convert to account; if Closed Lost → fill lost reason
- Validation: Close date cannot be in past for active opportunities; Lost Reason mandatory for Closed Lost
- SLA: Opportunity must be updated within 48h of any customer interaction; stale >14 days triggers alert
- KPI Impact: Pipeline Accuracy, Win Rate, Average Deal Size

**SOP-CRM-004: Customer Follow-Up**
- ID: SOP-CRM-004 | Owner: Sales Representative | Frequency: Daily
- Objective: Ensure no customer touchpoint is missed and all follow-ups are actioned on schedule
- Steps: 1) Start day by reviewing Dashboard Task Panel and overdue activities 2) Action highest-priority follow-ups first (sort by due date) 3) For each: complete activity, log outcome note, schedule next action 4) If customer unreachable: log attempt, reschedule for next business day, escalate after 3 failed attempts
- SLA: Overdue activities must be actioned within same business day
- Escalation: 3 consecutive missed follow-ups on an opportunity trigger manager notification
- KPI Impact: Activity Completion Rate, Follow-Up Compliance

**SOP-CRM-005: Approval Workflow**
- ID: SOP-CRM-005 | Owner: Sales Representative / Manager | Frequency: Per event
- Objective: Ensure all discount, exception, and high-value deal approvals follow the defined authority matrix
- Steps: 1) Identify if approval required (see Business Rules — Approval Rules) 2) Open opportunity or account record 3) Click "Request Approval" 4) Select approval type 5) Attach supporting documents 6) Fill justification note 7) Submit 8) Track in Approvals tab — follow up if pending >24h 9) Approver: review, approve/reject with comments
- Validation: Cannot submit without justification note; all supporting docs must be attached
- SLA: Approvals responded to within 1 business day (standard); 4 hours (urgent)
- Escalation: No response after 24h → auto-escalate to senior approver
- KPI Impact: Approval Cycle Time, Pending Approval Backlog

**SOP-CRM-006: Customer Complaint**
- ID: SOP-CRM-006 | Owner: Customer Service | Frequency: Per event
- Objective: Ensure all customer complaints are acknowledged, logged, investigated, and resolved within SLA
- Steps: 1) Receive complaint (phone/email/in-person) 2) Open customer Contact record 3) Log activity: type = Complaint 4) Escalate to Customer Service Manager if severity = High 5) Investigate using account and activity history 6) Respond to customer within SLA 7) Log resolution note 8) Close complaint activity with resolution summary
- SLA: Acknowledgement within 2 hours; Resolution within 2 business days (standard), 4 hours (urgent)
- Escalation: Unresolved after 2 business days → Senior Manager + Compliance notification
- Audit: All complaints are retained for minimum 7 years per BNM guidelines
- KPI Impact: Complaint Resolution Rate, Customer Satisfaction Score

**SOP-CRM-007: CRM Data Quality**
- ID: SOP-CRM-007 | Owner: CRM Admin | Frequency: Weekly
- Objective: Maintain data accuracy, completeness, and consistency across all CRM records
- Steps: 1) Run Duplicate Detection report (Reports → Data Quality) 2) Review and merge confirmed duplicates 3) Audit leads with missing Source field — contact owner to update 4) Review stale opportunities (>30 days no update) — notify rep 5) Verify KYC document completeness for active accounts 6) Export data quality score report for management review
- SLA: Weekly data quality review; duplicate resolution within 3 business days of detection
- KPI Impact: Data Completeness %, Duplicate Rate, KYC Compliance Rate

**SOP-CRM-008: Reporting & Dashboard**
- ID: SOP-CRM-008 | Owner: Sales Manager / Management | Frequency: Weekly/Monthly
- Objective: Ensure accurate, timely reporting for management decision-making and regulatory compliance
- Steps: 1) Navigate to Reports module 2) Select report type (Pipeline / Lead Conversion / Sales Performance / KYC Compliance / Activity / Forecast / Lost Analysis) 3) Set date range and filters 4) Review data for anomalies before sharing 5) Export to CSV if required 6) Present findings in weekly/monthly review meeting 7) Archive report outputs per retention policy
- SLA: Weekly pipeline report every Monday 9am; Monthly performance report by 5th of each month
- KPI Impact: Reporting Accuracy, On-Time Reporting Rate

```html
<!-- Full HTML file content — follow the shared shell, using Bootstrap accordion for each SOP -->
<!-- Each SOP accordion item contains: ID badge, objective alert-info, a steps table, an SLA table, and KPI badges -->
<!-- Sidebar nav: SOP Overview + 8 SOP items -->
```

The full HTML must implement all 8 SOPs using Bootstrap accordion (`<div class="accordion" id="sopAccordion">`) with each SOP as an `accordion-item`. Each accordion body contains:
- Meta row: SOP ID | Owner | Frequency | Version badges
- Objective (alert-info box)
- Numbered process steps table
- SLA requirements table
- Escalation rules
- KPI impact badges

- [ ] **Step 2: Verify the file renders**

Open in browser. Confirm:
- 8 accordion items present, all expand/collapse correctly
- SOP IDs (SOP-CRM-001 through SOP-CRM-008) visible in headers
- Tables render inside accordion bodies
- Suite navigation links work (links to other HTML files in same folder)

- [ ] **Step 3: Commit**

```bash
git add docs/crm-onboarding/02-sop.html
git commit -m "docs(crm): add SOP Documentation HTML — Part 2 of 6 onboarding suite"
```

---

## Task 3: `03-workflows.html` — Workflow Documentation

**Files:**
- Create: `docs/crm-onboarding/03-workflows.html`

Contains 5 workflows with Mermaid.js diagrams, swimlane explanations, SLA timelines, and operational risk tables.

- [ ] **Step 1: Create `docs/crm-onboarding/03-workflows.html`**

Use the shared shell. For each workflow, include:
1. A `<div class="mermaid-wrap">` containing a Mermaid `flowchart TD` or `sequenceDiagram`
2. A swimlane explanation table (Role | Step | Decision Point | SLA)
3. Escalation logic description
4. Workflow KPIs

**Workflow 1 — Lead Management Workflow**

Mermaid diagram:
```
flowchart TD
    A([Lead Captured]) --> B{Duplicate Check}
    B -->|Duplicate Found| C[Merge / Discard]
    B -->|New Lead| D[Assign to Rep]
    D --> E{Contacted within 24h?}
    E -->|No| F[Escalate to Manager]
    E -->|Yes| G[Log First Activity]
    G --> H{Qualified?}
    H -->|No| I[Mark Disqualified]
    H -->|Yes| J[Convert to Opportunity]
    J --> K([Pipeline Stage: Prospecting])
```

Swimlane roles: Sales Rep, Sales Manager, CRM System
SLA: 24h first contact, 4h assignment
Escalation: Auto-alert after 48h no activity
KPI: Lead Response Time, Conversion Rate

**Workflow 2 — Opportunity Workflow**

Mermaid diagram:
```
flowchart TD
    A([Opportunity Created]) --> B[Stage: Prospecting]
    B --> C{Meeting Held?}
    C -->|Yes| D[Stage: Qualification]
    D --> E{Proposal Requested?}
    E -->|Yes| F[Stage: Proposal]
    F --> G{Approval Required?}
    G -->|Yes| H[Submit Approval Request]
    H --> I{Approved?}
    I -->|Yes| J[Stage: Negotiation]
    I -->|No| K[Revise Proposal]
    G -->|No| J
    J --> L{Deal Agreed?}
    L -->|Won| M[Stage: Closed Won]
    L -->|Lost| N[Stage: Closed Lost]
    M --> O[Convert to Account + Trust Product]
    N --> P[Log Lost Reason]
```

**Workflow 3 — Customer Escalation Workflow**

Mermaid diagram:
```
flowchart TD
    A([Complaint Received]) --> B[Log Activity: Complaint]
    B --> C{Severity?}
    C -->|High| D[Escalate to CS Manager immediately]
    C -->|Standard| E[Assign to CS Rep]
    E --> F{Resolved within 2 days?}
    F -->|Yes| G[Log Resolution + Close]
    F -->|No| H[Escalate to Senior Manager]
    H --> I{Resolved within 4h?}
    I -->|Yes| G
    I -->|No| J[Escalate to Compliance + CEO]
    D --> F
```

**Workflow 4 — Approval Workflow**

Mermaid diagram:
```
sequenceDiagram
    participant Rep as Sales Rep
    participant Sys as CRM System
    participant Mgr as Sales Manager
    participant SMgr as Senior Manager
    Rep->>Sys: Submit Approval Request
    Sys->>Mgr: Notification: Pending Approval
    alt Responded within 24h
        Mgr->>Sys: Approve / Reject + Comments
        Sys->>Rep: Notification: Decision
    else No response after 24h
        Sys->>SMgr: Auto-escalate
        SMgr->>Sys: Approve / Reject
        Sys->>Rep: Notification: Decision
    end
```

**Workflow 5 — Reporting Workflow**

Mermaid diagram:
```
flowchart TD
    A([Report Trigger: Schedule / Manual]) --> B[Select Report Type]
    B --> C[Apply Date Range + Filters]
    C --> D[System Generates Report]
    D --> E{Data Anomaly?}
    E -->|Yes| F[Investigate + Correct Source Data]
    F --> D
    E -->|No| G[Review Report]
    G --> H{Export Required?}
    H -->|Yes| I[Export CSV]
    H -->|No| J[Present in Dashboard]
    I --> K[Archive per Retention Policy]
```

- [ ] **Step 2: Verify Mermaid diagrams render**

Open in browser. Confirm all 5 Mermaid diagrams render (no "Syntax error" displayed). Check swimlane tables and KPI sections for each workflow.

- [ ] **Step 3: Commit**

```bash
git add docs/crm-onboarding/03-workflows.html
git commit -m "docs(crm): add Workflow Documentation HTML with Mermaid diagrams — Part 3 of 6"
```

---

## Task 4: `04-business-rules.html` — CRM Business Rules Guide

**Files:**
- Create: `docs/crm-onboarding/04-business-rules.html`

Contains 11 business rule categories. Each rule set includes: rule description, business rationale, risk if violated, owner, enforcement mechanism, good/bad examples.

- [ ] **Step 1: Create `docs/crm-onboarding/04-business-rules.html`**

Use the shared shell. Sidebar nav: one item per rule category. Layout: each category is a `section-card` with a rules table.

**Rule categories and key content:**

**1. Customer Naming Rules**
- Rule: Account names must use full registered legal name. Contact names must use full name as per IC/Passport.
- Good: "Citadel Group Technologies Sdn Bhd" | Bad: "Citadel" or "CGT"
- Good: "Ahmad bin Abdullah" | Bad: "Ahmad" or "Mr Ahmad"
- Risk: Duplicate records, failed KYC verification, regulatory non-compliance
- Enforcement: System validates name length minimum 5 characters; KYC module requires full name match

**2. Lead Classification Rules**
- Hot: Responded within 48h + expressed clear interest + has budget + decision-maker contact made
- Warm: Responded but timeline or budget unclear
- Cold: No response after 3 attempts OR expressed no current need
- Rule: AI score overrides manual classification if difference >20 points — requires manager sign-off to override
- Risk: Misallocation of rep time; inflated pipeline

**3. Opportunity Stage Rules**
- Cannot skip stages (e.g., Prospecting → Negotiation not allowed without Qualification and Proposal)
- Stage change must be accompanied by an activity log entry
- Close date must be set at Qualification stage or later
- Closed Lost: Lost Reason field mandatory
- Closed Won: Account/Contact creation mandatory within 2 business days

**4. Mandatory Data Rules** (table format)
- Lead: Name, Source, Phone or Email, Assigned To
- Opportunity: Account, Stage, Estimated Value, Projected Close Date, Assigned To
- Account: Legal Name, Account Type, Industry, Primary Contact
- Contact: Full Name, Account Link, Phone or Email, KYC Status

**5. SLA Rules**
- Lead response: 24 hours from creation
- Lead assignment: 4 business hours
- Opportunity update: 48 hours post-customer interaction
- Activity logging: 24 hours post-occurrence
- Complaint acknowledgement: 2 hours
- Complaint resolution: 2 business days (standard), 4 hours (urgent)
- Approval response: 1 business day

**6. Escalation Rules**
- Unassigned lead > 4h → manager alert
- No lead activity > 48h → manager alert
- Opportunity stale > 14 days → manager + rep alert
- Complaint unresolved > 2 days → senior manager + compliance
- Approval pending > 24h → auto-escalate to senior approver

**7. Approval Rules**
- Discounts > 5% require Sales Manager approval
- Discounts > 15% require Senior Manager + Finance approval
- New account onboarding with credit facility requires compliance review
- Any deal > MYR 500,000 requires Director approval
- Approval cannot be self-approved

**8. Access Control Rules**
- Sales Rep: Own records only (crm:read + crm:write on own assignments)
- Sales Manager: All team records (crm:admin within own team)
- Admin: Full CRM access including delete and bulk operations
- Management: Read-only access to all records + reports
- Team tab visibility: Manager and Admin only

**9. Data Quality Rules**
- No placeholder values ("TBC", "N/A", "Test") in mandatory fields
- IC number format: 12 digits, no dashes or spaces
- Phone format: Malaysia (+60) or international format
- Duplicate detection: System flags when name similarity > 85% OR IC number exact match
- Weekly data quality audit: Admin responsibility

**10. Duplicate Prevention Rules**
- Always search before creating a new record
- System checks: exact IC match, exact phone match, name similarity >85%
- On duplicate warning: Review both records before deciding to merge or discard
- Merging: Only CRM Admin can execute a merge; audit trail preserved
- Penalty: 3+ duplicate records created by same user in a week → flagged in quality report

**11. Reporting Rules**
- Reports must not be shared externally without approval
- CSV exports are logged with timestamp and user
- Dashboard data has 1-hour cache — for real-time data, use filtered list views
- Monthly reports must be archived per Citadel data retention policy (7 years minimum)
- KPI targets are reviewed quarterly by Sales Manager + Management

- [ ] **Step 2: Verify rendering**

Open in browser. Confirm all 11 rule categories render with tables. Good/bad example rows use green/red text coding. Risk level badges (High/Medium/Low) display correctly.

- [ ] **Step 3: Commit**

```bash
git add docs/crm-onboarding/04-business-rules.html
git commit -m "docs(crm): add Business Rules Guide HTML — Part 4 of 6 onboarding suite"
```

---

## Task 5: `05-role-guides.html` — Role-Based User Guide

**Files:**
- Create: `docs/crm-onboarding/05-role-guides.html`

Contains 6 role cards with tabbed interface. Each role: responsibilities, accessible modules, daily workflow, approval authority, KPIs owned, restrictions.

- [ ] **Step 1: Create `docs/crm-onboarding/05-role-guides.html`**

Use the shared shell. Use Bootstrap tabs (`nav-tabs`) to switch between roles. Each tab pane contains a role summary card, a daily workflow checklist, and a permissions/restrictions table.

**Role content:**

**Role 1: Sales Representative**
- Modules: Dashboard, Accounts, Contacts, Leads, Pipeline, Reports, Guide
- Daily workflow: 1) Review Dashboard AI briefing 2) Action overdue tasks and activities 3) Follow up with hot leads 4) Update opportunity stages post-interactions 5) Log all activities before end of day 6) Schedule tomorrow's follow-ups
- Approval authority: None (submits requests only)
- KPIs: Lead Response Time, Activity Completion Rate, Pipeline Value (personal), Win Rate (personal)
- Restrictions: Cannot view Team tab; cannot delete records; cannot see other reps' records; cannot export reports

**Role 2: Sales Manager**
- Modules: All including Team Dashboard
- Daily workflow: 1) Review Team Dashboard — rep performance, stale leads, unassigned items 2) Assign/reassign leads 3) Review pending approvals 4) Coach underperforming reps 5) Review weekly pipeline report 6) Escalate unresolved complaints
- Approval authority: Discounts up to 15%; lead reassignment; access exceptions
- KPIs: Team Conversion Rate, Team Pipeline Value, SLA Compliance Rate, Rep Activity Rate
- Restrictions: Cannot delete accounts without Admin approval; cannot modify system settings

**Role 3: Customer Service**
- Modules: Dashboard, Accounts, Contacts, Activities (complaint logging)
- Daily workflow: 1) Check open complaint activities 2) Prioritise High severity 3) Investigate using account history 4) Contact customer within SLA 5) Log resolution note 6) Escalate if unresolved within 2 days
- Approval authority: None
- KPIs: Complaint Resolution Rate, Average Resolution Time, Customer Satisfaction
- Restrictions: Cannot create or modify Leads/Opportunities; read-only on Pipeline; no Reports access

**Role 4: Operations Team**
- Modules: Accounts, Contacts, Reports (read)
- Daily workflow: 1) Review trust product status on active accounts 2) Follow up on document checklist gaps 3) Update beneficiary records as notified 4) Support sales reps on operational tasks
- Approval authority: None
- KPIs: Document Completeness Rate, Trust Product Onboarding Time
- Restrictions: Cannot modify Leads or Opportunities; no Pipeline edit access; read-only Reports

**Role 5: Admin User**
- Modules: All modules + Admin Console
- Daily workflow: 1) Review data quality alerts 2) Process duplicate merge requests 3) Manage user permissions 4) Monitor system notifications 5) Archive exported reports
- Approval authority: Data corrections, user access changes, bulk operations
- KPIs: Data Quality Score, System Uptime (monitored), Permission Compliance
- Restrictions: Cannot approve financial deals (conflict of interest); all admin actions are audit-logged

**Role 6: Management User**
- Modules: Dashboard, Reports, Team (read-only)
- Daily workflow: 1) Review executive dashboard KPIs 2) Review weekly pipeline forecast 3) Review monthly performance report 4) Attend weekly management review meeting
- Approval authority: Deals > MYR 500,000; strategic exceptions
- KPIs: Total Pipeline Value, Revenue Forecast Accuracy, Team Win Rate, Customer Retention Rate
- Restrictions: Read-only access to all records; cannot create/edit CRM records; cannot modify system settings

- [ ] **Step 2: Verify rendering**

Open in browser. Confirm Bootstrap tabs switch between all 6 roles. Each tab pane shows full role content. Role badge colours are distinct.

- [ ] **Step 3: Commit**

```bash
git add docs/crm-onboarding/05-role-guides.html
git commit -m "docs(crm): add Role-Based User Guide HTML — Part 5 of 6 onboarding suite"
```

---

## Task 6: `06-reporting-kpi.html` — Reporting & KPI Guide

**Files:**
- Create: `docs/crm-onboarding/06-reporting-kpi.html`

Contains dashboard overview, 8 KPI categories, pipeline/performance/SLA/retention reporting, with Chart.js visualisation examples and a full KPI definitions table.

- [ ] **Step 1: Create `docs/crm-onboarding/06-reporting-kpi.html`**

Include Chart.js. Use the shared shell. Add one Chart.js bar chart (pipeline by stage) and one doughnut chart (lead source breakdown) as visual examples. Include a comprehensive KPI table with all metrics.

**KPI Table — all metrics:**

| KPI Name | Formula | Target | Frequency | Owner | Report Source |
|----------|---------|--------|-----------|-------|---------------|
| Lead Response Time | Avg hours from lead creation to first activity | < 24h | Daily | Sales Manager | Lead Activity Report |
| Lead Conversion Rate | (Qualified Leads / Total Leads) × 100 | > 30% | Weekly | Sales Manager | Lead Conversion Report |
| Lead Assignment Rate | (Assigned Leads / Total Leads) × 100 | 100% | Daily | Sales Manager | Lead Report |
| Opportunity Win Rate | (Closed Won / Total Closed) × 100 | > 40% | Monthly | Sales Manager | Pipeline Report |
| Average Deal Size | Total Won Value / Number Won Deals | MYR 250k+ | Monthly | Management | Sales Performance Report |
| Pipeline Coverage | Total Pipeline Value / Monthly Revenue Target | > 3× | Weekly | Management | Forecast Report |
| Activity Completion Rate | (Completed Activities / Scheduled Activities) × 100 | > 85% | Weekly | Sales Manager | Activity Report |
| Average Sales Cycle | Avg days from Prospecting to Closed Won | < 90 days | Monthly | Management | Pipeline Report |
| Complaint Resolution Rate | (Resolved Complaints / Total Complaints) × 100 | > 95% | Weekly | CS Manager | Activity Report |
| Avg Complaint Resolution Time | Avg hours from complaint log to resolution | < 48h | Weekly | CS Manager | Activity Report |
| SLA Compliance Rate | (On-time Activities / Total Due Activities) × 100 | > 90% | Weekly | Sales Manager | Activity Report |
| Approval Cycle Time | Avg hours from submission to decision | < 24h | Weekly | Sales Manager | Approval Report |
| Data Completeness Rate | (Records with all mandatory fields / Total Records) × 100 | > 95% | Weekly | CRM Admin | Data Quality Report |
| Duplicate Rate | Duplicate Records / Total Records × 100 | < 2% | Weekly | CRM Admin | Data Quality Report |
| KYC Compliance Rate | Accounts with complete KYC docs / Active Accounts × 100 | 100% | Monthly | Compliance | KYC Report |
| Customer Retention Rate | (Customers at end of period - New) / Customers at start × 100 | > 85% | Quarterly | Management | Customer Report |

**Report Types section:**
- Pipeline Report: Current stage distribution, total value, forecast by close date
- Lead Conversion Report: Source breakdown, conversion funnel, time-to-qualify
- Sales Performance Report: Rep-by-rep comparison, win/loss rates, deal sizes
- Activity Report: Activity volume by type, completion rates, overdue activities
- KYC Compliance Report: Document completeness by account, expiry alerts
- Forecast Report: Weighted pipeline forecast (stage × probability), 90-day projection
- Lost Analysis Report: Lost reasons, competitor analysis, stage lost patterns

**Chart.js implementation:**
```javascript
// Pipeline by Stage bar chart
const pipelineCtx = document.getElementById('pipelineChart').getContext('2d');
new Chart(pipelineCtx, {
  type: 'bar',
  data: {
    labels: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'],
    datasets: [{
      label: 'Pipeline Value (MYR 000s)',
      data: [850, 620, 340, 180],
      backgroundColor: ['#3b82f6','#0ea5e9','#06b6d4','#059669'],
      borderRadius: 6
    }]
  },
  options: { responsive: true, plugins: { legend: { display: false }}, scales: { y: { beginAtZero: true }}}
});

// Lead Source doughnut
const sourceCtx = document.getElementById('sourceChart').getContext('2d');
new Chart(sourceCtx, {
  type: 'doughnut',
  data: {
    labels: ['Referral', 'Cold Call', 'Website', 'Event', 'Walk-in'],
    datasets: [{
      data: [35, 25, 20, 12, 8],
      backgroundColor: ['#1e3a5f','#2563eb','#0ea5e9','#059669','#d97706'],
    }]
  },
  options: { responsive: true, cutout: '65%' }
});
```

Canvas elements must be wrapped in `position:relative` containers:
```html
<div style="position:relative;height:280px"><canvas id="pipelineChart"></canvas></div>
<div style="position:relative;height:280px"><canvas id="sourceChart"></canvas></div>
```

- [ ] **Step 2: Verify rendering**

Open in browser. Confirm:
- Both Chart.js charts render (bar and doughnut visible)
- Full KPI table renders with all 16 rows
- All 7 report type cards render
- Reporting hierarchy section shows management escalation structure

- [ ] **Step 3: Commit**

```bash
git add docs/crm-onboarding/06-reporting-kpi.html
git commit -m "docs(crm): add Reporting & KPI Guide HTML — Part 6 of 6 onboarding suite"
```

---

## Task 7: Final validation pass

- [ ] **Step 1: Verify all 6 files exist**

```bash
ls -la docs/crm-onboarding/
```
Expected: 6 files — `01-quick-start.html` through `06-reporting-kpi.html`

- [ ] **Step 2: Verify cross-file navigation links**

Open each file. Click each suite navigation link in the sidebar footer. Confirm all 6 links resolve to existing files (no 404s when opened from the same directory).

- [ ] **Step 3: Final commit**

```bash
git add docs/crm-onboarding/
git commit -m "docs(crm): complete CRM Onboarding & Operational Documentation Suite — 6 HTML files"
```

---

## Spec Coverage Check

| Master Prompt Section | Covered In |
|----------------------|-----------|
| Quick Start — System Introduction | Task 1 (s-intro) |
| Quick Start — Login Guide | Task 1 (s-login) |
| Quick Start — Dashboard Overview | Task 1 (s-dashboard) |
| Quick Start — Navigation Guide | Task 1 (s-nav) |
| Quick Start — Daily Core Activities (all 9) | Task 1 (s-activities) |
| Quick Start — Best Practices | Task 1 (s-best) |
| Quick Start — Support & Escalation | Task 1 (s-support) |
| SOP — All 8 SOPs with full structure | Task 2 |
| Workflow — 5 workflows with Mermaid diagrams | Task 3 |
| Business Rules — 11 rule categories | Task 4 |
| Role Guides — 6 roles | Task 5 |
| Reporting — Dashboard, KPIs, 7 report types | Task 6 |
| HTML portal structure + suite navigation | All tasks (shared shell) |
| Mermaid.js workflow diagrams | Task 3 |
| Chart.js KPI visualisations | Task 6 |
| Consistent design matching existing CRM-Module-Documentation.html | All tasks |

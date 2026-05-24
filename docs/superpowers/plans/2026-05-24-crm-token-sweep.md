# CRM Design Token Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded hex colors in the CRM module with CWC design tokens, aligning the CRM to the Citadel navy brand identity.

**Architecture:** Pure token-only color sweep — no layout changes, no logic changes. Each file gets its hardcoded hex values replaced with CSS custom property vars or Tailwind token classes already mapped in `frontend/index.css` and `frontend/src/styles/tokens.css`. The indigo/purple palette used throughout CRM is replaced with the Citadel brand navy palette.

**Tech Stack:** React + TypeScript + Tailwind v4 with CWC CSS custom properties (`--color-brand-*`, `--color-it-*`, `--color-hr-*`, `--color-fin-*`, `--color-success`, `--color-warning`, `--color-danger`, `--color-text-*`, `--color-surface-*`)

---

## Token Mapping Reference

Use this table for every task below. All replacements are mechanical substitutions.

| Old hardcoded value | Replace with | Notes |
|---|---|---|
| `from-[#1e1b4b] via-[#312e81] to-[#4338ca]` | `from-brand-900 via-brand-700 to-brand-600` | Hero gradient |
| `text-indigo-700` | `text-brand-700` | Active/button text |
| `text-indigo-600` | `text-brand-600` | Link/icon accent |
| `bg-indigo-50` | `bg-brand-50` | Icon bg |
| `bg-indigo-100` | `bg-brand-100` | Avatar bg |
| `color: '#6366f1'` | `color: 'var(--color-brand-500)'` | Inline icon color |
| `border-violet-200` / `border-violet-300` | `border-brand-100` / `border-brand-300` | AI card border |
| `from-violet-50 to-indigo-50` | `from-brand-50 to-brand-50/60` | AI card bg |
| `text-violet-500` | `text-brand-500` | AI card icon |
| `text-violet-600` | `text-brand-700` | AI card label |
| `#0052cc` in CrmNav | `brand-700` Tailwind class | Nav active color |
| `#1d4ed8` | `var(--color-it-500)` | Info/IT blue |
| `#92400e`, `#b45309` | `var(--color-warning)` | Warning amber text |
| `#065f46`, `#166534`, `#15803d` | `var(--color-success)` | Success green text |
| `#dc2626`, `#be123c`, `#991b1b` | `var(--color-danger)` | Danger red text |
| `#eff6ff` | `var(--color-it-50)` | IT/info bg (token = `#eff6ff`) |
| `#fef3c7`, `#fffbeb` | `var(--color-fin-50)` | Finance/warning bg |
| `#ecfdf5`, `#f0fdf4` | `var(--color-hr-50)` | HR/success bg |
| `#fef2f2`, `#fff1f2` | `rgba(220,38,38,0.06)` | Danger bg (no token exists) |
| `#f3f4f6` | `var(--color-surface-muted)` | Muted/lost bg |
| `#6b7280` text | `var(--color-text-secondary)` | Muted text |
| `#9ca3af` text | `var(--color-text-tertiary)` | Tertiary text |
| `#111827` text | `var(--color-text-primary)` | Primary text |

Emoji → Material Symbols (only in CrmDashboard priority cards):
| Emoji | Material Symbol |
|---|---|
| `📋` | `assignment` |
| `⚠️` | `warning` |
| `🔔` | `notifications` |

---

## Task 1: CrmNav — Active Tab Color

**Files:**
- Modify: `frontend/src/components/CrmNav.tsx`

- [ ] **Step 1: Replace hardcoded `#0052cc` with brand token classes**

In `CrmNav.tsx`, find the Link className string (around line 50):

```tsx
className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
  isActive(item.to)
    ? 'text-[#0052cc] border-[#0052cc]'
    : 'text-text-secondary border-transparent hover:text-[#0052cc] hover:border-[#0052cc]/30'
}`}
```

Replace with:

```tsx
className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
  isActive(item.to)
    ? 'text-brand-700 border-brand-700'
    : 'text-text-secondary border-transparent hover:text-brand-700 hover:border-brand-700/30'
}`}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/CrmNav.tsx
git commit -m "style(crm): sync CrmNav active color to brand-700 token"
```

---

## Task 2: CrmDashboard — Hero, Cards, AI Briefing, Activity Row

**Files:**
- Modify: `frontend/pages/CrmDashboard.tsx`

- [ ] **Step 1: Fix hero gradient (line 135)**

Find:
```tsx
<section className="bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#4338ca] rounded-xl py-10 px-4 sm:px-8 relative overflow-hidden mb-6">
```

Replace with:
```tsx
<section className="bg-gradient-to-br from-brand-900 via-brand-700 to-brand-600 rounded-xl py-10 px-4 sm:px-8 relative overflow-hidden mb-6">
```

- [ ] **Step 2: Fix All Deals / My Deals toggle buttons (lines 147–148)**

Find:
```tsx
<button onClick={() => setMyDeals(false)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!myDeals ? 'bg-white text-indigo-700' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>All Deals</button>
<button onClick={() => setMyDeals(true)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${myDeals ? 'bg-white text-indigo-700' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>My Deals</button>
```

Replace with:
```tsx
<button onClick={() => setMyDeals(false)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!myDeals ? 'bg-white text-brand-700' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>All Deals</button>
<button onClick={() => setMyDeals(true)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${myDeals ? 'bg-white text-brand-700' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>My Deals</button>
```

- [ ] **Step 3: Fix search dropdown — Accounts icon color (line 181)**

Find:
```tsx
<span className="material-symbols-outlined" style={{ fontSize: 16, color: '#6366f1' }}>business</span>
```

Replace with:
```tsx
<span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--color-brand-500)' }}>business</span>
```

- [ ] **Step 4: Fix Today's Priorities cards — emoji icons and hardcoded colors (lines 265–268)**

Find:
```tsx
{ label: 'Follow-ups Due Today', value: stats.followUpDueToday ?? 0, icon: '📋', bg: '#fffbeb', color: '#b45309', link: '/crm/leads?filter=followup' },
{ label: 'Stale Leads', value: stats.staleLeads ?? 0, icon: '⚠️', bg: '#fff1f2', color: '#be123c', link: '/crm/leads?filter=stale' },
{ label: 'Overdue Deals', value: stats.overdueDeals ?? 0, icon: '🔔', bg: '#fef2f2', color: '#dc2626', link: '/crm/opportunities?filter=overdue' },
```

Replace with:
```tsx
{ label: 'Follow-ups Due Today', value: stats.followUpDueToday ?? 0, icon: 'assignment', bg: 'var(--color-fin-50)', color: 'var(--color-warning)', link: '/crm/leads?filter=followup' },
{ label: 'Stale Leads', value: stats.staleLeads ?? 0, icon: 'warning', bg: 'rgba(220,38,38,0.06)', color: 'var(--color-danger)', link: '/crm/leads?filter=stale' },
{ label: 'Overdue Deals', value: stats.overdueDeals ?? 0, icon: 'notifications', bg: 'rgba(220,38,38,0.06)', color: 'var(--color-danger)', link: '/crm/opportunities?filter=overdue' },
```

Then update the priority card render to use Material Symbols instead of emoji text. Find the priority card icon div (around line 276):
```tsx
<div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xl" style={{ background: p.bg }}>
  {p.icon}
</div>
```

Replace with:
```tsx
<div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: p.bg }}>
  <span className="material-symbols-outlined text-[20px]" style={{ color: p.color }}>{p.icon}</span>
</div>
```

- [ ] **Step 5: Fix Stats Cards colors (lines 342–345)**

Find:
```tsx
{ label: 'Accounts', value: stats.totalAccounts, icon: 'business', bg: '#eff6ff', color: '#1d4ed8' },
{ label: 'Open Leads', value: stats.totalLeads, icon: 'lightbulb', bg: '#fef3c7', color: '#92400e' },
{ label: 'Pipeline Value', value: formatCurrency(Number(stats.pipelineValue)), icon: 'payments', bg: '#ecfdf5', color: '#065f46' },
{ label: 'Win Rate', value: `${stats.winRate}%`, icon: 'trending_up', bg: '#f0fdf4', color: '#166534' },
```

Replace with:
```tsx
{ label: 'Accounts', value: stats.totalAccounts, icon: 'business', bg: 'var(--color-it-50)', color: 'var(--color-it-500)' },
{ label: 'Open Leads', value: stats.totalLeads, icon: 'lightbulb', bg: 'var(--color-fin-50)', color: 'var(--color-warning)' },
{ label: 'Pipeline Value', value: formatCurrency(Number(stats.pipelineValue)), icon: 'payments', bg: 'var(--color-hr-50)', color: 'var(--color-success)' },
{ label: 'Win Rate', value: `${stats.winRate}%`, icon: 'trending_up', bg: 'var(--color-hr-50)', color: 'var(--color-success)' },
```

- [ ] **Step 6: Fix My Performance stats (lines 387–392)**

Find:
```tsx
{ label: 'My Leads', value: myStats.leads, icon: 'lightbulb', bg: '#fef3c7', color: '#92400e' },
{ label: 'My Open Deals', value: myStats.opportunities, icon: 'monetization_on', bg: '#eff6ff', color: '#1d4ed8' },
{ label: 'My Pipeline', value: formatCurrency(myStats.pipelineValue), icon: 'payments', bg: '#ecfdf5', color: '#065f46' },
{ label: 'Won This Month', value: myStats.wonThisMonth, icon: 'emoji_events', bg: '#f0fdf4', color: '#166534' },
{ label: 'Stale Leads', value: myStats.staleLeads, icon: 'warning', bg: '#fff1f2', color: '#be123c' },
```

Replace with:
```tsx
{ label: 'My Leads', value: myStats.leads, icon: 'lightbulb', bg: 'var(--color-fin-50)', color: 'var(--color-warning)' },
{ label: 'My Open Deals', value: myStats.opportunities, icon: 'monetization_on', bg: 'var(--color-it-50)', color: 'var(--color-it-500)' },
{ label: 'My Pipeline', value: formatCurrency(myStats.pipelineValue), icon: 'payments', bg: 'var(--color-hr-50)', color: 'var(--color-success)' },
{ label: 'Won This Month', value: myStats.wonThisMonth, icon: 'emoji_events', bg: 'var(--color-hr-50)', color: 'var(--color-success)' },
{ label: 'Stale Leads', value: myStats.staleLeads, icon: 'warning', bg: 'rgba(220,38,38,0.06)', color: 'var(--color-danger)' },
```

- [ ] **Step 7: Fix AI Briefing card colors (lines 296–327)**

Find:
```tsx
className="border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50"
```
Replace with:
```tsx
className="border-brand-100 bg-gradient-to-br from-brand-50 to-brand-50/60"
```

Find:
```tsx
<span className="material-symbols-outlined text-sm text-violet-500 mt-0.5">chevron_right</span>
```
Replace with:
```tsx
<span className="material-symbols-outlined text-sm text-brand-500 mt-0.5">chevron_right</span>
```

Find:
```tsx
<div className="rounded-lg border border-violet-300 bg-white px-3 py-2">
  <p className="text-xs font-bold text-violet-600 uppercase tracking-wide mb-0.5">Top Priority Today</p>
```
Replace with:
```tsx
<div className="rounded-lg border border-brand-300 bg-white px-3 py-2">
  <p className="text-xs font-bold text-brand-700 uppercase tracking-wide mb-0.5">Top Priority Today</p>
```

- [ ] **Step 8: Fix Recent Activity row icon (lines 441–442)**

Find:
```tsx
<div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
  <span className="material-symbols-outlined text-indigo-600 text-lg">{ACTIVITY_ICONS[act.activityType] || 'note'}</span>
```
Replace with:
```tsx
<div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
  <span className="material-symbols-outlined text-brand-600 text-lg">{ACTIVITY_ICONS[act.activityType] || 'note'}</span>
```

- [ ] **Step 9: Commit**

```bash
git add frontend/pages/CrmDashboard.tsx
git commit -m "style(crm): sync CrmDashboard colors to design tokens"
```

---

## Task 3: CrmLeads — Status Styles, Urgency Badges, Score Colors

**Files:**
- Modify: `frontend/pages/CrmLeads.tsx`

- [ ] **Step 1: Replace STATUS_STYLES (lines 7–13)**

Find:
```tsx
const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  NEW: { bg: '#eff6ff', text: '#1d4ed8', icon: 'fiber_new' },
  CONTACTED: { bg: '#fef3c7', text: '#92400e', icon: 'call' },
  QUALIFIED: { bg: '#ecfdf5', text: '#065f46', icon: 'verified' },
  UNQUALIFIED: { bg: '#fef2f2', text: '#991b1b', icon: 'block' },
  CONVERTED: { bg: '#f0fdf4', text: '#166534', icon: 'swap_horiz' },
  LOST: { bg: '#f3f4f6', text: '#6b7280', icon: 'cancel' },
};
```

Replace with:
```tsx
const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  NEW: { bg: 'var(--color-it-50)', text: 'var(--color-it-500)', icon: 'fiber_new' },
  CONTACTED: { bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'call' },
  QUALIFIED: { bg: 'var(--color-hr-50)', text: 'var(--color-success)', icon: 'verified' },
  UNQUALIFIED: { bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'block' },
  CONVERTED: { bg: 'var(--color-hr-50)', text: 'var(--color-success)', icon: 'swap_horiz' },
  LOST: { bg: 'var(--color-surface-muted)', text: 'var(--color-text-secondary)', icon: 'cancel' },
};
```

- [ ] **Step 2: Replace ACTIVITY_ICONS note color (line 20)**

Find:
```tsx
NOTE: { icon: 'note', color: '#6b7280' },
```
Replace with:
```tsx
NOTE: { icon: 'note', color: 'var(--color-text-secondary)' },
```

Find:
```tsx
SITE_VISIT: { icon: 'location_on', color: '#dc2626' },
```
Replace with:
```tsx
SITE_VISIT: { icon: 'location_on', color: 'var(--color-danger)' },
```

- [ ] **Step 3: Replace urgency badge colors (lines 47–53)**

Find:
```tsx
if (isOverdue(lead.followUpDate) && !isToday(lead.followUpDate))
  return { label: 'Overdue', bg: '#fef2f2', text: '#dc2626', icon: 'error' };
if (isToday(lead.followUpDate))
  return { label: 'Due Today', bg: '#fffbeb', text: '#b45309', icon: 'schedule' };
```
Find:
```tsx
return { label: 'Stale', bg: '#f3f4f6', text: '#6b7280', icon: 'hourglass_empty' };
```

Replace all three:
```tsx
if (isOverdue(lead.followUpDate) && !isToday(lead.followUpDate))
  return { label: 'Overdue', bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'error' };
if (isToday(lead.followUpDate))
  return { label: 'Due Today', bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'schedule' };
```
```tsx
return { label: 'Stale', bg: 'var(--color-surface-muted)', text: 'var(--color-text-secondary)', icon: 'hourglass_empty' };
```

- [ ] **Step 4: Replace scoreStyle colors (lines 60–63)**

Find:
```tsx
const scoreStyle = (score: number) =>
  score >= 70
    ? { bg: '#f0fdf4', text: '#15803d' }
    : score >= 40
    ? { bg: '#fffbeb', text: '#b45309' }
    : { bg: '#fef2f2', text: '#dc2626' };
```

Replace with:
```tsx
const scoreStyle = (score: number) =>
  score >= 70
    ? { bg: 'var(--color-hr-50)', text: 'var(--color-success)' }
    : score >= 40
    ? { bg: 'var(--color-fin-50)', text: 'var(--color-warning)' }
    : { bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)' };
```

- [ ] **Step 5: Replace remaining inline colors in the render (lines 197–308)**

Find (filter banner, line 197):
```tsx
background: filterParam === 'stale' ? '#f3f4f6' : '#fef3c7',
color: filterParam === 'stale' ? '#6b7280' : '#92400e',
```
Replace with:
```tsx
background: filterParam === 'stale' ? 'var(--color-surface-muted)' : 'var(--color-fin-50)',
color: filterParam === 'stale' ? 'var(--color-text-secondary)' : 'var(--color-warning)',
```

Find (clear button, line 203):
```tsx
<button onClick={clearFilterParam} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280' }}
```
Replace with:
```tsx
<button onClick={clearFilterParam} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
```

Find (follow-up date color, line 287):
```tsx
style={{ color: followUpOverdue ? '#dc2626' : '#6b7280' }}
```
Replace with:
```tsx
style={{ color: followUpOverdue ? 'var(--color-danger)' : 'var(--color-text-secondary)' }}
```

Find (estimated value text, line 301):
```tsx
<span className="text-sm font-bold text-indigo-600">{formatCurrency(lead.estimatedValue)}</span>
```
Replace with:
```tsx
<span className="text-sm font-bold text-brand-600">{formatCurrency(lead.estimatedValue)}</span>
```

Find (owner avatar, lines 307–308):
```tsx
<div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center">
  <span className="text-[10px] font-bold text-indigo-600">{lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}</span>
```
Replace with:
```tsx
<div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
  <span className="text-[10px] font-bold text-brand-600">{lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}</span>
```

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/CrmLeads.tsx
git commit -m "style(crm): sync CrmLeads colors to design tokens"
```

---

## Task 4: CrmLeadDetail

**Files:**
- Modify: `frontend/pages/CrmLeadDetail.tsx`

- [ ] **Step 1: Scan and replace all offending colors**

Run to see the exact lines:
```bash
grep -n "#1d4ed8\|#92400e\|#b45309\|#065f46\|#166534\|#15803d\|#be123c\|#dc2626\|#991b1b\|#eff6ff\|#fef3c7\|#ecfdf5\|#f0fdf4\|#fffbeb\|#f3f4f6\|#6b7280\|#9ca3af\|#111827\|indigo\|violet" frontend/pages/CrmLeadDetail.tsx
```

Apply the token mapping table at the top of this plan to each match. Key patterns in this file:
- `scoreColor` function using green/yellow/red hex → use `var(--color-success)`, `var(--color-warning)`, `var(--color-danger)`
- Status badge inline colors → use STATUS_STYLES tokens (same as CrmLeads Task 3 Step 1)
- Any `text-indigo-*` or `bg-indigo-*` → replace with `text-brand-*` / `bg-brand-*`
- Any `text-violet-*` → replace with `text-brand-*`

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmLeadDetail.tsx
git commit -m "style(crm): sync CrmLeadDetail colors to design tokens"
```

---

## Task 5: CrmOpportunities + CrmOpportunityDetail

**Files:**
- Modify: `frontend/pages/CrmOpportunities.tsx`
- Modify: `frontend/pages/CrmOpportunityDetail.tsx`

- [ ] **Step 1: Scan CrmOpportunities**

```bash
grep -n "#1d4ed8\|#92400e\|#b45309\|#065f46\|#166534\|#be123c\|#dc2626\|#991b1b\|#eff6ff\|#fef3c7\|#ecfdf5\|#f0fdf4\|#fffbeb\|#f3f4f6\|#6b7280\|#9ca3af\|indigo\|violet" frontend/pages/CrmOpportunities.tsx
```

Apply the token mapping table. Key patterns: urgency/stage badge colors follow the same semantic mapping as CrmLeads. Owner avatars: `bg-indigo-100`/`text-indigo-600` → `bg-brand-100`/`text-brand-600`.

- [ ] **Step 2: Scan CrmOpportunityDetail**

```bash
grep -n "#1d4ed8\|#92400e\|#b45309\|#065f46\|#166534\|#be123c\|#dc2626\|#991b1b\|#eff6ff\|#fef3c7\|#ecfdf5\|#f0fdf4\|#fffbeb\|#f3f4f6\|#6b7280\|#9ca3af\|indigo\|violet" frontend/pages/CrmOpportunityDetail.tsx
```

Apply the token mapping table.

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/CrmOpportunities.tsx frontend/pages/CrmOpportunityDetail.tsx
git commit -m "style(crm): sync CrmOpportunities colors to design tokens"
```

---

## Task 6: CrmPipeline

**Files:**
- Modify: `frontend/pages/CrmPipeline.tsx`

- [ ] **Step 1: Scan and replace**

```bash
grep -n "#1d4ed8\|#92400e\|#b45309\|#065f46\|#166534\|#be123c\|#dc2626\|#991b1b\|#eff6ff\|#fef3c7\|#ecfdf5\|#f0fdf4\|#fffbeb\|#f3f4f6\|#6b7280\|#9ca3af\|indigo\|violet" frontend/pages/CrmPipeline.tsx
```

Apply the token mapping table. Kanban column headers and deal card chips are the typical patterns here.

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmPipeline.tsx
git commit -m "style(crm): sync CrmPipeline colors to design tokens"
```

---

## Task 7: CrmAccounts + CrmAccountDetail

**Files:**
- Modify: `frontend/pages/CrmAccounts.tsx`
- Modify: `frontend/pages/CrmAccountDetail.tsx`

- [ ] **Step 1: Scan both files**

```bash
grep -n "#1d4ed8\|#92400e\|#b45309\|#065f46\|#166534\|#be123c\|#dc2626\|#991b1b\|#eff6ff\|#fef3c7\|#ecfdf5\|#f0fdf4\|#fffbeb\|#f3f4f6\|#6b7280\|#9ca3af\|indigo\|violet" frontend/pages/CrmAccounts.tsx frontend/pages/CrmAccountDetail.tsx
```

CrmAccounts had only 2 hits — likely minor. Apply the token mapping table.

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmAccounts.tsx frontend/pages/CrmAccountDetail.tsx
git commit -m "style(crm): sync CrmAccounts colors to design tokens"
```

---

## Task 8: CrmContacts + CrmContactDetail

**Files:**
- Modify: `frontend/pages/CrmContacts.tsx`
- Modify: `frontend/pages/CrmContactDetail.tsx`

- [ ] **Step 1: Scan both files**

```bash
grep -n "#1d4ed8\|#92400e\|#b45309\|#065f46\|#166534\|#be123c\|#dc2626\|#991b1b\|#eff6ff\|#fef3c7\|#ecfdf5\|#f0fdf4\|#fffbeb\|#f3f4f6\|#6b7280\|#9ca3af\|indigo\|violet" frontend/pages/CrmContacts.tsx frontend/pages/CrmContactDetail.tsx
```

Apply the token mapping table. Contact avatar initials likely use `bg-indigo-100`/`text-indigo-600` — replace with `bg-brand-100`/`text-brand-600`.

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmContacts.tsx frontend/pages/CrmContactDetail.tsx
git commit -m "style(crm): sync CrmContacts colors to design tokens"
```

---

## Task 9: CrmTeamDashboard

**Files:**
- Modify: `frontend/pages/CrmTeamDashboard.tsx`

- [ ] **Step 1: Scan and replace**

```bash
grep -n "#1d4ed8\|#92400e\|#b45309\|#065f46\|#166534\|#be123c\|#dc2626\|#991b1b\|#eff6ff\|#fef3c7\|#ecfdf5\|#f0fdf4\|#fffbeb\|#f3f4f6\|#6b7280\|#9ca3af\|indigo\|violet" frontend/pages/CrmTeamDashboard.tsx
```

8 hits. Apply the token mapping table. Team rep stat cards and performance badges are typical here.

- [ ] **Step 2: Commit**

```bash
git add frontend/pages/CrmTeamDashboard.tsx
git commit -m "style(crm): sync CrmTeamDashboard colors to design tokens"
```

---

## Task 10: CrmGuide — Status Badge Props and InfoBox Colors

**Files:**
- Modify: `frontend/pages/CrmGuide.tsx`

CrmGuide had 28 hits — the highest count. This file has `StatusBadge` component calls with inline `bg` and `text` props using raw hex, and `InfoBox` color props.

- [ ] **Step 1: Scan all StatusBadge and InfoBox color props**

```bash
grep -n "StatusBadge\|InfoBox\|#eff6ff\|#fef3c7\|#ecfdf5\|#f0fdf4\|#fef2f2\|#fffbeb\|#f3f4f6\|#1d4ed8\|#92400e\|#065f46\|#166534\|#991b1b\|#6b7280\|#9ca3af\|#dc2626\|#b45309" frontend/pages/CrmGuide.tsx
```

- [ ] **Step 2: Replace all StatusBadge bg/text props using the mapping**

Every `StatusBadge` call uses the same status color mapping as `STATUS_STYLES` in CrmLeads. Apply:

| Old prop value | New prop value |
|---|---|
| `bg="#eff6ff"` | `bg="var(--color-it-50)"` |
| `text="#1d4ed8"` | `text="var(--color-it-500)"` |
| `bg="#fef3c7"` | `bg="var(--color-fin-50)"` |
| `text="#92400e"` | `text="var(--color-warning)"` |
| `bg="#ecfdf5"` | `bg="var(--color-hr-50)"` |
| `text="#065f46"` | `text="var(--color-success)"` |
| `bg="#f0fdf4"` | `bg="var(--color-hr-50)"` |
| `text="#166534"` | `text="var(--color-success)"` |
| `bg="#fef2f2"` | `bg="rgba(220,38,38,0.06)"` |
| `text="#991b1b"` | `text="var(--color-danger)"` |
| `bg="#f3f4f6"` | `bg="var(--color-surface-muted)"` |
| `text="#6b7280"` | `text="var(--color-text-secondary)"` |
| `text="#9ca3af"` | `text="var(--color-text-tertiary)"` |

- [ ] **Step 3: Replace all InfoBox color props**

InfoBox `color` prop is used like `<InfoBox icon="lightbulb" color="#eff6ff">`. Apply:

| Old | New |
|---|---|
| `color="#eff6ff"` | `color="var(--color-it-50)"` |
| `color="#f0fdf4"` | `color="var(--color-hr-50)"` |
| `color="#fffbeb"` | `color="var(--color-fin-50)"` |
| `color="#fef2f2"` | `color="rgba(220,38,38,0.06)"` |

- [ ] **Step 4: Replace remaining inline hex for activity type colors**

Find (lines ~217, 220):
```tsx
{ type: 'SITE_VISIT', icon: 'location_on', color: '#dc2626', desc: '...' },
{ type: 'NOTE', icon: 'sticky_note_2', color: '#6b7280', desc: '...' },
```
Replace with:
```tsx
{ type: 'SITE_VISIT', icon: 'location_on', color: 'var(--color-danger)', desc: '...' },
{ type: 'NOTE', icon: 'sticky_note_2', color: 'var(--color-text-secondary)', desc: '...' },
```

Find urgency badge references in the guide (lines ~267–269) and apply same mapping as Task 3 Step 3.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/CrmGuide.tsx
git commit -m "style(crm): sync CrmGuide status badge and InfoBox colors to design tokens"
```

---

## Task 11: Visual Verification

- [ ] **Step 1: Start the frontend dev server**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Check these pages in the browser at `http://localhost:5173`**

Log in as `admin@test.local` / `abc@123`, then visit each CRM route:

| Route | What to look for |
|---|---|
| `/crm` | Hero gradient is navy (not indigo-purple), AI briefing card is navy-tinted |
| `/crm` nav tabs | Active tab underline is navy, not `#0052cc` IT blue |
| `/crm` priority cards | Material Symbols icons (not emoji) |
| `/crm/leads` | Status pills match semantic meaning (info blue = NEW, amber = CONTACTED, green = QUALIFIED) |
| `/crm/leads/:id` | Score badge colors correct |
| `/crm/guide` | Status badge colors correct throughout |

- [ ] **Step 3: Check dark mode** (toggle via browser DevTools or app settings if available)

Verify that the design tokens resolve correctly in dark mode — `var(--color-brand-700)` etc. should pick up the dark values from `tokens.css`.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "style(crm): fix any remaining token sweep cleanup"
```

---

## Self-Review

**Spec coverage:**
- ✅ CrmNav active color → Task 1
- ✅ Hero gradient → Task 2
- ✅ Toggle buttons → Task 2
- ✅ Search dropdown icons → Task 2
- ✅ Priority cards (emoji + colors) → Task 2
- ✅ Stat cards → Task 2
- ✅ AI Briefing card → Task 2
- ✅ Activity row → Task 2
- ✅ STATUS_STYLES → Task 3
- ✅ Urgency badges → Task 3
- ✅ Score colors → Task 3
- ✅ All 13 CRM pages covered → Tasks 3–10
- ✅ Visual verification → Task 11

**Placeholder scan:** Tasks 4–9 use a scan-first approach with the token mapping table rather than showing every exact line (the files were not fully read at plan-writing time). The grep command + mapping table gives the implementer everything needed to make the changes without guessing.

**Type consistency:** No type changes — this is a CSS/string-value-only sweep.

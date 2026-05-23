# Dashboard Announcement Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the announcement widget in `Dashboard.tsx` from the bottom of the page to a card-stack banner between the greeting and the stats strip, replacing the existing bottom widget entirely.

**Architecture:** All changes are confined to `frontend/pages/Dashboard.tsx`. A new `AnnouncementBanner` sub-component is extracted within the same file. It receives `pinned`, `latest`, and `loading` as props. No new API calls — data already fetched by the existing `useEffect`. The old bottom announcements block is deleted.

**Tech Stack:** React 19, TypeScript, React Router `<Link>`, inline styles matching existing design token pattern (`var(--color-*)`, `var(--text-*)`, `var(--space-*)`, `var(--radius-*)`), Material Symbols (already loaded), existing `PRIORITY_BADGE` and `formatRelativeTime` already defined in the file.

---

### Task 1: Add AnnouncementBanner sub-component

**Files:**
- Modify: `frontend/pages/Dashboard.tsx` — insert new component above the `Dashboard` const

- [ ] **Step 1: Define priority color map for card backgrounds/borders**

In `Dashboard.tsx`, after the existing `PRIORITY_BADGE` constant (around line 63), insert:

```tsx
const PRIORITY_CARD: Record<string, { bg: string; border: string; titleColor: string; unread: string }> = {
  CRITICAL: { bg: '#fef2f2', border: '#fecaca', titleColor: '#991b1b', unread: '#dc2626' },
  HIGH:     { bg: '#fffbeb', border: '#fde68a', titleColor: '#92400e', unread: '#d97706' },
  MEDIUM:   { bg: '#eff6ff', border: '#bfdbfe', titleColor: '#1e3a8a', unread: '#2563eb' },
  LOW:      { bg: '#f0fdf4', border: '#bbf7d0', titleColor: '#166534', unread: '#16a34a' },
};
```

- [ ] **Step 2: Add AnnouncementBanner component above the `Dashboard` const**

Insert this block immediately before the line `const Dashboard = () => {`:

```tsx
interface AnnouncementBannerProps {
  pinned: DashboardAnnouncement[];
  latest: DashboardAnnouncement[];
  loading: boolean;
}

const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ pinned, latest, loading }) => {
  const items = [...pinned, ...latest].slice(0, 3);

  if (loading) {
    return (
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {[0, 1].map(i => (
          <div key={i} style={{ height: 52, background: 'var(--color-border)', borderRadius: 'var(--radius-md)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      {/* Card stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map(a => {
          const isPinned = pinned.includes(a);
          const card = PRIORITY_CARD[a.priority] || { bg: 'var(--color-surface-subtle)', border: 'var(--color-border)', titleColor: 'var(--color-text-primary)', unread: 'var(--color-brand-700)' };
          const pri = PRIORITY_BADGE[a.priority];
          return (
            <Link
              key={a.id}
              to={`/announcements?open=${a.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: card.bg,
                border: `1px solid ${card.border}`,
                borderLeft: `3px solid ${a.isRead ? card.border : card.unread}`,
                borderRadius: 'var(--radius-md)',
                transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.85'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
              >
                {isPinned && <span style={{ fontSize: 13, flexShrink: 0 }}>📌</span>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--text-sm)', fontWeight: a.isRead ? 500 : 700,
                    color: card.titleColor,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {a.title}
                  </div>
                  {a.excerpt && (
                    <div style={{
                      fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginTop: 2,
                    }}>
                      {a.excerpt}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                  {pri && (
                    <span style={{
                      fontSize: 'var(--text-xs)', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 'var(--radius-full)',
                      background: pri.bg, color: pri.color,
                    }}>
                      {pri.label}
                    </span>
                  )}
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {a.publishedAt ? formatRelativeTime(a.publishedAt) : ''}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* View all footer */}
      <div style={{
        borderTop: '1px solid var(--color-border-subtle)',
        marginTop: 'var(--space-2)',
        paddingTop: 'var(--space-2)',
        textAlign: 'right',
      }}>
        <Link to="/announcements" style={{
          fontSize: 'var(--text-sm)', fontWeight: 700,
          color: 'var(--color-brand-700)', textDecoration: 'none',
        }}>
          View all announcements →
        </Link>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/pages/Dashboard.tsx
git commit -m "feat(dashboard): add AnnouncementBanner component"
```

---

### Task 2: Wire AnnouncementBanner into Dashboard JSX

**Files:**
- Modify: `frontend/pages/Dashboard.tsx` — Dashboard return JSX

- [ ] **Step 1: Insert AnnouncementBanner between greeting and stats strip**

In the `Dashboard` return, find the closing `</div>` of the `{/* ── GREETING ── */}` block (the `div` ending after `</h1></div></div>`). Insert `<AnnouncementBanner>` immediately after it:

```tsx
      {/* ── GREETING ── */}
      <div className="flex items-baseline gap-3 mb-6 pt-2">
        <div>
          <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest mb-0.5">{formatDate()}</p>
          <h1 className="text-2xl font-black text-text-primary leading-tight">
            {greeting}{' '}
            <span className="text-text-secondary font-normal text-lg">How can we help you today?</span>
          </h1>
        </div>
      </div>

      {/* ── ANNOUNCEMENT BANNER ── */}
      <AnnouncementBanner pinned={pinned} latest={latestAnnouncements} loading={loading} />

      {/* ── STATS STRIP ── */}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/Dashboard.tsx
git commit -m "feat(dashboard): wire AnnouncementBanner between greeting and stats"
```

---

### Task 3: Remove the old bottom announcements widget

**Files:**
- Modify: `frontend/pages/Dashboard.tsx` — delete old widget block

- [ ] **Step 1: Delete the bottom announcements block**

Find and delete the entire section from the comment `{/* ── ANNOUNCEMENTS WIDGET ── */}` through its closing `</div>` and the wrapping `)}` (the conditional that checks `pinned.length > 0 || latestAnnouncements.length > 0`).

The block to remove looks like this (currently around lines 346–421):

```tsx
      {/* ── ANNOUNCEMENTS WIDGET ── */}
      {(pinned.length > 0 || latestAnnouncements.length > 0) && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          ...
        </div>
      )}
```

Delete this entire block. Nothing replaces it — the banner at the top handles all announcement display now.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/pages/Dashboard.tsx
git commit -m "feat(dashboard): remove old bottom announcements widget"
```

---

### Task 4: Visual QA in browser

**Files:** none — verification only

- [ ] **Step 1: Start the frontend dev server**

```bash
cd frontend && npm run dev
```

Log in at `http://localhost:5173` with `admin@test.local` / `abc@123`.

- [ ] **Step 2: Verify banner renders above stats**

Confirm:
- Announcement cards appear between the greeting and the stats strip
- Pinned announcements show the 📌 icon and appear first
- Each card background/border/title color matches its priority (red=Critical, amber=High, blue=Medium, green=Low)
- Unread announcements have a colored 3px left border; read ones have a same-color-as-bg border
- "View all announcements →" link appears below the cards

- [ ] **Step 3: Verify empty state**

If no announcements exist, confirm the banner renders nothing and the greeting flows directly into the stats strip with no gap or empty box.

- [ ] **Step 4: Verify bottom widget is gone**

Scroll to the bottom of the dashboard. Confirm the old announcements section is no longer present.

- [ ] **Step 5: Verify card click navigation**

Click any announcement card. Confirm it navigates to `/announcements?open=<id>`.

- [ ] **Step 6: Final commit**

```bash
git add frontend/pages/Dashboard.tsx
git commit -m "feat(dashboard): announcement banner QA complete"
```

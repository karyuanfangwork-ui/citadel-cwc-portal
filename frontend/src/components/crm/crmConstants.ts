// ── Shared CRM Status Styles ──────────────────────────────────────────────
// Used by CrmLeads card view, LeadsTable, and StatusDropdown

export const STATUS_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  NEW: { bg: 'var(--color-it-50)', text: 'var(--color-it-500)', icon: 'fiber_new' },
  CONTACTED: { bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'call' },
  QUALIFIED: { bg: 'var(--color-hr-50)', text: 'var(--color-success)', icon: 'verified' },
  UNQUALIFIED: { bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'block' },
  CONVERTED: { bg: 'var(--color-hr-50)', text: 'var(--color-success)', icon: 'swap_horiz' },
  LOST: { bg: 'var(--color-surface-muted)', text: 'var(--color-text-secondary)', icon: 'cancel' },
};

export const ALL_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'] as const;

export const LEAD_SOURCES = ['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','ADVERTISEMENT','PARTNER','OTHER'] as const;

export const SOURCE_LABELS: Record<string, string> = {
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  COLD_CALL: 'Cold Call',
  TRADE_SHOW: 'Trade Show',
  LINKEDIN: 'LinkedIn',
  ADVERTISEMENT: 'Ad',
  PARTNER: 'Partner',
  OTHER: 'Other',
};

export const formatCurrency = (val: number | null) =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val) : '—';

export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const formatShortDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const isToday = (d: string) => {
  const dt = new Date(d); const now = new Date();
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth() && dt.getDate() === now.getDate();
};

export const isOverdue = (d: string) => new Date(d) < new Date(new Date().toDateString());

export const isStale = (updatedAt: string) => {
  const diff = Date.now() - new Date(updatedAt).getTime();
  return diff > 7 * 24 * 60 * 60 * 1000;
};

export type UrgencyBadge = { label: string; bg: string; text: string; icon: string } | null;

export const scoreStyle = (score: number) =>
  score >= 70
    ? { bg: 'var(--color-hr-50)', text: 'var(--color-success)' }
    : score >= 40
    ? { bg: 'var(--color-fin-50)', text: 'var(--color-warning)' }
    : { bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)' };

// ── Stage badge palette (dynamic — keyed by displayOrder, not stage name) ────
// Pipeline stages are user-defined; static name→color maps break on rename/add.
// Use stageBadgeColor(stage) to pick a color from this palette by displayOrder.
export const STAGE_PALETTE = [
  'var(--color-brand-500)',
  'var(--color-info)',
  'var(--color-warning)',
  'var(--color-success)',
  'var(--color-danger)',
  'var(--color-text-secondary)',
] as const;

export const stageBadgeColor = (stage: { displayOrder?: number; color?: string }) => {
  // If the backend provides a color, use it; otherwise fall back to palette rotation
  if (stage.color) return stage.color;
  const idx = (stage.displayOrder ?? 0) % STAGE_PALETTE.length;
  return STAGE_PALETTE[idx];
};

// ── Win probability style (for opportunity AI badge) ─────────────────────────
export const winProbStyle = (prob: number) =>
  prob >= 70
    ? { bg: 'var(--color-hr-50)', text: 'var(--color-success)', icon: 'trending_up' }
    : prob >= 40
    ? { bg: 'var(--color-fin-50)', text: 'var(--color-warning)', icon: 'trending_flat' }
    : { bg: 'rgba(220,38,38,0.06)', text: 'var(--color-danger)', icon: 'trending_down' };

// ── Display ID for leads (LD-XXXX format from UUID) ──────────────────────
export const getLeadDisplayId = (id: string) =>
  `LD-${id.slice(0, 4).toUpperCase()}`;
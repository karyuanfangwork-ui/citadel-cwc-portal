import React from 'react';
import { CrmAccount } from '../../services/crm.service';

// ── Design tokens (Kinetic Enterprise) ──────────────────────────────
const T = {
  teal: '#006a61',
  tealLight: '#86f2e4',
  tealDark: '#006f66',
  surface: '#f8f9ff',
  surfaceLow: '#eff4ff',
  white: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0b1c30',
  textSecondary: '#45464d',
  textMuted: '#76777d',
  success: '#22c55e',
};

// ── Helpers ────────────────────────────────────────────────────────
const formatCurrency = (val: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', notation: 'compact', maximumFractionDigits: 1 }).format(val)
    : '—';

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CORPORATE: 'Corporate Account',
  INDIVIDUAL: 'Individual Account',
  SOLE_PROPRIETOR: 'Sole Proprietor',
  JOINT: 'Joint Account',
};

interface Props {
  account: CrmAccount;
  onEdit?: () => void;
}

const Customer360Profile: React.FC<Props> = ({ account, onEdit }) => {
  // Derived: health score (simple heuristic)
  const activities = account.activities ?? [];
  const lastActivityDate = activities.length > 0
    ? new Date(Math.max(...activities.map(a => new Date(a.createdAt).getTime())))
    : new Date(account.updatedAt);
  const daysSince = Math.max(0, Math.floor((Date.now() - lastActivityDate.getTime()) / 86400000));
  const activeOpps = (account.opportunities ?? []).filter(
    o => o.stage && !o.stage.isWonStage && !o.stage.isLostStage
  ).length;
  const healthScore = Math.max(0, Math.min(100, 100 - Math.min(daysSince * 2, 60) + Math.min(activeOpps * 5, 40)));

  // Derived: tenure
  const tenure = Math.floor((Date.now() - new Date(account.createdAt).getTime()) / (365.25 * 86400000));

  // Derived: product pills from opportunities
  const productNames = [...new Set((account.opportunities ?? []).map(o => o.name))];

  const segmentLabel = ACCOUNT_TYPE_LABELS[account.accountType ?? 'CORPORATE'] ?? account.accountType ?? 'Corporate Account';

  return (
    <div className="flex flex-col gap-6">
      {/* ── Profile Card ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4">
        {/* Avatar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative shrink-0">
            <div
              className="w-16 h-16 rounded-xl border-2 flex items-center justify-center"
              style={{ borderColor: T.tealLight, background: `${T.teal}10` }}
            >
              <span className="material-symbols-outlined text-[28px]" style={{ color: T.teal }}>
                apartment
              </span>
            </div>
            {account.isActive && (
              <span
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                style={{ background: T.success }}
              />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold leading-snug truncate" style={{ color: T.textPrimary }}>
              {account.name}
            </h2>
            <p className="text-[14px] font-medium" style={{ color: T.teal }}>
              {segmentLabel}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t pt-4" style={{ borderColor: `${T.border}30` }} />

        {/* Stats row */}
        <div className="flex justify-between">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
              Health
            </p>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{ background: `${T.success}15`, color: T.success }}
            >
              {healthScore}/100
            </span>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
              Since
            </p>
            <p className="mt-1 text-[13px] font-semibold" style={{ color: T.textPrimary }}>
              {formatDate(account.createdAt)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
              LTV
            </p>
            <p className="mt-1 text-[13px] font-bold" style={{ color: T.teal }}>
              {formatCurrency(account.annualRevenue)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Contact Information ──────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
          Contact Information
        </h3>
        <div className="space-y-2.5">
          {[
            { icon: 'call', value: account.phone, href: account.phone ? `tel:${account.phone}` : undefined },
            { icon: 'mail', value: account.email, href: account.email ? `mailto:${account.email}` : undefined },
            { icon: 'location_on', value: [account.city, account.state].filter(Boolean).join(', ') || null },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px]" style={{ color: T.teal }}>
                {item.icon}
              </span>
              {item.value ? (
                item.href ? (
                  <a href={item.href} className="text-[13px] font-medium hover:underline" style={{ color: T.textPrimary, textDecoration: 'none' }}>
                    {item.value}
                  </a>
                ) : (
                  <span className="text-[13px] font-medium" style={{ color: T.textPrimary }}>
                    {item.value}
                  </span>
                )
              ) : (
                <span style={{ color: T.textMuted }}>—</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: `${T.border}30` }} />

      {/* ── Account Details ─────────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
          Account Details
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            { label: 'Registration No.', value: account.registrationNumber },
            { label: 'Tax No.', value: account.taxNumber },
            { label: 'Company Size', value: account.companySize },
            { label: 'Account Type', value: account.accountType },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
                {item.label}
              </p>
              <p className="text-[13px] font-medium" style={{ color: item.value ? T.textPrimary : T.textMuted }}>
                {item.value || '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: `${T.border}30` }} />

      {/* ── Industry & Revenue ───────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
          Industry & Revenue
        </h3>
        <p className="text-[14px] font-semibold mb-1" style={{ color: T.textPrimary }}>
          {account.industry || '—'}
        </p>
        {account.country && (
          <p className="text-[12px] mb-3" style={{ color: T.textMuted }}>
            {[account.city, account.state, account.country].filter(Boolean).join(', ')}
          </p>
        )}
        <div
          className="p-3 rounded-lg border"
          style={{ background: T.surfaceLow, borderColor: `${T.border}30` }}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
            Annual Revenue
          </p>
          <p className="text-[18px] font-bold mt-0.5" style={{ color: T.textPrimary }}>
            {account.annualRevenue
              ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(account.annualRevenue)
              : '—'}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: `${T.border}30` }} />

      {/* ── Existing Products ────────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
          Existing Products
        </h3>
        {productNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {productNames.slice(0, 6).map((name, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full text-[11px] font-bold"
                style={{ background: T.tealLight, color: T.tealDark }}
              >
                {name}
              </span>
            ))}
            {productNames.length > 6 && (
              <span className="text-[11px] font-medium" style={{ color: T.textMuted }}>
                +{productNames.length - 6} more
              </span>
            )}
          </div>
        ) : (
          <p className="text-[13px] italic" style={{ color: T.textMuted }}>
            No active products
          </p>
        )}
      </div>

      {/* ── Edit button (mobile-fallback) ────────────────────────── */}
      {onEdit && (
        <button
          onClick={onEdit}
          className="lg:hidden mt-2 w-full py-2 rounded-lg text-[13px] font-bold border transition-colors hover:opacity-90"
          style={{ borderColor: T.teal, color: T.teal, background: 'transparent', cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined text-[16px] align-middle mr-1">edit</span>
          Edit Account
        </button>
      )}
    </div>
  );
};

export default Customer360Profile;
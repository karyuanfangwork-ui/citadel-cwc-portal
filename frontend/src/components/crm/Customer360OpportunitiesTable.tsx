import React from 'react';
import { Link } from 'react-router-dom';
import { CrmAccount, CrmOpportunity, CrmPipelineStage } from '../../services/crm.service';

const T = {
  teal: '#006a61',
  tealLight: '#86f2e4',
  tealDark: '#006f66',
  surfaceLow: '#eff4ff',
  white: '#ffffff',
  border: '#e2e8f0',
  textPrimary: '#0b1c30',
  textSecondary: '#45464d',
  textMuted: '#76777d',
  success: '#22c55e',
  blue: '#3b82f6',
  error: '#ba1a1a',
  warning: '#f59e0b',
};

const formatCurrency = (val: number | null) =>
  val != null
    ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val)
    : '—';

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  PROSPECTING: { bg: '#eef2ff', text: '#6366f1' },
  QUALIFICATION: { bg: '#fffbeb', text: '#d97706' },
  PROPOSAL: { bg: '#eff6ff', text: '#2563eb' },
  NEGOTIATION: { bg: '#faf5ff', text: '#7c3aed' },
  CLOSED_WON: { bg: '#f0fdf4', text: '#16a34a' },
  CLOSED_LOST: { bg: '#fef2f2', text: '#dc2626' },
};

interface Props {
  opportunities: CrmOpportunity[];
  onViewAll?: () => void;
}

const Customer360OpportunitiesTable: React.FC<Props> = ({ opportunities, onViewAll }) => {
  // Filter to open (non-won, non-lost) opportunities
  const openOpps = opportunities.filter(
    o => !(o.stage?.isWonStage) && !(o.stage?.isLostStage)
  );
  const displayOpps = openOpps.slice(0, 5);

  if (displayOpps.length === 0) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5" style={{ borderColor: T.border }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-semibold" style={{ color: T.textPrimary }}>
            Open Opportunities
          </h3>
        </div>
        <div className="flex flex-col items-center py-6">
          <span className="material-symbols-outlined text-[40px] mb-2" style={{ color: T.textMuted }}>
            handshake
          </span>
          <p className="text-[13px]" style={{ color: T.textMuted }}>
            No open opportunities
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden" style={{ borderColor: T.border }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-[16px] font-semibold" style={{ color: T.textPrimary }}>
          Open Opportunities
        </h3>
        {openOpps.length > 5 && onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[13px] font-bold hover:underline"
            style={{ color: T.teal, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View All &rsaquo;
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
                Product Name
              </th>
              <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-right" style={{ color: T.textMuted }}>
                Amount
              </th>
              <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
                Stage
              </th>
              <th className="px-5 py-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
                Probability
              </th>
            </tr>
          </thead>
          <tbody>
            {displayOpps.map(o => {
              const stageName = o.stage?.name ?? '—';
              const stageColor = STAGE_COLORS[stageName] ?? { bg: '#f1f5f9', text: T.textSecondary };
              const prob = o.stage?.probability ?? o.probability ?? 0;

              return (
                <tr
                  key={o.id}
                  className="border-t hover:bg-[#f8f9ff] transition-colors"
                  style={{ borderColor: T.border }}
                >
                  <td className="px-5 py-3">
                    <Link
                      to={`/crm/opportunities/${o.id}`}
                      className="text-[13px] font-semibold hover:underline"
                      style={{ color: T.textPrimary, textDecoration: 'none' }}
                    >
                      {o.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className="font-[JetBrains_Mono] text-[13px] font-medium"
                      style={{ color: T.textPrimary }}
                    >
                      {formatCurrency(o.value)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                      style={{ background: stageColor.bg, color: stageColor.text }}
                    >
                      {stageName}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-1.5 rounded-full flex-1"
                        style={{ background: '#e2e8f0' }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${prob}%`,
                            background: prob >= 60 ? T.success : prob >= 30 ? T.warning : T.error,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-medium" style={{ color: T.textMuted }}>
                        {prob}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Customer360OpportunitiesTable;
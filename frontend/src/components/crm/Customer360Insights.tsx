import React from 'react';
import { CrmAccount, CrmActivity } from '../../services/crm.service';
import { useNextBestAction } from '../../hooks/useCrmAi';

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

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', notation: 'compact', maximumFractionDigits: 1 }).format(val);

// ── Engagement metrics ─────────────────────────────────────────────
function computeEngagement(activities: CrmActivity[]) {
  const now = Date.now();
  const last30 = activities.filter(a => (now - new Date(a.createdAt).getTime()) < 30 * 86400000);
  const comm = last30.filter(a => ['CALL', 'EMAIL', 'WHATSAPP'].includes(a.activityType)).length;
  const rel = last30.filter(a => ['MEETING', 'SITE_VISIT'].includes(a.activityType)).length;
  const total = last30.length;
  return {
    communicationEngagement: Math.min(comm * 10, 100),
    relationshipDepth: Math.min(rel * 20, 100),
    activityVelocity: Math.min(total * 8, 100),
  };
}

// ── Health bar component ──────────────────────────────────────────
const HealthBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="mb-3 last:mb-0">
    <div className="flex items-center justify-between mb-1">
      <span className="text-[12px] font-medium" style={{ color: T.textSecondary }}>{label}</span>
      <span className="text-[11px] font-bold" style={{ color: T.textMuted }}>{value}%</span>
    </div>
    <div className="h-1.5 rounded-full" style={{ background: '#e2e8f0' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  </div>
);

interface Props {
  account: CrmAccount;
  nba: ReturnType<typeof useNextBestAction>;
}

const Customer360Insights: React.FC<Props> = ({ account, nba }) => {
  const engagement = computeEngagement(account.activities ?? []);
  const opps = account.opportunities ?? [];
  const wonOpps = opps.filter(o => o.stage?.isWonStage);
  const lostOpps = opps.filter(o => o.stage?.isLostStage);
  const totalExposure = opps.reduce((sum, o) => sum + (o.value ?? 0), 0);

  // Classify NBA actions into insight categories
  const actions = nba.data?.actions ?? [];
  const insightCards: Array<{ type: 'upsell' | 'warning' | 'suggestion'; title: string; body: string }> = [];
  actions.forEach(a => {
    const text = a.action.toLowerCase();
    if (text.includes('upsell') || text.includes('qualify') || text.includes('financing') || text.includes('cross-sell')) {
      insightCards.push({ type: 'upsell', title: 'Upsell Opportunity', body: a.action });
    } else if (text.includes('contact') || text.includes('engage') || text.includes('follow') || text.includes('churn') || text.includes('risk')) {
      insightCards.push({ type: 'warning', title: 'Engagement Alert', body: a.action });
    } else {
      insightCards.push({ type: 'suggestion', title: 'Recommended Action', body: a.action });
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ── Next Steps ────────────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
          Next Steps
        </h3>
        {actions.length === 0 ? (
          <div
            className="bg-white rounded-lg border p-4 text-center"
            style={{ borderColor: T.border }}
          >
            <p className="text-[13px] italic" style={{ color: T.textMuted }}>
              {nba.loading ? 'Analyzing…' : 'No upcoming tasks'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.slice(0, 3).map((a, i) => (
              <div
                key={i}
                className="relative bg-white rounded-xl border shadow-sm p-4 pl-5 overflow-hidden"
                style={{ borderColor: T.border }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ background: a.priority === 'high' ? T.error : T.teal }}
                />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span
                      className="inline-block text-[10px] font-bold uppercase mb-1"
                      style={{ color: a.priority === 'high' ? T.error : T.teal }}
                    >
                      {a.priority === 'high' ? 'Due Today' : 'Upcoming'}
                    </span>
                    <p className="text-[13px] font-semibold truncate" style={{ color: T.textPrimary }}>
                      {a.action}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: `${T.border}30` }} />

      {/* ── Engagement Health ─────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
          Engagement Health
        </h3>
        <HealthBar label="Communication" value={engagement.communicationEngagement} color={T.teal} />
        <HealthBar label="Relationship Depth" value={engagement.relationshipDepth} color={T.textPrimary} />
        <HealthBar label="Activity Velocity" value={engagement.activityVelocity} color={T.blue} />
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: `${T.border}30` }} />

      {/* ── Smart Insights ────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-[16px]" style={{ color: T.teal }}>auto_awesome</span>
          <h3 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
            Smart Insights
          </h3>
        </div>

        {nba.loading && !insightCards.length && (
          <div className="flex items-center gap-2 text-[13px]" style={{ color: T.teal }}>
            <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
            Analyzing…
          </div>
        )}

        {nba.error && !insightCards.length && (
          <p className="text-[13px]" style={{ color: T.textMuted }}>AI insights unavailable</p>
        )}

        {insightCards.length === 0 && !nba.loading && (
          <p className="text-[13px] italic" style={{ color: T.textMuted }}>No insights available</p>
        )}

        <div className="space-y-2">
          {insightCards.slice(0, 3).map((card, i) => {
            if (card.type === 'upsell') {
              return (
                <div
                  key={i}
                  className="p-3 rounded-lg border"
                  style={{ background: 'rgba(134,242,228,0.3)', borderColor: 'rgba(0,106,97,0.1)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px]" style={{ color: T.tealDark }}>trending_up</span>
                    <span className="text-[12px] font-bold" style={{ color: T.tealDark }}>{card.title}</span>
                  </div>
                  <p className="text-[12px]" style={{ color: T.textPrimary }}>{card.body}</p>
                </div>
              );
            }
            if (card.type === 'warning') {
              return (
                <div
                  key={i}
                  className="p-3 rounded-lg border"
                  style={{ background: 'rgba(255,218,214,0.3)', borderColor: 'rgba(186,26,26,0.1)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px]" style={{ color: T.error }}>warning</span>
                    <span className="text-[12px] font-bold" style={{ color: T.error }}>{card.title}</span>
                  </div>
                  <p className="text-[12px]" style={{ color: T.textPrimary }}>{card.body}</p>
                </div>
              );
            }
            return (
              <div
                key={i}
                className="p-3 rounded-lg border"
                style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[16px]" style={{ color: '#1d4ed8' }}>lightbulb</span>
                  <span className="text-[12px] font-bold" style={{ color: '#1d4ed8' }}>{card.title}</span>
                </div>
                <p className="text-[12px]" style={{ color: T.textPrimary }}>{card.body}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: `${T.border}30` }} />

      {/* ── Group Portfolio ───────────────────────────────────── */}
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: T.textMuted }}>
          Group Portfolio
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white p-3 rounded-lg border text-center" style={{ borderColor: T.border }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>Won</p>
            <p className="text-[24px] font-bold mt-0.5" style={{ color: T.success }}>{wonOpps.length}</p>
          </div>
          <div className="bg-white p-3 rounded-lg border text-center" style={{ borderColor: T.border }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>Lost</p>
            <p className="text-[24px] font-bold mt-0.5" style={{ color: T.textMuted }}>{lostOpps.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border text-center" style={{ borderColor: T.border }}>
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>
            Total Exposure (Group)
          </p>
          <p className="text-[24px] font-bold mt-0.5" style={{ color: T.textPrimary }}>
            {formatCurrency(totalExposure)}
          </p>
          <p className="text-[10px] font-bold mt-1" style={{ color: T.teal }}>
            Includes Family Grouping
          </p>
        </div>
      </div>
    </div>
  );
};

export default Customer360Insights;
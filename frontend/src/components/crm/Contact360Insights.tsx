import React from 'react';
import { CrmContact } from '../../services/crm.service';
import { useNextBestAction, useKycGaps, useRiskProfile } from '../../hooks/useCrmAi';

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

// ── Engagement metrics ─────────────────────────────────────────────
function computeEngagement(activities: CrmContact['activities']) {
  const acts = activities ?? [];
  const now = Date.now();
  const last30 = acts.filter(a => (now - new Date(a.createdAt).getTime()) < 30 * 86400000);
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

// ── Section wrapper ───────────────────────────────────────────────
const Section: React.FC<{ title: string; icon: string; children: React.ReactNode; onRefresh?: () => void; loading?: boolean }> = ({
  title, icon, children, onRefresh, loading,
}) => (
  <div className="mb-5 last:mb-0">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[14px]" style={{ color: T.teal }}>{icon}</span>
        <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: T.textMuted }}>{title}</h3>
      </div>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-1 rounded transition-colors hover:bg-[#e2e8f0]"
          style={{ background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          <span className={`material-symbols-outlined text-[14px] ${loading ? 'animate-spin' : ''}`} style={{ color: T.teal }}>
            {loading ? 'progress_activity' : 'refresh'}
          </span>
        </button>
      )}
    </div>
    {children}
  </div>
);

interface Props {
  contact: CrmContact;
  nba: ReturnType<typeof useNextBestAction>;
  kycGaps: ReturnType<typeof useKycGaps>;
  riskProfile: ReturnType<typeof useRiskProfile>;
  onDraftMessage?: () => void;
}

const Contact360Insights: React.FC<Props> = ({ contact, nba, kycGaps, riskProfile, onDraftMessage }) => {
  const engagement = computeEngagement(contact.activities);

  return (
    <div className="space-y-1">
      {/* ── Next Steps (NBA) ──────────────────────────────────────── */}
      <Section title="Next Steps" icon="route" onRefresh={() => nba.fetch('contact', contact.id)} loading={nba.loading}>
        {nba.loading && !nba.data ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: '#e2e8f0' }} />
            ))}
          </div>
        ) : nba.data?.actions?.length ? (
          <div className="space-y-2">
            {nba.data.actions.slice(0, 3).map((a, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg px-3 py-2"
                style={{ background: T.white, border: `1px solid ${T.border}` }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: a.priority === 'high' ? T.error : a.priority === 'medium' ? T.warning : T.textMuted }}
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium" style={{ color: T.textPrimary }}>{a.action}</p>
                  {a.reason && (
                    <p className="text-[10px] mt-0.5" style={{ color: T.textMuted }}>{a.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px]" style={{ color: T.textMuted }}>No suggestions available</p>
        )}
      </Section>

      {/* ── Engagement Health ─────────────────────────────────────── */}
      <Section title="Engagement" icon="monitoring">
        <HealthBar label="Communication" value={engagement.communicationEngagement} color={T.teal} />
        <HealthBar label="Relationship Depth" value={engagement.relationshipDepth} color={T.blue} />
        <HealthBar label="Activity Velocity" value={engagement.activityVelocity} color={T.success} />
      </Section>

      {/* ── KYC Compliance ────────────────────────────────────────── */}
      <Section
        title="KYC Compliance"
        icon="verified_user"
        onRefresh={() => kycGaps.fetch(contact.id)}
        loading={kycGaps.loading}
      >
        {kycGaps.loading && !kycGaps.data ? (
          <div className="h-6 rounded animate-pulse" style={{ background: '#e2e8f0' }} />
        ) : kycGaps.data ? (
          <div>
            <div className={`flex items-center gap-1.5 text-[12px] font-semibold mb-1 ${kycGaps.data.isCompliant ? '' : ''}`}
              style={{ color: kycGaps.data.isCompliant ? T.success : T.error }}
            >
              <span className="material-symbols-outlined text-[14px]">{kycGaps.data.isCompliant ? 'check_circle' : 'warning'}</span>
              {kycGaps.data.complianceSummary}
            </div>
            {kycGaps.data.gaps.length > 0 && (
              <div className="space-y-1 mt-1">
                {kycGaps.data.gaps.slice(0, 3).map((g, i) => (
                  <div key={i} className="flex items-start gap-1.5 rounded px-2 py-1 text-[10px]"
                    style={{
                      background: g.severity === 'required' ? `${T.error}10` : `${T.warning}10`,
                      color: g.severity === 'required' ? T.error : T.warning,
                    }}
                  >
                    <span className="material-symbols-outlined mt-0.5 text-[10px]">{g.severity === 'required' ? 'error' : 'info'}</span>
                    <span><b>{g.field}:</b> {g.requirement}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px]" style={{ color: T.textMuted }}>Click refresh to check</p>
        )}
      </Section>

      {/* ── Risk Classification ───────────────────────────────────── */}
      <Section
        title="Risk Level"
        icon="shield"
        onRefresh={() => riskProfile.fetch(contact.id)}
        loading={riskProfile.loading}
      >
        {riskProfile.loading && !riskProfile.data ? (
          <div className="h-6 rounded animate-pulse" style={{ background: '#e2e8f0' }} />
        ) : riskProfile.data ? (
          <div>
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold mb-1"
              style={{
                background: riskProfile.data.suggestedRiskTier === 'High' ? `${T.error}10` : riskProfile.data.suggestedRiskTier === 'Medium' ? `${T.warning}10` : `${T.success}10`,
                color: riskProfile.data.suggestedRiskTier === 'High' ? T.error : riskProfile.data.suggestedRiskTier === 'Medium' ? T.warning : T.success,
              }}
            >
              {riskProfile.data.suggestedRiskTier} Risk
            </span>
            <p className="text-[11px] leading-snug" style={{ color: T.textSecondary }}>
              {riskProfile.data.justification}
            </p>
          </div>
        ) : (
          <p className="text-[11px]" style={{ color: T.textMuted }}>Click refresh to assess</p>
        )}
      </Section>

      {/* ── Quick Actions ─────────────────────────────────────────── */}
      <Section title="Quick Actions" icon="bolt">
        <div className="space-y-1.5">
          {onDraftMessage && (
            <button
              onClick={onDraftMessage}
              className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors"
              style={{ background: T.white, color: T.teal, border: `1px solid ${T.teal}20`, cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
              Draft Message
            </button>
          )}
        </div>
      </Section>
    </div>
  );
};

export default Contact360Insights;
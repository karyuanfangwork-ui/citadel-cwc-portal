import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../../services/crm.service';

interface Anomaly {
  id: string;
  type: 'DEAL_STUCK' | 'PROBABILITY_DROP' | 'VELOCITY_ANOMALY' | 'STALE_LEAD';
  entityId: string;
  entityType: 'OPPORTUNITY' | 'LEAD';
  severity: 'LOW' | 'MODERATE' | 'CRITICAL';
  detectedAt: string;
  message: string;
  recommendation: string;
  metadata: Record<string, any>;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  DEAL_STUCK: { label: 'Deal Stuck', icon: '⏸', color: '#f59e0b' },
  PROBABILITY_DROP: { label: 'Probability Drop', icon: '📉', color: '#ef4444' },
  VELOCITY_ANOMALY: { label: 'Slow Velocity', icon: '🐢', color: '#8b5cf6' },
  STALE_LEAD: { label: 'Stale Lead', icon: '💤', color: '#6b7280' },
};

const SEVERITY_BG: Record<string, string> = {
  CRITICAL: '#fef2f2',
  MODERATE: '#fffbeb',
  LOW: '#f0f9ff',
};

const SEVERITY_BORDER: Record<string, string> = {
  CRITICAL: '#ef4444',
  MODERATE: '#f59e0b',
  LOW: '#3b82f6',
};

export default function CrmAnomalyCards() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadAnomalies = useCallback(async () => {
    try {
      setLoading(true);
      const { anomalies: data } = await crmService.getAnomalies();
      setAnomalies(data);
    } catch { setAnomalies([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAnomalies(); }, [loadAnomalies]);

  const refresh = async () => {
    setLoading(true);
    try {
      await crmService.refreshAnomalies();
      const { anomalies: data } = await crmService.getAnomalies();
      setAnomalies(data);
    } catch { } finally { setLoading(false); }
  };

  if (loading) return <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>Scanning pipeline...</div>;
  if (anomalies.length === 0) return null;

  const critical = anomalies.filter(a => a.severity === 'CRITICAL').length;
  const moderate = anomalies.filter(a => a.severity === 'MODERATE').length;
  const low = anomalies.filter(a => a.severity === 'LOW').length;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Pipeline Anomalies</h3>
          <span style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            {critical > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{critical} critical</span>}
            {critical > 0 && moderate > 0 && ' · '}
            {moderate > 0 && <span style={{ color: '#f59e0b' }}>{moderate} moderate</span>}
            {(critical > 0 || moderate > 0) && low > 0 && ' · '}
            {low > 0 && <span style={{ color: '#3b82f6' }}>{low} low</span>}
          </span>
        </div>
        <button onClick={refresh} style={{ padding: '4px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {anomalies.slice(0, 8).map(anomaly => {
          const typeConfig = TYPE_CONFIG[anomaly.type] || { label: anomaly.type, icon: '⚠', color: '#6b7280' };
          const isExpanded = expanded === anomaly.id;
          return (
            <div
              key={anomaly.id}
              style={{
                border: `1px solid ${SEVERITY_BORDER[anomaly.severity]}`,
                borderLeft: `4px solid ${SEVERITY_BORDER[anomaly.severity]}`,
                borderRadius: 8,
                background: SEVERITY_BG[anomaly.severity],
                padding: '12px 16px',
                cursor: 'pointer',
              }}
              onClick={() => setExpanded(isExpanded ? null : anomaly.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{typeConfig.icon}</span>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{typeConfig.label}</span>
                    <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>
                      {anomaly.entityType === 'OPPORTUNITY' ? 'Opportunity' : 'Lead'}
                    </span>
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                  background: SEVERITY_BORDER[anomaly.severity], color: '#fff', textTransform: 'uppercase',
                }}>
                  {anomaly.severity}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>{anomaly.message}</p>
              {isExpanded && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Recommendation</p>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#4b5563' }}>{anomaly.recommendation}</p>
                  {Object.keys(anomaly.metadata).length > 0 && (
                    <details style={{ marginTop: 8, fontSize: 12 }}>
                      <summary style={{ cursor: 'pointer', color: '#6b7280' }}>Details</summary>
                      <pre style={{ fontSize: 11, background: '#f9fafb', padding: 8, borderRadius: 4, overflow: 'auto' }}>
                        {JSON.stringify(anomaly.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {anomalies.length > 8 && (
        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 8 }}>
          + {anomalies.length - 8} more anomalies
        </p>
      )}
    </div>
  );
}
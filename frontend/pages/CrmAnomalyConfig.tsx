import React, { useState, useEffect, useCallback } from 'react';
import CrmNav from '../src/components/CrmNav';
import crmService from '../src/services/crm.service';

interface AnomalyConfig {
  id: string;
  entityType: string;
  anomalyType: string;
  threshold: number;
  severity: string;
  isActive: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  DEAL_STUCK: 'Deal Stuck (days in stage)',
  PROBABILITY_DROP: 'Probability Drop (%)',
  VELOCITY_ANOMALY: 'Velocity Anomaly (σ)',
  STALE_LEAD: 'Stale Lead (days without activity)',
};

const ENTITY_LABELS: Record<string, string> = {
  OPPORTUNITY: 'Opportunity',
  LEAD: 'Lead',
};

export default function CrmAnomalyConfigPage() {
  const [configs, setConfigs] = useState<AnomalyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await crmService.getAnomalyConfig();
      setConfigs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load configs');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);

  const updateConfig = async (id: string, field: string, value: any) => {
    setSaving(id);
    try {
      await crmService.updateAnomalyConfig(id, { [field]: value });
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update');
    } finally { setSaving(null); }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <CrmNav />
      <div style={{ flex: 1, padding: 24, maxWidth: 800 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Anomaly Detection Settings</h1>
        <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
          Configure thresholds for the AI pipeline anomaly detection engine. Anomalies are flagged when deals or leads exceed these thresholds.
        </p>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {configs.map(config => (
              <div key={config.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15 }}>
                      {ENTITY_LABELS[config.entityType] || config.entityType}: {TYPE_LABELS[config.anomalyType] || config.anomalyType}
                    </h3>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={config.isActive}
                      onChange={e => updateConfig(config.id, 'isActive', e.target.checked)}
                      disabled={saving === config.id}
                    />
                    Active
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span style={{ color: '#6b7280' }}>Threshold</span>
                    <input
                      type="number"
                      value={config.threshold}
                      onChange={e => updateConfig(config.id, 'threshold', parseFloat(e.target.value) || 0)}
                      disabled={saving === config.id}
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14 }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                    <span style={{ color: '#6b7280' }}>Default Severity</span>
                    <select
                      value={config.severity}
                      onChange={e => updateConfig(config.id, 'severity', e.target.value)}
                      disabled={saving === config.id}
                      style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14 }}
                    >
                      <option value="LOW">Low</option>
                      <option value="MODERATE">Moderate</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
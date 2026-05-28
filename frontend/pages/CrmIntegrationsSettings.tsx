import React, { useState, useEffect, useCallback } from 'react';
import CrmNav from '../src/components/CrmNav';
import crmService from '../src/services/crm.service';
import { useAuth } from '../src/context/AuthContext';

interface Integration {
  id: string;
  provider: string;
  emailAddress: string;
  syncEnabled: boolean;
  syncFrequency: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

const PROVIDER_META: Record<string, { label: string; icon: string; color: string }> = {
  GOOGLE: { label: 'Gmail / Google Calendar', icon: 'mail', color: '#4285f4' },
  OUTLOOK: { label: 'Outlook / Microsoft Calendar', icon: 'outlook', color: '#0078d4' },
};

export default function CrmIntegrationsSettings() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await crmService.listIntegrations();
      setIntegrations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadIntegrations(); }, [loadIntegrations]);

  const connectGoogle = async () => {
    try {
      const { url } = await crmService.getGoogleAuthUrl();
      window.open(url, '_blank', 'width=600,height=700');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initiate Google auth');
    }
  };

  const connectOutlook = async () => {
    try {
      const { url } = await crmService.getOutlookAuthUrl();
      window.open(url, '_blank', 'width=600,height=700');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to initiate Outlook auth');
    }
  };

  const disconnect = async (id: string) => {
    if (!confirm('Disconnect this integration? Synced emails and events will be removed.')) return;
    try {
      await crmService.disconnectIntegration(id);
      setIntegrations(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disconnect');
    }
  };

  const toggleSync = async (id: string, enabled: boolean) => {
    try {
      const updated = await crmService.updateSyncPreferences(id, { syncEnabled: !enabled });
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, syncEnabled: !enabled } : i));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update sync preferences');
    }
  };

  const changeFrequency = async (id: string, frequency: string) => {
    try {
      await crmService.updateSyncPreferences(id, { syncFrequency: frequency });
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, syncFrequency: frequency } : i));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update sync frequency');
    }
  };

  const triggerSync = async (id: string) => {
    setSyncingId(id);
    try {
      await crmService.triggerSync(id);
      await loadIntegrations();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const hasGoogle = integrations.some(i => i.provider === 'GOOGLE');
  const hasOutlook = integrations.some(i => i.provider === 'OUTLOOK');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <CrmNav />
      <div style={{ flex: 1, padding: '24px', maxWidth: 900 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Email & Calendar Integration</h1>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}

        {/* Available connections */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
          {/* Google */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>G</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Google Workspace</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Gmail + Google Calendar</p>
              </div>
            </div>
            {hasGoogle ? (
              <div style={{ color: '#16a34a', fontSize: 14 }}>✓ Connected</div>
            ) : (
              <button onClick={connectGoogle} style={{ width: '100%', padding: '10px 16px', background: '#4285f4', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                Connect Google
              </button>
            )}
          </div>

          {/* Outlook */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: '#e1f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>O</div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Microsoft 365</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Outlook + Microsoft Calendar</p>
              </div>
            </div>
            {hasOutlook ? (
              <div style={{ color: '#16a34a', fontSize: 14 }}>✓ Connected</div>
            ) : (
              <button onClick={connectOutlook} style={{ width: '100%', padding: '10px 16px', background: '#0078d4', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500 }}>
                Connect Outlook
              </button>
            )}
          </div>
        </div>

        {/* Connected integrations */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Connected Accounts</h2>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>Loading...</div>
        ) : integrations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <p style={{ fontSize: 16 }}>No integrations connected yet.</p>
            <p style={{ fontSize: 14 }}>Connect your Gmail or Outlook account to start syncing emails and calendar events.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {integrations.map(integration => {
              const meta = PROVIDER_META[integration.provider] || { label: integration.provider, icon: '?', color: '#6b7280' };
              return (
                <div key={integration.id} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16 }}>{meta.label}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>{integration.emailAddress}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => triggerSync(integration.id)}
                        disabled={syncingId === integration.id}
                        style={{ padding: '6px 16px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: syncingId === integration.id ? 'not-allowed' : 'pointer', fontSize: 13 }}
                      >
                        {syncingId === integration.id ? 'Syncing...' : 'Sync Now'}
                      </button>
                      <button
                        onClick={() => disconnect(integration.id)}
                        style={{ padding: '6px 16px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 24, fontSize: 14, color: '#374151' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={integration.syncEnabled} onChange={() => toggleSync(integration.id, integration.syncEnabled)} />
                      Sync enabled
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      Frequency:
                      <select
                        value={integration.syncFrequency}
                        onChange={e => changeFrequency(integration.id, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #d1d5db' }}
                      >
                        <option value="15min">Every 15 min</option>
                        <option value="30min">Every 30 min</option>
                        <option value="1hr">Every hour</option>
                        <option value="manual">Manual only</option>
                      </select>
                    </label>
                    <span style={{ color: '#9ca3af' }}>
                      Last synced: {integration.lastSyncedAt ? new Date(integration.lastSyncedAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
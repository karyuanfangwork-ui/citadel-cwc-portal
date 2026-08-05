import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../src/services/crm.service';
import { INDUSTRY_OPTIONS as DEFAULT_OPTIONS, clearIndustryOptionsCache } from '../src/components/crm/crmConstants';

interface IndustryOption {
  value: string;
  label: string;
}

export default function CrmIndustryOptionsAdmin() {
  const [options, setOptions] = useState<IndustryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOptions = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await crmService.getIndustryOptions();
      setOptions(Array.isArray(data) ? data : [...DEFAULT_OPTIONS]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load industry options');
      setOptions([...DEFAULT_OPTIONS]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  const handleAdd = () => {
    setOptions(prev => [...prev, { value: '', label: '' }]);
  };

  const handleRemove = (index: number) => {
    setOptions(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: 'value' | 'label', val: string) => {
    setOptions(prev => prev.map((o, i) => i === index ? { ...o, [field]: val } : o));
  };

  const handleSave = async () => {
    // Validate
    const cleaned = options.filter(o => o.value.trim() && o.label.trim());
    const values = cleaned.map(o => o.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'));
    if (new Set(values).size !== values.length) {
      setError('Duplicate values are not allowed');
      return;
    }
    if (cleaned.length === 0) {
      setError('At least one industry option is required');
      return;
    }
    const normalized = cleaned.map(o => ({
      value: o.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
      label: o.label.trim(),
    }));
    try {
      setSaving(true);
      setError('');
      await crmService.setIndustryOptions(normalized);
      setOptions(normalized);
      clearIndustryOptionsCache();
      setSuccess('Industry options saved successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save industry options');
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    if (!confirm('Reset to default industry options?')) return;
    setOptions([...DEFAULT_OPTIONS]);
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading...</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ flex: 1, padding: 24, maxWidth: 800 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Industry Options</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '4px 0 0' }}>
              Manage the industry dropdown values shown in lead and borrower forms.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleReset} style={{ padding: '8px 16px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>
              Reset Defaults
            </button>
            <button onClick={handleAdd} style={{ padding: '8px 16px', background: '#fff', color: '#2563eb', border: '1px solid #2563eb', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>
              + Add Industry
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', background: saving ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500 }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: 12, borderRadius: 8, marginBottom: 16 }}>{success}</div>}

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 40px', gap: 12, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div>#</div>
            <div>Value (stored in DB)</div>
            <div>Label (displayed to user)</div>
            <div></div>
          </div>

          {options.map((opt, idx) => (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 40px', gap: 12, padding: '10px 16px', borderBottom: idx < options.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>{idx + 1}</div>
              <input
                value={opt.value}
                onChange={e => handleChange(idx, 'value', e.target.value)}
                placeholder="e.g. INSURANCE"
                style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <input
                value={opt.label}
                onChange={e => handleChange(idx, 'label', e.target.value)}
                placeholder="e.g. Insurance"
                style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                onClick={() => handleRemove(idx)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, padding: 4 }}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}

          {options.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              No industry options. Click "+ Add Industry" to add one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
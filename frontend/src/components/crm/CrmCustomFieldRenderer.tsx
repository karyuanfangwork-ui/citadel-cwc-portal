import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../../services/crm.service';

interface FieldDef {
  id: string;
  entity: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  group: string | null;
  options: any[];
  validation: any;
  defaultValue: string | null;
  displayOrder: number;
  isSearchable: boolean;
  isRequired: boolean;
  isActive: boolean;
}

interface Props {
  entity: 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY' | 'ACTIVITY';
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  errors?: Record<string, string>;
}

// Renders custom field inputs for create/edit forms
export default function CrmCustomFieldRenderer({ entity, values, onChange, errors }: Props) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFields = useCallback(async () => {
    try {
      setLoading(true);
      const data = await crmService.getCustomFieldDefinitions(entity);
      setFields(Array.isArray(data) ? data : []);
    } catch { setFields([]); } finally { setLoading(false); }
  }, [entity]);

  useEffect(() => { loadFields(); }, [loadFields]);

  if (loading) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading custom fields...</div>;
  if (fields.length === 0) return null;

  const grouped = fields.reduce<Record<string, FieldDef[]>>((acc, f) => {
    const g = f.group || 'General';
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {});

  const renderField = (field: FieldDef) => {
    const val = values[field.fieldKey] ?? field.defaultValue ?? '';
    const err = errors?.[field.fieldKey];

    switch (field.fieldType) {
      case 'TEXT':
      case 'URL':
        return (
          <div key={field.id} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              {field.label}{field.isRequired && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <input
              type={field.fieldType === 'URL' ? 'url' : 'text'}
              value={val}
              onChange={e => onChange(field.fieldKey, e.target.value)}
              placeholder={field.fieldType === 'URL' ? 'https://' : ''}
              style={{ width: '100%', padding: 8, border: `1px solid ${err ? '#fca5a5' : '#d1d5db'}`, borderRadius: 4, fontSize: 14 }}
            />
            {err && <span style={{ fontSize: 12, color: '#dc2626' }}>{err}</span>}
          </div>
        );
      case 'NUMBER':
        return (
          <div key={field.id} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              {field.label}{field.isRequired && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <input
              type="number"
              value={val}
              onChange={e => onChange(field.fieldKey, parseFloat(e.target.value) || 0)}
              style={{ width: '100%', padding: 8, border: `1px solid ${err ? '#fca5a5' : '#d1d5db'}`, borderRadius: 4, fontSize: 14 }}
            />
            {err && <span style={{ fontSize: 12, color: '#dc2626' }}>{err}</span>}
          </div>
        );
      case 'DATE':
        return (
          <div key={field.id} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              {field.label}{field.isRequired && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <input
              type="date"
              value={val}
              onChange={e => onChange(field.fieldKey, e.target.value)}
              style={{ width: '100%', padding: 8, border: `1px solid ${err ? '#fca5a5' : '#d1d5db'}`, borderRadius: 4, fontSize: 14 }}
            />
            {err && <span style={{ fontSize: 12, color: '#dc2626' }}>{err}</span>}
          </div>
        );
      case 'DROPDOWN':
        return (
          <div key={field.id} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              {field.label}{field.isRequired && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <select
              value={val}
              onChange={e => onChange(field.fieldKey, e.target.value)}
              style={{ width: '100%', padding: 8, border: `1px solid ${err ? '#fca5a5' : '#d1d5db'}`, borderRadius: 4, fontSize: 14 }}
            >
              <option value="">— Select —</option>
              {(field.options || []).map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {err && <span style={{ fontSize: 12, color: '#dc2626' }}>{err}</span>}
          </div>
        );
      case 'MULTI_SELECT':
        return (
          <div key={field.id} style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>
              {field.label}{field.isRequired && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(field.options || []).map((opt: any) => {
                const selected = Array.isArray(val) ? val.includes(opt.value) : false;
                return (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={e => {
                        const current = Array.isArray(val) ? [...val] : [];
                        if (e.target.checked) current.push(opt.value);
                        else current.splice(current.indexOf(opt.value), 1);
                        onChange(field.fieldKey, current);
                      }}
                    />
                    {opt.label}
                  </label>
                );
              })}
            </div>
            {err && <span style={{ fontSize: 12, color: '#dc2626' }}>{err}</span>}
          </div>
        );
      case 'CHECKBOX':
        return (
          <div key={field.id} style={{ marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={!!val}
                onChange={e => onChange(field.fieldKey, e.target.checked)}
              />
              {field.label}{field.isRequired && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            {err && <span style={{ fontSize: 12, color: '#dc2626' }}>{err}</span>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      {Object.entries(grouped).map(([group, groupFields]) => (
        <div key={group} style={{ marginBottom: 16 }}>
          {Object.keys(grouped).length > 1 && (
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>{group}</h4>
          )}
          {groupFields.sort((a, b) => a.displayOrder - b.displayOrder).map(renderField)}
        </div>
      ))}
    </div>
  );
}
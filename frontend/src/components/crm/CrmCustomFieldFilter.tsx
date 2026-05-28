import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../../services/crm.service';

interface FieldDef {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  options: any[];
  isSearchable: boolean;
}

interface Props {
  entity: 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY' | 'ACTIVITY';
  onFilter: (filters: Record<string, any>) => void;
}

// Renders searchable custom fields as filters on list pages
export default function CrmCustomFieldFilter({ entity, onFilter }: Props) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [values, setValues] = useState<Record<string, any>>({});

  const loadFields = useCallback(async () => {
    try {
      const data = await crmService.getCustomFieldDefinitions(entity);
      const searchable = Array.isArray(data) ? data.filter((f: any) => f.isSearchable) : [];
      setFields(searchable);
    } catch { setFields([]); }
  }, [entity]);

  useEffect(() => { loadFields(); }, [loadFields]);

  if (fields.length === 0) return null;

  const handleChange = (key: string, value: any) => {
    const next = { ...values, [key]: value };
    setValues(next);
    // Remove empty filters
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(next)) {
      if (v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) {
        cleaned[k] = v;
      }
    }
    onFilter(cleaned);
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
      {fields.map(field => {
        switch (field.fieldType) {
          case 'TEXT':
          case 'URL':
            return (
              <div key={field.id} style={{ minWidth: 160 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>{field.label}</label>
                <input
                  type="text"
                  value={values[field.fieldKey] || ''}
                  onChange={e => handleChange(field.fieldKey, e.target.value)}
                  placeholder={`Search ${field.label.toLowerCase()}...`}
                  style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                />
              </div>
            );
          case 'NUMBER':
            return (
              <div key={field.id} style={{ minWidth: 120 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>{field.label}</label>
                <input
                  type="number"
                  value={values[field.fieldKey] || ''}
                  onChange={e => handleChange(field.fieldKey, parseFloat(e.target.value) || '')}
                  style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                />
              </div>
            );
          case 'DROPDOWN':
            return (
              <div key={field.id} style={{ minWidth: 160 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>{field.label}</label>
                <select
                  value={values[field.fieldKey] || ''}
                  onChange={e => handleChange(field.fieldKey, e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                >
                  <option value="">All</option>
                  {(field.options || []).map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
            );
          case 'CHECKBOX':
            return (
              <div key={field.id} style={{ display: 'flex', alignItems: 'flex-end', minWidth: 120 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!values[field.fieldKey]}
                    onChange={e => handleChange(field.fieldKey, e.target.checked || '')}
                  />
                  {field.label}
                </label>
              </div>
            );
          case 'DATE':
            return (
              <div key={field.id} style={{ minWidth: 160 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>{field.label}</label>
                <input
                  type="date"
                  value={values[field.fieldKey] || ''}
                  onChange={e => handleChange(field.fieldKey, e.target.value)}
                  style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
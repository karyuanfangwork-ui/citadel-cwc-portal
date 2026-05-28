import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../../services/crm.service';

interface FieldDef {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  group: string | null;
  options: any[];
  displayOrder: number;
}

interface Props {
  entity: 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY' | 'ACTIVITY';
  values: Record<string, any> | null;
}

// Renders custom fields in read-only display on detail pages
export default function CrmCustomFieldDisplay({ entity, values }: Props) {
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

  if (loading) return null;
  if (!values || Object.keys(values).length === 0) return null;

  const activeFields = fields.filter(f => values[f.fieldKey] !== undefined && values[f.fieldKey] !== null);
  if (activeFields.length === 0) return null;

  const grouped = activeFields.reduce<Record<string, FieldDef[]>>((acc, f) => {
    const g = f.group || 'General';
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {});

  const formatValue = (field: FieldDef, value: any): string => {
    if (value === null || value === undefined) return '—';
    if (field.fieldType === 'CHECKBOX') return value ? '✓ Yes' : '✗ No';
    if (field.fieldType === 'MULTI_SELECT' && Array.isArray(value)) return value.join(', ');
    if (field.fieldType === 'DROPDOWN') {
      const opt = (field.options || []).find((o: any) => o.value === value);
      return opt ? opt.label : String(value);
    }
    if (field.fieldType === 'DATE') return new Date(value).toLocaleDateString();
    return String(value);
  };

  return (
    <div>
      {Object.entries(grouped).map(([group, groupFields]) => (
        <div key={group} style={{ marginBottom: 16 }}>
          {Object.keys(grouped).length > 1 && (
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px', paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>{group}</h4>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 24px' }}>
            {groupFields.sort((a, b) => a.displayOrder - b.displayOrder).map(field => (
              <div key={field.id}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase' }}>{field.label}</div>
                <div style={{ fontSize: 14, color: '#111827', marginTop: 2 }}>{formatValue(field, values[field.fieldKey])}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
import React, { useState, useEffect, useCallback } from 'react';
import crmService from '../src/services/crm.service';

const ENTITIES = ['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY', 'ACTIVITY'] as const;
const ENTITY_LABELS: Record<string, string> = {
  LEAD: 'Lead', CONTACT: 'Contact', ACCOUNT: 'Account', OPPORTUNITY: 'Opportunity', ACTIVITY: 'Activity',
};
const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'CHECKBOX', 'URL'] as const;

interface FieldDef {
  id: string;
  entity: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  group: string | null;
  options: any;
  validation: any;
  defaultValue: string | null;
  displayOrder: number;
  isSearchable: boolean;
  isRequired: boolean;
  isActive: boolean;
}

export default function CrmCustomFieldAdmin() {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('LEAD');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FieldDef | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const loadFields = useCallback(async () => {
    try {
      setLoading(true);
      const data = await crmService.getCustomFieldDefinitions(selectedEntity);
      setFields(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load fields');
    } finally { setLoading(false); }
  }, [selectedEntity]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deactivate this field?')) return;
    try {
      await crmService.deleteCustomFieldDefinition(id);
      setFields(prev => prev.map(f => f.id === id ? { ...f, isActive: false } : f));
    } catch (err: any) { setError(err.response?.data?.message || 'Failed'); }
  };

  const grouped = fields.reduce<Record<string, FieldDef[]>>((acc, f) => {
    const g = f.group || 'Default';
    if (!acc[g]) acc[g] = [];
    acc[g].push(f);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{ flex: 1, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Custom Fields</h1>
          <button onClick={() => { setEditing(null); setShowCreate(true); }} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, cursor: 'pointer' }}>
            + Add Field
          </button>
        </div>

        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 16 }}>{error}</div>}

        {/* Entity Selector */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {ENTITIES.map(e => (
            <button key={e} onClick={() => setSelectedEntity(e)} style={{
              padding: '6px 16px', borderRadius: 6, border: `1px solid ${selectedEntity === e ? '#2563eb' : '#d1d5db'}`,
              background: selectedEntity === e ? '#2563eb' : '#fff', color: selectedEntity === e ? '#fff' : '#374151',
              fontSize: 14, cursor: 'pointer', fontWeight: 500,
            }}>
              {ENTITY_LABELS[e]}
            </button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.keys(grouped).length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                No custom fields for {ENTITY_LABELS[selectedEntity]}. Click "Add Field" to create one.
              </div>
            )}
            {Object.entries(grouped).map(([group, groupFields]) => (
              <div key={group}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  {group}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {groupFields.map(field => (
                    <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: field.isActive ? '#fff' : '#f9fafb' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: field.isActive ? '#111827' : '#9ca3af' }}>{field.label}</span>
                          <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>{field.fieldType}</span>
                          <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>${'{' + field.fieldKey + '}'}</span>
                          {field.isRequired && <span style={{ fontSize: 11, color: '#dc2626' }}>*required</span>}
                          {field.isSearchable && <span style={{ fontSize: 11, color: '#2563eb' }}>🔍 searchable</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Key: {field.fieldKey}</div>
                      </div>
                      <button onClick={() => { setEditing(field); setShowCreate(true); }} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDelete(field.id)} style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #fca5a5', borderRadius: 4, background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                        {field.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showCreate && (
          <FieldFormModal
            field={editing}
            entity={selectedEntity}
            onClose={() => { setShowCreate(false); setEditing(null); }}
            onSaved={() => { setShowCreate(false); setEditing(null); loadFields(); }}
          />
        )}
      </div>
    </div>
  );
}

function FieldFormModal({ field, entity, onClose, onSaved }: { field: FieldDef | null; entity: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    entity: field?.entity || entity,
    fieldKey: field?.fieldKey || '',
    label: field?.label || '',
    fieldType: field?.fieldType || 'TEXT',
    group: field?.group || '',
    defaultValue: field?.defaultValue || '',
    displayOrder: field?.displayOrder || 0,
    isSearchable: field?.isSearchable || false,
    isRequired: field?.isRequired || false,
    isActive: field?.isActive ?? true,
    options: (field?.options as any[]) || [],
    validation: field?.validation || {},
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const needsOptions = ['DROPDOWN', 'MULTI_SELECT'].includes(form.fieldType);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        entity: form.entity,
        fieldKey: form.fieldKey,
        label: form.label,
        fieldType: form.fieldType,
        group: form.group || null,
        defaultValue: form.defaultValue || null,
        displayOrder: form.displayOrder,
        isSearchable: form.isSearchable,
        isRequired: form.isRequired,
        isActive: form.isActive,
      };
      if (needsOptions) payload.options = form.options;
      if (Object.keys(form.validation).length > 0) payload.validation = form.validation;

      if (field) {
        await crmService.updateCustomFieldDefinition(field.id, payload);
      } else {
        payload.fieldKey = form.fieldKey;
        await crmService.createCustomFieldDefinition(payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 520, maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 16px' }}>{field ? 'Edit Custom Field' : 'Add Custom Field'}</h2>
        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 8, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!field && (
            <label style={{ fontSize: 13 }}>
              Entity <span style={{ color: '#dc2626' }}>*</span>
              <select value={form.entity} onChange={e => setForm({ ...form, entity: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginTop: 4 }}>
                {ENTITIES.map(e => <option key={e} value={e}>{ENTITY_LABELS[e]}</option>)}
              </select>
            </label>
          )}

          {!field && (
            <label style={{ fontSize: 13 }}>
              Field Key (slug) <span style={{ color: '#dc2626' }}>*</span>
              <input value={form.fieldKey} onChange={e => setForm({ ...form, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} placeholder="e.g. trust_deed_number" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginTop: 4 }} />
            </label>
          )}

          <label style={{ fontSize: 13 }}>
            Label <span style={{ color: '#dc2626' }}>*</span>
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. Trust Deed Number" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginTop: 4 }} />
          </label>

          <label style={{ fontSize: 13 }}>
            Field Type
            <select value={form.fieldType} onChange={e => setForm({ ...form, fieldType: e.target.value })} style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginTop: 4 }}>
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label style={{ fontSize: 13 }}>
            Group (tab/section)
            <input value={form.group} onChange={e => setForm({ ...form, group: e.target.value })} placeholder="e.g. Trust Details (leave blank for Default)" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginTop: 4 }} />
          </label>

          {needsOptions && (
            <div style={{ fontSize: 13 }}>
              <label style={{ fontWeight: 600, marginBottom: 4, display: 'block' }}>Options</label>
              {form.options.map((opt: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <input value={opt.label} onChange={e => { const o = [...form.options]; o[i] = { ...o[i], label: e.target.value }; setForm({ ...form, options: o }); }} placeholder="Label" style={{ flex: 1, padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }} />
                  <input value={opt.value} onChange={e => { const o = [...form.options]; o[i] = { ...o[i], value: e.target.value }; setForm({ ...form, options: o }); }} placeholder="Value" style={{ flex: 1, padding: 6, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }} />
                  <button onClick={() => setForm({ ...form, options: form.options.filter((_: any, j: number) => j !== i) })} style={{ padding: '4px 8px', border: '1px solid #fca5a5', borderRadius: 4, background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>✕</button>
                </div>
              ))}
              <button onClick={() => setForm({ ...form, options: [...form.options, { label: '', value: '' }] })} style={{ padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb', fontSize: 12, cursor: 'pointer' }}>+ Add Option</button>
            </div>
          )}

          <label style={{ fontSize: 13 }}>
            Default Value
            <input value={form.defaultValue} onChange={e => setForm({ ...form, defaultValue: e.target.value })} placeholder="Optional default" style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginTop: 4 }} />
          </label>

          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.isRequired} onChange={e => setForm({ ...form, isRequired: e.target.checked })} /> Required
            </label>
            <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={form.isSearchable} onChange={e => setForm({ ...form, isSearchable: e.target.checked })} /> Searchable (show in filters)
            </label>
            {field && (
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> Active
              </label>
            )}
          </div>

          <label style={{ fontSize: 13 }}>
            Display Order
            <input type="number" value={form.displayOrder} onChange={e => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })} style={{ width: 100, padding: 8, border: '1px solid #d1d5db', borderRadius: 4, fontSize: 14, marginTop: 4 }} />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer' }}>{saving ? 'Saving...' : field ? 'Update' : 'Create'}</button>
        </div>
      </div>
    </div>
  );
}
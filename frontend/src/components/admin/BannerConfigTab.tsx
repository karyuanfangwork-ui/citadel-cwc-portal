import React, { useState, useEffect } from 'react';
import { bannerConfigService, BannerConfigItem, CreateBannerConfigPayload } from '../../services/bannerConfigService';
import { COLOR_SCHEME_CLASSES, clearBannerCache } from '../../hooks/useBannerConfigs';
import { requestStatusService, RequestStatusDefinition } from '../../services/requestStatusService';

const ROLES = ['staff', 'agent', 'ceo', 'hiring_manager', 'all'];
const COLOR_SCHEMES = ['blue', 'indigo', 'purple', 'amber', 'orange', 'green', 'emerald', 'yellow', 'red'];

const emptyForm = (): CreateBannerConfigPayload => ({
  role: 'staff',
  status: '',
  icon: 'hourglass_top',
  title: '',
  description: '',
  colorScheme: 'blue',
  isActive: true,
});

interface Props {
  onLoad?: () => void;
}

export const BannerConfigTab: React.FC<Props> = () => {
  const [configs, setConfigs] = useState<BannerConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusDefs, setStatusDefs] = useState<RequestStatusDefinition[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<BannerConfigItem | null>(null);
  const [form, setForm] = useState<CreateBannerConfigPayload>(emptyForm());

  useEffect(() => {
    fetchConfigs();
    fetchStatusDefs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const data = await bannerConfigService.getAll();
      setConfigs(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatusDefs = async () => {
    try {
      const defs = await requestStatusService.getActive();
      setStatusDefs(defs);
    } catch {
      // fallback: status dropdown stays empty, user can still type
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (config: BannerConfigItem) => {
    setEditing(config);
    setForm({ role: config.role, status: config.status, icon: config.icon, title: config.title, description: config.description, colorScheme: config.colorScheme, isActive: config.isActive });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.status || !form.title || !form.description) return;
    if (editing) {
      const updated = await bannerConfigService.update(editing.id, form);
      setConfigs(prev => prev.map(c => c.id === editing.id ? updated : c));
    } else {
      const created = await bannerConfigService.create(form);
      setConfigs(prev => [...prev, created]);
    }
    clearBannerCache();
    setShowForm(false);
  };

  const handleDelete = async (config: BannerConfigItem) => {
    if (!confirm(`Delete banner for "${config.status}" (${config.role})?`)) return;
    await bannerConfigService.delete(config.id);
    clearBannerCache();
    setConfigs(prev => prev.filter(c => c.id !== config.id));
  };

  return (
    <div>
      <div className="mb-8 p-6 bg-blue-50 rounded-2xl border border-blue-200">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Banner Configuration</h3>
        <p className="text-sm text-gray-600">
          Configure status banners shown on request detail pages. Use{' '}
          <code className="bg-white px-1 rounded">{'{{assignedToName}}'}</code>{' '}
          in descriptions to insert the assigned user's name.
        </p>
      </div>

      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-blue-700">
          + Add Banner
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-3">
          {configs.length === 0 && (
            <div className="text-center py-12 text-gray-400">No banner configs yet. Click "Add Banner" to create one.</div>
          )}
          {configs.map(config => (
            <div key={config.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${COLOR_SCHEME_CLASSES[config.colorScheme]?.iconBgClass ?? 'bg-blue-600'}`}>
                <span className="material-symbols-outlined text-lg text-white">{config.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-gray-900">{config.title}</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">{config.role}</span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-50 rounded-full text-indigo-600 font-mono">{config.status}</span>
                  {!config.isActive && <span className="text-xs px-2 py-0.5 bg-red-50 rounded-full text-red-500">Inactive</span>}
                </div>
                <p className="text-xs text-gray-500 truncate">{config.description}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(config)} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Edit</button>
                <button onClick={() => handleDelete(config)} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Edit Banner' : 'Add Banner'}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
                  {statusDefs.length > 0 ? (
                    <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono">
                      <option value="">— select status —</option>
                      {statusDefs.map(d => (
                        <option key={d.code} value={d.code}>{d.label} ({d.code})</option>
                      ))}
                    </select>
                  ) : (
                    <input value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} placeholder="e.g. PENDING_INVOICE_IT" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Icon (Material Symbols name)</label>
                  <input value={form.icon} onChange={e => setForm(p => ({ ...p, icon: e.target.value }))} placeholder="e.g. hourglass_top" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Color Scheme</label>
                  <select value={form.colorScheme} onChange={e => setForm(p => ({ ...p, colorScheme: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                    {COLOR_SCHEMES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Use {{assignedToName}} to insert assigned user's name" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="rounded" />
                Active
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700"
              >
                {editing ? 'Save Changes' : 'Create Banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

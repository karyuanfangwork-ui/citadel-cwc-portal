import React, { useState, useEffect, useCallback } from 'react';
import assetService, { Asset, AssetStatus, AssetCategory, AssetAssignment } from '../src/services/asset.service';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/context/ToastContext';

const STATUS_COLORS: Record<AssetStatus, string> = {
  IN_STOCK: 'bg-green-100 text-green-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  RESERVED: 'bg-yellow-100 text-yellow-800',
  PENDING_RETURN: 'bg-orange-100 text-orange-800',
  IN_REPAIR: 'bg-purple-100 text-purple-800',
  RETIRED: 'bg-gray-100 text-gray-600',
  LOST: 'bg-red-100 text-red-800',
  STOLEN: 'bg-red-200 text-red-900',
  DISPOSED: 'bg-gray-200 text-gray-500',
};

const CATEGORIES: AssetCategory[] = ['LAPTOP','DESKTOP','MONITOR','PERIPHERAL','PHONE','NETWORK','SOFTWARE_LICENSE','OTHER'];
const STATUSES: AssetStatus[] = ['IN_STOCK','ASSIGNED','RESERVED','PENDING_RETURN','IN_REPAIR','RETIRED','LOST','STOLEN','DISPOSED'];

export default function AssetManagement() {
  const [activeTab, setActiveTab] = useState<'registry' | 'employee'>('registry');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">IT Asset Management</h1>
        <p className="text-gray-500 mt-1">Track, assign, and manage company IT assets</p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          {(['registry', 'employee'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'registry' ? 'Asset Registry' : 'Employee Assets'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'registry' ? <AssetRegistryTab /> : <EmployeeAssetsTab />}
    </div>
  );
}

// ── Asset Registry Tab ──────────────────────────────────────────

function AssetRegistryTab() {
  const toast = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const result = await assetService.listAssets({
        search: search || undefined,
        status: (filterStatus as AssetStatus) || undefined,
        category: (filterCategory as AssetCategory) || undefined,
        limit: 50,
      });
      setAssets(result.assets);
      setTotal(result.total);
    } catch {
      toast.error('Error', 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, filterCategory]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const currentAssignee = (asset: Asset) => asset.assignments?.find(a => !a.returnedAt)?.user;

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="Search name, asset tag, serial..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowImportModal(true)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            ↑ Import CSV
          </button>
          <button onClick={() => setShowCreateModal(true)} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            + Register Asset
          </button>
        </div>
      </div>

      <div className="text-sm text-gray-500 mb-3">{total} asset{total !== 1 ? 's' : ''}</div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : assets.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No assets found</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Asset Tag','Name','Category','Status','Assigned To','Updated',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {assets.map(asset => {
                const assignee = currentAssignee(asset);
                return (
                  <tr key={asset.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-gray-900">{asset.assetTag}</td>
                    <td className="px-4 py-3 text-gray-900">{asset.name}</td>
                    <td className="px-4 py-3 text-gray-500">{asset.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[asset.status]}`}>
                        {asset.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {assignee ? `${assignee.firstName} ${assignee.lastName}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{new Date(asset.updatedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedAsset(asset)} className="text-blue-600 hover:underline text-sm">View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedAsset && (
        <AssetDetailDrawer
          assetId={selectedAsset.id}
          onClose={() => { setSelectedAsset(null); fetchAssets(); }}
        />
      )}
      {showCreateModal && (
        <AssetFormModal onClose={() => { setShowCreateModal(false); fetchAssets(); }} />
      )}
      {showImportModal && (
        <CsvImportModal onClose={() => { setShowImportModal(false); fetchAssets(); }} />
      )}
    </div>
  );
}

// ── Employee Assets Tab ─────────────────────────────────────────

function EmployeeAssetsTab() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<{ id: string; firstName: string; lastName: string; email: string; department?: string }[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignment[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; firstName: string; lastName: string; email: string } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) { setUsers([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/v1/users?search=${encodeURIComponent(query)}&limit=10`, { credentials: 'include' });
        const data = await response.json();
        setUsers(data.data?.users || []);
      } catch { /* silent */ } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const selectUser = async (user: typeof users[0]) => {
    setQuery(`${user.firstName} ${user.lastName} (${user.email})`);
    setUsers([]);
    try {
      const result = await assetService.getAssetsByUser(user.id);
      setSelectedUser(result.user);
      setAssignments(result.assignments);
    } catch {
      toast.error('Error', 'Failed to load employee assets');
    }
  };

  const handleReturn = async (assignment: AssetAssignment) => {
    setReturning(assignment.id);
    try {
      await assetService.returnAsset(assignment.assetId, { notes: 'Returned from Employee Assets view' });
      setAssignments(prev => prev.filter(a => a.id !== assignment.id));
      toast.success('Success', `${assignment.asset?.name} returned to IN_STOCK`);
    } catch {
      toast.error('Error', 'Failed to return asset');
    } finally {
      setReturning(null);
    }
  };

  return (
    <div>
      <div className="relative mb-6 w-96">
        <input
          type="text"
          placeholder="Search employee by name or email..."
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedUser(null); setAssignments([]); }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchLoading && <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Searching...</div>}
        {users.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {users.map(u => (
              <button key={u.id} onClick={() => selectUser(u)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm">
                <span className="font-medium">{u.firstName} {u.lastName}</span>
                <span className="text-gray-400 ml-2">{u.email}</span>
                {u.department && <span className="text-gray-400 ml-2">· {u.department}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <div>
          <div className="mb-4 pb-3 border-b">
            <h3 className="font-semibold text-gray-900">{selectedUser.firstName} {selectedUser.lastName}</h3>
            <p className="text-sm text-gray-500">{selectedUser.email}</p>
            <p className="text-sm text-gray-500 mt-1">{assignments.length} asset{assignments.length !== 1 ? 's' : ''} currently assigned</p>
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No assets assigned to this employee</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Asset Tag','Name','Category','Assigned Date',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {assignments.map(a => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium">{a.asset?.assetTag}</td>
                      <td className="px-4 py-3">{a.asset?.name}</td>
                      <td className="px-4 py-3 text-gray-500">{a.asset?.category}</td>
                      <td className="px-4 py-3 text-gray-500">{new Date(a.assignedAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleReturn(a)}
                          disabled={returning === a.id}
                          className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          {returning === a.id ? 'Returning...' : 'Return'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Asset Detail Drawer ─────────────────────────────────────────

function AssetDetailDrawer({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const toast = useToast();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Asset>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    assetService.getAsset(assetId).then(a => {
      setAsset(a);
      setForm(a);
      setLoading(false);
    }).catch(() => toast.error('Error', 'Failed to load asset'));
  }, [assetId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await assetService.updateAsset(assetId, form);
      setAsset(updated);
      setEditing(false);
      toast.success('Success', 'Asset updated');
    } catch {
      toast.error('Error', 'Failed to update asset');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
      <div className="w-full max-w-xl bg-white h-full flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );

  if (!asset) return null;

  const fields = [
    { label: 'Asset Tag', field: 'assetTag' },
    { label: 'Serial Number', field: 'serialNumber' },
    { label: 'Brand', field: 'brand' },
    { label: 'Model', field: 'model' },
    { label: 'Vendor', field: 'vendor' },
    { label: 'Purchase Date', field: 'purchaseDate' },
    { label: 'Purchase Price', field: 'purchasePrice' },
    { label: 'Warranty Expiry', field: 'warrantyExpiry' },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">{asset.name}</h2>
            <p className="text-sm text-gray-500 font-mono">{asset.assetTag}</p>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Edit</button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2 text-xl leading-none">×</button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {fields.map(({ label, field }) => (
              <div key={field}>
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">{label}</p>
                {editing ? (
                  <input
                    value={String(form[field as keyof Asset] ?? '')}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                ) : (
                  <p className="text-gray-900">{String(asset[field as keyof Asset] ?? '—')}</p>
                )}
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Category</p>
            {editing ? (
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as AssetCategory }))} className="border rounded px-2 py-1 text-sm">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <p className="text-gray-900">{asset.category}</p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Status</p>
            {editing ? (
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as AssetStatus }))} className="border rounded px-2 py-1 text-sm">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            ) : (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[asset.status]}`}>
                {asset.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-400 uppercase font-medium mb-2">Assignment History</p>
            {!asset.assignments || asset.assignments.length === 0 ? (
              <p className="text-sm text-gray-400">No assignment history</p>
            ) : (
              <div className="space-y-2">
                {asset.assignments.map(a => (
                  <div key={a.id} className="text-sm p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.user?.firstName} {a.user?.lastName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.returnedAt ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
                        {a.returnedAt ? 'Returned' : 'Active'}
                      </span>
                    </div>
                    <p className="text-gray-500 mt-0.5">
                      {new Date(a.assignedAt).toLocaleDateString()}
                      {a.returnedAt ? ` → ${new Date(a.returnedAt).toLocaleDateString()}` : ' → present'}
                    </p>
                    {a.reason && <p className="text-gray-400 text-xs mt-0.5">{a.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Asset Form Modal ────────────────────────────────────────────

function AssetFormModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Partial<Asset>>({ status: 'IN_STOCK', category: 'LAPTOP' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await assetService.createAsset(form);
      toast.success('Success', 'Asset registered');
      onClose();
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'Failed to register asset');
    } finally {
      setSaving(false);
    }
  };

  const f = (field: keyof Asset) => ({
    value: String(form[field] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Register New Asset</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Asset Tag *</label>
              <input {...f('assetTag')} required className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Serial Number</label>
              <input {...f('serialNumber')} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input {...f('name')} required className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
              <select {...f('category')} required className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select {...f('status')} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Brand</label>
              <input {...f('brand')} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
              <input {...f('model')} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
              <input {...f('vendor')} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Price (RM)</label>
              <input type="number" step="0.01" {...f('purchasePrice')} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Purchase Date</label>
              <input type="date" {...f('purchaseDate')} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Warranty Expiry</label>
              <input type="date" {...f('warrantyExpiry')} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea {...f('notes')} rows={2} className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Registering...' : 'Register Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── CSV Import Modal ────────────────────────────────────────────

function CsvImportModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [csvText, setCsvText] = useState('');
  const [result, setResult] = useState<{ imported: number; warnings: string[]; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  const parseCsv = (text: string): Record<string, string>[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
    });
  };

  const handleImport = async () => {
    const rows = parseCsv(csvText);
    if (rows.length === 0) { toast.error('Error', 'No valid rows found in CSV'); return; }
    setImporting(true);
    try {
      const res = await assetService.importAssets(rows);
      setResult(res);
      if (res.imported > 0) toast.success('Success', `Imported ${res.imported} asset${res.imported !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Error', 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const CSV_TEMPLATE = `assetTag,serialNumber,name,category,brand,model,purchaseDate,purchasePrice,vendor,warrantyExpiry,status,assignedToEmail,notes
CIT-LT-0001,SN123456,Dell XPS 15,LAPTOP,Dell,XPS 15 9530,2024-01-15,5500.00,Dell Malaysia,2027-01-15,ASSIGNED,john.tan@citadel.com,
CIT-MN-0001,,LG 27" Monitor,MONITOR,LG,27UK850,2024-01-15,800.00,LG Malaysia,,IN_STOCK,,`;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Bulk Import Assets (CSV)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600 overflow-x-auto">
            <p className="text-xs font-medium text-gray-400 mb-1 font-sans">CSV format (header row required):</p>
            {CSV_TEMPLATE}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Paste CSV content</label>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={8}
              placeholder={CSV_TEMPLATE}
              className="w-full border border-gray-300 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {result && (
            <div className="space-y-2 text-sm">
              <p className="text-green-700 font-medium">✓ {result.imported} imported</p>
              {result.warnings.map((w, i) => <p key={i} className="text-yellow-700">⚠ {w}</p>)}
              {result.errors.map((e, i) => <p key={i} className="text-red-600">✕ {e}</p>)}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
              {result ? 'Close' : 'Cancel'}
            </button>
            {!result && (
              <button onClick={handleImport} disabled={importing || !csvText.trim()} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {importing ? 'Importing...' : 'Import'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import assetService, { Asset, AssetStatus, AssetCategory, AssetAssignment } from '../src/services/asset.service';
import api from '../src/services/api';
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

const CATEGORIES: AssetCategory[] = ['LAPTOP','DESKTOP','MONITOR','PERIPHERAL','PHONE','NETWORK','PRINTER','SOFTWARE_LICENSE','OTHER'];
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
          placeholder="Search name, tag, serial, employee..."
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
                // Extract last known user from notes for unassigned assets
                const lastUserMatch = !assignee && asset.notes
                  ? asset.notes.match(/Original user:\s*(.+?)(?:\s*\||$)/)
                  : null;
                const lastUser = lastUserMatch ? lastUserMatch[1].trim() : null;
                const lastAssignee = !assignee && asset.assignments && asset.assignments.length > 0
                  ? asset.assignments.find(a => a.returnedAt)?.user
                  : null;
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
                    <td className="px-4 py-3">
                      {assignee ? (
                        <div>
                          <p className="text-gray-900 font-medium text-sm">{assignee.firstName} {assignee.lastName}</p>
                          <p className="text-gray-400 text-xs">{assignee.email}</p>
                        </div>
                      ) : lastUser ? (
                        <div>
                          <p className="text-gray-500 text-sm italic">{lastUser}</p>
                          <p className="text-gray-300 text-xs">previous user</p>
                        </div>
                      ) : lastAssignee ? (
                        <div>
                          <p className="text-gray-500 text-sm italic">{lastAssignee.firstName} {lastAssignee.lastName}</p>
                          <p className="text-gray-300 text-xs">{lastAssignee.email}</p>
                        </div>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
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
  const [userAssignments, setUserAssignments] = useState<{
    user: { id: string; firstName: string; lastName: string; email: string; department: string | null };
    assignments: AssetAssignment[];
  }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchUsers, setSearchUsers] = useState<{ id: string; firstName: string; lastName: string; email: string; department?: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserAssignments, setSelectedUserAssignments] = useState<AssetAssignment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [returning, setReturning] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Load all active assignments on mount
  useEffect(() => {
    const fetchAssignments = async () => {
      setLoading(true);
      try {
        const result = await assetService.listActiveAssignments({ search: query || undefined, limit: 50 });
        setUserAssignments(result.userAssignments);
        setTotal(result.pagination.total);
      } catch {
        toast.error('Error', 'Failed to load employee assets');
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, [query]);

  // Live search for user lookup (when typing in search box with ≥3 chars)
  // This searches ALL users (not just those with assets), for assign-action etc.
  const [userSearchMode, setUserSearchMode] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  useEffect(() => {
    if (!userSearchMode || !userSearchQuery || userSearchQuery.length < 2) {
      setSearchUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await api.get('/search/users', { params: { q: userSearchQuery, limit: 10 } });
        setSearchUsers(response.data.data?.users || []);
      } catch { /* silent */ } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, userSearchMode]);

  const viewUserDetail = async (userId: string) => {
    setExpandedUser(prev => prev === userId ? null : userId);
    setSelectedUserId(userId);
    setDetailLoading(true);
    try {
      const result = await assetService.getAssetsByUser(userId);
      setSelectedUserAssignments(result.assignments);
    } catch {
      toast.error('Error', 'Failed to load employee assets');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReturn = async (assignment: AssetAssignment) => {
    setReturning(assignment.id);
    try {
      await assetService.returnAsset(assignment.assetId, { notes: 'Returned from Employee Assets view' });
      setSelectedUserAssignments(prev => prev.filter(a => a.id !== assignment.id));
      // Also remove from the main list
      setUserAssignments(prev => prev.map(ua => ({
        ...ua,
        assignments: ua.assignments.filter(a => a.id !== assignment.id),
      })).filter(ua => ua.assignments.length > 0));
      toast.success('Success', `${assignment.asset?.name} returned to IN_STOCK`);
    } catch {
      toast.error('Error', 'Failed to return asset');
    } finally {
      setReturning(null);
    }
  };

  return (
    <div>
      {/* Search bar - filters the assignment list */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by employee name or email..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-80 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Stats */}
      <div className="mb-4 text-sm text-gray-500">
        {loading ? 'Loading...' : `${total} employee${total !== 1 ? 's' : ''} with active asset assignments`}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading assignments...</div>
      ) : userAssignments.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-gray-300 text-5xl mb-4">📦</div>
          <p className="text-gray-500 font-medium">No employees with active assignments</p>
          <p className="text-gray-400 text-sm mt-1">Assets assigned to employees will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {userAssignments.map(({ user, assignments }) => (
            <div key={user.id} className="rounded-lg border border-gray-200 overflow-hidden">
              {/* User row - clickable to expand */}
              <button
                onClick={() => viewUserDetail(user.id)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-semibold">
                    {user.firstName[0]}{user.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500">{user.email}{user.department ? ` · ${user.department}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    {assignments.length} asset{assignments.length !== 1 ? 's' : ''}
                  </span>
                  <span className={`text-gray-400 text-xs transition-transform ${expandedUser === user.id ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </button>

              {/* Expanded: asset list */}
              {expandedUser === user.id && (
                <div className="border-t border-gray-100 bg-gray-50/50">
                  {detailLoading ? (
                    <div className="px-5 py-4 text-sm text-gray-400">Loading...</div>
                  ) : selectedUserAssignments.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-400">No active assignments</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="px-5 py-2 text-left font-medium">Asset Tag</th>
                          <th className="px-5 py-2 text-left font-medium">Name</th>
                          <th className="px-5 py-2 text-left font-medium">Category</th>
                          <th className="px-5 py-2 text-left font-medium">Assigned</th>
                          <th className="px-5 py-2 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedUserAssignments.map(a => (
                          <tr key={a.id} className="hover:bg-white/60">
                            <td className="px-5 py-2.5 font-mono text-gray-900 font-medium">{a.asset?.assetTag}</td>
                            <td className="px-5 py-2.5 text-gray-700">{a.asset?.name}</td>
                            <td className="px-5 py-2.5 text-gray-500">{a.asset?.category}</td>
                            <td className="px-5 py-2.5 text-gray-500">{new Date(a.assignedAt).toLocaleDateString()}</td>
                            <td className="px-5 py-2.5 text-right">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReturn(a); }}
                                disabled={returning === a.id}
                                className="text-xs px-2.5 py-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50 transition-colors"
                              >
                                {returning === a.id ? 'Returning...' : 'Return'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* User lookup modal trigger (for searching any user, not just those with assets) */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <button
          onClick={() => setUserSearchMode(true)}
          className="text-sm text-blue-600 hover:underline"
        >
          Lookup any employee...
        </button>

        {userSearchMode && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Search any employee</p>
              <button onClick={() => { setUserSearchMode(false); setUserSearchQuery(''); setSearchUsers([]); }} className="text-gray-400 hover:text-gray-600 text-xs">×</button>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Type name or email..."
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {searchLoading && <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Searching...</div>}
            </div>
            {searchUsers.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {searchUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      viewUserDetail(u.id);
                      setUserSearchMode(false);
                      setUserSearchQuery('');
                      setSearchUsers([]);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium">{u.firstName} {u.lastName}</span>
                    <span className="text-gray-400 ml-2">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
  // Assign / Return / Reassign state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignQuery, setAssignQuery] = useState('');
  const [assignUsers, setAssignUsers] = useState<{ id: string; firstName: string; lastName: string; email: string }[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; firstName: string; lastName: string; email: string } | null>(null);
  const [assignReason, setAssignReason] = useState('');
  const [showReturnMenu, setShowReturnMenu] = useState(false);
  const [returning, setReturning] = useState(false);
  const [reassignMode, setReassignMode] = useState(false); // true = reassign (return+assign)

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

  // User search for assignment
  useEffect(() => {
    if (!showAssignModal || assignQuery.length < 2) { setAssignUsers([]); return; }
    const timer = setTimeout(async () => {
      setAssignLoading(true);
      try {
        const res = await api.get('/search/users', { params: { q: assignQuery, limit: 10 } });
        setAssignUsers(res.data.data?.users || []);
      } catch { /* silent */ } finally {
        setAssignLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [assignQuery, showAssignModal]);

  const handleAssign = async () => {
    if (!selectedUser) return;
    setAssigning(true);
    try {
      // If reassign mode, return first
      if (reassignMode && asset) {
        await assetService.returnAsset(assetId, { notes: 'Reassigned to another user', newStatus: 'IN_STOCK' });
      }
      await assetService.assignAsset(assetId, {
        userId: selectedUser.id,
        reason: assignReason || (reassignMode ? 'Reassigned' : 'New assignment'),
      });
      toast.success('Success', reassignMode
        ? `Reassigned to ${selectedUser.firstName} ${selectedUser.lastName}`
        : `Assigned to ${selectedUser.firstName} ${selectedUser.lastName}`);
      // Reload asset
      const updated = await assetService.getAsset(assetId);
      setAsset(updated);
      setShowAssignModal(false);
      setReassignMode(false);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'Failed to assign asset');
    } finally {
      setAssigning(false);
    }
  };

  const handleReturn = async (newStatus: AssetStatus = 'IN_STOCK') => {
    setReturning(true);
    setShowReturnMenu(false);
    try {
      await assetService.returnAsset(assetId, { notes: 'Returned from Asset Registry', newStatus });
      toast.success('Success', `Asset returned (${newStatus.replace(/_/g, ' ')})`);
      const updated = await assetService.getAsset(assetId);
      setAsset(updated);
      setForm(updated);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'Failed to return asset');
    } finally {
      setReturning(false);
    }
  };

  const openAssignModal = (reassign = false) => {
    setReassignMode(reassign);
    setAssignQuery('');
    setAssignUsers([]);
    setSelectedUser(null);
    setAssignReason('');
    setShowAssignModal(true);
  };

  const canAssign = asset && ['IN_STOCK', 'RESERVED', 'IN_REPAIR', 'PENDING_RETURN', 'RETIRED'].includes(asset.status);
  const isAssigned = asset?.status === 'ASSIGNED';

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
          <div className="flex gap-2 items-center">
            {!editing && canAssign && (
              <button onClick={() => openAssignModal(false)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Assign</button>
            )}
            {!editing && isAssigned && (
              <>
                <button onClick={() => openAssignModal(true)} className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700">Reassign</button>
                <div className="relative">
                  <button
                    onClick={() => setShowReturnMenu(v => !v)}
                    disabled={returning}
                    className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                  >
                    {returning ? 'Returning...' : 'Return'}
                  </button>
                  {showReturnMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                      <button onClick={() => handleReturn('IN_STOCK')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Return → In Stock</button>
                      <button onClick={() => handleReturn('IN_REPAIR')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Return → In Repair</button>
                      <button onClick={() => handleReturn('PENDING_RETURN')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Return → Pending Return</button>
                    </div>
                  )}
                </div>
              </>
            )}
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

        {/* Assign / Reassign Modal */}
        {showAssignModal && (
          <div className="border-t px-6 py-5 bg-gray-50">
            <h3 className="font-medium text-gray-900 text-sm mb-3">
              {reassignMode ? 'Reassign Asset' : 'Assign Asset'}
            </h3>
            {reassignMode && (
              <p className="text-xs text-amber-600 mb-3">
                Current assignee will be returned first, then asset will be assigned to new user.
              </p>
            )}
            {/* User search */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search employee by name or email..."
                value={assignQuery}
                onChange={e => setAssignQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {assignLoading && <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Searching...</div>}
            </div>
            {/* Search results */}
            {assignUsers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-3 max-h-48 overflow-y-auto">
                {assignUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full text-left px-4 py-2.5 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                      selectedUser?.id === u.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium">{u.firstName} {u.lastName}</span>
                    <span className="text-gray-400 ml-2 text-xs">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Selected user */}
            {selectedUser && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-blue-900">{selectedUser.firstName} {selectedUser.lastName}</p>
                  <p className="text-xs text-blue-600">{selectedUser.email}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-blue-400 hover:text-blue-600 text-xs">Change</button>
              </div>
            )}
            {/* Reason */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
              <input
                type="text"
                placeholder={reassignMode ? 'Reason for reassignment...' : 'Reason for assignment...'}
                value={assignReason}
                onChange={e => setAssignReason(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowAssignModal(false); setReassignMode(false); }}
                className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={!selectedUser || assigning}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {assigning ? (reassignMode ? 'Reassigning...' : 'Assigning...') : (reassignMode ? 'Reassign' : 'Assign')}
              </button>
            </div>
          </div>
        )}
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

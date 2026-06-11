import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import CreditNav from '../../src/components/CreditNav';
import { useAuth } from '../../src/context/AuthContext';
import { hasPermission } from '../../src/utils/permissions';
import {
  relatedPartyGroupApi,
  RelatedPartyGroup,
  GroupExposureData,
} from '../../src/services/credit.service';
import creditService from '../../src/services/credit.service';

// ── Helpers ──────────────────────────────────────────────────────────────

const formatCurrency = (val: number | null | undefined, currency = 'MYR') => {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(val);
};

const formatPct = (val: number | null) => {
  if (val == null) return '—';
  return `${val.toFixed(2)}%`;
};

const RATING_COLOR = (r: string | null) => {
  if (!r) return '#6b7280';
  if (['AAA', 'AA', 'A'].includes(r)) return '#16a34a';
  if (['BBB', 'BB'].includes(r)) return '#2563eb';
  if (['B', 'CCC'].includes(r)) return '#d97706';
  return '#dc2626';
};

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  CORPORATE: { bg: '#3b82f620', text: '#2563eb' },
  INDIVIDUAL: { bg: '#a855f720', text: '#7e22ce' },
  SOLE_PROPRIETOR: { bg: '#f59e0b20', text: '#d97706' },
};

const utilizationColor = (pct: number | null) => {
  if (pct == null) return '#6b7280';
  if (pct >= 90) return '#dc2626';
  if (pct >= 70) return '#d97706';
  return '#16a34a';
};

// ── Sub-components ───────────────────────────────────────────────────────

/** Create Group Modal */
const CreateGroupModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [relationshipType, setRelationshipType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      setError('');
      await relatedPartyGroupApi.create({
        name: name.trim(),
        description: description.trim() || null,
        relationshipType: relationshipType.trim() || null,
      });
      setName('');
      setDescription('');
      setRelationshipType('');
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#101418] mb-4">Create Related Party Group</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#44546f] mb-1">Group Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#d0d7de] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
              placeholder="e.g. ABC Holdings Group"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#44546f] mb-1">Relationship Type</label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value)}
              className="w-full border border-[#d0d7de] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
            >
              <option value="">— Select —</option>
              <option value="COMMON_OWNERSHIP">Common Ownership</option>
              <option value="COMMON_DIRECTORS">Common Directors</option>
              <option value="FAMILY">Family Related</option>
              <option value="CROSS_GUARANTEE">Cross Guarantee</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#44546f] mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-[#d0d7de] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
              placeholder="Optional description of the group relationship"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#44546f] hover:text-[#101418]">Cancel</button>
            <button type="submit" disabled={submitting || !name.trim()} className="px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-[#0043a8] disabled:opacity-50">
              {submitting ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Add Member Modal */
const AddMemberModal: React.FC<{
  open: boolean;
  groupId: string;
  onClose: () => void;
  onAdded: () => void;
}> = ({ open, groupId, onClose, onAdded }) => {
  const [selectedId, setSelectedId] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced borrower search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const { profiles } = await creditService.listBorrowerProfiles({ search: search.trim(), limit: 10 });
        setSearchResults(profiles.map((p: any) => ({
          id: p.id,
          name: p.account?.name || [p.contact?.firstName, p.contact?.lastName].filter(Boolean).join(' ') || p.name || p.id,
        })));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError('');
      await relatedPartyGroupApi.addMember(groupId, {
        borrowerProfileId: selectedId,
        role: role.trim() || null,
      });
      setSelectedId('');
      setRole('');
      setSearch('');
      setSearchResults([]);
      onAdded();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add member');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const selectedName = searchResults.find(r => r.id === selectedId)?.name || '';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#101418] mb-4">Add Member to Group</h2>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#44546f] mb-1">Search Borrower *</label>
            <input
              type="text"
              value={selectedId ? selectedName : search}
              onChange={(e) => { if (selectedId) { setSelectedId(''); setSearch(e.target.value); } else { setSearch(e.target.value); } }}
              className="w-full border border-[#d0d7de] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
              placeholder="Type to search by name…"
              required={!selectedId}
            />
            {searching && <p className="text-xs text-[#44546f] mt-1">Searching…</p>}
            {searchResults.length > 0 && !selectedId && (
              <ul className="border border-[#d0d7de] rounded-lg mt-1 max-h-40 overflow-y-auto bg-white">
                {searchResults.map(r => (
                  <li key={r.id} onClick={() => { setSelectedId(r.id); setSearch(''); }}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-[#0052cc]/5 border-b border-[#d0d7de] last:border-b-0">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-[#44546f] ml-2 text-xs font-mono">{r.id.slice(0, 8)}…</span>
                  </li>
                ))}
              </ul>
            )}
            {selectedId && (
              <div className="flex items-center gap-2 mt-1 text-sm text-[#0052cc]">
                <span className="font-medium">{selectedName}</span>
                <button type="button" onClick={() => setSelectedId('')} className="text-xs text-red-500 hover:underline">Clear</button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#44546f] mb-1">Role in Group</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border border-[#d0d7de] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
            >
              <option value="">— Select —</option>
              <option value="PARENT">Parent Company</option>
              <option value="SUBSIDIARY">Subsidiary</option>
              <option value="ASSOCIATE">Associate</option>
              <option value="JOINT_VENTURE">Joint Venture</option>
              <option value="DIRECTOR">Common Director</option>
              <option value="SHAREHOLDER">Common Shareholder</option>
              <option value="GUARANTOR">Guarantor</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[#44546f] hover:text-[#101418]">Cancel</button>
            <button type="submit" disabled={submitting || !selectedId} className="px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-[#0043a8] disabled:opacity-50">
              {submitting ? 'Adding…' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Exposure Detail Panel */
const ExposureDetailPanel: React.FC<{
  exposure: GroupExposureData;
}> = ({ exposure }) => {
  const currencies = Object.entries(exposure.currencyBreakdown);

  return (
    <div className="space-y-6">
      {/* Currency Breakdown */}
      {currencies.length > 0 && (
        <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e5e7eb] bg-[#f9fafb]">
            <h3 className="text-sm font-bold text-[#101418]">Exposure by Currency</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-left">
                  <th className="px-5 py-2.5 font-semibold text-[#44546f]">Currency</th>
                  <th className="px-5 py-2.5 font-semibold text-[#44546f] text-right">Total Approved</th>
                  <th className="px-5 py-2.5 font-semibold text-[#44546f] text-right">Total Outstanding</th>
                  <th className="px-5 py-2.5 font-semibold text-[#44546f] text-center">Facilities</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map(([currency, data]) => (
                  <tr key={currency} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb]">
                    <td className="px-5 py-2.5 font-mono font-semibold">{currency}</td>
                    <td className="px-5 py-2.5 text-right">{formatCurrency(data.totalApproved, currency)}</td>
                    <td className="px-5 py-2.5 text-right">{formatCurrency(data.totalOutstanding, currency)}</td>
                    <td className="px-5 py-2.5 text-center">{data.facilityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Member Exposure Table */}
      <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e5e7eb] bg-[#f9fafb]">
          <h3 className="text-sm font-bold text-[#101418]">Member Exposure Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-left">
                <th className="px-5 py-2.5 font-semibold text-[#44546f]">Borrower</th>
                <th className="px-5 py-2.5 font-semibold text-[#44546f]">Type</th>
                <th className="px-5 py-2.5 font-semibold text-[#44546f]">Risk</th>
                <th className="px-5 py-2.5 font-semibold text-[#44546f] text-right">Exposure</th>
                <th className="px-5 py-2.5 font-semibold text-[#44546f] text-right">Limit</th>
                <th className="px-5 py-2.5 font-semibold text-[#44546f] text-right">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {exposure.memberExposures.map((m) => (
                <tr key={m.memberId} className="border-b border-[#e5e7eb] last:border-0 hover:bg-[#f9fafb]">
                  <td className="px-5 py-2.5">
                    <Link
                      to={`/credit/borrowers/${m.borrowerProfileId}`}
                      className="text-[#0052cc] hover:underline font-medium"
                    >
                      {m.borrowerName}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: TYPE_BADGE[m.borrowerType]?.bg || '#6b728020',
                        color: TYPE_BADGE[m.borrowerType]?.text || '#6b7280',
                      }}
                    >
                      {m.borrowerType}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    {m.creditRiskRating ? (
                      <span className="font-bold text-xs" style={{ color: RATING_COLOR(m.creditRiskRating) }}>
                        {m.creditRiskRating}
                      </span>
                    ) : (
                      <span className="text-[#6b7280] text-xs">NR</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatCurrency(m.totalExposure)}</td>
                  <td className="px-5 py-2.5 text-right font-mono">{formatCurrency(m.exposureLimit)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="font-bold text-xs" style={{ color: utilizationColor(m.utilizationPct) }}>
                      {formatPct(m.utilizationPct)}
                    </span>
                    {m.utilizationPct != null && (
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1 ml-auto">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(m.utilizationPct, 100)}%`,
                            backgroundColor: utilizationColor(m.utilizationPct),
                          }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── Main Page Component ──────────────────────────────────────────────────

const GroupExposurePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGroupId = searchParams.get('groupId') || '';

  const [groups, setGroups] = useState<RelatedPartyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  // Exposure state
  const [exposureData, setExposureData] = useState<GroupExposureData | null>(null);
  const [exposureLoading, setExposureLoading] = useState(false);

  const canWrite = hasPermission(user, 'credit:write');
  const canAdmin = hasPermission(user, 'credit:admin');

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const result = await relatedPartyGroupApi.list({ search: search || undefined });
      setGroups(result.groups);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // Fetch exposure when a group is selected
  const fetchExposure = useCallback(async (groupId: string) => {
    if (!groupId) {
      setExposureData(null);
      return;
    }
    try {
      setExposureLoading(true);
      const data = await relatedPartyGroupApi.getExposure(groupId);
      setExposureData(data);
    } catch (e) {
      console.error(e);
      setExposureData(null);
    } finally {
      setExposureLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      fetchExposure(selectedGroupId);
    } else {
      setExposureData(null);
    }
  }, [selectedGroupId, fetchExposure]);

  const handleGroupSelect = (groupId: string) => {
    setSearchParams(groupId ? { groupId } : {});
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the group?')) return;
    try {
      await relatedPartyGroupApi.removeMember(memberId);
      // Refresh both the group list and exposure data
      fetchGroups();
      if (selectedGroupId) fetchExposure(selectedGroupId);
    } catch (e: any) {
      alert(e?.message || 'Failed to remove member');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this entire group? This will also remove all member associations.')) return;
    try {
      await relatedPartyGroupApi.delete(groupId);
      if (selectedGroupId === groupId) {
        setSearchParams({});
        setExposureData(null);
      }
      fetchGroups();
    } catch (e: any) {
      alert(e?.message || 'Failed to delete group');
    }
  };

  const REL_TYPE_LABELS: Record<string, string> = {
    COMMON_OWNERSHIP: 'Common Ownership',
    COMMON_DIRECTORS: 'Common Directors',
    FAMILY: 'Family Related',
    CROSS_GUARANTEE: 'Cross Guarantee',
    OTHER: 'Other',
  };

  return (
    <>
      <CreditNav />
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 'var(--space-16)' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb + Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-text-secondary mb-1">
              <Link to="/credit" className="hover:text-brand-700 transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>Credit</Link>
              <span>/</span>
              <span className="font-semibold text-text-primary">Group Exposure</span>
            </div>
            <h1 className="text-2xl font-black text-text-primary">Group Exposure Aggregation</h1>
            <p className="text-sm text-text-secondary mt-1">Monitor and aggregate exposure across related party groups</p>
          </div>
          {canWrite && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              <span className="material-symbols-outlined text-lg">group_add</span> New Group
            </button>
          )}
        </div>

        {/* Main layout: group list + exposure detail */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Group List */}
          <div className="lg:col-span-4">
            <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden">
              {/* Search */}
              <div className="p-4 border-b border-[#e5e7eb]">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-lg">search</span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search groups…"
                    className="w-full pl-9 pr-3 py-2 border border-[#d0d7de] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                  />
                </div>
              </div>

              {/* List */}
              <div className="max-h-[600px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="material-symbols-outlined animate-spin text-[#0052cc] text-2xl">progress_activity</span>
                  </div>
                ) : groups.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-[#6b7280]">
                    <span className="material-symbols-outlined text-4xl mb-2">groups</span>
                    <p className="text-sm font-medium">No related party groups found</p>
                    {canWrite && (
                      <button onClick={() => setShowCreate(true)} className="mt-3 text-sm font-bold text-[#0052cc] hover:underline">
                        Create your first group
                      </button>
                    )}
                  </div>
                ) : (
                  groups.map((group) => {
                    const isSelected = selectedGroupId === group.id;
                    const memberCount = group._count?.members ?? group.members?.length ?? 0;
                    return (
                      <div
                        key={group.id}
                        onClick={() => handleGroupSelect(group.id)}
                        className={`px-4 py-3 border-b border-[#e5e7eb] last:border-0 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#eff6ff] border-l-[3px] border-l-[#0052cc]' : 'hover:bg-[#f9fafb] border-l-[3px] border-l-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-[#101418] truncate">{group.name}</div>
                            {group.relationshipType && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#0052cc10] text-[#0052cc] mt-1">
                                {REL_TYPE_LABELS[group.relationshipType] || group.relationshipType}
                              </span>
                            )}
                            {group.description && (
                              <p className="text-xs text-[#6b7280] mt-1 line-clamp-2">{group.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className="text-[10px] font-semibold text-[#44546f] bg-[#f3f4f6] px-1.5 py-0.5 rounded-full">
                              {memberCount} {memberCount === 1 ? 'member' : 'members'}
                            </span>
                            {canAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }}
                                className="p-1 text-[#6b7280] hover:text-red-600 transition-colors"
                                title="Delete group"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: Exposure Detail */}
          <div className="lg:col-span-8">
            {!selectedGroupId ? (
              <div className="bg-white border border-[#e5e7eb] rounded-xl flex flex-col items-center justify-center py-16 text-[#6b7280]">
                <span className="material-symbols-outlined text-5xl mb-3">scatter_plot</span>
                <p className="text-sm font-medium">Select a group to view exposure details</p>
                <p className="text-xs mt-1">Aggregated exposure across all group members</p>
              </div>
            ) : exposureLoading ? (
              <div className="bg-white border border-[#e5e7eb] rounded-xl flex items-center justify-center py-16">
                <span className="material-symbols-outlined animate-spin text-[#0052cc] text-2xl">progress_activity</span>
              </div>
            ) : exposureData ? (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Total Group Exposure */}
                  <div className="bg-white border border-[#e5e7eb] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[#0052cc] text-lg">account_balance</span>
                      <span className="text-xs font-semibold text-[#44546f] uppercase tracking-wider">Total Exposure</span>
                    </div>
                    <div className="text-2xl font-black text-[#101418]">{formatCurrency(exposureData.aggregateTotalExposure)}</div>
                  </div>

                  {/* Aggregate Limit */}
                  <div className="bg-white border border-[#e5e7eb] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-[#44546f] text-lg">speed</span>
                      <span className="text-xs font-semibold text-[#44546f] uppercase tracking-wider">Aggregate Limit</span>
                    </div>
                    <div className="text-2xl font-black text-[#101418]">{formatCurrency(exposureData.aggregateExposureLimit)}</div>
                  </div>

                  {/* Utilization */}
                  <div className="bg-white border border-[#e5e7eb] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-lg" style={{ color: utilizationColor(exposureData.groupUtilizationPct) }}>pie_chart</span>
                      <span className="text-xs font-semibold text-[#44546f] uppercase tracking-wider">Utilization</span>
                    </div>
                    <div className="text-2xl font-black" style={{ color: utilizationColor(exposureData.groupUtilizationPct) }}>
                      {formatPct(exposureData.groupUtilizationPct)}
                    </div>
                    {exposureData.groupUtilizationPct != null && (
                      <div className="w-full h-2 bg-gray-200 rounded-full mt-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(exposureData.groupUtilizationPct, 100)}%`,
                            backgroundColor: utilizationColor(exposureData.groupUtilizationPct),
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Meta info bar */}
                <div className="bg-white border border-[#e5e7eb] rounded-xl px-5 py-3 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-[#44546f]">Members</span>
                      <span className="ml-1 font-bold text-sm text-[#101418]">{exposureData.memberCount}</span>
                    </div>
                    {exposureData.relationshipType && (
                      <div>
                        <span className="text-xs text-[#44546f]">Type</span>
                        <span className="ml-1 font-bold text-sm text-[#101418]">{REL_TYPE_LABELS[exposureData.relationshipType] || exposureData.relationshipType}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-xs text-[#44546f]">Active Applications</span>
                      <span className="ml-1 font-bold text-sm text-[#101418]">{exposureData.activeApplicationCount}</span>
                    </div>
                  </div>
                  {canWrite && (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="flex items-center gap-1.5 text-sm font-bold text-[#0052cc] hover:text-[#0043a8] transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">person_add</span>
                      Add Member
                    </button>
                  )}
                </div>

                {/* Detailed breakdown */}
                <ExposureDetailPanel exposure={exposureData} />
              </div>
            ) : (
              <div className="bg-white border border-[#e5e7eb] rounded-xl flex flex-col items-center justify-center py-16 text-[#6b7280]">
                <span className="material-symbols-outlined text-4xl mb-2">error_outline</span>
                <p className="text-sm font-medium">Failed to load exposure data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateGroupModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchGroups}
      />
      {selectedGroupId && (
        <AddMemberModal
          open={showAddMember}
          groupId={selectedGroupId}
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            fetchGroups();
            fetchExposure(selectedGroupId);
          }}
        />
      )}
    </>
  );
};

export default GroupExposurePage;
import React, { useEffect, useRef, useState, useCallback } from 'react';
import apiClient from '../../services/api';

interface CreditUserRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

interface UserSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  roles?: { role: { name: string } }[];
}

interface UserAssignChipProps {
  label: 'RM' | 'Analyst';
  value: CreditUserRef | null;
  applicationId: string;
  field: 'assignedRmId' | 'assignedAnalystId';
  roleFilters?: string[];
  disabled?: boolean;
  onUpdated: (app: any) => void;
}

export default function UserAssignChip({
  label,
  value,
  applicationId,
  field,
  roleFilters,
  disabled = false,
  onUpdated,
}: UserAssignChipProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setQuery('');
        setResults([]);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      // If role filters specified, use the multi-role filter endpoint
      if (roleFilters && roleFilters.length > 0) {
        const res = await apiClient.get(
          `/users?roles=${encodeURIComponent(roleFilters.join(','))}&search=${encodeURIComponent(q)}&limit=10`
        );
        const users = res.data?.data?.users ?? res.data?.data ?? [];
        setResults(Array.isArray(users) ? users : []);
      } else {
        // Generic user search (no role filter)
        const res = await apiClient.get(
          `/users/search?q=${encodeURIComponent(q)}&limit=10`
        );
        const users = res.data?.data?.users ?? res.data?.data ?? [];
        setResults(Array.isArray(users) ? users : []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [roleFilters]);

  useEffect(() => {
    if (!editing) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      // When dropdown opens with no query, load all eligible users
      if (roleFilters && roleFilters.length > 0) {
        debounceRef.current = setTimeout(() => searchUsers(''), 0);
        // Actually load all role-filtered users
        setLoading(true);
        apiClient.get(`/users?roles=${encodeURIComponent(roleFilters.join(','))}&limit=20`)
          .then(res => {
            const users = res.data?.data?.users ?? res.data?.data ?? [];
            setResults(Array.isArray(users) ? users : []);
          })
          .catch(() => setResults([]))
          .finally(() => setLoading(false));
      }
      return;
    }
    debounceRef.current = setTimeout(() => searchUsers(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, editing, searchUsers, roleFilters]);

  async function handleSelect(user: UserSearchResult) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.patch(`/credit/applications/${applicationId}`, {
        [field]: user.id,
      });
      const updatedApp = res.data?.data?.application ?? res.data?.data;
      if (updatedApp) {
        onUpdated(updatedApp);
      }
      setEditing(false);
      setQuery('');
      setResults([]);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  }

  async function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.patch(`/credit/applications/${applicationId}`, {
        [field]: null,
      });
      const updatedApp = res.data?.data?.application ?? res.data?.data;
      if (updatedApp) {
        onUpdated(updatedApp);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to clear');
    } finally {
      setSaving(false);
    }
  }

  // Icon based on label
  const iconMap: Record<string, string> = {
    RM: 'person',
    Analyst: 'analytics',
  };
  const icon = iconMap[label] || 'person';

  // Display chip
  if (!editing) {
    return (
      <div className="flex items-center gap-2 bg-bg-subtle border border-border px-4 py-2 rounded-xl text-sm group">
        <span className="material-symbols-outlined text-base text-brand-700">{icon}</span>
        {value ? (
          <>
            <span className="font-bold text-text-primary">{value.firstName} {value.lastName}</span>
            <span className="text-text-secondary">{label}</span>
            {!disabled && (
              <button
                onClick={handleClear}
                className="ml-0.5 text-text-secondary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Remove ${label}`}
                disabled={saving}
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </>
        ) : (
          <>
            <span className="font-bold text-text-secondary">—</span>
            <span className="text-text-secondary">{label}</span>
            {!disabled && (
              <button
                onClick={() => setEditing(true)}
                className="ml-0.5 text-text-secondary hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Assign ${label}`}
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
            )}
          </>
        )}
        {label === 'RM' && value && (
          <span className="material-symbols-outlined text-sm text-amber-500" title="RM cannot approve their own application (SOD)">warning</span>
        )}
        {error && <span className="text-red-500 text-xs ml-1">{error}</span>}
      </div>
    );
  }

  // Editing mode — dropdown search
  return (
    <div ref={containerRef} className="relative bg-bg-subtle border border-brand-400 px-4 py-2 rounded-xl text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-base text-brand-700">{icon}</span>
        <span className="font-bold text-text-primary">{label}:</span>
        <input
          autoFocus
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name or email..."
          className="flex-1 text-sm border-b border-brand-300 bg-transparent outline-none py-0.5 min-w-[120px]"
          disabled={saving}
        />
        {loading && <span className="material-symbols-outlined text-sm animate-spin text-brand-600">refresh</span>}
        <button
          onClick={() => { setEditing(false); setQuery(''); setResults([]); setError(null); }}
          className="text-text-secondary hover:text-red-500"
        >
          <span className="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      {error && <p className="text-red-500 text-xs mb-1">{error}</p>}

      {/* Results dropdown */}
      {(results.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-30 max-h-48 overflow-y-auto">
          {loading && !results.length && (
            <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
          )}
          {results.map(u => (
            <button
              key={u.id}
              onClick={() => handleSelect(u)}
              disabled={saving}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-brand-50 text-xs disabled:opacity-50"
            >
              <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {`${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{u.firstName} {u.lastName}</span>
                <span className="text-gray-400 ml-1">{u.email}</span>
                {u.roles && u.roles.length > 0 && (
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {u.roles.map(r => r.role.name).join(', ')}
                  </div>
                )}
              </div>
              {value?.id === u.id && (
                <span className="material-symbols-outlined text-brand-600 text-sm">check</span>
              )}
            </button>
          ))}
          {results.length === 0 && !loading && query.trim() && (
            <div className="px-3 py-2 text-xs text-gray-400">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
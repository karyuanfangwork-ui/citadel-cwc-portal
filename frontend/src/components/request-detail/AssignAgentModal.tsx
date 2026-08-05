// frontend/src/components/request-detail/AssignAgentModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../services/api';
import { requestService } from '../../services/request.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: { role: { name: string } }[];
}

interface AssignAgentModalProps {
  requestId: string;
  currentAssigneeId?: string;
  currentUserId: string;
  currentUserName: string;
  onSuccess: () => void;
  onClose: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  AGENT: 'Agent',
  END_USER: 'End User',
  CEO: 'CEO',
  CTO: 'CTO',
  CFO: 'CFO',
  GROUP_DCEO: 'Group Deputy CEO',
  CREDIT_RM: 'Credit RM',
  CREDIT_ANALYST: 'Credit Analyst',
  CREDIT_MANAGER: 'Credit Manager',
};

const primaryRole = (roles: { role: { name: string } }[]): string => {
  if (!roles.length) return 'END_USER';
  // Prefer non-END_USER role for display
  const nonEndUser = roles.find(r => r.role.name !== 'END_USER');
  return nonEndUser?.role.name || roles[0].role.name;
};

const roleSortPriority = (roleName: string): number => {
  const order: Record<string, number> = {
    ADMIN: 0,
    AGENT: 1,
    CEO: 2,
    CTO: 3,
    CFO: 4,
    GROUP_DCEO: 5,
    CREDIT_MANAGER: 6,
    CREDIT_ANALYST: 7,
    CREDIT_RM: 8,
    END_USER: 9,
  };
  return order[roleName] ?? 10;
};

const AssignAgentModal: React.FC<AssignAgentModalProps> = ({
  requestId,
  currentAssigneeId,
  currentUserId,
  currentUserName,
  onSuccess,
  onClose,
}) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(currentAssigneeId || '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await apiClient.get('/users/staff');
        setStaff(res.data.data.staff);
      } catch {
        setError('Failed to load staff');
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return staff
      .filter(a =>
        a.firstName.toLowerCase().includes(q) ||
        a.lastName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const pa = roleSortPriority(primaryRole(a.roles));
        const pb = roleSortPriority(primaryRole(b.roles));
        if (pa !== pb) return pa - pb;
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      });
  }, [search, staff]);

  // Group filtered results for display: agents/admins first, then other staff
  const { agents, others } = useMemo(() => {
    const agents: StaffMember[] = [];
    const others: StaffMember[] = [];
    for (const s of filtered) {
      const role = primaryRole(s.roles);
      if (role === 'ADMIN' || role === 'AGENT') {
        agents.push(s);
      } else {
        others.push(s);
      }
    }
    return { agents, others };
  }, [filtered]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    try {
      setSubmitting(true);
      setError(null);
      await requestService.assignRequest(requestId, selectedId);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to assign request');
    } finally {
      setSubmitting(false);
    }
  };

  const isSelf = selectedId === currentUserId;

  const renderStaffOption = (s: StaffMember) => {
    const role = primaryRole(s.roles);
    const label = ROLE_LABEL[role] || role.replace(/_/g, ' ');
    return (
      <label
        key={s.id}
        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
          selectedId === s.id ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
        }`}
      >
        <input
          type="radio"
          name="agent"
          value={s.id}
          checked={selectedId === s.id}
          onChange={() => setSelectedId(s.id)}
          className="accent-[#0052cc]"
        />
        <div className="size-7 rounded-full bg-[#0052cc] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {s.firstName[0]}{s.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 truncate">{s.firstName} {s.lastName}</p>
          <p className="text-xs text-gray-500 truncate">{s.email}</p>
        </div>
        <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
          {label}
        </span>
      </label>
    );
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 flex-shrink-0">
          <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#0052cc]">person_add</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Assign to Staff</h2>
            <p className="text-xs text-gray-500">Select any staff member or claim for yourself</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Assign to self quick option */}
            <label
              className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                isSelf ? 'border-[#0052cc] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="agent"
                value={currentUserId}
                checked={isSelf}
                onChange={() => setSelectedId(currentUserId)}
                className="accent-[#0052cc]"
              />
              <div className="size-7 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                Me
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Assign to myself</p>
                <p className="text-xs text-gray-500">{currentUserName}</p>
              </div>
            </label>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                Search staff
              </label>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Type name or email…"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              />
            </div>

            {loading ? (
              <p className="text-xs text-gray-400 py-2">Loading staff…</p>
            ) : (
              <div className="space-y-3">
                {/* Agents / Admins section */}
                {agents.filter(a => a.id !== currentUserId).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Agents &amp; Admins</p>
                    <div className="space-y-2">
                      {agents.filter(a => a.id !== currentUserId).map(renderStaffOption)}
                    </div>
                  </div>
                )}
                {/* Other staff section */}
                {others.filter(a => a.id !== currentUserId).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Other Staff</p>
                    <div className="space-y-2">
                      {others.filter(a => a.id !== currentUserId).map(renderStaffOption)}
                    </div>
                  </div>
                )}
                {filtered.filter(a => a.id !== currentUserId).length === 0 && (
                  <p className="text-xs text-gray-400 py-2">No matching staff found</p>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2">Cancel</button>
            <button
              type="submit"
              disabled={!selectedId || submitting}
              className="px-4 py-3 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052cc] focus-visible:ring-offset-2"
            >
              {submitting ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};

export default AssignAgentModal;
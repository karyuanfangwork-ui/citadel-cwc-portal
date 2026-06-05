import React, { useState, useEffect, useCallback } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface UserEditModalProps {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    jobTitle?: string | null;
    isActive: boolean;
    managerId?: string | null;
    agentTeam?: string | null;
    executiveRole?: string | null;
    entityId?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  entities?: { id: string; name: string; code: string }[];
}

const UserEditModal: React.FC<UserEditModalProps> = ({ user, isOpen, onClose, onSave, entities }) => {
  const focusTrapRef = useFocusTrap(true);
  const stableOnClose = useCallback(() => onClose(), [onClose]);
  useEscapeKey(stableOnClose);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    isActive: true,
    agentTeam: '',
    executiveRole: '',
    entityId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailChangeConfirmed, setEmailChangeConfirmed] = useState(false);

  const originalEmail = user?.email || '';
  const emailChanged = formData.email !== originalEmail && originalEmail !== '';

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        jobTitle: user.jobTitle || '',
        isActive: user.isActive,
        agentTeam: user.agentTeam || '',
        executiveRole: user.executiveRole || '',
        entityId: user.entityId || '',
      });
    }
  }, [user]);

  useEffect(() => {
    setEmailChangeConfirmed(false);
  }, [formData.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSave({
        ...formData,
        entityId: formData.entityId || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Edit Employee">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#0052cc]">edit</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Edit Employee</h2>
              <p className="text-xs text-gray-500">{user.firstName} {user.lastName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-gray-400">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              ⚠️ Changing email will update the user's login credential
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Job Title
            </label>
            <input
              type="text"
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Agent Team
            </label>
            <input
              type="text"
              value={formData.agentTeam}
              onChange={(e) => setFormData({ ...formData, agentTeam: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
              placeholder="e.g., IT Support, HR Services"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Entity (Subsidiary)
            </label>
            <select
              value={formData.entityId}
              onChange={(e) => setFormData({ ...formData, entityId: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] bg-white"
            >
              <option value="">None</option>
              {entities?.map(entity => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} ({entity.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Executive Role
            </label>
            <select
              value={formData.executiveRole}
              onChange={(e) => setFormData({ ...formData, executiveRole: e.target.value })}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] bg-white"
            >
              <option value="">None</option>
              <option value="GROUP_DCEO">Group Deputy CEO</option>
              <option value="CEO">CEO</option>
              <option value="CTO">CTO</option>
              <option value="CFO">CFO</option>
              <option value="CMO">CMO</option>
              <option value="COO">COO</option>
              <option value="CHRO">CHRO</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Assign C-level executive role for high-value approval workflows
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-[#0052cc] rounded focus:ring-[#0052cc]"
            />
            <label htmlFor="isActive" className="text-sm font-semibold text-gray-700">
              Active Account
            </label>
            <span className="text-xs text-gray-500 ml-2">
              (Inactive users cannot log in)
            </span>
          </div>

          {emailChanged && !emailChangeConfirmed && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-bold text-amber-800 mb-2">
                ⚠️ You are changing this user's login email from <code className="bg-amber-100 px-1 rounded">{originalEmail}</code> to <code className="bg-amber-100 px-1 rounded">{formData.email}</code>
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailChangeConfirmed}
                  onChange={e => setEmailChangeConfirmed(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <span className="text-sm font-semibold text-amber-700">Yes, update the login email</span>
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (emailChanged && !emailChangeConfirmed)}
              className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#0047b3] disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserEditModal;
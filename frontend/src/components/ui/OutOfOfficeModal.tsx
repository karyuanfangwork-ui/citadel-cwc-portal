import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

interface OutOfOfficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCurrentlyOOO: boolean;
  currentUntil?: string | null;
  currentMessage?: string | null;
  onSubmit: (data: { outOfOffice: boolean; outOfOfficeUntil?: string; outOfOfficeMessage?: string }) => Promise<void>;
}

interface DelegateOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string | null;
}

const OutOfOfficeModal: React.FC<OutOfOfficeModalProps> = ({
  isOpen,
  onClose,
  isCurrentlyOOO,
  currentUntil,
  currentMessage,
  onSubmit,
}) => {
  const { user, updateDelegation } = useAuth();
  const [outOfOffice, setOutOfOffice] = useState(isCurrentlyOOO);
  const [until, setUntil] = useState(currentUntil ? currentUntil.slice(0, 10) : '');
  const [message, setMessage] = useState(currentMessage || '');
  const [submitting, setSubmitting] = useState(false);

  // Delegation state
  const [delegationEnabled, setDelegationEnabled] = useState(user?.delegationEnabled ?? false);
  const [selectedDelegate, setSelectedDelegate] = useState<DelegateOption | null>(
    user?.delegatedTo ? { id: user.delegatedTo.id, firstName: user.delegatedTo.firstName, lastName: user.delegatedTo.lastName, email: user.delegatedTo.email } : null
  );
  const [delegateSearch, setDelegateSearch] = useState('');
  const [delegateOptions, setDelegateOptions] = useState<DelegateOption[]>([]);
  const [delegateSearching, setDelegateSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync delegation state when user changes
  useEffect(() => {
    setDelegationEnabled(user?.delegationEnabled ?? false);
    if (user?.delegatedTo) {
      setSelectedDelegate({ id: user.delegatedTo.id, firstName: user.delegatedTo.firstName, lastName: user.delegatedTo.lastName, email: user.delegatedTo.email });
    } else {
      setSelectedDelegate(null);
    }
  }, [user?.delegationEnabled, user?.delegatedTo]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const searchDelegates = async (term: string) => {
    if (term.length < 2) { setDelegateOptions([]); return; }
    setDelegateSearching(true);
    try {
      const res = await api.get(`/users/me/delegation/search?q=${encodeURIComponent(term)}`);
      setDelegateOptions(res.data.data || []);
    } catch { /* ignore */ }
    finally { setDelegateSearching(false); }
  };

  const handleDelegateSearch = (value: string) => {
    setDelegateSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => searchDelegates(value), 300);
  };

  const handleDelegateSelect = (delegate: DelegateOption) => {
    setSelectedDelegate(delegate);
    setDelegateSearch('');
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Save OOO settings
      await onSubmit({
        outOfOffice,
        outOfOfficeUntil: outOfOffice && until ? until : undefined,
        outOfOfficeMessage: outOfOffice && message ? message : undefined,
      });

      // Save delegation settings
      await updateDelegation({
        delegationEnabled,
        delegatedToId: delegationEnabled ? (selectedDelegate?.id ?? null) : null,
      });

      onClose();
    } catch {
      // ignore — toast will be handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Out of Office & Delegation Settings"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Out of Office & Delegation</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl text-gray-500">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── OOO Toggle ── */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={outOfOffice}
              onChange={(e) => setOutOfOffice(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="font-semibold text-gray-900 text-sm">Enable Out of Office</p>
              <p className="text-xs text-gray-500">Approvals and assignments will consider your unavailability</p>
            </div>
          </label>

          {/* Date & Message */}
          {outOfOffice && (
            <div className="space-y-3 pl-8 border-l-2 border-amber-200">
              <div>
                <label htmlFor="ooo-until" className="block text-sm font-medium text-gray-700 mb-1">
                  Return Date <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="ooo-until"
                  type="date"
                  value={until}
                  onChange={(e) => setUntil(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div>
                <label htmlFor="ooo-message" className="block text-sm font-medium text-gray-700 mb-1">
                  Auto-Reply Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="ooo-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="I am currently out of office and will respond upon my return."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Delegation ── */}
          <hr className="border-gray-200" />

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={delegationEnabled}
              onChange={(e) => setDelegationEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <p className="font-semibold text-gray-900 text-sm">Delegate Approvals</p>
              <p className="text-xs text-gray-500">Route your pending approvals to another person while you're away</p>
            </div>
          </label>

          {delegationEnabled && (
            <div className="pl-8 border-l-2 border-blue-200 space-y-3">
              {/* Selected Delegate Chip */}
              {selectedDelegate && (
                <div className="flex items-center gap-2 bg-brand-50 text-brand-800 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium">{selectedDelegate.firstName} {selectedDelegate.lastName}</span>
                  <span className="text-brand-500">({selectedDelegate.email})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDelegate(null)}
                    className="ml-auto p-0.5 hover:bg-brand-100 rounded-full transition-colors"
                    aria-label="Remove delegate"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              )}

              {/* Delegate Search */}
              <div className="relative" ref={dropdownRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {selectedDelegate ? 'Change Delegate' : 'Select Delegate'}
                </label>
                <input
                  type="text"
                  value={delegateSearch}
                  onChange={(e) => { handleDelegateSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => { if (delegateOptions.length > 0) setShowDropdown(true); }}
                  placeholder="Search by name or email..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
                {delegateSearching && (
                  <div className="absolute right-3 top-[38px]">
                    <span className="material-symbols-outlined text-lg text-gray-400 animate-spin">progress_activity</span>
                  </div>
                )}
                {showDropdown && delegateOptions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {delegateOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleDelegateSelect(opt)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                      >
                        <span className="font-medium text-gray-900">{opt.firstName} {opt.lastName}</span>
                        <span className="text-gray-500 text-xs">{opt.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {outOfOffice && !delegationEnabled && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Consider enabling delegation while out of office so approvals aren't delayed.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OutOfOfficeModal;
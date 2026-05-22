import React, { useState } from 'react';

interface OutOfOfficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  isCurrentlyOOO: boolean;
  currentUntil?: string | null;
  currentMessage?: string | null;
  onSubmit: (data: { outOfOffice: boolean; outOfOfficeUntil?: string; outOfOfficeMessage?: string }) => Promise<void>;
}

const OutOfOfficeModal: React.FC<OutOfOfficeModalProps> = ({
  isOpen,
  onClose,
  isCurrentlyOOO,
  currentUntil,
  currentMessage,
  onSubmit,
}) => {
  const [outOfOffice, setOutOfOffice] = useState(isCurrentlyOOO);
  const [until, setUntil] = useState(currentUntil ? currentUntil.slice(0, 10) : '');
  const [message, setMessage] = useState(currentMessage || '');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        outOfOffice,
        outOfOfficeUntil: outOfOffice && until ? until : undefined,
        outOfOfficeMessage: outOfOffice && message ? message : undefined,
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
        className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Out of Office Settings"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Out of Office</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl text-gray-500">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle */}
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

          {/* Date & Message — only shown when OOO is enabled */}
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
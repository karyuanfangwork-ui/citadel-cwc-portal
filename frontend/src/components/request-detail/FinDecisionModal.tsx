import React, { useState } from 'react';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Props {
  title: string;
  subtitle: string;
  onDecision: (decision: 'APPROVED' | 'REJECTED', comments?: string) => Promise<void>;
  onClose: () => void;
}

const FinDecisionModal: React.FC<Props> = ({ title, subtitle, onDecision, onClose }) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | ''>('');
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const isValid = decision !== '' && (decision === 'APPROVED' || comments.trim() !== '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision || !isValid) return;
    try {
      setSubmitting(true);
      setError(null);
      await onDecision(decision, comments || undefined);
      onClose(); // Close modal after successful submission
    } catch (err: any) {
      setError(err.message || 'Failed to submit decision');
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#0052cc]">gavel</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">{title}</h2>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Decision <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['APPROVED', 'REJECTED'] as const).map(d => (
                    <label
                      key={d}
                      className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        decision === d
                          ? d === 'APPROVED' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="decision"
                        value={d}
                        checked={decision === d}
                        onChange={() => setDecision(d)}
                        className="accent-[#0052cc] w-4 h-4 flex-shrink-0"
                      />
                      <span className={`text-sm font-bold ${d === 'APPROVED' ? 'text-green-700' : 'text-red-700'}`}>
                        {d === 'APPROVED' ? 'Approve' : 'Reject'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Comments {decision === 'REJECTED' && <span className="text-red-500">*</span>}
                  {decision !== 'REJECTED' && <span className="font-normal normal-case text-gray-400">(optional)</span>}
                </label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={3}
                  placeholder={decision === 'REJECTED' ? 'Reason for rejection (required)…' : 'Any comments for the Finance team…'}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                  required={decision === 'REJECTED'}
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || submitting}
                className={`px-4 py-3 text-sm font-bold text-white rounded-lg disabled:opacity-50 ${
                  decision === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {submitting ? 'Submitting…' : decision === 'REJECTED' ? 'Reject' : 'Approve'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default FinDecisionModal;
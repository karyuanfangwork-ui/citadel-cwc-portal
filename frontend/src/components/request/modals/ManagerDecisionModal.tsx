import React, { useState } from 'react';
import ModalWrapper from '../../ModalWrapper';

interface CandidateResume {
  id: string;
  candidateName?: string;
  fileName: string;
}

interface ManagerDecisionModalProps {
  isOpen: boolean;
  processingAction: boolean;
  resumes: CandidateResume[];
  onClose: () => void;
  onSubmit: (decision: 'APPROVED' | 'REJECTED', selectedCandidateIds: string[], comments: string) => Promise<void>;
}

const MAX_CANDIDATES = 3;

const ManagerDecisionModal: React.FC<ManagerDecisionModalProps> = ({
  isOpen,
  processingAction,
  resumes,
  onClose,
  onSubmit,
}) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | ''>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comments, setComments] = useState('');

  const handleToggleCandidate = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(cid => cid !== id);
      }
      if (prev.length >= MAX_CANDIDATES) return prev;
      return [...prev, id];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    if (decision === 'APPROVED' && selectedIds.length === 0) return;
    onSubmit(decision as 'APPROVED' | 'REJECTED', selectedIds, comments);
  };

  const isValid = decision && (decision === 'REJECTED' || selectedIds.length > 0);

  return (
    <ModalWrapper open={isOpen} onClose={onClose} title="Manager Decision" maxWidth="672px">
      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          {/* Candidate Selection — only shown when approving */}
          {resumes.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-[#44546f] mb-2">
                Select Candidates for Interview
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (Choose 1–{MAX_CANDIDATES} candidates)
                </span>
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {resumes.map((resume) => {
                  const checked = selectedIds.includes(resume.id);
                  const disabled = !checked && selectedIds.length >= MAX_CANDIDATES;
                  return (
                    <label
                      key={resume.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        checked
                          ? 'bg-blue-50 border border-blue-200'
                          : disabled
                          ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'bg-white border border-gray-100 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-[#0052cc] focus:ring-[#0052cc]"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => handleToggleCandidate(resume.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#101418] truncate">
                          {resume.candidateName || resume.fileName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{resume.fileName}</p>
                      </div>
                      {checked && (
                        <span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {selectedIds.length > 0 && (
                <p className="mt-2 text-xs text-blue-600 font-medium">
                  {selectedIds.length} of {MAX_CANDIDATES} selected
                </p>
              )}
              {decision === 'APPROVED' && selectedIds.length === 0 && (
                <p className="mt-2 text-xs text-red-500 font-medium">
                  Please select at least 1 candidate to approve.
                </p>
              )}
            </div>
          )}

          {/* Decision */}
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">
              Decision *
            </label>
            <select
              value={decision}
              onChange={e => {
                const val = e.target.value as 'APPROVED' | 'REJECTED' | '';
                setDecision(val);
                if (val === 'REJECTED') setSelectedIds([]);
              }}
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            >
              <option value="">Select decision...</option>
              <option value="APPROVED">Approve Selection</option>
              <option value="REJECTED">Request More Candidates</option>
            </select>
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">
              Comments
            </label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={4}
              placeholder="Add your feedback..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={processingAction || !isValid}
            className="flex-1 px-6 py-3 text-sm font-bold text-white bg-[#0052cc] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {processingAction ? 'Processing...' : 'Submit Decision'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default ManagerDecisionModal;
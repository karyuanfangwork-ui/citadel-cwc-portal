import React, { useState, useMemo } from 'react';
import ModalWrapper from '../../ModalWrapper';

interface CandidateDoc {
  id: string;
  fileName: string;
  documentType?: string;
}

interface Candidate {
  id: string;
  fullName: string;
  documents: CandidateDoc[];
}

interface ManagerDecisionModalProps {
  isOpen: boolean;
  processingAction: boolean;
  candidates: Candidate[];
  onClose: () => void;
  onSubmit: (decision: 'APPROVED' | 'REJECTED', selectedCandidateIds: string[], comments: string) => Promise<void>;
}

const MAX_CANDIDATES = 3;

const REQUIRED_DOC_TYPES = ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'];

const ManagerDecisionModal: React.FC<ManagerDecisionModalProps> = ({
  isOpen,
  processingAction,
  candidates,
  onClose,
  onSubmit,
}) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | ''>('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [comments, setComments] = useState('');

  const handleToggleCandidate = (id: string) => {
    setSelectedCandidateIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(n => n !== id);
      }
      if (prev.length >= MAX_CANDIDATES) return prev;
      return [...prev, id];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    if (decision === 'APPROVED' && selectedCandidateIds.length === 0) return;
    onSubmit(decision as 'APPROVED' | 'REJECTED', selectedCandidateIds, comments);
  };

  const isValid = decision && (decision === 'REJECTED' || selectedCandidateIds.length > 0);

  return (
    <ModalWrapper open={isOpen} onClose={onClose} title="Manager Decision" maxWidth="672px">
      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          {/* Candidate Selection — from Candidate model */}
          {candidates.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-[#44546f] mb-2">
                Select Candidates for Interview
                <span className="ml-2 text-xs font-normal text-gray-500">
                  (Choose 1–{Math.min(MAX_CANDIDATES, candidates.length)} candidate{candidates.length > 1 ? 's' : ''})
                </span>
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {candidates.map((candidate) => {
                  const checked = selectedCandidateIds.includes(candidate.id);
                  const disabled = !checked && selectedCandidateIds.length >= MAX_CANDIDATES;
                  const docTypesSet = new Set(candidate.documents.map(d => d.documentType || 'RESUME'));
                  const isComplete = REQUIRED_DOC_TYPES.every(t => docTypesSet.has(t));
                  const fileNames = candidate.documents.map(d => d.fileName);

                  return (
                    <label
                      key={candidate.id}
                      className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                        checked
                          ? 'bg-blue-50 border border-blue-200'
                          : disabled
                          ? 'bg-gray-50 opacity-50 cursor-not-allowed'
                          : 'bg-white border border-gray-100 hover:bg-gray-50 cursor-pointer'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#0052cc] focus:ring-[#0052cc]"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => handleToggleCandidate(candidate.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#101418] truncate">
                            {candidate.fullName}
                          </p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {candidate.documents.length} doc{candidate.documents.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {fileNames.length > 0 ? fileNames.join(', ') : 'No documents'}
                        </p>
                      </div>
                      {checked && (
                        <span className="material-symbols-outlined text-blue-600 text-lg">check_circle</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {selectedCandidateIds.length > 0 && (
                <p className="mt-2 text-xs text-blue-600 font-medium">
                  {selectedCandidateIds.length} candidate{selectedCandidateIds.length > 1 ? 's' : ''} selected
                </p>
              )}
              {decision === 'APPROVED' && selectedCandidateIds.length === 0 && (
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
                if (val === 'REJECTED') setSelectedCandidateIds([]);
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
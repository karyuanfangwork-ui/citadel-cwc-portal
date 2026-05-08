import React from 'react';
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
  onSubmit: (decision: 'APPROVED' | 'REJECTED', selectedCandidateId: string, comments: string) => Promise<void>;
}

const ManagerDecisionModal: React.FC<ManagerDecisionModalProps> = ({
  isOpen,
  processingAction,
  resumes,
  onClose,
  onSubmit,
}) => {
  return (
    <ModalWrapper open={isOpen} onClose={onClose} title="Manager Decision" maxWidth="672px">
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const decision = formData.get('decision') as 'APPROVED' | 'REJECTED';
        const selectedCandidateId = formData.get('selectedCandidate') as string;
        const comments = formData.get('comments') as string;
        onSubmit(decision, selectedCandidateId, comments);
      }}>
        <div className="space-y-4">
          {resumes.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-[#44546f] mb-2">
                Select Candidate (if approving)
              </label>
              <select
                name="selectedCandidate"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              >
                <option value="">-- Select a candidate --</option>
                {resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.candidateName || resume.fileName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">
              Decision *
            </label>
            <select
              name="decision"
              required
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            >
              <option value="">Select decision...</option>
              <option value="APPROVED">Approve Selection</option>
              <option value="REJECTED">Request More Candidates</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">
              Comments
            </label>
            <textarea
              name="comments"
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
            disabled={processingAction}
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
// frontend/src/components/request-detail/ManagerDecisionModal.tsx
import React, { useState, useEffect } from 'react';
import approvalService, { CandidateResume } from '../../services/approval.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface ManagerDecisionModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const ManagerDecisionModal: React.FC<ManagerDecisionModalProps> = ({
  requestId,
  onSuccess,
  onClose,
}) => {
  const [resumes, setResumes] = useState<CandidateResume[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [comments, setComments] = useState('');
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  useEffect(() => {
    const loadResumes = async () => {
      try {
        setLoadingResumes(true);
        const data = await approvalService.getResumes(requestId);
        setResumes(data);
        if (data.length === 1) {
          setSelectedCandidateId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to load candidate resumes:', err);
      } finally {
        setLoadingResumes(false);
      }
    };
    loadResumes();
  }, [requestId]);

  const handleApprove = async () => {
    if (!selectedCandidateId) {
      setError('Please select a candidate to approve.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await approvalService.managerDecision(requestId, 'APPROVED', selectedCandidateId, comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to approve candidate');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await approvalService.managerDecision(requestId, 'REJECTED', undefined, comments || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to reject candidates');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-orange-50">
          <div className="size-9 rounded-lg bg-orange-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-orange-600">rate_review</span>
          </div>
          <div>
            <h2 className="font-bold text-base text-gray-900">Review Candidates</h2>
            <p className="text-xs text-gray-500">HR Hiring · Manager Decision Required</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Candidate List */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              Select Candidate to Approve
            </label>
            {loadingResumes ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
              </div>
            ) : resumes.length === 0 ? (
              <p className="text-sm text-gray-400 italic bg-gray-50 rounded-lg p-4 text-center">
                No candidate resumes have been uploaded yet.
              </p>
            ) : (
              <div className="space-y-2">
                {resumes.map(resume => (
                  <label
                    key={resume.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      selectedCandidateId === resume.id
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="candidate"
                      value={resume.id}
                      checked={selectedCandidateId === resume.id}
                      onChange={() => setSelectedCandidateId(resume.id)}
                      className="accent-orange-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {resume.candidateName || resume.fileName}
                      </p>
                      {resume.candidateName && (
                        <p className="text-xs text-gray-400 truncate">{resume.fileName}</p>
                      )}
                      {resume.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{resume.notes}</p>
                      )}
                    </div>
                    <span className="material-symbols-outlined text-gray-400 text-sm shrink-0">description</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
              Comments <span className="font-normal normal-case text-gray-400">(optional)</span>
            </label>
            <textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={3}
              placeholder="Add notes for the HR team…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-orange-400 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={submitting}
            className="px-4 py-3 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Rejecting…' : 'Reject All'}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting || !selectedCandidateId}
            className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? 'Approving…' : 'Approve Selected'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default ManagerDecisionModal;

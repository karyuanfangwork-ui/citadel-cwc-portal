import React, { useState, useEffect } from 'react';
import itWorkflowService from '../../../services/it-workflow.service';

interface CTOUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CEODecisionModalProps {
  isOpen: boolean;
  processingAction: boolean;
  onClose: () => void;
  onSubmit: (decision: 'APPROVED' | 'REJECTED', comments: string, ctoId?: string) => Promise<void>;
  isITRequest?: boolean;
}

const CEODecisionModal: React.FC<CEODecisionModalProps> = ({
  isOpen,
  processingAction,
  onClose,
  onSubmit,
  isITRequest = false,
}) => {
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | ''>('');
  const [comments, setComments] = useState('');
  const [ctoId, setCtoId] = useState('');
  const [ctoUsers, setCtoUsers] = useState<CTOUser[]>([]);
  const [ctoLoading, setCtoLoading] = useState(false);

  // Fetch CTO users when modal opens for IT request
  useEffect(() => {
    if (isOpen && isITRequest) {
      setCtoLoading(true);
      itWorkflowService.getUsersByRole('CTO')
        .then(users => setCtoUsers(users))
        .catch(() => setCtoUsers([]))
        .finally(() => setCtoLoading(false));
    }
  }, [isOpen, isITRequest]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDecision('');
      setComments('');
      setCtoId('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision) return;
    onSubmit(decision as 'APPROVED' | 'REJECTED', comments, isITRequest && decision === 'APPROVED' ? ctoId : undefined);
  };

  const canSubmit = decision && (!isITRequest || decision === 'REJECTED' || ctoId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-6">CEO Approval Decision</h2>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#44546f] mb-2">
                  Decision *
                </label>
                <select
                  value={decision}
                  required
                  onChange={e => setDecision(e.target.value as 'APPROVED' | 'REJECTED' | '')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="">Select decision...</option>
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                </select>
              </div>

              {/* CTO selector — only shown for IT requests when approving */}
              {isITRequest && decision === 'APPROVED' && (
                <div>
                  <label className="block text-sm font-bold text-[#44546f] mb-2">
                    Assign to CTO *
                  </label>
                  {ctoLoading ? (
                    <div className="w-full px-4 py-2 border border-gray-200 rounded-lg text-gray-400 text-sm">
                      Loading CTO users...
                    </div>
                  ) : ctoUsers.length === 0 ? (
                    <div className="w-full px-4 py-2 border border-red-200 rounded-lg text-red-600 text-sm">
                      No CTO users found. Please create a CTO user first.
                    </div>
                  ) : (
                    <select
                      value={ctoId}
                      required
                      onChange={e => setCtoId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                    >
                      <option value="">Select CTO...</option>
                      {ctoUsers.map(cto => (
                        <option key={cto.id} value={cto.id}>
                          {cto.firstName} {cto.lastName} ({cto.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[#44546f] mb-2">
                  Comments
                </label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  rows={4}
                  placeholder="Add your comments..."
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
                disabled={processingAction || !canSubmit}
                className="flex-1 px-6 py-3 text-sm font-bold text-white bg-[#0052cc] hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {processingAction ? 'Processing...' : 'Submit Decision'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CEODecisionModal;
import React from 'react';

interface CEODecisionModalProps {
  isOpen: boolean;
  processingAction: boolean;
  onClose: () => void;
  onSubmit: (decision: 'APPROVED' | 'REJECTED', comments: string) => Promise<void>;
}

const CEODecisionModal: React.FC<CEODecisionModalProps> = ({
  isOpen,
  processingAction,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-6">CEO Approval Decision</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const decision = formData.get('decision') as 'APPROVED' | 'REJECTED';
            const comments = formData.get('comments') as string;
            onSubmit(decision, comments);
          }}>
            <div className="space-y-4">
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
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#44546f] mb-2">
                  Comments
                </label>
                <textarea
                  name="comments"
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
                disabled={processingAction}
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

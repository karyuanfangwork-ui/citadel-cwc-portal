import React from 'react';

interface RejectionModalProps {
  isOpen: boolean;
  updatingStatus: boolean;
  onClose: () => void;
  onConfirmReject: () => void;
}

const RejectionModal: React.FC<RejectionModalProps> = ({
  isOpen,
  updatingStatus,
  onClose,
  onConfirmReject,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="size-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl text-red-600">cancel</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#101418] mb-2">Reject this Request?</h2>
              <p className="text-sm text-[#44546f]">
                You are about to mark this request as <span className="font-bold text-red-600">REJECTED</span>.
                This action cannot be easily undone. Are you sure?
              </p>
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={onClose}
              disabled={updatingStatus}
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              className="px-6 py-2.5 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-lg transition-colors"
              onClick={onClose}
              disabled={updatingStatus}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-6 py-2.5 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={onConfirmReject}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                  Rejecting...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">cancel</span>
                  Confirm Reject
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RejectionModal;

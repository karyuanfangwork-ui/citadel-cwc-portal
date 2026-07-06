import React from 'react';
import ModalWrapper from '../../ModalWrapper';

interface RejectionModalProps {
  isOpen: boolean;
  updatingStatus: boolean;
  rejectionComment: string;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onConfirmReject: () => void;
}

const RejectionModal: React.FC<RejectionModalProps> = ({
  isOpen,
  updatingStatus,
  rejectionComment,
  onCommentChange,
  onClose,
  onConfirmReject,
}) => {
  const trimmed = rejectionComment.trim();

  return (
    <ModalWrapper open={isOpen} onClose={onClose} title="Reject Request" maxWidth="448px">
      <div className="flex items-start gap-4 mb-4">
        <div className="size-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-2xl text-red-600">cancel</span>
        </div>
        <div className="flex-1">
          <p className="text-sm text-[#44546f]">
            You are about to mark this request as <span className="font-bold text-red-600">REJECTED</span>.
            This action cannot be easily undone. Are you sure?
          </p>
        </div>
      </div>
      <div className="mb-6">
        <label htmlFor="rejection-reason" className="block text-sm font-bold text-[#1a2b4c] mb-2">
          Reason for rejection <span className="text-red-600">*</span>
        </label>
        <textarea
          id="rejection-reason"
          className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          rows={3}
          placeholder="Explain why this request is being rejected..."
          value={rejectionComment}
          onChange={(e) => onCommentChange(e.target.value)}
          disabled={updatingStatus}
        />
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
          disabled={updatingStatus || !trimmed}
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
    </ModalWrapper>
  );
};

export default RejectionModal;
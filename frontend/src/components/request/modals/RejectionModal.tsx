import React from 'react';
import ModalWrapper from '../../ModalWrapper';

const COPY = {
  reject: {
    title: 'Reject Request',
    statusLabel: 'REJECTED',
    sentence: 'You are about to mark this request as',
    reasonLabel: 'Reason for rejection',
    placeholder: 'Explain why this request is being rejected...',
    confirmLabel: 'Confirm Reject',
    confirmingLabel: 'Rejecting...',
    icon: 'cancel',
    color: 'red',
  },
  cancel: {
    title: 'Cancel Request',
    statusLabel: 'CANCELLED',
    sentence: 'You are about to mark this request as',
    reasonLabel: 'Reason for cancellation',
    placeholder: 'e.g. Submitted in error, duplicate ticket, no longer needed...',
    confirmLabel: 'Confirm Cancel',
    confirmingLabel: 'Cancelling...',
    icon: 'block',
    color: 'gray',
  },
} as const;

interface RejectionModalProps {
  isOpen: boolean;
  mode: 'reject' | 'cancel';
  updatingStatus: boolean;
  rejectionComment: string;
  onCommentChange: (value: string) => void;
  onClose: () => void;
  onConfirmReject: () => void;
}

const RejectionModal: React.FC<RejectionModalProps> = ({
  isOpen,
  mode,
  updatingStatus,
  rejectionComment,
  onCommentChange,
  onClose,
  onConfirmReject,
}) => {
  const copy = COPY[mode];
  const trimmed = rejectionComment.trim();
  const isRed = copy.color === 'red';

  return (
    <ModalWrapper open={isOpen} onClose={onClose} title={copy.title} maxWidth="448px">
      <div className="flex items-start gap-4 mb-4">
        <div className={`size-12 rounded-full ${isRed ? 'bg-red-100' : 'bg-gray-100'} flex items-center justify-center shrink-0`}>
          <span className={`material-symbols-outlined text-2xl ${isRed ? 'text-red-600' : 'text-gray-600'}`}>{copy.icon}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm text-[#44546f]">
            {copy.sentence} <span className={`font-bold ${isRed ? 'text-red-600' : 'text-gray-700'}`}>{copy.statusLabel}</span>.
            This action cannot be easily undone. Are you sure?
          </p>
        </div>
      </div>
      <div className="mb-6">
        <label htmlFor="rejection-reason" className="block text-sm font-bold text-[#1a2b4c] mb-2">
          {copy.reasonLabel} <span className="text-red-600">*</span>
        </label>
        <textarea
          id="rejection-reason"
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          rows={3}
          placeholder={copy.placeholder}
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
          className={`px-6 py-2.5 ${isRed ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'} text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          onClick={onConfirmReject}
          disabled={updatingStatus || !trimmed}
        >
          {updatingStatus ? (
            <>
              <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
              {copy.confirmingLabel}
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">{copy.icon}</span>
              {copy.confirmLabel}
            </>
          )}
        </button>
      </div>
    </ModalWrapper>
  );
};

export default RejectionModal;
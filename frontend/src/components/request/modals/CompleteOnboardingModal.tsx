import React from 'react';

interface CompleteOnboardingModalProps {
  isOpen: boolean;
  processingAction: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const CompleteOnboardingModal: React.FC<CompleteOnboardingModalProps> = ({
  isOpen,
  processingAction,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="size-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl text-green-600">task_alt</span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-[#101418] mb-2">Complete Onboarding?</h2>
              <p className="text-sm text-[#44546f]">
                You are about to mark this onboarding as <span className="font-bold text-green-600">COMPLETED</span> and close the ticket.
                All tasks have been verified as done.
              </p>
              <p className="text-sm text-[#44546f] mt-2">This action cannot be undone. Please confirm.</p>
            </div>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={onClose}
              disabled={processingAction}
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              className="px-6 py-2.5 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-lg transition-colors"
              onClick={onClose}
              disabled={processingAction}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              onClick={onConfirm}
              disabled={processingAction}
            >
              {processingAction ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                  Completing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  Yes, Complete Onboarding
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteOnboardingModal;

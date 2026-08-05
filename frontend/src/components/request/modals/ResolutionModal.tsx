import React from 'react';
import ModalWrapper from '../../ModalWrapper';

interface ResolutionModalProps {
  isOpen: boolean;
  resolutionComment: string;
  updatingStatus: boolean;
  onClose: () => void;
  onCommentChange: (comment: string) => void;
  onSkipResolution: () => void;
  onSubmitResolution: () => void;
}

const ResolutionModal: React.FC<ResolutionModalProps> = ({
  isOpen,
  resolutionComment,
  updatingStatus,
  onClose,
  onCommentChange,
  onSkipResolution,
  onSubmitResolution,
}) => {
  return (
    <ModalWrapper open={isOpen} onClose={onClose} title="Resolve Request" maxWidth="672px">
      {/* Context */}
      <div className="flex items-start gap-4 mb-6">
        <div className="size-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-2xl text-green-600">check_circle</span>
        </div>
        <p className="text-sm text-[#44546f]">
          You're about to mark this request as <span className="font-bold text-green-600">RESOLVED</span>.
          Please document what was done to resolve this issue.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-600 text-lg shrink-0">info</span>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">Why add a resolution comment?</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Helps the requester understand what was done</li>
              <li>Creates a record for future reference</li>
              <li>Improves knowledge base for similar issues</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Resolution Comment Textarea */}
      <div className="mb-6">
        <label className="block text-sm font-bold text-[#101418] mb-3">
          Resolution Details <span className="text-[#44546f] font-normal">(Recommended)</span>
        </label>
        <textarea
          className="w-full p-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none resize-none"
          rows={6}
          placeholder="Example: Reviewed and processed the request. All required steps have been completed and the requester has been notified. No further action needed."
          value={resolutionComment}
          onChange={(e) => onCommentChange(e.target.value)}
          disabled={updatingStatus}
        ></textarea>
        <p className="text-xs text-[#44546f] mt-2">
          Include: actions taken, outcome, any next steps, and relevant reference numbers
        </p>
      </div>

      {/* Action Buttons */}
      <div className="border-t border-gray-100 pt-5">
        <p className="text-xs text-[#44546f] mb-3">
          Choose how you want to finish this request:
        </p>
        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 sm:justify-end">
        <button
          type="button"
          className="px-4 py-2.5 text-sm font-bold text-[#44546f] hover:bg-gray-100 rounded-lg transition-colors"
          onClick={onClose}
          disabled={updatingStatus}
        >
          Keep Request Open
        </button>
        <button
          type="button"
          className="px-4 py-2.5 text-sm font-bold text-[#44546f] border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          onClick={onSkipResolution}
          disabled={updatingStatus}
        >
          Resolve Without Comment
        </button>
        <button
          type="button"
          className="px-4 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={onSubmitResolution}
          disabled={updatingStatus}
        >
          {updatingStatus ? (
            <>
              <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
              Resolving...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">check</span>
              Resolve With Comment
            </>
          )}
        </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default ResolutionModal;
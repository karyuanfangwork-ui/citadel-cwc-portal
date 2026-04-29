import React from 'react';
import ModalWrapper from '../../ModalWrapper';

interface LOAApprovalModalProps {
  isOpen: boolean;
  processingAction: boolean;
  onClose: () => void;
  onSubmit: (decision: 'APPROVE' | 'REJECT', comments: string) => Promise<void>;
}

const LOAApprovalModal: React.FC<LOAApprovalModalProps> = ({
  isOpen,
  processingAction,
  onClose,
  onSubmit,
}) => {
  return (
    <ModalWrapper open={isOpen} onClose={onClose} title="LOA Approval" maxWidth="512px">
      <p className="text-sm text-gray-600 mb-6">Review the draft LOA and provide your decision.</p>
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const decision = formData.get('decision') as 'APPROVE' | 'REJECT';
        const comments = formData.get('comments') as string;
        onSubmit(decision, comments);
      }}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">Decision *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 font-semibold">
                <input type="radio" name="decision" value="APPROVE" required /> Approve
              </label>
              <label className="flex items-center gap-2 font-semibold">
                <input type="radio" name="decision" value="REJECT" required /> Reject
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">Comments</label>
            <textarea name="comments" rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none" placeholder="Feedback for HR..." />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
          <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-emerald-600 rounded-lg">Submit Decision</button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default LOAApprovalModal;
import React from 'react';

interface InterviewFeedbackModalProps {
  isOpen: boolean;
  processingAction: boolean;
  onClose: () => void;
  onSubmit: (data: {
    decision: string;
    feedback: string;
    overallRating: number;
    technicalSkills: number;
    culturalFit: number;
    communication: number;
  }) => Promise<void>;
}

const InterviewFeedbackModal: React.FC<InterviewFeedbackModalProps> = ({
  isOpen,
  processingAction,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-y-auto max-h-[90vh]">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-6">Interview Feedback</h2>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            onSubmit({
              decision: formData.get('decision') as string,
              feedback: formData.get('feedback') as string,
              overallRating: parseInt(formData.get('overallRating') as string) || 3,
              technicalSkills: parseInt(formData.get('technicalSkills') as string) || 3,
              culturalFit: parseInt(formData.get('culturalFit') as string) || 3,
              communication: parseInt(formData.get('communication') as string) || 3,
            });
          }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#44546f] mb-2">Final Decision *</label>
                <select name="decision" required className="w-full px-4 py-2 border border-gray-200 rounded-lg">
                  <option value="PROCEED">Proceed to Screening</option>
                  <option value="REJECT">Reject Candidate</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#44546f] mb-2">Technical Skills (1-5)</label>
                  <input type="number" name="technicalSkills" min="1" max="5" defaultValue="3" className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#44546f] mb-2">Cultural Fit (1-5)</label>
                  <input type="number" name="culturalFit" min="1" max="5" defaultValue="3" className="w-full px-4 py-2 border border-gray-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#44546f] mb-2">Overall Feedback *</label>
                <textarea name="feedback" required rows={4} className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={onClose} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg">Submit Feedback</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InterviewFeedbackModal;

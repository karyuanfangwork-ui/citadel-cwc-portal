import React from 'react';
import ModalWrapper from '../../ModalWrapper';

interface InterviewSchedule {
  interviewDate: string;
  interviewTime: string;
  meetingLink?: string;
  location?: string;
  interviewers: string[];
  notes?: string;
}

interface InterviewFeedback {
  decision?: string;
  feedback?: string;
  overallRating?: number;
  technicalSkills?: number;
  culturalFit?: number;
  communication?: number;
}

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  processingAction: boolean;
  requestId: string;
  onClose: () => void;
  onSubmit: (data: {
    interviewDate: string;
    interviewTime: string;
    location: string;
    meetingLink: string;
    interviewers: string[];
    notes: string;
  }) => Promise<void>;
}

const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({
  isOpen,
  processingAction,
  onClose,
  onSubmit,
}) => {
  return (
    <ModalWrapper open={isOpen} onClose={onClose} title="Schedule Interview" maxWidth="512px">
      <p className="text-sm text-[#44546f] mb-6">Set up the interview date, time, and panel members.</p>
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSubmit({
          interviewDate: formData.get('interviewDate') as string,
          interviewTime: formData.get('interviewTime') as string,
          location: formData.get('location') as string,
          meetingLink: formData.get('meetingLink') as string,
          interviewers: (formData.get('interviewers') as string).split(',').map(i => i.trim()).filter(Boolean),
          notes: formData.get('notes') as string,
        });
      }}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#44546f] mb-2">Date *</label>
              <input
                type="date" name="interviewDate" required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#44546f] mb-2">Time *</label>
              <input
                type="time" name="interviewTime" required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">Interviewers (comma separated) *</label>
            <input
              type="text" name="interviewers" required
              placeholder="e.g. Jane Smith, Robert Brown"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">Microsoft Teams / Meeting Link</label>
            <input
              type="url" name="meetingLink"
              placeholder="https://teams.microsoft.com/..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">Physical Location</label>
            <input
              type="text" name="location"
              placeholder="e.g. Meeting Room A, Level 3"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">Notes</label>
            <textarea
              name="notes" rows={2}
              placeholder="Any notes for the candidate or panel..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
          <button type="submit" disabled={processingAction} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg">
            {processingAction ? 'Scheduling...' : 'Schedule Interview'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default ScheduleInterviewModal;
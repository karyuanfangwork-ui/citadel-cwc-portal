import React, { useState } from 'react';
import ModalWrapper from '../../ModalWrapper';

interface CandidateOption {
  id: string;
  candidateName: string;
  documentCount: number;
}

/** Generate 30-min interval slots from 8:00 AM to 6:00 PM */
const TIME_SLOTS: { label: string; value: string }[] = [];
for (let h = 8; h <= 18; h++) {
  for (const m of [0, 30]) {
    if (h === 18 && m === 30) break;
    const period = h < 12 ? 'AM' : 'PM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    TIME_SLOTS.push({
      label: `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`,
      value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    });
  }
}

interface ScheduleInterviewModalProps {
  isOpen: boolean;
  processingAction: boolean;
  requestId: string;
  candidates: CandidateOption[];
  onClose: () => void;
  onSubmit: (data: {
    candidateId: string;
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
  candidates,
  onClose,
  onSubmit,
}) => {
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // Reset when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCandidateId(candidates.length === 1 ? candidates[0].id : '');
      setSelectedTime('');
    }
  }, [isOpen, candidates]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const interviewDate = (formData.get('interviewDate') as string) || '';
    if (!selectedCandidateId || !selectedTime || !interviewDate) return;
    onSubmit({
      candidateId: selectedCandidateId,
      interviewDate: formData.get('interviewDate') as string,
      interviewTime: selectedTime,
      location: formData.get('location') as string,
      meetingLink: formData.get('meetingLink') as string,
      interviewers: (formData.get('interviewers') as string).split(',').map(i => i.trim()).filter(Boolean),
      notes: formData.get('notes') as string,
    });
  };

  if (!isOpen) return null;

  return (
    <ModalWrapper open={isOpen} onClose={onClose} title="Schedule Interview" maxWidth="512px">
      <p className="text-sm text-[#44546f] mb-6">Set up the interview date, time, and panel members.</p>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* Candidate selector */}
          <div>
            <label className="block text-sm font-bold text-[#44546f] mb-2">Candidate *</label>
            {candidates.length === 0 ? (
              <p className="text-sm text-red-500">No candidates available. Upload resumes first.</p>
            ) : (
              <select
                value={selectedCandidateId}
                onChange={e => setSelectedCandidateId(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-200 rounded-lg appearance-none bg-white"
              >
                <option value="">Select a candidate...</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.candidateName}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-[#44546f] mb-2">Date *</label>
              <div className="relative">
                <input
                  type="date" name="interviewDate" required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg appearance-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#44546f] mb-2">Time *</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#44546f] text-lg pointer-events-none">schedule</span>
                <select
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                  required
                  className="w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg appearance-none bg-white cursor-pointer"
                >
                  <option value="">Select time...</option>
                  {TIME_SLOTS.map(slot => (
                    <option key={slot.value} value={slot.value}>{slot.label}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#8993a4] text-sm pointer-events-none">expand_more</span>
              </div>
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
          <button type="submit" disabled={processingAction || !selectedCandidateId || !selectedTime || candidates.length === 0} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg disabled:opacity-50">
            {processingAction ? 'Scheduling...' : 'Schedule Interview'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
};

export default ScheduleInterviewModal;
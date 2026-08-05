import React, { useState, useEffect } from 'react';

interface InterviewSchedule {
  interviewDate: string;
  interviewTime: string;
  meetingLink?: string;
  location?: string;
  interviewers: string[] | string;
  notes?: string;
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

/** Convert HH:mm 24hr to the closest 30-min slot value */
function toSlotValue(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const snapped = m >= 30 ? 30 : 0;
    return `${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`;
  }
  return '';
}

interface EditInterviewModalProps {
  isOpen: boolean;
  processingAction: boolean;
  interviewDetails: {
    schedule: InterviewSchedule;
    feedback?: any;
  } | null;
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

const EditInterviewModal: React.FC<EditInterviewModalProps> = ({
  isOpen,
  processingAction,
  interviewDetails,
  onClose,
  onSubmit,
}) => {
  const [selectedTime, setSelectedTime] = useState('');

  useEffect(() => {
    if (isOpen && interviewDetails?.schedule?.interviewTime) {
      setSelectedTime(toSlotValue(interviewDetails.schedule.interviewTime));
    }
  }, [isOpen, interviewDetails?.schedule?.interviewTime]);

  if (!isOpen || !interviewDetails?.schedule) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="p-8">
          <h2 className="text-2xl font-bold mb-1">Edit Interview Details</h2>
          <p className="text-sm text-[#44546f] mb-6">Update interview information to fix any errors.</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!selectedTime) return;
            const formData = new FormData(e.currentTarget);
            onSubmit({
              interviewDate: formData.get('interviewDate') as string,
              interviewTime: selectedTime,
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
                    defaultValue={new Date(interviewDetails.schedule.interviewDate).toISOString().split('T')[0]}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg appearance-none"
                  />
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
                  defaultValue={Array.isArray(interviewDetails.schedule.interviewers) ? interviewDetails.schedule.interviewers.join(', ') : String(interviewDetails.schedule.interviewers)}
                  placeholder="e.g. Jane Smith, Robert Brown"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#44546f] mb-2">Microsoft Teams / Meeting Link</label>
                <input
                  type="url" name="meetingLink"
                  defaultValue={interviewDetails.schedule.meetingLink || ''}
                  placeholder="https://teams.microsoft.com/..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#44546f] mb-2">Physical Location</label>
                <input
                  type="text" name="location"
                  defaultValue={interviewDetails.schedule.location || ''}
                  placeholder="e.g. Meeting Room A, Level 3"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#44546f] mb-2">Notes</label>
                <textarea
                  name="notes" rows={2}
                  defaultValue={interviewDetails.schedule.notes || ''}
                  placeholder="Any notes for the candidate or panel..."
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={onClose} className="flex-1 px-6 py-3 text-sm font-bold text-[#44546f] bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={processingAction || !selectedTime} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg disabled:opacity-50">
                {processingAction ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditInterviewModal;
import React, { useState, useEffect, useMemo } from 'react';
import { interviewService } from '../../services/interview.service';
import * as approvalService from '../../services/approval.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface Resume {
  id: string;
  candidateId: string;
  candidateName: string;
  candidate?: { id: string; fullName: string };
}

interface ScheduleInterviewModalProps {
  requestId: string;
  selectedCandidateId?: string;
  selectedCandidateIds?: string[];
  onSuccess: () => void;
  onClose: () => void;
}

const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({
  requestId,
  selectedCandidateId,
  selectedCandidateIds,
  onSuccess,
  onClose,
}) => {
  // Normalize: accept both new array format and legacy single ID
  const preselectedIds = selectedCandidateIds && selectedCandidateIds.length > 0
    ? selectedCandidateIds
    : selectedCandidateId
      ? [selectedCandidateId]
      : [];

  const [resumes, setResumes] = useState<Resume[]>([]);
  const [candidateId, setCandidateId] = useState(preselectedIds[0] || '');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('');
  const [interviewers, setInterviewers] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [location, setLocation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledIds, setScheduledIds] = useState<string[]>([]);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const allDone = preselectedIds.length > 0 && scheduledIds.length >= preselectedIds.length;
  const remainingIds = preselectedIds.filter(id => !scheduledIds.includes(id));

  // Deduplicate resumes by candidateId so each candidate appears once in dropdown
  const uniqueCandidates = useMemo(() => {
    const seen = new Map<string, Resume>();
    for (const r of resumes) {
      // Use candidateId if linked, otherwise fall back to resume id (legacy rows)
      const key = r.candidateId || r.candidate?.id || r.id;
      if (!seen.has(key)) {
        seen.set(key, r);
      }
    }
    return Array.from(seen.values());
  }, [resumes]);

  useEffect(() => {
    approvalService.getResumes(requestId).then(setResumes).catch(() => {});
  }, [requestId]);

  // Auto-select first remaining candidate
  useEffect(() => {
    if (preselectedIds.length > 0 && remainingIds.length > 0 && !candidateId) {
      setCandidateId(remainingIds[0]);
    }
  }, [preselectedIds, remainingIds, candidateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) {
      setError('Please select a candidate');
      return;
    }
    if (!interviewDate) {
      setError('Please select an interview date');
      return;
    }
    if (!interviewTime) {
      setError('Please select an interview time');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await interviewService.scheduleInterview(requestId, {
        candidateId,
        interviewDate,
        interviewTime,
        location: location || undefined,
        meetingLink: meetingLink || undefined,
        interviewers: interviewers.split(',').map(i => i.trim()).filter(Boolean),
      });

      if (preselectedIds.length > 1) {
        // Multi-candidate mode: mark this one as scheduled, continue with next
        setScheduledIds(prev => [...prev, candidateId]);
        const nextId = remainingIds.find(id => id !== candidateId);
        if (nextId) {
          setCandidateId(nextId);
          setInterviewDate('');
          setInterviewTime('');
        } else {
          // All done
          onSuccess();
        }
      } else {
        // Single candidate mode — just close
        onSuccess();
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to schedule interview';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Resolve the stable candidate ID from a resume row */
  const candId = (r: Resume) => r.candidateId || r.candidate?.id || r.id;

  const candidateLabel = (r: Resume) => {
    const id = candId(r);
    const isPreselected = preselectedIds.includes(id);
    const isScheduled = scheduledIds.includes(id);
    const displayName = r.candidate?.fullName || r.candidateName || 'Unknown';
    let suffix = '';
    if (isPreselected && isScheduled) suffix = ' ✅ Scheduled';
    else if (isPreselected) suffix = ' ★ Selected';
    return `${displayName}${suffix}`;
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600">calendar_month</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">
                {preselectedIds.length > 1
                  ? `Schedule Interview (${scheduledIds.length + 1} of ${preselectedIds.length})`
                  : 'Schedule Interview'}
              </h2>
              <p className="text-xs text-gray-500">HR Workflow · Candidate selected by hiring manager</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Progress indicator for multi-candidate scheduling */}
              {preselectedIds.length > 1 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-blue-800">
                    Scheduling interviews for {preselectedIds.length} candidates
                  </p>
                  <div className="flex gap-1.5 mt-2">
                    {preselectedIds.map((id, idx) => {
                      const isScheduled = scheduledIds.includes(id);
                      const isCurrent = id === candidateId;
                      return (
                        <div
                          key={id}
                          className={`h-2 flex-1 rounded-full ${
                            isScheduled ? 'bg-green-500' : isCurrent ? 'bg-blue-500' : 'bg-gray-200'
                          }`}
                          title={uniqueCandidates.find(r => candId(r) === id)?.candidateName || `Candidate ${idx + 1}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Select Candidate <span className="text-red-500">*</span>
                </label>
                <select
                  value={candidateId}
                  onChange={e => setCandidateId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                >
                  <option value="">-- Select --</option>
                  {uniqueCandidates.map(r => {
                    const id = candId(r);
                    return (
                      <option key={id} value={id} disabled={scheduledIds.includes(id)}>
                        {candidateLabel(r)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={interviewDate}
                    onChange={e => setInterviewDate(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg pointer-events-none">schedule</span>
                    <select
                      value={interviewTime}
                      onChange={e => setInterviewTime(e.target.value)}
                      required
                      className="w-full pl-10 pr-8 py-2.5 text-sm border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:border-[#0052cc] cursor-pointer"
                    >
                      <option value="">Select time...</option>
                      {(() => {
                        const slots: { label: string; value: string }[] = [];
                        for (let h = 8; h <= 18; h++) {
                          for (const m of [0, 30]) {
                            if (h === 18 && m === 30) break;
                            const period = h < 12 ? 'AM' : 'PM';
                            const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
                            slots.push({
                              label: `${String(displayHour).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`,
                              value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
                            });
                          }
                        }
                        return slots.map(s => <option key={s.value} value={s.value}>{s.label}</option>);
                      })()}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Interviewers (comma separated) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={interviewers}
                  onChange={e => setInterviewers(e.target.value)}
                  placeholder="e.g. Jane Smith, Robert Brown"
                  required
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Meeting Link <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <input
                  type="url"
                  value={meetingLink}
                  onChange={e => setMeetingLink(e.target.value)}
                  placeholder="https://teams.microsoft.com/..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Physical Location <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Meeting Room A, Level 3"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                {preselectedIds.length > 1 && scheduledIds.length > 0 ? 'Finish' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Scheduling…' : preselectedIds.length > 1 && scheduledIds.length < preselectedIds.length - 1 ? 'Schedule & Next' : 'Schedule Interview'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ScheduleInterviewModal;
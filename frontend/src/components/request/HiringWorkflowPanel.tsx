import React from 'react';
import { isHiringRequest } from '@/src/utils/roleDetection';

interface User {
  id: string;
  roles?: string[];
  firstName: string;
  lastName: string;
}

interface CandidateResume {
  id: string;
  candidateName?: string;
  fileName: string;
  notes?: string;
  uploadedBy: { firstName: string; lastName: string };
  createdAt: string;
  fileSize: string;
  fileUrl?: string;
}

interface InterviewSchedule {
  interviewDate: string;
  interviewTime: string;
  meetingLink?: string;
  location?: string;
  interviewers: string[];
  notes?: string;
}

interface InterviewFeedback {
  decision: string;
  feedback: string;
  overallRating: number;
  technicalSkills: number;
  culturalFit: number;
  communication: number;
}

interface HRScreening {
  backgroundCheckStatus: string;
  backgroundCheckNotes?: string;
  referencesCheckStatus: string;
  referencesCheckNotes?: string;
  referencesContacted?: string[];
  overallStatus?: string;
}

interface LetterOfAcceptance {
  loaFileUrl?: string;
  loaFileName?: string;
  loaFileSize?: number;
  signedLoaFileUrl?: string;
  signedLoaFileName?: string;
  signedLoaFileSize?: number;
  approvalDate?: string;
  acceptedDate?: string;
  approvedBy?: string;
  approvalComments?: string;
}

interface HiringWorkflowPanelProps {
  request: {
    id: string;
    status: string;
    serviceDesk?: { code: string };
    customFields?: Record<string, any>;
  };
  resumes: CandidateResume[];
  interviewDetails: {
    schedule: InterviewSchedule | null;
    feedback: InterviewFeedback | null;
  } | null;
  screeningDetails: HRScreening | null;
  loaDetails: LetterOfAcceptance | null;
  user: User | null;
  onDeleteResume: (resumeId: string) => void;
  onEditInterview: () => void;
  onShowUploadModal: () => void;
}

const HiringWorkflowPanel: React.FC<HiringWorkflowPanelProps> = ({
  request,
  resumes,
  interviewDetails,
  screeningDetails,
  loaDetails,
  user,
  onDeleteResume,
  onEditInterview,
  onShowUploadModal,
}) => {
  const isHiring = isHiringRequest(request.serviceDesk?.code || '', request.status);
  const loaFileUrl = loaDetails?.loaFileUrl || '';

  if (!isHiring) return null;

  return (
    <>
      {/* Candidate Resumes Section */}
      {resumes.length > 0 && (
        <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6">
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-bold text-[#44546f] uppercase tracking-widest">
              Candidate Resumes ({resumes.length})
            </span>
            {request.status === 'JOB_POSTED' && (user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN')) && (
              <button
                onClick={onShowUploadModal}
                className="text-sm font-bold text-[#0052cc] hover:text-blue-700 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add Resume
              </button>
            )}
          </div>
          <div className="space-y-4">
            {resumes.map((resume) => (
              <div key={resume.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="material-symbols-outlined text-[#0052cc] text-2xl">description</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-[#101418]">
                        {resume.candidateName || 'Unnamed Candidate'}
                      </h4>
                      <p className="text-sm text-[#44546f] mt-1">{resume.fileName}</p>
                      {resume.notes && (
                        <p className="text-sm text-[#44546f] mt-2 italic">{resume.notes}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#44546f]">
                        <span>Uploaded by {resume.uploadedBy.firstName} {resume.uploadedBy.lastName}</span>
                        <span>•</span>
                        <span>{new Date(resume.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{(parseInt(resume.fileSize) / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {resume.fileUrl && (
                      <a
                        href={`http://localhost:3000/api/v1/files/download/${loaFileUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#0052cc] hover:bg-gray-50 transition-colors"
                      >
                        View
                      </a>
                    )}
                    {request.status === 'JOB_POSTED' && (user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN')) && (
                      <button
                        onClick={() => onDeleteResume(resume.id)}
                        className="px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selection Information Section */}
      {request.customFields?.selectedCandidateId && (
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm mt-6 bg-gradient-to-r from-blue-50/50 to-transparent">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md">
              <span className="material-symbols-outlined text-2xl">person_check</span>
            </div>
            <div>
              <h3 className="font-bold text-blue-900">Selected Candidate</h3>
              <p className="text-sm text-blue-700 font-medium">
                {request.customFields.selectedCandidateName || 'The candidate'} has been approved for schedule interview.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Interview Details Section */}
      {interviewDetails?.schedule && (
        <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <span className="material-symbols-outlined">calendar_month</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#101418]">Interview Information</h3>
                <p className="text-xs text-[#44546f] uppercase tracking-wider font-semibold">Scheduled Stage</p>
              </div>
            </div>
            {(user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN')) && !interviewDetails?.feedback && (
              <button
                onClick={onEditInterview}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-gray-400 text-xl">event</span>
                <div>
                  <p className="text-xs font-bold text-[#44546f] uppercase">Date & Time</p>
                  <p className="font-semibold text-[#101418]">
                    {new Date(interviewDetails.schedule.interviewDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {interviewDetails.schedule.interviewTime}
                  </p>
                </div>
              </div>

              {interviewDetails.schedule.meetingLink && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-gray-400 text-xl">video_call</span>
                  <div>
                    <p className="text-xs font-bold text-[#44546f] uppercase">Meeting Link</p>
                    <a href={interviewDetails.schedule.meetingLink} target="_blank" rel="noreferrer" className="text-[#0052cc] font-semibold hover:underline flex items-center gap-1">
                      Join Meeting <span className="material-symbols-outlined text-xs">open_in_new</span>
                    </a>
                  </div>
                </div>
              )}
              {interviewDetails.schedule.location && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-gray-400 text-xl">location_on</span>
                  <div>
                    <p className="text-xs font-bold text-[#44546f] uppercase">Location</p>
                    <p className="font-semibold text-[#101418]">{interviewDetails.schedule.location}</p>
                  </div>
                </div>
              )}
              {!interviewDetails.schedule.meetingLink && !interviewDetails.schedule.location && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-gray-400 text-xl">location_on</span>
                  <div>
                    <p className="text-xs font-bold text-[#44546f] uppercase">Location / Link</p>
                    <p className="font-semibold text-[#101418]">N/A</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-gray-400 text-xl">group</span>
                <div>
                  <p className="text-xs font-bold text-[#44546f] uppercase">Interviewers</p>
                  <p className="font-semibold text-[#101418]">
                    {Array.isArray(interviewDetails.schedule.interviewers)
                      ? interviewDetails.schedule.interviewers.join(', ')
                      : String(interviewDetails.schedule.interviewers)}
                  </p>
                </div>
              </div>
              {interviewDetails.schedule.notes && (
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-gray-400 text-xl">notes</span>
                  <div>
                    <p className="text-xs font-bold text-[#44546f] uppercase">Pre-interview Notes</p>
                    <p className="text-sm text-[#44546f]">{interviewDetails.schedule.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interview Feedback Display */}
          {interviewDetails.feedback && (
            <div className="mt-8 pt-8 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-[#101418]">Interview Outcome</h4>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${interviewDetails.feedback.decision === 'PROCEED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                  {interviewDetails.feedback.decision}
                </span>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <p className="text-[#44546f] italic mb-4">"{interviewDetails.feedback.feedback}"</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-[#44546f] uppercase mb-1">Overall</p>
                    <div className="flex text-amber-500">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="material-symbols-outlined text-xs">
                          {i < (interviewDetails.feedback?.overallRating || 0) ? 'star' : 'star_outline'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#44546f] uppercase mb-1">Technical</p>
                    <p className="font-bold text-sm">{interviewDetails.feedback.technicalSkills}/5</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#44546f] uppercase mb-1">Culture</p>
                    <p className="font-bold text-sm">{interviewDetails.feedback.culturalFit}/5</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#44546f] uppercase mb-1">Comm.</p>
                    <p className="font-bold text-sm">{interviewDetails.feedback.communication}/5</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HR Screening Details Section */}
      {screeningDetails && (
        <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined">fact_check</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-[#101418]">HR Screening Status</h3>
              <p className="text-xs text-[#44546f] uppercase tracking-wider font-semibold">Verification Stage</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-[#44546f] uppercase">Background Check</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${screeningDetails.backgroundCheckStatus === 'PASSED' ? 'bg-green-100 text-green-700' :
                    screeningDetails.backgroundCheckStatus === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {screeningDetails.backgroundCheckStatus}
                  </span>
                </div>
                <p className="text-sm text-[#44546f] bg-gray-50 p-3 rounded-lg border border-gray-100">
                  {screeningDetails.backgroundCheckNotes || 'No notes available.'}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-[#44546f] uppercase">References Check</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${screeningDetails.referencesCheckStatus === 'PASSED' ? 'bg-green-100 text-green-700' :
                    screeningDetails.referencesCheckStatus === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {screeningDetails.referencesCheckStatus}
                  </span>
                </div>
                <p className="text-sm text-[#44546f] bg-gray-50 p-3 rounded-lg border border-gray-100 mb-3">
                  {screeningDetails.referencesCheckNotes || 'No notes available.'}
                </p>
                {Array.isArray(screeningDetails.referencesContacted) && screeningDetails.referencesContacted.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-[#44546f] uppercase mb-1">Contacted</p>
                    <div className="flex flex-wrap gap-2">
                      {screeningDetails.referencesContacted.map((ref, idx) => (
                        <span key={idx} className="bg-white border border-gray-200 px-2 py-1 rounded text-xs font-medium text-[#101418]">
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOA Documents Section */}
      {loaDetails && (
        <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined">article</span>
            </div>
            <div>
              <h3 className="font-bold text-lg text-[#101418]">Letter of Acceptance (LOA)</h3>
              <p className="text-xs text-[#44546f] uppercase tracking-wider font-semibold">Final Stage</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Draft LOA */}
            <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="size-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-[#0052cc]">
                  <span className="material-symbols-outlined">description</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#101418]">Draft / Issued LOA</p>
                  <p className="text-xs text-[#44546f]">{loaDetails.loaFileName} • {(loaDetails.loaFileSize / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {loaDetails.approvalDate && (
                  <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">APPROVED</span>
                )}
                {loaDetails.loaFileUrl && (
                  <a
                    href={`http://localhost:3000/api/v1/files/download/${loaDetails.loaFileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#0052cc] hover:bg-gray-50 transition-colors"
                  >
                    View
                  </a>
                )}
              </div>
            </div>

            {/* Signed LOA */}
            {loaDetails.signedLoaFileUrl && (
              <div className="flex items-center justify-between p-4 border border-emerald-100 rounded-xl bg-emerald-50/30">
                <div className="flex items-center gap-4">
                  <div className="size-10 bg-white rounded-lg flex items-center justify-center shadow-sm text-emerald-600 border border-emerald-100">
                    <span className="material-symbols-outlined">ink_pen</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Signed LOA</p>
                    <p className="text-xs text-emerald-700">{loaDetails.signedLoaFileName} • {(loaDetails.signedLoaFileSize ? loaDetails.signedLoaFileSize / 1024 : 0).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {loaDetails.acceptedDate && (
                    <span className="text-[10px] font-bold text-white bg-emerald-600 px-2 py-0.5 rounded">ACCEPTED</span>
                  )}
                  {loaDetails.signedLoaFileUrl && (
                    <a
                      href={`http://localhost:3000/api/v1/files/download/${loaDetails.signedLoaFileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-[#0052cc] hover:bg-gray-50 transition-colors"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Approval Comments */}
          {loaDetails.approvalComments && (
            <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-amber-600 text-sm">comment</span>
                <p className="text-xs font-bold text-amber-800 uppercase">Approval Comments</p>
              </div>
              <p className="text-sm text-amber-900 italic">"{loaDetails.approvalComments}"</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default HiringWorkflowPanel;

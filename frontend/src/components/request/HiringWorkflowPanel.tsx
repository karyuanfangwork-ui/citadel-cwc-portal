import React, { useState, useCallback, lazy, Suspense } from 'react';
import { isHiringRequest } from '@/src/utils/roleDetection';

const UploadResumeModal = lazy(() => import('@/src/components/request-detail/UploadResumeModal'));

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
  documentType?: string;
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
  overallRating?: number;
  technicalSkills?: number;
  culturalFit?: number;
  communication?: number;
  strengths?: string;
  weaknesses?: string;
  recommendation?: 'HIRE' | 'NO_HIRE' | 'MAYBE';
  feedbackNotes?: string;
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

const DOC_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  RESUME: { label: 'Resume', icon: 'description', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  CERTIFICATE: { label: 'Certificates', icon: 'workspace_premium', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  TRANSCRIPT: { label: 'Transcripts', icon: 'school', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

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
  onDocsChanged?: () => void;
  onShowUploadModal?: () => void;
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
  onDocsChanged,
  onShowUploadModal,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const isHiring = isHiringRequest(request.serviceDesk?.code || '', request.status);
  const canUpload = request.status === 'JOB_POSTED' && (user?.roles?.includes('AGENT') || user?.roles?.includes('ADMIN'));
  const DOC_TYPES = ['RESUME', 'CERTIFICATE', 'TRANSCRIPT'];

  // Group resumes by candidate name
  const groupedByCandidate = resumes.reduce<Record<string, CandidateResume[]>>((acc, resume) => {
    const key = resume.candidateName?.trim() || 'Unnamed Candidate';
    if (!acc[key]) acc[key] = [];
    acc[key].push(resume);
    return acc;
  }, {});

  const candidateCount = Object.keys(groupedByCandidate).length;

  const handleUploadSuccess = useCallback(() => {
    setShowUploadModal(false);
    onDocsChanged?.();
  }, [onDocsChanged]);

  if (!isHiring) return null;

  return (
    <>
      {/* Candidate Documents Section */}
      {(resumes.length > 0 || canUpload) && (
        <div className="bg-white p-8 rounded-xl border border-gray-100 mt-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 text-xl">folder_open</span>
              <span className="text-xs font-bold text-[#44546f] uppercase tracking-widest">
                Candidate Documents
                {candidateCount > 0 && (
                  <span className="ml-1.5 text-blue-600">({candidateCount} candidate{candidateCount > 1 ? 's' : ''}, {resumes.length} doc{resumes.length > 1 ? 's' : ''})</span>
                )}
              </span>
            </div>
            {canUpload && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="text-sm font-bold text-[#0052cc] hover:text-blue-700 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Upload Document
              </button>
            )}
          </div>

          {resumes.length === 0 && canUpload && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="material-symbols-outlined text-5xl text-gray-300 mb-3">cloud_upload</span>
              <p className="text-sm font-semibold text-gray-500">No candidate documents yet</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Upload resume, certificates, and transcripts for each candidate (max 5)</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2.5 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">upload_file</span>
                Upload First Document
              </button>
            </div>
          )}

          {Object.entries(groupedByCandidate).map(([candidateName, docs]) => {
            // Track which doc types are present
            const docsByType: Record<string, CandidateResume> = {};
            docs.forEach(d => {
              const dt = d.documentType || 'RESUME';
              if (!docsByType[dt]) docsByType[dt] = d;
            });
            const filledCount = Object.keys(docsByType).length;

            return (
              <div key={candidateName} className="border border-gray-200 rounded-xl overflow-hidden mb-4 last:mb-0">
                {/* Candidate Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#0052cc] text-xl">person</span>
                    <span className="text-sm font-bold text-[#101418]">{candidateName}</span>
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">
                      {filledCount}/{DOC_TYPES.length} docs
                    </span>
                  </div>
                  {canUpload && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="text-xs font-semibold text-[#0052cc] hover:text-blue-700 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add
                    </button>
                  )}
                </div>

                {/* Document Type Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
                  {DOC_TYPES.map(dt => {
                    const doc = docsByType[dt];
                    const config = DOC_TYPE_CONFIG[dt] || DOC_TYPE_CONFIG.RESUME;

                    return (
                      <div
                        key={dt}
                        className={`rounded-lg border-2 border-dashed p-3 transition-all ${
                          doc
                            ? `${config.bg} ${config.border} border-solid`
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className={`material-symbols-outlined text-sm ${doc ? config.color : 'text-gray-400'}`}>
                            {config.icon}
                          </span>
                          <span className={`text-xs font-bold ${doc ? config.color : 'text-gray-400'}`}>
                            {config.label}
                          </span>
                          {!doc && (
                            <span className="material-symbols-outlined text-xs text-gray-300 ml-auto">
                              pending
                            </span>
                          )}
                        </div>

                        {doc ? (
                          <div className="space-y-1.5">
                            <p className="text-sm font-semibold text-[#101418] truncate" title={doc.fileName}>
                              {doc.fileName}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              <span>{(parseInt(doc.fileSize) / 1024).toFixed(1)} KB</span>
                              <span>•</span>
                              <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              {doc.fileUrl && (
                                <a
                                  href={`http://localhost:3000/api/v1/files/download/${doc.fileUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className={`px-2 py-1 text-[10px] font-bold rounded ${config.color} ${config.bg} hover:opacity-80 transition-opacity`}
                                >
                                  View
                                </a>
                              )}
                              {canUpload && (
                                <button
                                  onClick={() => onDeleteResume(doc.id)}
                                  className="px-2 py-1 text-[10px] font-bold rounded text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Not uploaded</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Notes from any doc */}
                {docs.some(d => d.notes) && (
                  <div className="px-4 pb-3">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <span className="text-[10px] font-bold text-gray-500 uppercase">Notes</span>
                      {docs.filter(d => d.notes).map(d => (
                        <p key={d.id} className="text-xs text-gray-600 mt-1">
                          <span className="font-semibold">{(DOC_TYPE_CONFIG[d.documentType || 'RESUME']?.label || 'Resume')}:</span> {d.notes}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal — managed by this component */}
      {showUploadModal && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center"><div className="bg-white rounded-xl p-6 text-sm text-gray-600">Loading...</div></div>}>
          <UploadResumeModal
            requestId={request.id}
            onSuccess={handleUploadSuccess}
            onClose={() => setShowUploadModal(false)}
            existingCandidateNames={Object.keys(groupedByCandidate)}
          />
        </Suspense>
      )}

      {/* Selection Information Section — supports multi-candidate selection */}
      {(request.customFields?.selectedCandidateIds?.length > 0 || request.customFields?.selectedCandidateId) && (
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm mt-6 bg-gradient-to-r from-blue-50/50 to-transparent">
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-md">
              <span className="material-symbols-outlined text-2xl">person_check</span>
            </div>
            <div>
              <h3 className="font-bold text-blue-900">
                {request.customFields?.selectedCandidateIds?.length > 1
                  ? `${request.customFields.selectedCandidateIds.length} Candidates Selected`
                  : 'Selected Candidate'}
              </h3>
              <p className="text-sm text-blue-700 font-medium">
                {request.customFields?.selectedCandidateNames?.length > 0
                  ? `${request.customFields.selectedCandidateNames.join(', ')} approved for interview.`
                  : request.customFields?.selectedCandidateName
                    ? `${request.customFields.selectedCandidateName} has been approved for interview.`
                    : 'Candidates have been approved for interview.'}
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
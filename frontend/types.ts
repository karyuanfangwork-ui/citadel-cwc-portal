
export enum RequestStatus {
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RESOLVED = 'RESOLVED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING = 'WAITING',
  PENDING_CEO_APPROVAL = 'PENDING_CEO_APPROVAL',
  CEO_APPROVED = 'CEO_APPROVED',
  CEO_REJECTED = 'CEO_REJECTED',
  JOB_POSTED = 'JOB_POSTED',
  PENDING_MANAGER_REVIEW = 'PENDING_MANAGER_REVIEW',
  MANAGER_APPROVED = 'MANAGER_APPROVED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEW_FEEDBACK_PENDING = 'INTERVIEW_FEEDBACK_PENDING',
  CANDIDATE_REJECTED_INTERVIEW = 'CANDIDATE_REJECTED_INTERVIEW',
  HR_SCREENING = 'HR_SCREENING',
  LOA_PENDING_APPROVAL = 'LOA_PENDING_APPROVAL',
  LOA_APPROVED = 'LOA_APPROVED',
  LOA_ISSUED = 'LOA_ISSUED',
  LOA_ACCEPTED = 'LOA_ACCEPTED'
}

export enum RequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface RequestItem {
  id: string;
  reference: string;
  summary: string;
  service: string;
  status: RequestStatus;
  updated: string;
  created: string;
  type: 'IT' | 'HR' | 'FINANCE';
  description?: string;
  stakeholders?: string[];
  updates: ActivityItem[];
  // Extended Hiring Workflow fields
  candidateResumes?: CandidateResume[];
  interviewSchedule?: InterviewSchedule;
  interviewFeedback?: InterviewFeedback;
  hrScreening?: HRScreening;
  letterOfAcceptance?: LetterOfAcceptance;
  requesterId?: string;
}

export interface ActivityItem {
  id: string;
  author: string;
  authorRole?: string;
  avatar?: string;
  timestamp: string;
  message: string;
  isSystem?: boolean;
}

export interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CandidateResume {
  id: string;
  requestId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType?: string;
  uploadedById: string;
  candidateName?: string;
  notes?: string;
  createdAt: string;
}

export interface InterviewSchedule {
  id: string;
  requestId: string;
  candidateId: string;
  interviewDate: string;
  interviewTime: string;
  location?: string;
  meetingLink?: string;
  interviewers: string[];
  notes?: string;
  scheduledBy: string;
  scheduledByUser?: UserInfo;
  candidateResume?: { id: string; candidateName: string };
}

export interface InterviewFeedback {
  id: string;
  requestId: string;
  decision: 'PROCEED' | 'REJECT';
  overallRating?: number;
  technicalSkills?: number;
  culturalFit?: number;
  communication?: number;
  feedback: string;
  concerns?: string;
  submittedBy: string;
  submittedByUser?: UserInfo;
}

export interface HRScreening {
  id: string;
  requestId: string;
  backgroundCheckStatus: string;
  backgroundCheckNotes?: string;
  referencesCheckStatus: string;
  referencesCheckNotes?: string;
  referencesContacted?: string[];
  overallStatus: string;
  completedBy?: string;
  completedByUser?: UserInfo;
}

export interface LetterOfAcceptance {
  id: string;
  requestId: string;
  loaFileUrl: string;
  loaFileName: string;
  loaFileSize: number;
  signedLoaFileUrl?: string;
  signedLoaFileName?: string;
  signedLoaFileSize?: number;
  uploadedBy: string;
  approvedBy?: string;
  approvalDate?: string;
  approvalComments?: string;
  issuedDate?: string;
  acceptedDate?: string;
  uploadedByUser?: UserInfo;
  approvedByUser?: UserInfo;
}

export interface ServiceCard {
  title: string;
  description: string;
  icon: string;
  colorClass: string;
  link: string;
  actionText: string;
}

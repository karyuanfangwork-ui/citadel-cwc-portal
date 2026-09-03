
export enum RequestStatus {
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
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
  LOA_ACCEPTED = 'LOA_ACCEPTED',
  COMPLETED = 'COMPLETED',
  // Onboarding Statuses
  ONBOARDING_SUBMITTED = 'ONBOARDING_SUBMITTED',
  ONBOARDING_PENDING_HR_APPROVAL = 'ONBOARDING_PENDING_HR_APPROVAL',
  ONBOARDING_PRE_ARRIVAL_SETUP = 'ONBOARDING_PRE_ARRIVAL_SETUP',
  ONBOARDING_READY_FOR_DAY_1 = 'ONBOARDING_READY_FOR_DAY_1',
  ONBOARDING_DAY_1_ORIENTATION = 'ONBOARDING_DAY_1_ORIENTATION',
  ONBOARDING_WEEK_1_INTEGRATION = 'ONBOARDING_WEEK_1_INTEGRATION',
  ONBOARDING_MONTH_1_MILESTONE = 'ONBOARDING_MONTH_1_MILESTONE',
  ONBOARDING_MONTH_2_MILESTONE = 'ONBOARDING_MONTH_2_MILESTONE',
  ONBOARDING_MONTH_3_MILESTONE = 'ONBOARDING_MONTH_3_MILESTONE',
  ONBOARDING_COMPLETED = 'ONBOARDING_COMPLETED',
  // Offboarding Statuses
  OFFBOARDING_SUBMITTED = 'OFFBOARDING_SUBMITTED',
  OFFBOARDING_NOTICE_PERIOD = 'OFFBOARDING_NOTICE_PERIOD',
  OFFBOARDING_KNOWLEDGE_TRANSFER = 'OFFBOARDING_KNOWLEDGE_TRANSFER',
  OFFBOARDING_FINAL_WEEK = 'OFFBOARDING_FINAL_WEEK',
  OFFBOARDING_EXIT_PROCEDURES = 'OFFBOARDING_EXIT_PROCEDURES',
  OFFBOARDING_COMPLETED = 'OFFBOARDING_COMPLETED',
  // IT Workflow

  PROCUREMENT_IN_PROGRESS = 'PROCUREMENT_IN_PROGRESS',
  HARDWARE_ORDERED = 'HARDWARE_ORDERED',
  HARDWARE_RECEIVED = 'HARDWARE_RECEIVED',
  SOFTWARE_PROVISIONED = 'SOFTWARE_PROVISIONED',
  ACKNOWLEDGED_IT = 'ACKNOWLEDGED_IT',
  PENDING_CEO_APPROVAL_IT = 'PENDING_CEO_APPROVAL_IT',
  CEO_APPROVED_IT = 'CEO_APPROVED_IT',
  CEO_REJECTED_IT = 'CEO_REJECTED_IT',
  PENDING_CTO_APPROVAL_IT = 'PENDING_CTO_APPROVAL_IT',
  CTO_APPROVED_IT = 'CTO_APPROVED_IT',
  CTO_REJECTED_IT = 'CTO_REJECTED_IT',
  PENDING_INVOICE_IT = 'PENDING_INVOICE_IT',
  PENDING_CFO_APPROVAL_IT = 'PENDING_CFO_APPROVAL_IT',
  CFO_APPROVED_IT = 'CFO_APPROVED_IT',
  CFO_REJECTED_IT = 'CFO_REJECTED_IT',
  PAYMENT_PROCESSING_IT = 'PAYMENT_PROCESSING_IT',
  PAYMENT_DONE_IT = 'PAYMENT_DONE_IT',
  PENDING_DELIVERY_IT = 'PENDING_DELIVERY_IT',
  // Finance Workflow
  PENDING_MANAGER_APPROVAL_FIN = 'PENDING_MANAGER_APPROVAL_FIN',
  MANAGER_APPROVED_FIN = 'MANAGER_APPROVED_FIN',
  MANAGER_REJECTED_FIN = 'MANAGER_REJECTED_FIN',
  PENDING_FINANCE_HEAD_APPROVAL = 'PENDING_FINANCE_HEAD_APPROVAL',
  FINANCE_HEAD_APPROVED = 'FINANCE_HEAD_APPROVED',
  FINANCE_HEAD_REJECTED = 'FINANCE_HEAD_REJECTED',
  PAYMENT_PROCESSING = 'PAYMENT_PROCESSING',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  REIMBURSEMENT_CLOSED = 'REIMBURSEMENT_CLOSED',
  // Finance Purchase Requisition
  FINANCE_PENDING_ACK = 'FINANCE_PENDING_ACK',
  FINANCE_ACKNOWLEDGED = 'FINANCE_ACKNOWLEDGED',
  FINANCE_IN_PROGRESS = 'FINANCE_IN_PROGRESS',
  PENDING_CEO_APPROVAL_FIN = 'PENDING_CEO_APPROVAL_FIN',
  CEO_APPROVED_FIN = 'CEO_APPROVED_FIN',
  CEO_REJECTED_FIN = 'CEO_REJECTED_FIN',
  PENDING_CFO_APPROVAL_FIN = 'PENDING_CFO_APPROVAL_FIN',
  CFO_APPROVED_FIN = 'CFO_APPROVED_FIN',
  CFO_REJECTED_FIN = 'CFO_REJECTED_FIN',
  PENDING_GROUP_DCEO_APPROVAL = 'PENDING_GROUP_DCEO_APPROVAL',
  GROUP_DCEO_APPROVED = 'GROUP_DCEO_APPROVED',
  GROUP_DCEO_REJECTED = 'GROUP_DCEO_REJECTED',
  PAYMENT_PROCESSING_FIN = 'PAYMENT_PROCESSING_FIN',
  AWAITING_PAYMENT_CONFIRMATION = 'AWAITING_PAYMENT_CONFIRMATION',
  PAYMENT_CONFIRMED_FIN = 'PAYMENT_CONFIRMED_FIN',
  TICKET_CLOSED_FIN = 'TICKET_CLOSED_FIN',
  // Inter-Company Chargeback
  PENDING_FROM_ENTITY_APPROVAL = 'PENDING_FROM_ENTITY_APPROVAL',
  FROM_ENTITY_APPROVED = 'FROM_ENTITY_APPROVED',
  FROM_ENTITY_REJECTED = 'FROM_ENTITY_REJECTED',
  PENDING_TO_ENTITY_APPROVAL = 'PENDING_TO_ENTITY_APPROVAL',
  TO_ENTITY_APPROVED = 'TO_ENTITY_APPROVED',
  TO_ENTITY_REJECTED = 'TO_ENTITY_REJECTED',
  CHARGEBACK_FINANCE_REVIEW = 'CHARGEBACK_FINANCE_REVIEW',
  AWAITING_CHARGEBACK_CONFIRMATION = 'AWAITING_CHARGEBACK_CONFIRMATION',
  CHARGEBACK_COMPLETED = 'CHARGEBACK_COMPLETED',
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
  // Ticket linking (parent/child for onboarding workflow)
  parentRequestId?: string;
  parentRequest?: { id: string; referenceNumber: string; summary: string; status: RequestStatus };
  childRequests?: { id: string; referenceNumber: string; summary: string; status: RequestStatus }[];
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

// Onboarding Types
export interface OnboardingTask {
  id: string;
  onboardingId: string;
  taskName: string;
  taskDescription?: string;
  taskCategory: 'IT' | 'HR' | 'TRAINING' | 'ADMIN';
  assignedTo?: string;
  assignedToUser?: UserInfo;
  dueDate?: string;
  priority: RequestPriority;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
  completedBy?: string;
  completedByUser?: UserInfo;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface OnboardingTaskTemplate {
  id: string;
  taskName: string;
  taskDescription?: string;
  taskCategory: 'IT' | 'HR' | 'TRAINING' | 'ADMIN';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDayOffset: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingRequest {
  id: string;
  requestId: string;
  newHireFirstName: string;
  newHireLastName: string;
  newHireEmail: string;
  newHirePhone?: string;
  newHireId?: string;
  jobTitle: string;
  department: string;
  hiringManagerId: string;
  startDate: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  overallStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  currentPhase: 'PRE_ARRIVAL' | 'DAY_1' | 'WEEK_1' | 'MONTH_1' | 'MONTH_2' | 'MONTH_3' | 'COMPLETED';
  // IT Setup
  accountCreated: boolean;
  emailSetup: boolean;
  hardwareAssigned: boolean;
  badgeReady: boolean;
  // HR Documentation
  i9Completed: boolean;
  w4Completed: boolean;
  benefitsEnrolled: boolean;
  policiesAcknowledged: boolean;
  // Training
  orientationCompleted: boolean;
  trainingScheduled: boolean;
  buddyAssigned?: string;
  // Milestones
  day1Completed?: string;
  week1Completed?: string;
  day30Completed?: string;
  day60Completed?: string;
  day90Completed?: string;
  completedBy?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Relations
  request?: RequestItem;
  hiringManager?: UserInfo;
  newHire?: UserInfo;
  buddy?: UserInfo;
  tasks?: OnboardingTask[];
}

export interface OnboardingProgress {
  overallStatus: string;
  currentPhase: string;
  completionPercentage: number;
  tasks: {
    total: number;
    completed: number;
    pending: number;
  };
  milestones: {
    day1: boolean;
    week1: boolean;
    day30: boolean;
    day60: boolean;
    day90: boolean;
  };
  completedMilestones: number;
  totalMilestones: number;
}

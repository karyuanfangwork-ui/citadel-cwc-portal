export type RequestRole = 'agent' | 'hiring_manager' | 'ceo' | 'staff';

interface RoleDetectionParams {
  userRoles: string[];
  userId: string;
  requesterId: string;
  requestStatus: string;
  serviceDeskCode: string;
}

const HIRING_STATUSES = [
  'PENDING_CEO_APPROVAL', 'CEO_APPROVED', 'CEO_REJECTED',
  'JOB_POSTED', 'PENDING_MANAGER_REVIEW', 'MANAGER_APPROVED',
  'INTERVIEW_SCHEDULED', 'INTERVIEW_FEEDBACK_PENDING', 'CANDIDATE_REJECTED_INTERVIEW',
  'HR_SCREENING', 'LOA_PENDING_APPROVAL', 'LOA_APPROVED', 'LOA_ISSUED', 'LOA_ACCEPTED',
  'COMPLETED', 'ONBOARDING_SUBMITTED', 'ONBOARDING_PENDING_HR_APPROVAL',
  'ONBOARDING_PRE_ARRIVAL_SETUP', 'ONBOARDING_READY_FOR_DAY_1',
  'ONBOARDING_DAY_1_ORIENTATION', 'ONBOARDING_WEEK_1_INTEGRATION',
  'ONBOARDING_MONTH_1_MILESTONE', 'ONBOARDING_MONTH_2_MILESTONE',
  'ONBOARDING_MONTH_3_MILESTONE', 'ONBOARDING_COMPLETED'
];

export function isHiringRequest(serviceDeskCode: string, status: string): boolean {
  return serviceDeskCode === 'HR' && HIRING_STATUSES.includes(status);
}

export function detectRequestRole(params: RoleDetectionParams): RequestRole {
  const { userRoles, userId, requesterId, requestStatus, serviceDeskCode } = params;

  if (userRoles.includes('AGENT') || userRoles.includes('ADMIN')) {
    return 'agent';
  }

  if (userRoles.includes('CEO') && requestStatus === 'PENDING_CEO_APPROVAL') {
    return 'ceo';
  }

  if (userId === requesterId && isHiringRequest(serviceDeskCode, requestStatus)) {
    return 'hiring_manager';
  }

  return 'staff';
}

export { HIRING_STATUSES };

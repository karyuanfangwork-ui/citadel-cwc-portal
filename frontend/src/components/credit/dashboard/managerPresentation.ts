import type { PipelineStateCount as CreditPipelineStateCount } from '../../../services/credit.service';

export type PipelineStateCount = Omit<CreditPipelineStateCount, 'avgDaysInState'> & {
  avgDaysInState?: number | null;
};

export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  avgDaysInState?: number;
}

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  KYC_REVIEW: 'Verification review',
  COMPLIANCE_HOLD: 'Compliance hold',
  UNDERWRITING: 'Underwriting',
  CREDIT_ASSESSMENT: 'Credit assessment',
  COMMITTEE_REVIEW: 'Committee review',
  APPROVED: 'Approved',
  OFFER: 'Offer',
  ACCEPTED: 'Accepted',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  KYC_APPROVED: 'KYC approved',
  REFERRED_BACK: 'Returned for updates',
};

const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  submit: 'Submitted application',
  withdraw: 'Withdrew application',
  start_kyc: 'Started KYC review',
  place_compliance_hold: 'Placed compliance hold',
  approve_kyc: 'Approved KYC',
  reject_kyc: 'Rejected KYC',
  clear_compliance_hold: 'Cleared compliance hold',
  reject_compliance: 'Rejected compliance review',
  start_underwriting: 'Started underwriting',
  resubmit: 'Resubmitted application',
  start_assessment: 'Started credit assessment',
  submit_to_committee: 'Submitted to committee',
  approve: 'Approved application',
  reject: 'Rejected application',
  start_condition_fulfilment: 'Started condition fulfilment',
  make_offer: 'Made offer',
  make_offer_direct: 'Made direct offer',
  accept_offer: 'Accepted offer',
  decline_offer: 'Declined offer',
  disburse: 'Disbursed application',
  activate: 'Activated application',
  close: 'Closed application',
  refer_back: 'Returned for updates',
  resume_kyc: 'Resumed KYC review',
  resume_underwriting: 'Resumed underwriting',
  resume_assessment: 'Resumed credit assessment',
  resume_committee: 'Resumed committee review',
};

const MANAGER_STAGES = [
  { key: 'intake', label: 'Intake', states: ['DRAFT', 'SUBMITTED'] },
  { key: 'verification', label: 'Verification', states: ['KYC_REVIEW', 'KYC_APPROVED', 'COMPLIANCE_HOLD'] },
  { key: 'assessment', label: 'Assessment', states: ['UNDERWRITING', 'CREDIT_ASSESSMENT', 'COMMITTEE_REVIEW'] },
  { key: 'decision', label: 'Decision', states: ['APPROVED', 'OFFER', 'ACCEPTED', 'REFERRED_BACK', 'REJECTED', 'WITHDRAWN'] },
  { key: 'portfolio', label: 'Portfolio', states: ['DISBURSED', 'ACTIVE', 'CLOSED'] },
] as const;

export function formatPipelineState(state: string): string {
  return STATE_LABELS[state] ?? state
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function formatActivityAction(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, character => character.toUpperCase());
}

export function buildPipelineStages(states: PipelineStateCount[]): PipelineStage[] {
  const stages = MANAGER_STAGES.map(stage => {
    const matchingStates = states.filter(state => stage.states.includes(state.state as never));
    const count = matchingStates.reduce((sum, state) => sum + state.count, 0);
    const agedStates = matchingStates.filter(state => typeof state.avgDaysInState === 'number');
    const agedCount = agedStates.reduce((sum, state) => sum + state.count, 0);
    const stageResult: PipelineStage = { key: stage.key, label: stage.label, count };

    if (agedCount > 0) {
      stageResult.avgDaysInState = agedStates.reduce(
        (sum, state) => sum + state.count * (state.avgDaysInState as number),
        0,
      ) / agedCount;
    }

    return stageResult;
  });

  const knownStates = new Set(MANAGER_STAGES.flatMap(stage => stage.states));
  const otherStates = states.filter(state => !knownStates.has(state.state));

  if (otherStates.length > 0) {
    const count = otherStates.reduce((sum, state) => sum + state.count, 0);
    const agedStates = otherStates.filter(state => typeof state.avgDaysInState === 'number');
    const agedCount = agedStates.reduce((sum, state) => sum + state.count, 0);
    const other: PipelineStage = { key: 'other', label: 'Other', count };

    if (agedCount > 0) {
      other.avgDaysInState = agedStates.reduce(
        (sum, state) => sum + state.count * (state.avgDaysInState as number),
        0,
      ) / agedCount;
    }

    stages.push(other);
  }

  return stages;
}

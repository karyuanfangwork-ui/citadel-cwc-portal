import { describe, expect, it } from 'vitest';
import { getWorkflowActions } from '../workflowActions';

const actions = (status: string, selected = false) => getWorkflowActions(
  status, ['AGENT'], true, false, 'New Hiring', false, 'HR', true,
  'NEW_HIRING', false, false, false, false, false, '', '', 'HR', '', selected,
).map(action => action.type);

describe('NEW_HIRING executive routing', () => {
  it('does not offer routing without the requester selection', () => {
    expect(actions('SUBMITTED')).not.toContain('ROUTE_TO_CEO_HR');
  });

  it('offers one route and posting after either executive approval', () => {
    expect(actions('SUBMITTED', true)).toContain('ROUTE_TO_CEO_HR');
    expect(actions('CEO_APPROVED', true)).toContain('MARK_JOB_POSTED');
    expect(actions('CEO_APPROVED', true)).not.toContain('ROUTE_TO_GROUP_DCEO_HR');
    expect(actions('GROUP_DCEO_APPROVED', true)).toContain('MARK_JOB_POSTED');
  });

  it('offers the manager decision only to the HIRING_MANAGER requester while review is pending', () => {
    const managerActions = getWorkflowActions(
      'PENDING_MANAGER_REVIEW', ['NORMAL_STAFF', 'HIRING_MANAGER'], false, false,
      'New Hiring Request', true, 'HR', true, 'NEW_HIRING',
    ).map(action => action.type);
    const ordinaryRequesterActions = getWorkflowActions(
      'PENDING_MANAGER_REVIEW', ['NORMAL_STAFF'], false, false,
      'New Hiring Request', true, 'HR', true, 'NEW_HIRING',
    ).map(action => action.type);

    expect(managerActions).toContain('MANAGER_DECISION');
    expect(ordinaryRequesterActions).not.toContain('MANAGER_DECISION');
  });

  it('offers interview feedback only to the HIRING_MANAGER requester for a scheduled HR interview', () => {
    const managerActions = getWorkflowActions(
      'INTERVIEW_SCHEDULED', ['NORMAL_STAFF', 'HIRING_MANAGER'], false, false,
      'New Hiring Request', true, 'HR', true, 'NEW_HIRING',
    ).map(action => action.type);
    const ordinaryRequesterActions = getWorkflowActions(
      'INTERVIEW_SCHEDULED', ['NORMAL_STAFF'], false, false,
      'New Hiring Request', true, 'HR', true, 'NEW_HIRING',
    ).map(action => action.type);
    const hrAgentActions = getWorkflowActions(
      'INTERVIEW_SCHEDULED', ['AGENT'], true, false,
      'New Hiring Request', false, 'HR', true, 'NEW_HIRING',
    ).map(action => action.type);

    expect(managerActions).toContain('SUBMIT_INTERVIEW_FEEDBACK');
    expect(ordinaryRequesterActions).not.toContain('SUBMIT_INTERVIEW_FEEDBACK');
    expect(hrAgentActions).not.toContain('SUBMIT_INTERVIEW_FEEDBACK');
  });

  it('offers LOA approval only to the HIRING_MANAGER requester when an LOA exists', () => {
    const managerActions = getWorkflowActions(
      'LOA_PENDING_APPROVAL', ['NORMAL_STAFF', 'HIRING_MANAGER'], false, false,
      'New Hiring Request', true, 'HR', true, 'NEW_HIRING', false, false, false, true,
    ).map(action => action.type);
    const ordinaryRequesterActions = getWorkflowActions(
      'LOA_PENDING_APPROVAL', ['NORMAL_STAFF'], false, false,
      'New Hiring Request', true, 'HR', true, 'NEW_HIRING', false, false, false, true,
    ).map(action => action.type);

    expect(managerActions).toContain('LOA_APPROVAL');
    expect(ordinaryRequesterActions).not.toContain('LOA_APPROVAL');
  });
});

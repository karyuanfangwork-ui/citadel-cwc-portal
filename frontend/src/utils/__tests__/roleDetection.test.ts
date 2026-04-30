import { describe, it, expect } from 'vitest';
import { isHiringRequest, detectRequestRole, HIRING_STATUSES } from '../roleDetection';
import type { RequestRole } from '../roleDetection';

describe('isHiringRequest', () => {
  it('returns true when serviceDeskCode is HR and status is a hiring status', () => {
    expect(isHiringRequest('HR', 'SUBMITTED')).toBe(true);
    expect(isHiringRequest('HR', 'PENDING_CEO_APPROVAL')).toBe(true);
    expect(isHiringRequest('HR', 'CEO_APPROVED')).toBe(true);
    expect(isHiringRequest('HR', 'ONBOARDING_COMPLETED')).toBe(true);
  });

  it('returns false when serviceDeskCode is not HR', () => {
    expect(isHiringRequest('IT', 'SUBMITTED')).toBe(false);
    expect(isHiringRequest('FINANCE', 'PENDING_CEO_APPROVAL')).toBe(false);
    expect(isHiringRequest('', 'SUBMITTED')).toBe(false);
  });

  it('returns false when status is not a hiring status', () => {
    expect(isHiringRequest('HR', 'RANDOM_STATUS')).toBe(false);
    expect(isHiringRequest('HR', 'PENDING_CTO_APPROVAL_IT')).toBe(false);
    expect(isHiringRequest('HR', '')).toBe(false);
  });

  it('returns false when both serviceDeskCode is not HR and status is not a hiring status', () => {
    expect(isHiringRequest('IT', 'RANDOM_STATUS')).toBe(false);
  });

  it('covers all HIRING_STATUSES as valid when code is HR', () => {
    for (const status of HIRING_STATUSES) {
      expect(isHiringRequest('HR', status)).toBe(true);
    }
  });
});

describe('detectRequestRole', () => {
  const baseParams = {
    userRoles: ['STAFF'],
    userId: 'user-1',
    requesterId: 'requester-1',
    requestStatus: 'SUBMITTED',
    serviceDeskCode: 'HR',
  };

  describe('agent role', () => {
    it('returns "agent" when userRoles includes AGENT', () => {
      expect(detectRequestRole({ ...baseParams, userRoles: ['AGENT'] })).toBe('agent');
    });

    it('returns "agent" when userRoles includes ADMIN', () => {
      expect(detectRequestRole({ ...baseParams, userRoles: ['ADMIN'] })).toBe('agent');
    });

    it('returns "agent" when userRoles includes both AGENT and ADMIN', () => {
      expect(detectRequestRole({ ...baseParams, userRoles: ['AGENT', 'ADMIN'] })).toBe('agent');
    });

    it('AGENT takes precedence over other roles', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['AGENT', 'CEO', 'CTO', 'CFO', 'HIRING_MANAGER'],
          requestStatus: 'PENDING_CEO_APPROVAL',
        })
      ).toBe('agent');
    });
  });

  describe('ceo role', () => {
    it('returns "ceo" when userRoles includes CEO and requestStatus is PENDING_CEO_APPROVAL', () => {
      expect(
        detectRequestRole({ ...baseParams, userRoles: ['CEO'], requestStatus: 'PENDING_CEO_APPROVAL' })
      ).toBe('ceo');
    });

    it('returns "ceo" when userRoles includes CEO and requestStatus is PENDING_CEO_APPROVAL_IT', () => {
      expect(
        detectRequestRole({ ...baseParams, userRoles: ['CEO'], requestStatus: 'PENDING_CEO_APPROVAL_IT' })
      ).toBe('ceo');
    });

    it('returns "staff" when userRoles includes CEO but requestStatus does not match', () => {
      expect(
        detectRequestRole({ ...baseParams, userRoles: ['CEO'], requestStatus: 'SUBMITTED' })
      ).toBe('staff');
    });
  });

  describe('cto role', () => {
    it('returns "cto" when userRoles includes CTO and requestStatus is PENDING_CTO_APPROVAL_IT', () => {
      expect(
        detectRequestRole({ ...baseParams, userRoles: ['CTO'], requestStatus: 'PENDING_CTO_APPROVAL_IT' })
      ).toBe('cto');
    });

    it('returns "staff" when userRoles includes CTO but requestStatus does not match', () => {
      expect(
        detectRequestRole({ ...baseParams, userRoles: ['CTO'], requestStatus: 'SUBMITTED' })
      ).toBe('staff');
    });
  });

  describe('cfo role', () => {
    it('returns "cfo" when userRoles includes CFO and requestStatus is PENDING_CFO_APPROVAL_IT', () => {
      expect(
        detectRequestRole({ ...baseParams, userRoles: ['CFO'], requestStatus: 'PENDING_CFO_APPROVAL_IT' })
      ).toBe('cfo');
    });

    it('returns "staff" when userRoles includes CFO but requestStatus does not match', () => {
      expect(
        detectRequestRole({ ...baseParams, userRoles: ['CFO'], requestStatus: 'SUBMITTED' })
      ).toBe('staff');
    });
  });

  describe('hiring_manager role', () => {
    it('returns "hiring_manager" when userRoles includes HIRING_MANAGER and it is a hiring request', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['HIRING_MANAGER'],
          requestStatus: 'SUBMITTED',
          serviceDeskCode: 'HR',
        })
      ).toBe('hiring_manager');
    });

    it('returns "hiring_manager" for ONBOARDING_COMPLETED status in HR service desk', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['HIRING_MANAGER'],
          requestStatus: 'ONBOARDING_COMPLETED',
          serviceDeskCode: 'HR',
        })
      ).toBe('hiring_manager');
    });

    it('returns "staff" when userRoles includes HIRING_MANAGER but serviceDeskCode is not HR', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['HIRING_MANAGER'],
          requestStatus: 'SUBMITTED',
          serviceDeskCode: 'IT',
        })
      ).toBe('staff');
    });

    it('returns "staff" when userRoles includes HIRING_MANAGER but status is not a hiring status', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['HIRING_MANAGER'],
          requestStatus: 'PENDING_CTO_APPROVAL_IT',
          serviceDeskCode: 'HR',
        })
      ).toBe('staff');
    });
  });

  describe('staff role (default)', () => {
    it('returns "staff" when no special role matches', () => {
      expect(detectRequestRole({ ...baseParams, userRoles: ['STAFF'] })).toBe('staff');
    });

    it('returns "staff" for empty userRoles', () => {
      expect(detectRequestRole({ ...baseParams, userRoles: [] })).toBe('staff');
    });

    it('returns "staff" for unrecognized roles', () => {
      expect(detectRequestRole({ ...baseParams, userRoles: ['INTERN'] })).toBe('staff');
    });
  });

  describe('role precedence', () => {
    it('AGENT/ADMIN takes precedence over CEO', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['AGENT', 'CEO'],
          requestStatus: 'PENDING_CEO_APPROVAL',
        })
      ).toBe('agent');
    });

    it('CEO takes precedence over CTO', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['CEO', 'CTO'],
          requestStatus: 'PENDING_CEO_APPROVAL',
        })
      ).toBe('ceo');
    });

    it('CTO takes precedence over CFO', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['CTO', 'CFO'],
          requestStatus: 'PENDING_CTO_APPROVAL_IT',
        })
      ).toBe('cto');
    });

    it('CFO takes precedence over HIRING_MANAGER', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['CFO', 'HIRING_MANAGER'],
          requestStatus: 'PENDING_CFO_APPROVAL_IT',
          serviceDeskCode: 'HR',
        })
      ).toBe('cfo');
    });

    it('HIRING_MANAGER takes precedence over default staff', () => {
      expect(
        detectRequestRole({
          ...baseParams,
          userRoles: ['HIRING_MANAGER', 'STAFF'],
          requestStatus: 'SUBMITTED',
          serviceDeskCode: 'HR',
        })
      ).toBe('hiring_manager');
    });
  });
});
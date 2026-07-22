import { describe, it, expect } from 'vitest';
import { isValidTransition, getValidNextStatuses } from '../workflowTransitions';

describe('workflowTransitions', () => {
  describe('isValidTransition', () => {
    it('returns true for valid transition SUBMITTED -> IN_REVIEW', () => {
      expect(isValidTransition('SUBMITTED', 'IN_REVIEW')).toBe(true);
    });

    it('returns true for valid transition PENDING_CEO_APPROVAL -> CEO_APPROVED', () => {
      expect(isValidTransition('PENDING_CEO_APPROVAL', 'CEO_APPROVED')).toBe(true);
    });

    it('returns true for valid transition COMPLETED -> ONBOARDING_SUBMITTED', () => {
      expect(isValidTransition('COMPLETED', 'ONBOARDING_SUBMITTED')).toBe(true);
    });

    it('returns false for invalid transition RESOLVED -> SUBMITTED', () => {
      expect(isValidTransition('RESOLVED', 'SUBMITTED')).toBe(false);
    });

    it('returns false for invalid transition REJECTED -> IN_PROGRESS', () => {
      expect(isValidTransition('REJECTED', 'IN_PROGRESS')).toBe(false);
    });

    it('returns false for unknown source status', () => {
      expect(isValidTransition('NONEXISTENT_STATUS', 'SUBMITTED')).toBe(false);
    });

    it('returns false when target is not in the valid transitions list', () => {
      expect(isValidTransition('SUBMITTED', 'CEO_APPROVED')).toBe(false);
    });

    it('returns true for additional valid transitions', () => {
      expect(isValidTransition('IN_REVIEW', 'RESOLVED')).toBe(true);
      expect(isValidTransition('IN_PROGRESS', 'ACTION_REQUIRED')).toBe(true);
      expect(isValidTransition('LOA_ACCEPTED', 'COMPLETED')).toBe(true);
    });
  });

  describe('getValidNextStatuses (terminal states return empty)', () => {
    // COMPLETED is NOT terminal — it leads to ONBOARDING_SUBMITTED
    const terminalStates = [
      'RESOLVED',
      'REJECTED',
      'OFFBOARDING_COMPLETED',
      'ONBOARDING_COMPLETED',
      'LOA_REJECTED',
    ];

    it.each(terminalStates)('returns empty array for terminal state %s', (status) => {
      expect(getValidNextStatuses(status)).toEqual([]);
    });

    it('returns non-empty array for non-terminal state', () => {
      const transitions = getValidNextStatuses('SUBMITTED');
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions).toContain('IN_REVIEW');
    });

    it('COMPLETED is NOT terminal — it leads to ONBOARDING_SUBMITTED', () => {
      const transitions = getValidNextStatuses('COMPLETED');
      expect(transitions).toEqual(['ONBOARDING_SUBMITTED']);
    });

    it('returns empty array for unknown status', () => {
      expect(getValidNextStatuses('NONEXISTENT_STATUS')).toEqual([]);
    });

    it('returns the correct transitions for IN_REVIEW', () => {
      expect(getValidNextStatuses('IN_REVIEW')).toEqual([
        'IN_PROGRESS',
        'ACTION_REQUIRED',
        'WAITING',
        'REJECTED',
        'CANCELLED',
        'RESOLVED',
        'PENDING_CEO_APPROVAL',
        'PENDING_GROUP_DCEO_APPROVAL',
      ]);
    });
  });
});
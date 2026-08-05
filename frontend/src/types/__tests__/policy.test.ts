import { describe, it, expect } from 'vitest';
import {
  isAllowed,
  isAllowedWithScope,
  type PolicyDecision,
} from '../policy';

describe('policy types and helpers', () => {
  const basePolicy: PolicyDecision = {
    permissions: ['request:create', 'request:read', 'request:approve'],
    departments: [
      { id: 'dept-it', code: 'IT', name: 'IT Department' },
      { id: 'dept-hr', code: 'HR', name: 'Human Resources' },
    ],
    allowedActions: [
      { resource: 'request', action: 'create', scope: 'own' },
      { resource: 'request', action: 'read', scope: 'own' },
      { resource: 'request', action: 'approve', scope: 'department' },
      { resource: 'report', action: 'read', scope: 'tenant' },
    ],
  };

  describe('isAllowed', () => {
    it('returns true when action exists in policy', () => {
      expect(isAllowed(basePolicy, 'request', 'create')).toBe(true);
      expect(isAllowed(basePolicy, 'request', 'approve')).toBe(true);
      expect(isAllowed(basePolicy, 'report', 'read')).toBe(true);
    });

    it('returns false when action is not in policy', () => {
      expect(isAllowed(basePolicy, 'request', 'delete')).toBe(false);
      expect(isAllowed(basePolicy, 'asset', 'manage')).toBe(false);
    });

    it('returns false for null policy', () => {
      expect(isAllowed(null, 'request', 'create')).toBe(false);
    });
  });

  describe('isAllowedWithScope', () => {
    it('returns true when action exists with sufficient scope', () => {
      expect(isAllowedWithScope(basePolicy, 'request', 'approve', 'department')).toBe(true);
      expect(isAllowedWithScope(basePolicy, 'report', 'read', 'tenant')).toBe(true);
    });

    it('returns true when action has higher scope than minimum', () => {
      // 'tenant' scope satisfies 'department' minimum
      expect(isAllowedWithScope(basePolicy, 'report', 'read', 'department')).toBe(true);
    });

    it('returns false when action scope is below minimum', () => {
      // 'own' scope does not satisfy 'department' minimum
      expect(isAllowedWithScope(basePolicy, 'request', 'create', 'department')).toBe(false);
    });

    it('returns false for null policy', () => {
      expect(isAllowedWithScope(null, 'request', 'approve', 'own')).toBe(false);
    });
  });
});
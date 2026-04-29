import { describe, it, expect } from 'vitest';
import {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
} from '../permissions';

// Minimal User shape matching the interface from AuthContext
type User = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles?: string[];
    permissions?: string[];
    agentTeam?: string | null;
};

const makeUser = (overrides: Partial<Pick<User, 'roles' | 'permissions'>> = {}): User => ({
    id: 'u1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
});

const adminUser: User = makeUser({ roles: ['ADMIN'] });
const editorUser: User = makeUser({ roles: ['EDITOR'], permissions: ['kb:manage', 'report:read'] });
const viewerUser: User = makeUser({ roles: ['VIEWER'], permissions: ['report:read'] });
const noPermsUser: User = makeUser({ roles: ['VIEWER'] });

// ---------------------------------------------------------------------------
// hasPermission
// ---------------------------------------------------------------------------
describe('hasPermission', () => {
    it('returns false for null user', () => {
        expect(hasPermission(null, 'kb:manage')).toBe(false);
    });

    it('returns true for ADMIN user regardless of permission', () => {
        expect(hasPermission(adminUser, 'kb:manage')).toBe(true);
        expect(hasPermission({ ...adminUser, permissions: [] }, 'anything')).toBe(true);
    });

    it('returns true when user has the exact permission', () => {
        expect(hasPermission(editorUser, 'kb:manage')).toBe(true);
        expect(hasPermission(viewerUser, 'report:read')).toBe(true);
    });

    it('returns false when user lacks the permission', () => {
        expect(hasPermission(viewerUser, 'kb:manage')).toBe(false);
        expect(hasPermission(noPermsUser, 'report:read')).toBe(false);
    });

    it('returns false when permissions array is undefined', () => {
        const user = makeUser({ roles: ['VIEWER'] });
        expect(hasPermission(user, 'kb:manage')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// hasAnyPermission
// ---------------------------------------------------------------------------
describe('hasAnyPermission', () => {
    it('returns false for null user', () => {
        expect(hasAnyPermission(null, ['kb:manage'])).toBe(false);
    });

    it('returns true for ADMIN user regardless of permissions list', () => {
        expect(hasAnyPermission(adminUser, ['nonexistent'])).toBe(true);
    });

    it('returns true when user has at least one matching permission (OR)', () => {
        expect(hasAnyPermission(editorUser, ['kb:manage', 'admin:delete'])).toBe(true);
        expect(hasAnyPermission(viewerUser, ['admin:delete', 'report:read'])).toBe(true);
    });

    it('returns false when user has none of the listed permissions', () => {
        expect(hasAnyPermission(viewerUser, ['kb:manage', 'admin:delete'])).toBe(false);
    });

    it('returns false for empty permissions list', () => {
        expect(hasAnyPermission(editorUser, [])).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// hasAllPermissions
// ---------------------------------------------------------------------------
describe('hasAllPermissions', () => {
    it('returns false for null user', () => {
        expect(hasAllPermissions(null, ['kb:manage'])).toBe(false);
    });

    it('returns true for ADMIN user regardless of permissions list', () => {
        expect(hasAllPermissions(adminUser, ['nonexistent'])).toBe(true);
    });

    it('returns true when user has all specified permissions (AND)', () => {
        expect(hasAllPermissions(editorUser, ['kb:manage', 'report:read'])).toBe(true);
    });

    it('returns false when user is missing at least one permission', () => {
        expect(hasAllPermissions(viewerUser, ['kb:manage', 'report:read'])).toBe(false);
        expect(hasAllPermissions(editorUser, ['kb:manage', 'admin:delete'])).toBe(false);
    });

    it('returns true for empty permissions list (vacuous truth)', () => {
        expect(hasAllPermissions(editorUser, [])).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// hasRole
// ---------------------------------------------------------------------------
describe('hasRole', () => {
    it('returns false for null user', () => {
        expect(hasRole(null, 'ADMIN')).toBe(false);
    });

    it('returns true when user has the exact role', () => {
        expect(hasRole(adminUser, 'ADMIN')).toBe(true);
        expect(hasRole(editorUser, 'EDITOR')).toBe(true);
    });

    it('returns false when user does not have the role', () => {
        expect(hasRole(viewerUser, 'ADMIN')).toBe(false);
    });

    it('returns false when roles array is undefined', () => {
        const user = makeUser({});
        expect(hasRole(user, 'ADMIN')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// hasAnyRole
// ---------------------------------------------------------------------------
describe('hasAnyRole', () => {
    it('returns false for null user', () => {
        expect(hasAnyRole(null, ['ADMIN'])).toBe(false);
    });

    it('returns true when user has at least one of the roles (OR)', () => {
        expect(hasAnyRole(editorUser, ['ADMIN', 'EDITOR'])).toBe(true);
        expect(hasAnyRole(viewerUser, ['ADMIN', 'VIEWER'])).toBe(true);
    });

    it('returns false when user has none of the roles', () => {
        expect(hasAnyRole(viewerUser, ['ADMIN', 'EDITOR'])).toBe(false);
    });

    it('returns false when roles array is undefined', () => {
        const user = makeUser({});
        expect(hasAnyRole(user, ['ADMIN'])).toBe(false);
    });
});
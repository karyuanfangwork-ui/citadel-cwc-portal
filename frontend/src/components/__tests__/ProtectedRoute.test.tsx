import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

// Helper to wrap component in router
const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner when auth is loading', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null, loading: true });
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, user: null, loading: false });
    const { container } = renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    // Navigate renders a redirect, children should NOT appear
    expect(container.textContent).not.toContain('Protected Content');
  });

  it('renders children when authenticated (no permission required)', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['NORMAL_STAFF'], permissions: [] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Protected Content')).toBeTruthy();
  });

  it('redirects to / when requireAdmin=true and user lacks admin:access', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['NORMAL_STAFF'], permissions: ['some:other'] },
      loading: false,
    });
    const { container } = renderWithRouter(
      <ProtectedRoute requireAdmin={true}>
        <div>Admin Content</div>
      </ProtectedRoute>
    );
    expect(container.textContent).not.toContain('Admin Content');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('renders children when requireAdmin=true and user has admin:access permission', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['ADMIN'], permissions: ['admin:access'] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requireAdmin={true}>
        <div>Admin Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Admin Content')).toBeTruthy();
  });

  it('redirects when requirePermission (string) is not met', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['NORMAL_STAFF'], permissions: [] },
      loading: false,
    });
    const { container } = renderWithRouter(
      <ProtectedRoute requirePermission="report:read">
        <div>Report Content</div>
      </ProtectedRoute>
    );
    expect(container.textContent).not.toContain('Report Content');
    warnSpy.mockRestore();
  });

  it('renders children when requirePermission (string) is met', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['NORMAL_STAFF'], permissions: ['report:read'] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requirePermission="report:read">
        <div>Report Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Report Content')).toBeTruthy();
  });

  it('renders children when any requirePermission (array) is met', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['NORMAL_STAFF'], permissions: ['request:assign'] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requirePermission={['admin:access', 'request:assign']}>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Protected Content')).toBeTruthy();
  });

  // ── Task 14: requireAllPermissions (AND logic) ──────────────────────

  it('renders children when ALL requireAllPermissions are met', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['AGENT'], permissions: ['request:approve', 'request:assign'] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requireAllPermissions={['request:approve', 'request:assign']}>
        <div>Approve & Assign</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Approve & Assign')).toBeTruthy();
  });

  it('redirects when some requireAllPermissions are missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['AGENT'], permissions: ['request:approve'] },
      loading: false,
    });
    const { container } = renderWithRouter(
      <ProtectedRoute requireAllPermissions={['request:approve', 'request:assign']}>
        <div>Approve & Assign</div>
      </ProtectedRoute>
    );
    expect(container.textContent).not.toContain('Approve & Assign');
    warnSpy.mockRestore();
  });

  // ── Task 14: requireDepartment ──────────────────────────────────────

  it('renders children when user is a member of the required department', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['AGENT'], permissions: [], departmentIds: ['dept-hr', 'dept-it'] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requireDepartment="dept-hr">
        <div>HR Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('HR Content')).toBeTruthy();
  });

  it('redirects when user is not a member of the required department', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['AGENT'], permissions: [], departmentIds: ['dept-it'] },
      loading: false,
    });
    const { container } = renderWithRouter(
      <ProtectedRoute requireDepartment="dept-hr">
        <div>HR Content</div>
      </ProtectedRoute>
    );
    expect(container.textContent).not.toContain('HR Content');
    warnSpy.mockRestore();
  });

  it('renders children when user matches any department in requireDepartment array', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['AGENT'], permissions: [], departmentIds: ['dept-finance'] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requireDepartment={['dept-hr', 'dept-finance']}>
        <div>Finance Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Finance Content')).toBeTruthy();
  });

  it('redirects when user has no department memberships', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['NORMAL_STAFF'], permissions: [], departmentIds: [] },
      loading: false,
    });
    const { container } = renderWithRouter(
      <ProtectedRoute requireDepartment="dept-hr">
        <div>HR Content</div>
      </ProtectedRoute>
    );
    expect(container.textContent).not.toContain('HR Content');
    warnSpy.mockRestore();
  });

  // ── Task 14: No ADMIN bypass — ADMIN must have explicit permissions ──

  it('denies access when ADMIN role lacks the required permission (no bypass)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['ADMIN'], permissions: [] },
      loading: false,
    });
    const { container } = renderWithRouter(
      <ProtectedRoute requirePermission="report:read">
        <div>Reports</div>
      </ProtectedRoute>
    );
    // ADMIN bypass removed: must have explicit permission
    expect(container.textContent).not.toContain('Reports');
    warnSpy.mockRestore();
  });

  it('grants access when ADMIN role has the required permission', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['ADMIN'], permissions: ['report:read'] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requirePermission="report:read">
        <div>Reports</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Reports')).toBeTruthy();
  });
});
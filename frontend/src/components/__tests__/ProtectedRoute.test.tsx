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
      user: { roles: ['USER'], permissions: [] },
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
      user: { roles: ['USER'], permissions: ['some:other'] },
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

  it('renders children when requireAdmin=true and user has ADMIN role', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: { roles: ['ADMIN'], permissions: [] },
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
      user: { roles: ['USER'], permissions: [] },
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
      user: { roles: ['USER'], permissions: ['report:read'] },
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
      user: { roles: ['USER'], permissions: ['request:assign'] },
      loading: false,
    });
    renderWithRouter(
      <ProtectedRoute requirePermission={['admin:access', 'request:assign']}>
        <div>Protected Content</div>
      </ProtectedRoute>
    );
    expect(screen.getByText('Protected Content')).toBeTruthy();
  });
});
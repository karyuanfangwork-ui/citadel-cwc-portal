import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserAccountsTab } from '../UserAccountsTab';

const baseProps = {
  users: [],
  usersLoading: false,
  userPagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  userSearch: '',
  userRoleFilter: '',
  userStatusFilter: '' as const,
  userStats: { total: 0, active: 0, disabled: 0, agents: 0 },
  availableRoles: [],
  entities: [],
  approverEntityMap: {},
  onSearch: vi.fn(),
  onRoleFilter: vi.fn(),
  onStatusFilter: vi.fn(),
  onFetchUsers: vi.fn(),
  onCreateUser: vi.fn(),
  onImportStaff: vi.fn(),
  onEditUser: vi.fn(),
  onManageRoles: vi.fn(),
  onResetPassword: vi.fn(),
  onAssignAgentTeam: vi.fn(),
  onToggleUserStatus: vi.fn(),
};

const agentUser = {
  id: 'u1',
  firstName: 'Nurul',
  lastName: 'Hidayah',
  email: 'nurul@company.com',
  isActive: true,
  agentTeam: 'IT Support',
  roles: [{ role: { name: 'AGENT' } }],
};

const adminUser = {
  id: 'u2',
  firstName: 'Ahmad',
  lastName: 'Razali',
  email: 'ahmad@company.com',
  isActive: true,
  agentTeam: null,
  roles: [{ role: { name: 'Admin' } }],
};

describe('UserAccountsTab', () => {
  it('does NOT render an "Agent Team" column header', () => {
    render(<UserAccountsTab {...baseProps} />);
    expect(screen.queryByText(/agent team/i)).toBeNull();
  });

  it('renders Import Staff button in the same row as Create User', () => {
    render(<UserAccountsTab {...baseProps} />);
    const importBtns = screen.getAllByRole('button', { name: /import staff/i });
    const createBtns = screen.getAllByRole('button', { name: /create user/i });
    // Both should be in the DOM (unified bar)
    expect(importBtns.length).toBeGreaterThanOrEqual(1);
    expect(createBtns.length).toBeGreaterThanOrEqual(1);
    // The first pair (header bar) must share the same parent container
    expect(importBtns[0].parentElement).toBe(createBtns[0].parentElement);
  });

  it('shows agent team badge inline under user name for AGENT users', () => {
    render(<UserAccountsTab {...baseProps} users={[agentUser]} />);
    expect(screen.getByText('IT Support')).toBeTruthy();
  });

  it('does NOT show agent team badge for non-agent users', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} />);
    // adminUser has no agentTeam and no AGENT role
    expect(screen.queryByText(/unassigned/i)).toBeNull();
  });

  it('renders Edit button per row', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} />);
    expect(screen.getByRole('button', { name: /edit ahmad razali/i })).toBeTruthy();
  });

  it('shows overflow menu when ··· button is clicked', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} />);
    const moreBtn = screen.getByRole('button', { name: /more actions for ahmad razali/i });
    fireEvent.click(moreBtn);
    expect(screen.getByText(/manage roles/i)).toBeTruthy();
    expect(screen.getByText(/reset password/i)).toBeTruthy();
  });

  it('closes overflow menu on outside click', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} />);
    const moreBtn = screen.getByRole('button', { name: /more actions for ahmad razali/i });
    fireEvent.click(moreBtn);
    expect(screen.getByText(/manage roles/i)).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/manage roles/i)).toBeNull();
  });

  it('shows "Assign Agent Team" in overflow menu only for AGENT users', () => {
    render(<UserAccountsTab {...baseProps} users={[agentUser, adminUser]} />);
    // Open agent user menu
    fireEvent.click(screen.getByRole('button', { name: /more actions for nurul hidayah/i }));
    expect(screen.getByText(/assign agent team/i)).toBeTruthy();
    // Close and open admin user menu
    fireEvent.mouseDown(document.body);
    fireEvent.click(screen.getByRole('button', { name: /more actions for ahmad razali/i }));
    expect(screen.queryByText(/assign agent team/i)).toBeNull();
  });

  it('calls onEditUser when Edit button is clicked', () => {
    const onEditUser = vi.fn();
    render(<UserAccountsTab {...baseProps} users={[adminUser]} onEditUser={onEditUser} />);
    fireEvent.click(screen.getByRole('button', { name: /edit ahmad razali/i }));
    expect(onEditUser).toHaveBeenCalledWith(adminUser);
  });

  it('calls onToggleUserStatus from overflow menu', () => {
    const onToggleUserStatus = vi.fn();
    render(<UserAccountsTab {...baseProps} users={[adminUser]} onToggleUserStatus={onToggleUserStatus} />);
    fireEvent.click(screen.getByRole('button', { name: /more actions for ahmad razali/i }));
    fireEvent.click(screen.getByText(/disable account/i));
    expect(onToggleUserStatus).toHaveBeenCalledWith(adminUser);
  });
});
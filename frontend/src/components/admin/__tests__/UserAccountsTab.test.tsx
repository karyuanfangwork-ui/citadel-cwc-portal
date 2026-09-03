import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces valid search input and invokes onSearch once after it settles', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<UserAccountsTab {...baseProps} onSearch={onSearch} />);
    const input = screen.getByRole('textbox', { name: /search user accounts/i });

    fireEvent.change(input, { target: { value: 'ah' } });
    expect(onSearch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(299));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('ah');
  });

  it('does not issue a remote search for a one-character query', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(<UserAccountsTab {...baseProps} onSearch={onSearch} />);
    fireEvent.change(screen.getByRole('textbox', { name: /search user accounts/i }), { target: { value: 'a' } });

    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByText(/enter at least 2 characters/i)).toBeTruthy();
  });

  it('keeps existing rows visible while a background refresh is active', () => {
    render(<UserAccountsTab {...baseProps} users={[adminUser]} usersLoading />);

    expect(screen.getByText('Ahmad Razali')).toBeTruthy();
    expect(screen.getByRole('status', { name: /refreshing users/i })).toBeTruthy();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the initial loading skeleton when no rows exist', () => {
    render(<UserAccountsTab {...baseProps} usersLoading />);

    expect(screen.getByRole('status', { name: /loading users/i })).toBeTruthy();
  });

  it('does not reissue a settled search when the parent rerenders', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    const { rerender } = render(<UserAccountsTab {...baseProps} onSearch={onSearch} />);
    const input = screen.getByRole('textbox', { name: /search user accounts/i });

    fireEvent.change(input, { target: { value: 'ah' } });
    act(() => vi.advanceTimersByTime(300));
    expect(onSearch).toHaveBeenCalledTimes(1);

    rerender(<UserAccountsTab {...baseProps} onSearch={onSearch} />);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

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

  it('renders last sign-in and active timestamps with tooltips', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00.000Z'));
    const user = {
      ...adminUser,
      lastLoginAt: '2026-09-02T09:00:00.000Z',
      lastActiveAt: '2026-09-02T11:00:00.000Z',
    };
    render(<UserAccountsTab {...baseProps} users={[user]} />);
    expect(screen.getByText('Last Sign-In')).toBeTruthy();
    expect(screen.getByText('3 hours ago')).toHaveAttribute('title');
    expect(screen.getByText('Active 1 hour ago')).toHaveAttribute('title');
  });

  it('renders Never without an active line for users with no sign-in history', () => {
    render(<UserAccountsTab {...baseProps} users={[{ ...adminUser, lastLoginAt: null, lastActiveAt: null }]} />);
    expect(screen.getByText('Never')).toBeTruthy();
    expect(screen.queryByText(/^Active /)).toBeNull();
  });
});
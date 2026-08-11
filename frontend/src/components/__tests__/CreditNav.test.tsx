import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CreditNav from '../CreditNav';

const mockUseAuth = vi.hoisted(() => vi.fn());
vi.mock('../../context/AuthContext', () => ({ useAuth: mockUseAuth }));

const renderNav = (path = '/credit') => render(
  <MemoryRouter initialEntries={[path]}>
    <CreditNav />
  </MemoryRouter>,
);

describe('CreditNav', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        email: 'officer@test.local',
        firstName: 'Credit',
        lastName: 'Officer',
        permissions: ['credit:read'],
      },
    });
  });

  it('marks the Credit route active with aria-current', () => {
    renderNav('/credit/borrowers');
    fireEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(screen.getByRole('menuitem', { name: /Borrowers/ })).toHaveAttribute('aria-current', 'page');
  });

  it('hides approval and administration destinations without their permissions', () => {
    renderNav();
    expect(screen.queryByRole('link', { name: /My Approvals/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Scorecards/ })).not.toBeInTheDocument();
  });

  it('exposes an accessible More menu control when items overflow', () => {
    renderNav();
    const more = screen.getByRole('button', { name: /More/ });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-expanded', 'false');
  });
});

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import CrmLayout from '../CrmLayout';

const mockUseAuth = vi.fn();

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const renderWithRouter = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<CrmLayout />}>
          <Route path="/crm" element={<div>Dashboard Page</div>} />
          <Route path="/crm/leads" element={<div>Leads Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe('CrmLayout', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        firstName: 'Ahmad',
        lastName: 'Razak',
        email: 'ahmad@test.local',
        roles: ['NORMAL_STAFF'],
        permissions: ['crm:read', 'crm:write'],
      },
    });
  });

  it('renders CRM brand label', () => {
    renderWithRouter('/crm');
    expect(screen.getAllByText('CRM').length).toBeGreaterThan(0);
  });

  it('renders Dashboard nav link as active on /crm', () => {
    renderWithRouter('/crm');
    const dashLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashLink.className).toContain('text-brand-700');
  });

  it('renders outlet content', () => {
    renderWithRouter('/crm');
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });
});

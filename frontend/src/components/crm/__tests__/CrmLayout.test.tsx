import { fireEvent, render, screen } from '@testing-library/react';
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
          <Route path="/crm/import-export" element={<div>Import Export Page</div>} />
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

  it('renders the CRM workspace shell with primary navigation only', () => {
    renderWithRouter('/crm/leads');
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /leads/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new lead/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('crm-content-shell')).toBeInTheDocument();
  });

  it('renders Dashboard nav link as active on /crm (teal active)', () => {
    renderWithRouter('/crm');
    const dashLink = screen.getByRole('link', { name: /dashboard/i });
    // Kinetic Enterprise: active tab uses teal (#006a61) color
    expect(dashLink.style.color).toBe('rgb(0, 106, 97)'); // #006a61
    expect(dashLink.style.borderBottomColor).toBe('rgb(0, 106, 97)');
  });

  it('shows the more menu for admin CRM routes', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        firstName: 'Ahmad',
        lastName: 'Razak',
        email: 'ahmad@test.local',
        roles: ['NORMAL_STAFF'],
        permissions: ['crm:read', 'crm:write', 'crm:admin'],
      },
    });

    renderWithRouter('/crm');
    const moreButton = screen.getByRole('button', { name: /more/i });
    fireEvent.click(moreButton);

    expect(moreButton).toBeInTheDocument();
    // Match "Import / Export" link — the slash may have spaces or not
    const importExportLink = screen.getAllByRole('link').find(
      (el) => /import.*export/i.test(el.textContent || '')
    );
    expect(importExportLink).toBeTruthy();
  });

  it('keeps the more trigger active (teal) for grouped crm routes', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        firstName: 'Ahmad',
        lastName: 'Razak',
        email: 'ahmad@test.local',
        roles: ['NORMAL_STAFF'],
        permissions: ['crm:read', 'crm:write', 'crm:admin'],
      },
    });

    renderWithRouter('/crm/import-export');
    const moreButton = screen.getByRole('button', { name: /more/i });
    // Kinetic Enterprise: active admin tab uses teal color
    expect(moreButton.style.color).toBe('rgb(0, 106, 97)'); // #006a61
  });

  it('uses a nav track that does not clip the more dropdown', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'u1',
        firstName: 'Ahmad',
        lastName: 'Razak',
        email: 'ahmad@test.local',
        roles: ['NORMAL_STAFF'],
        permissions: ['crm:read', 'crm:write', 'crm:admin'],
      },
    });

    renderWithRouter('/crm');
    expect(screen.getByTestId('crm-nav-track').className).not.toContain('overflow-x-auto');
  });

  it('renders outlet content', () => {
    renderWithRouter('/crm');
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('uses Kinetic Enterprise surface background on content shell', () => {
    renderWithRouter('/crm');
    const shell = screen.getByTestId('crm-content-shell');
    expect(shell.style.background).toBe('rgb(248, 249, 255)'); // #f8f9ff
  });

  it('renders inactive nav items with secondary text color', () => {
    renderWithRouter('/crm/leads');
    const dashLink = screen.getByRole('link', { name: /dashboard/i });
    // Dashboard is NOT active on /crm/leads
    expect(dashLink.style.color).toBe('rgb(100, 116, 139)'); // #64748b
  });
});
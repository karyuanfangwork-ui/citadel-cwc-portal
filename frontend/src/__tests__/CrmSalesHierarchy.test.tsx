import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import CrmSalesHierarchy from '../../pages/CrmSalesHierarchy';
import crmService from '../services/crm.service';

const mockUseAuth = vi.fn();

vi.mock('../context/AuthContext', () => ({ useAuth: () => mockUseAuth() }));
vi.mock('../services/crm.service', async () => {
  const actual = await vi.importActual<typeof import('../services/crm.service')>('../services/crm.service');
  return { ...actual, default: { getSalesHierarchy: vi.fn(), updateSalesRepManager: vi.fn() } };
});

const manager = {
  id: 'manager-1', firstName: 'Alice', lastName: 'Tan', email: 'alice@test.local', avatarUrl: null,
  jobTitle: 'Sales Manager', department: 'Sales', isActive: true, roles: ['SALES_MANAGER'], managerId: null,
  territories: [{ id: 'territory-1', name: 'Central' }], leadCount: 4, opportunityCount: 2,
};
const rep = {
  id: 'rep-1', firstName: 'Ben', lastName: 'Lee', email: 'ben@test.local', avatarUrl: null,
  jobTitle: 'Sales Rep', department: 'Sales', isActive: true, roles: ['SALES_REP'], managerId: 'manager-1',
  territories: [{ id: 'territory-1', name: 'Central' }], leadCount: 3, opportunityCount: 1,
};

const hierarchy = {
  managers: [{ ...manager, directReports: [rep], indirectReportCount: 0 }],
  unassignedReps: [{ ...rep, id: 'rep-2', firstName: 'Cindy', lastName: 'Wong', email: 'cindy@test.local', managerId: null }],
  invalidAssignments: [{ representative: { ...rep, id: 'rep-3', firstName: 'Daniel', lastName: 'Lim', email: 'daniel@test.local' }, managerId: 'missing', reason: 'MISSING_MANAGER', reasonLabel: 'Manager user was not found in this tenant' }],
  managerOptions: [manager],
  summary: { managerCount: 1, activeManagerCount: 1, inactiveManagerCount: 0, salesRepCount: 3, activeSalesRepCount: 3, inactiveSalesRepCount: 0, assignedRepCount: 1, unassignedRepCount: 1, invalidAssignmentCount: 1 },
};

describe('CrmSalesHierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { roles: ['ADMIN'], permissions: ['crm:admin'] } });
    vi.mocked(crmService.getSalesHierarchy).mockResolvedValue(hierarchy as any);
    vi.mocked(crmService.updateSalesRepManager).mockResolvedValue({ id: 'rep-1', managerId: null });
  });

  it('renders summary and explicit exception sections', async () => {
    render(<MemoryRouter><CrmSalesHierarchy /></MemoryRouter>);
    expect(await screen.findByText('Sales Hierarchy')).toBeInTheDocument();
    expect(screen.getByText('Unassigned sales representatives')).toBeInTheDocument();
    expect(screen.getByText('Invalid manager assignments')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('opens reassignment modal and refreshes after save', async () => {
    render(<MemoryRouter><CrmSalesHierarchy /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Change manager' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    await waitFor(() => expect(crmService.updateSalesRepManager).toHaveBeenCalledWith('rep-1', 'manager-1'));
    await waitFor(() => expect(crmService.getSalesHierarchy).toHaveBeenCalledTimes(2));
  });

  it('redirects users without crm admin permission before loading data', async () => {
    mockUseAuth.mockReturnValue({ user: { roles: ['SALES_MANAGER'], permissions: ['crm:read:team'] } });
    render(<MemoryRouter><CrmSalesHierarchy /></MemoryRouter>);
    expect(screen.queryByTestId('sales-hierarchy-page')).not.toBeInTheDocument();
    expect(crmService.getSalesHierarchy).not.toHaveBeenCalled();
  });

  it('renders an API failure as an alert instead of an empty hierarchy', async () => {
    vi.mocked(crmService.getSalesHierarchy).mockRejectedValueOnce(new Error('Hierarchy unavailable'));
    render(<MemoryRouter><CrmSalesHierarchy /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('Hierarchy unavailable');
    expect(screen.queryByText('No hierarchy entries match the current filters.')).not.toBeInTheDocument();
  });

  it('filters to invalid assignments and keeps the correction action available', async () => {
    render(<MemoryRouter><CrmSalesHierarchy /></MemoryRouter>);
    await screen.findByText('Invalid manager assignments');
    fireEvent.change(screen.getByRole('combobox', { name: 'Assignment filter' }), { target: { value: 'INVALID' } });
    expect(screen.getByText('Daniel Lim')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fix assignment' })).toBeInTheDocument();
    expect(screen.queryByText('Cindy Wong')).not.toBeInTheDocument();
  });

  it('shows a failed reassignment without closing the modal', async () => {
    vi.mocked(crmService.updateSalesRepManager).mockRejectedValueOnce(new Error('Assignment rejected'));
    render(<MemoryRouter><CrmSalesHierarchy /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Change manager' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Assignment rejected');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

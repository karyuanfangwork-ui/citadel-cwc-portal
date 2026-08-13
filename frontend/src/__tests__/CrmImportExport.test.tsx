import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmImportExport from '../../pages/CrmImportExport';

const mockGetFieldDefinitions = vi.fn();
const mockGetImportHistory = vi.fn();
const mockGetExportHistory = vi.fn();
const mockDownloadImportTemplate = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    getFieldDefinitions: (...args: unknown[]) => mockGetFieldDefinitions(...args),
    getImportHistory: (...args: unknown[]) => mockGetImportHistory(...args),
    getExportHistory: (...args: unknown[]) => mockGetExportHistory(...args),
    downloadImportTemplate: (...args: unknown[]) => mockDownloadImportTemplate(...args),
    uploadImportFile: vi.fn(),
    validateImportMapping: vi.fn(),
    executeImport: vi.fn(),
    requestExport: vi.fn(),
    getImportStatus: vi.fn(),
    downloadExport: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'admin@test.local',
      permissions: ['crm:read', 'crm:write', 'crm:admin', 'crm:import', 'crm:export'],
    },
  }),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <CrmImportExport />
    </MemoryRouter>
  );

describe('CrmImportExport', () => {
  beforeEach(() => {
    mockGetFieldDefinitions.mockResolvedValue({
      fields: [
        { key: 'title', label: 'Lead Name', required: true, type: 'string' },
        { key: 'email', label: 'Email', required: false, type: 'string' },
        { key: 'industry', label: 'Industry', required: false, type: 'string' },
        { key: 'address', label: 'Address', required: false, type: 'string' },
        { key: 'remark', label: 'Remark', required: false, type: 'string' },
      ],
    });
    mockGetImportHistory.mockResolvedValue({ jobs: [] });
    mockGetExportHistory.mockResolvedValue({ jobs: [] });
    mockDownloadImportTemplate.mockResolvedValue(undefined);
  });

  it('renders the kinetic import shell with stepper, entity tabs, and template actions', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /import \/ export/i })).toBeInTheDocument();
    expect(screen.getByText('Move data in and out of CWC CRM')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Select Entity & Upload File')).toBeInTheDocument();
    });

    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Map Columns')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Importing')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();

    // Entity labels use ENTITY_LABELS: Leads, Contacts, Clients, Opportunities
    expect(screen.getByRole('button', { name: /leads/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /contacts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clients/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /opportunities/i })).toBeInTheDocument();

    expect(screen.getByText(/column reference/i)).toBeInTheDocument();
    expect(screen.getByText('Industry')).toBeInTheDocument();
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByText('Remark')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /csv template/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /excel template/i })).toBeInTheDocument();
  });
});

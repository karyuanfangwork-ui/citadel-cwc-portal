import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CrmAccountDocuments from '../components/crm/CrmAccountDocuments';

const mockList = vi.fn();
const mockUpload = vi.fn();
const mockDownload = vi.fn();
const mockDelete = vi.fn();

vi.mock('../services/crm.service', () => ({
  default: {
    listAccountDocuments: (...args: unknown[]) => mockList(...args),
    uploadAccountDocuments: (...args: unknown[]) => mockUpload(...args),
    downloadAccountDocument: (...args: unknown[]) => mockDownload(...args),
    deleteAccountDocument: (...args: unknown[]) => mockDelete(...args),
  },
}));

const emptyResult = { documents: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
const existingDocument = { id: 'doc-1', accountId: 'account-1', fileName: 'statement.pdf', mimeType: 'application/pdf', fileSize: 1024, createdAt: '2026-11-01T00:00:00.000Z' };

describe('CrmAccountDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue(emptyResult);
    mockUpload.mockResolvedValue({ documents: [existingDocument] });
    mockDownload.mockResolvedValue(new Blob(['%PDF']));
    mockDelete.mockResolvedValue(undefined);
    vi.stubGlobal('confirm', vi.fn(() => true));
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('renders an empty, responsive client-document interface', async () => {
    render(<CrmAccountDocuments accountId="account-1" canWrite />);
    expect(await screen.findByText('No client documents uploaded yet.')).toBeInTheDocument();
    expect(screen.getByLabelText('Client documents').className).toContain('sm:p-5');
  });

  it('validates PDF type and size before upload', async () => {
    render(<CrmAccountDocuments accountId="account-1" canWrite />);
    const input = screen.getByLabelText('Select client PDF documents');
    fireEvent.change(input, { target: { files: [new File(['text'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Only PDF documents');

    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('10 MB');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('uploads selected PDFs and shows success', async () => {
    render(<CrmAccountDocuments accountId="account-1" canWrite />);
    const input = screen.getByLabelText('Select client PDF documents');
    fireEvent.change(input, { target: { files: [new File(['%PDF-1.7'], 'valid.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 PDF' }));
    await waitFor(() => expect(mockUpload).toHaveBeenCalledWith('account-1', expect.any(Array), expect.any(Function)));
    expect(await screen.findByRole('status')).toHaveTextContent('uploaded successfully');
  });

  it('shows upload failures without adding a document', async () => {
    mockUpload.mockRejectedValue({ response: { data: { message: 'Storage unavailable' } } });
    render(<CrmAccountDocuments accountId="account-1" canWrite />);
    fireEvent.change(screen.getByLabelText('Select client PDF documents'), { target: { files: [new File(['%PDF'], 'valid.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage unavailable');
  });

  it('downloads and confirms deletion of an existing document', async () => {
    mockList.mockResolvedValue({ documents: [existingDocument], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    render(<CrmAccountDocuments accountId="account-1" canWrite />);
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('account-1', 'doc-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('account-1', 'doc-1'));
    expect(window.confirm).toHaveBeenCalledWith('Delete statement.pdf?');
  });

  it('hides upload and delete controls without crm:write capability', async () => {
    mockList.mockResolvedValue({ documents: [existingDocument], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    render(<CrmAccountDocuments accountId="account-1" canWrite={false} />);
    await screen.findByText('statement.pdf');
    expect(screen.queryByRole('button', { name: 'Upload PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
  });
});
